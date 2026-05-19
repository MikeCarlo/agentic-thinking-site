#!/usr/bin/env python3
"""
merge-transcript.py — Merge cleaned JSONL transcript chunks into an MDX frontmatter.

Usage:
    python scripts/merge-transcript.py <chunks_dir> <mdx_file>

Example:
    python scripts/merge-transcript.py /tmp/ep004/chunks src/content/episodes/ep004-my-episode.mdx

What it does:
    1. Reads all chunk_NN_clean.jsonl files in <chunks_dir>, sorted by chunk number.
    2. Parses each line as a JSON object: {"t": seconds, "text": "..."}
    3. Combines all entries and sorts them by t (ascending).
    4. Formats them as a YAML array.
    5. Replaces the line `transcript: []` in the MDX frontmatter with the full array.

Safe to run multiple times — always replaces the entire transcript: block.
"""

import json
import os
import re
import sys


def load_chunks(chunks_dir: str) -> list[dict]:
    """Load and merge all chunk_NN_clean.jsonl files, sorted by chunk number."""
    entries: list[dict] = []
    pattern = re.compile(r'^chunk_(\d+)_clean\.jsonl$')

    chunk_files = sorted(
        (f for f in os.listdir(chunks_dir) if pattern.match(f)),
        key=lambda f: int(pattern.match(f).group(1))
    )

    if not chunk_files:
        print(f"Warning: no chunk_NN_clean.jsonl files found in {chunks_dir}", file=sys.stderr)
        return entries

    for filename in chunk_files:
        path = os.path.join(chunks_dir, filename)
        with open(path, encoding='utf-8') as f:
            for lineno, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if 't' not in obj or 'text' not in obj:
                        print(f"Warning: {filename}:{lineno} missing 't' or 'text', skipping", file=sys.stderr)
                        continue
                    entries.append({'t': int(obj['t']), 'text': str(obj['text'])})
                except json.JSONDecodeError as e:
                    print(f"Warning: {filename}:{lineno} JSON parse error: {e}, skipping", file=sys.stderr)

    return entries


def escape_yaml_string(s: str) -> str:
    """Wrap a string in double quotes, escaping inner double quotes and backslashes."""
    s = s.replace('\\', '\\\\').replace('"', '\\"')
    return f'"{s}"'


def format_transcript_yaml(entries: list[dict]) -> str:
    """Format transcript entries as a YAML array for MDX frontmatter."""
    if not entries:
        return 'transcript: []'

    lines = ['transcript:']
    for entry in entries:
        text = escape_yaml_string(entry['text'])
        lines.append(f'  - {{ t: {entry["t"]}, text: {text} }}')
    return '\n'.join(lines)


def inject_transcript(mdx_path: str, entries: list[dict]) -> None:
    """Replace the transcript: [] line (or existing transcript block) in the MDX file."""
    with open(mdx_path, encoding='utf-8') as f:
        content = f.read()

    yaml_block = format_transcript_yaml(entries)

    # Match an existing transcript block:
    #   transcript: []                     (empty array)
    #   transcript:\n  - { t: ... }\n ...  (existing entries, up to next top-level key or end of frontmatter)
    transcript_block_re = re.compile(
        r'^transcript:[ \t]*\[\][ \t]*$|^transcript:\n(?:[ \t]+.*\n)*',
        re.MULTILINE
    )

    if transcript_block_re.search(content):
        new_content = transcript_block_re.sub(yaml_block + '\n', content, count=1)
    else:
        print("Warning: could not find 'transcript:' block in MDX frontmatter.", file=sys.stderr)
        print("Make sure the MDX file contains exactly: transcript: []", file=sys.stderr)
        sys.exit(1)

    with open(mdx_path, 'w', encoding='utf-8') as f:
        f.write(new_content)


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <chunks_dir> <mdx_file>", file=sys.stderr)
        sys.exit(1)

    chunks_dir = sys.argv[1]
    mdx_path = sys.argv[2]

    if not os.path.isdir(chunks_dir):
        print(f"Error: chunks directory not found: {chunks_dir}", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(mdx_path):
        print(f"Error: MDX file not found: {mdx_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading chunks from: {chunks_dir}")
    entries = load_chunks(chunks_dir)
    entries.sort(key=lambda e: e['t'])
    print(f"  {len(entries)} transcript entries loaded")

    if not entries:
        print("No entries to merge — leaving MDX file unchanged.")
        return

    print(f"Injecting into: {mdx_path}")
    inject_transcript(mdx_path, entries)
    print(f"Done. transcript block written with {len(entries)} entries.")


if __name__ == '__main__':
    main()
