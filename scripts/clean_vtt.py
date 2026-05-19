#!/usr/bin/env python3
"""
clean_vtt.py — Convert a YouTube auto-caption VTT file into clean MDX transcript entries.

YouTube auto-caption VTTs are "rolling" — each cue shows a 2-line window that
overlaps heavily with the previous cue. This script:
  1. Parses the VTT into (start_seconds, raw_text) cue pairs.
  2. Removes HTML tags for overlap detection, keeping all words intact.
  3. Finds how much of each cue's text was already in the previous cue.
  4. Extracts only the NEW words, then removes filler words from them.
  5. Applies spelling corrections.
  6. Groups cleaned fragments into transcript entries with:
       - At least MIN_GAP seconds between entries (default 10)
       - At most MAX_WORDS words per entry (default 50)
       - Splits only at sentence or natural boundaries

Usage:
    python scripts/clean_vtt.py <input.vtt> <mdx_file>
    python scripts/clean_vtt.py --dry-run <input.vtt>
"""

import re
import sys
import os

MIN_GAP = 10
MAX_WORDS = 50

# ---------------------------------------------------------------------------
# Spelling / recognition corrections
# ---------------------------------------------------------------------------
CORRECTIONS = [
    (re.compile(r'\bAgentyc\b'), 'Agentic'),
    (re.compile(r'\bagentyc\b'), 'agentic'),
    (re.compile(r'\bAentic\b'),  'Agentic'),
    (re.compile(r'\baentic\b'),  'agentic'),
    (re.compile(r'\bMatas\b'),   'Mathias'),
    (re.compile(r'\barting\b'),      'starting'),
    (re.compile(r'\badjunctive\b'),  'Agentic'),
    (re.compile(r'(?<!\w)nergy\b'),  'energy'),
    (re.compile(r'\bse\s+them\b'),   'use them'),
]

FILLER_RE = re.compile(
    r'\b(?:um+|uh+|hmm+|mhm+|mm+|ah+|er+|like|you\s+know|i\s+mean|'
    r'kind\s+of|sort\s+of|basically|literally|actually|right|okay|ok|'
    r'so|well|now)\b',
    re.IGNORECASE,
)


def apply_corrections(text: str) -> str:
    for pattern, replacement in CORRECTIONS:
        text = pattern.sub(replacement, text)
    return text


def strip_html_only(text: str) -> str:
    """Remove HTML tags but keep all words (for overlap detection)."""
    return re.sub(r'<[^>]+>', '', text)


def clean_fillers(text: str) -> str:
    """Remove filler words/phrases, then clean up resulting punctuation."""
    cleaned = FILLER_RE.sub('', text)
    # Remove orphan leading commas (e.g., ", we have" → "we have")
    cleaned = re.sub(r'^[,\s]+', '', cleaned)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()
    return cleaned


def parse_vtt_timestamp(ts: str) -> float:
    parts = ts.strip().split(':')
    if len(parts) == 3:
        h, m, s = parts
    elif len(parts) == 2:
        h, m, s = '0', parts[0], parts[1]
    else:
        return 0.0
    return int(h) * 3600 + int(m) * 60 + float(s)


def extract_cues(vtt_path: str) -> list[tuple[int, str]]:
    """Parse a VTT file into (start_seconds, raw_text) pairs, sorted by time."""
    cues = []
    with open(vtt_path, encoding='utf-8') as f:
        content = f.read()

    blocks = re.split(r'\n\s*\n', content)
    ts_re = re.compile(
        r'(\d{1,2}:\d{2}:\d{2}\.\d+|\d{2}:\d{2}\.\d+)\s*-->\s*'
        r'(\d{1,2}:\d{2}:\d{2}\.\d+|\d{2}:\d{2}\.\d+)'
    )
    for block in blocks:
        lines = block.strip().splitlines()
        for i, line in enumerate(lines):
            m = ts_re.match(line.strip())
            if m:
                start_sec = int(parse_vtt_timestamp(m.group(1)))
                text = ' '.join(l.strip() for l in lines[i + 1:] if l.strip())
                if text:
                    cues.append((start_sec, text))
                break

    cues.sort(key=lambda c: c[0])
    return cues


def extract_new_words(prev_stripped: str, cur_stripped: str) -> list[str]:
    """
    Find the longest suffix of prev_stripped that is a prefix of cur_stripped
    (the overlapping region), then return the remaining new words.

    Uses word-level matching to be robust against minor whitespace differences.
    """
    prev_words = prev_stripped.split()
    cur_words = cur_stripped.split()

    # Find the largest overlap: the longest suffix of prev that matches
    # a prefix of cur (at word level)
    max_overlap = min(len(prev_words), len(cur_words))
    overlap_len = 0
    for n in range(max_overlap, 0, -1):
        if prev_words[-n:] == cur_words[:n]:
            overlap_len = n
            break

    return cur_words[overlap_len:]


def clean_cues(cues: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """
    Apply rolling-window deduplication to extract new text from each cue.
    Returns (start_seconds, cleaned_new_text) pairs where cleaned_new_text is non-empty.
    """
    results = []
    prev_stripped = ''

    for t, raw in cues:
        cur_stripped = strip_html_only(raw)
        new_words = extract_new_words(prev_stripped, cur_stripped)
        prev_stripped = cur_stripped

        if not new_words:
            continue

        fragment = clean_fillers(' '.join(new_words))
        fragment = apply_corrections(fragment)
        if fragment.strip():
            results.append((t, fragment.strip()))

    return results


def split_sentences(text: str) -> list[str]:
    """Split text at sentence boundaries (. ! ? followed by uppercase word)."""
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z][a-z0-9])', text)
    return [p.strip() for p in parts if p.strip()]


def regroup(fragments: list[tuple[int, str]],
            min_gap: int = MIN_GAP,
            max_words: int = MAX_WORDS) -> list[dict]:
    """
    Group cleaned VTT fragments into transcript entries.

    Fragments from the same second are always merged. A new entry starts when
    the gap since the current group started is >= min_gap OR the word count
    would exceed max_words (whichever comes first at a natural boundary).
    """
    output = []
    grp_t: int | None = None
    grp_parts: list[str] = []
    grp_wc: int = 0

    for t, text in fragments:
        wc = len(text.split())

        if grp_t is None:
            grp_t, grp_parts, grp_wc = t, [text], wc
            continue

        new_wc = grp_wc + wc
        gap = t - grp_t

        if new_wc > max_words and gap > 0:
            # Adding this fragment would exceed word limit → flush first
            output.append({'t': grp_t, 'text': ' '.join(grp_parts)})
            grp_t, grp_parts, grp_wc = t, [text], wc
        elif gap >= min_gap:
            # Enough time has elapsed → flush at this natural boundary
            output.append({'t': grp_t, 'text': ' '.join(grp_parts)})
            grp_t, grp_parts, grp_wc = t, [text], wc
        else:
            # Same second or within min_gap → accumulate
            grp_parts.append(text)
            grp_wc = new_wc

    if grp_parts:
        output.append({'t': grp_t, 'text': ' '.join(grp_parts)})

    return output


def escape_yaml(s: str) -> str:
    s = s.replace('\\', '\\\\').replace('"', '\\"')
    return f'"{s}"'


def format_transcript_yaml(entries: list[dict]) -> str:
    if not entries:
        return 'transcript: []'
    lines = ['transcript:']
    for e in entries:
        lines.append(f'  - {{ t: {e["t"]}, text: {escape_yaml(e["text"])} }}')
    return '\n'.join(lines)


def inject_transcript(content: str, entries: list[dict]) -> str | None:
    yaml_block = format_transcript_yaml(entries)
    transcript_re = re.compile(
        r'^transcript:[ \t]*\[\][ \t]*$|^transcript:\n(?:[ \t]+.*\n)*',
        re.MULTILINE,
    )
    if transcript_re.search(content):
        return transcript_re.sub(yaml_block + '\n', content, count=1)
    return None


def main():
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if a != '--dry-run']

    if dry_run and len(args) == 1:
        vtt_path = args[0]
        mdx_path = None
    elif len(args) == 2:
        vtt_path, mdx_path = args
    else:
        print('Usage:')
        print('  python scripts/clean_vtt.py <input.vtt> <mdx_file>')
        print('  python scripts/clean_vtt.py --dry-run <input.vtt>')
        sys.exit(1)

    if not os.path.isfile(vtt_path):
        print(f'Error: VTT not found: {vtt_path}', file=sys.stderr)
        sys.exit(1)

    print(f'Parsing VTT: {vtt_path}')
    cues = extract_cues(vtt_path)
    print(f'  {len(cues)} raw cues')

    fragments = clean_cues(cues)
    print(f'  {len(fragments)} fragments after deduplication')

    entries = regroup(fragments)
    wcs = [len(e['text'].split()) for e in entries]
    short_gaps = sum(
        1 for i in range(len(entries) - 1)
        if entries[i + 1]['t'] - entries[i]['t'] < MIN_GAP
    )
    print(f'  {len(entries)} entries | avg {round(sum(wcs)/len(wcs))}w | '
          f'max {max(wcs)}w | <{MIN_GAP}s gaps: {short_gaps}')

    if dry_run or mdx_path is None:
        print('Dry run — MDX not modified.')
        return

    if not os.path.isfile(mdx_path):
        print(f'Error: MDX not found: {mdx_path}', file=sys.stderr)
        sys.exit(1)

    with open(mdx_path, encoding='utf-8') as f:
        content = f.read()

    new_content = inject_transcript(content, entries)
    if new_content is None:
        print(f'Error: no transcript: block found in {mdx_path}', file=sys.stderr)
        sys.exit(1)

    with open(mdx_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Injected into {mdx_path}')


if __name__ == '__main__':
    main()
