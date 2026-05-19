#!/usr/bin/env python3
"""
regroup_transcript.py — Re-group existing MDX transcript entries.

Reads the current transcript entries from an MDX file and re-groups them so that:
  - Entries are separated by at least MIN_GAP seconds (default 10)
  - Each entry is at most MAX_WORDS words (default 50)
  - Splits happen only at sentence boundaries (. ! ?) where possible
  - Applies spelling/recognition corrections

Usage:
    python scripts/regroup_transcript.py <mdx_file>
    python scripts/regroup_transcript.py --all
"""

import re
import os
import sys

MIN_GAP = 10    # minimum seconds between entries
MAX_WORDS = 50  # maximum words per entry

# ---------------------------------------------------------------------------
# Spelling / recognition corrections (applied before re-grouping)
# Each tuple: (compiled_regex, replacement_string_or_callable)
# ---------------------------------------------------------------------------
CORRECTIONS = [
    # Podcast name mis-recognitions
    (re.compile(r'\bAgentyc\b'), 'Agentic'),
    (re.compile(r'\bagentyc\b'), 'agentic'),
    (re.compile(r'\bAentic\b'),  'Agentic'),
    (re.compile(r'\baentic\b'),  'agentic'),
    # Host name mis-recognitions
    (re.compile(r'\bMatas\b'),   'Mathias'),
    # ep002 word-fragment errors
    (re.compile(r'\barting\b'),      'starting'),
    (re.compile(r'\badjunctive\b'),  'Agentic'),
    (re.compile(r'(?<!\w)nergy\b'),  'energy'),
    (re.compile(r'\bse\s+them\b'),   'use them'),
]


def apply_corrections(text: str) -> str:
    for pattern, replacement in CORRECTIONS:
        text = pattern.sub(replacement, text)
    return text


def split_sentences(text: str) -> list[str]:
    """
    Split text into sentences at .!? boundaries followed by a space + uppercase word.
    Avoids splitting inside acronyms (e.g. "U.S. Army") by requiring the following
    word to start with uppercase-then-lowercase or a digit.
    """
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z][a-z0-9])', text)
    return [p.strip() for p in parts if p.strip()]


def parse_transcript(content: str) -> list[tuple[int, str]]:
    """Extract (t, text) entries from MDX frontmatter."""
    entries = []
    pattern = re.compile(r'\{\s*t:\s*(\d+),\s*text:\s*"((?:[^"\\]|\\.)*)"\s*\}')
    for m in pattern.finditer(content):
        t = int(m.group(1))
        text = m.group(2).replace('\\"', '"').replace('\\\\', '\\')
        entries.append((t, text))
    return sorted(entries, key=lambda e: e[0])


def flatten_to_sentences(entries: list[tuple[int, str]]) -> list[tuple[int, int, str]]:
    """
    Flatten entries into individual sentences with interpolated timestamps.

    Returns (timestamp, entry_index, text) triples. The entry_index lets the
    re-grouper avoid splitting in the middle of an original entry.
    """
    sentences = []
    for i, (t, text) in enumerate(entries):
        t_next = entries[i + 1][0] if i + 1 < len(entries) else t + 30
        # Ensure at least 1 second of duration so interpolation has some range
        duration = max(t_next - t, 1)

        sents = split_sentences(text)
        if not sents:
            if text.strip():
                sentences.append((t, i, text.strip()))
            continue

        total_chars = sum(len(s) for s in sents)
        char_offset = 0
        for sent in sents:
            t_sent = int(t + (char_offset / max(total_chars, 1)) * duration)
            sentences.append((t_sent, i, sent))
            char_offset += len(sent) + 1  # +1 for space between sentences

    return sentences


def regroup(sentences: list[tuple[int, int, str]],
            min_gap: int = MIN_GAP,
            max_words: int = MAX_WORDS) -> list[dict]:
    """
    Re-group sentences into output entries.

    Flush priority (in order):
      1. Word-count exceeded: always flush, even mid-entry.
      2. Same original entry (same entry_index as last accumulated sentence):
         always accumulate (don't split within an entry).
      3. Gap >= min_gap at an entry boundary: flush cleanly.
      4. Otherwise (different entry, close in time, under limit): accumulate.
    """
    output = []
    grp_t: int | None = None
    grp_parts: list[str] = []
    grp_wc: int = 0
    grp_last_idx: int = -1

    for t, entry_idx, sent in sentences:
        wc = len(sent.split())

        if grp_t is None:
            grp_t = t
            grp_parts = [sent]
            grp_wc = wc
            grp_last_idx = entry_idx
            continue

        new_wc = grp_wc + wc
        gap = t - grp_t
        same_entry = (entry_idx == grp_last_idx)

        if new_wc > max_words:
            # Word limit exceeded — flush regardless of same-entry or gap
            output.append({'t': grp_t, 'text': ' '.join(grp_parts)})
            grp_t = t
            grp_parts = [sent]
            grp_wc = wc
            grp_last_idx = entry_idx
        elif same_entry:
            # Within the same original entry and under word limit → never split here
            grp_parts.append(sent)
            grp_wc = new_wc
        elif gap >= min_gap:
            # Clean sentence boundary with enough elapsed time → flush
            output.append({'t': grp_t, 'text': ' '.join(grp_parts)})
            grp_t = t
            grp_parts = [sent]
            grp_wc = wc
            grp_last_idx = entry_idx
        else:
            # Different entry but close in time and under limit → merge
            grp_parts.append(sent)
            grp_wc = new_wc
            grp_last_idx = entry_idx

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
    transcript_block_re = re.compile(
        r'^transcript:[ \t]*\[\][ \t]*$|^transcript:\n(?:[ \t]+.*\n)*',
        re.MULTILINE,
    )
    if transcript_block_re.search(content):
        return transcript_block_re.sub(yaml_block + '\n', content, count=1)
    return None


def process_mdx(mdx_path: str, dry_run: bool = False) -> bool:
    with open(mdx_path, encoding='utf-8') as f:
        content = f.read()

    entries = parse_transcript(content)
    if not entries:
        print(f'  {os.path.basename(mdx_path)}: no transcript, skipping')
        return False

    # Apply spelling corrections
    corrected = [(t, apply_corrections(text)) for t, text in entries]

    # Flatten to sentences, re-group
    sentences = flatten_to_sentences(corrected)
    new_entries = regroup(sentences)

    old_wcs = [len(t.split()) for _, t in entries]
    new_wcs = [len(e['text'].split()) for e in new_entries]
    short_gaps_old = sum(
        1 for i in range(len(entries) - 1)
        if entries[i + 1][0] - entries[i][0] < MIN_GAP
    )
    short_gaps_new = sum(
        1 for i in range(len(new_entries) - 1)
        if new_entries[i + 1]['t'] - new_entries[i]['t'] < MIN_GAP
    )

    print(
        f'  {os.path.basename(mdx_path)[:42]:42} '
        f'{len(entries):3}→{len(new_entries):3} entries | '
        f'avg {round(sum(old_wcs)/len(old_wcs)):3}→{round(sum(new_wcs)/len(new_wcs)):3}w | '
        f'max {max(old_wcs):3}→{max(new_wcs):3}w | '
        f'<10s gaps {short_gaps_old:3}→{short_gaps_new:3}'
    )

    if dry_run:
        return True

    new_content = inject_transcript(content, new_entries)
    if new_content is None:
        print(f'  WARNING: could not find transcript block in {mdx_path}')
        return False

    with open(mdx_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True


def main():
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if a != '--dry-run']

    if args == ['--all']:
        eps_dir = 'src/content/episodes'
        label = 'DRY RUN — ' if dry_run else ''
        print(f'{label}Processing all episodes in {eps_dir}/ ...\n')
        for fname in sorted(os.listdir(eps_dir)):
            if fname.endswith('.mdx'):
                process_mdx(os.path.join(eps_dir, fname), dry_run=dry_run)
    elif len(args) == 1 and not args[0].startswith('-'):
        process_mdx(args[0], dry_run=dry_run)
    else:
        print('Usage:')
        print('  python scripts/regroup_transcript.py <mdx_file>')
        print('  python scripts/regroup_transcript.py --all')
        print('  python scripts/regroup_transcript.py --dry-run --all')
        print('  python scripts/regroup_transcript.py --dry-run <mdx_file>')
        sys.exit(1)


if __name__ == '__main__':
    main()
