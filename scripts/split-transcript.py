#!/usr/bin/env python3
"""
split-transcript.py — Split a YouTube VTT file into N time-based chunks.

Usage:
    python scripts/split-transcript.py <input.vtt> <output_dir> <num_chunks>

Example:
    python scripts/split-transcript.py /tmp/ep004/transcript.en.vtt /tmp/ep004/chunks 6

Output:
    <output_dir>/chunk_00.txt
    <output_dir>/chunk_01.txt
    ...

Each line in an output file is formatted as:
    SECONDS|RAW_VTT_TEXT

where SECONDS is the cue start time as a whole integer.
"""

import html
import re
import sys
import os


def parse_vtt_timestamp(ts: str) -> float:
    """Convert a VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to total seconds."""
    parts = ts.strip().split(':')
    if len(parts) == 3:
        h, m, s = parts
    elif len(parts) == 2:
        h, m, s = '0', parts[0], parts[1]
    else:
        return 0.0
    return int(h) * 3600 + int(m) * 60 + float(s)


def extract_cues(vtt_path: str) -> list[tuple[int, str]]:
    """Parse a VTT file and return a list of (start_seconds, raw_text) tuples."""
    cues = []
    with open(vtt_path, encoding='utf-8') as f:
        content = f.read()

    # Split on blank lines to get blocks
    blocks = re.split(r'\n\s*\n', content)
    timestamp_re = re.compile(
        r'(\d{1,2}:\d{2}:\d{2}\.\d+|\d{2}:\d{2}\.\d+)\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d+|\d{2}:\d{2}\.\d+)'
    )

    for block in blocks:
        lines = block.strip().splitlines()
        for i, line in enumerate(lines):
            m = timestamp_re.match(line.strip())
            if m:
                start_sec = int(parse_vtt_timestamp(m.group(1)))
                # Text is everything after the timestamp line, joined
                text_lines = lines[i + 1:]
                text = ' '.join(t.strip() for t in text_lines if t.strip())
                if text:
                    # Decode HTML entities (&gt; → >, &amp; → &, etc.) and
                    # strip YouTube speaker-change markers (>>) before writing
                    text = html.unescape(text)
                    text = re.sub(r'\s*>>\s*', ' ', text).strip()
                    if text:
                        cues.append((start_sec, text))
                break

    # Sort by start time (VTT files are usually in order but just in case)
    cues.sort(key=lambda c: c[0])
    return cues


def split_cues(cues: list[tuple[int, str]], num_chunks: int) -> list[list[tuple[int, str]]]:
    """Distribute cues evenly across num_chunks by time range."""
    if not cues:
        return [[] for _ in range(num_chunks)]

    min_t = cues[0][0]
    max_t = cues[-1][0]
    span = max(max_t - min_t, 1)
    chunk_duration = span / num_chunks

    chunks: list[list[tuple[int, str]]] = [[] for _ in range(num_chunks)]
    for t, text in cues:
        idx = min(int((t - min_t) / chunk_duration), num_chunks - 1)
        chunks[idx].append((t, text))

    return chunks


def main():
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} <input.vtt> <output_dir> <num_chunks>", file=sys.stderr)
        sys.exit(1)

    vtt_path = sys.argv[1]
    output_dir = sys.argv[2]
    num_chunks = int(sys.argv[3])

    if not os.path.isfile(vtt_path):
        print(f"Error: VTT file not found: {vtt_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    print(f"Parsing VTT: {vtt_path}")
    cues = extract_cues(vtt_path)
    print(f"  Found {len(cues)} cues")

    chunks = split_cues(cues, num_chunks)

    for i, chunk in enumerate(chunks):
        out_path = os.path.join(output_dir, f"chunk_{i:02d}.txt")
        with open(out_path, 'w', encoding='utf-8') as f:
            for t, text in chunk:
                f.write(f"{t}|{text}\n")
        print(f"  chunk_{i:02d}.txt — {len(chunk)} cues")

    print(f"Done. {num_chunks} chunks written to {output_dir}/")


if __name__ == '__main__':
    main()
