#!/usr/bin/env python3
"""Create an Agentic Thinking episode MDX file from a YouTube URL.

This helper script owns the deterministic parts of the workflow:
  1. Fetch YouTube metadata with yt-dlp.
  2. Pick the next repo episode number unless overridden.
  3. Create a valid episode MDX scaffold in src/content/episodes/.
  4. Download English auto-captions.
  5. Inject transcript entries via scripts/clean_vtt.py.

The generated file is intentionally conservative. It creates valid schema data
and placeholder content that can be refined by a skill or a human editor.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse, unquote

REPO_ROOT = Path(__file__).resolve().parent.parent
EPISODES_DIR = REPO_ROOT / "src" / "content" / "episodes"
CLEAN_VTT = REPO_ROOT / "scripts" / "clean_vtt.py"
HOST_LINKEDIN_URLS = {
    "https://www.linkedin.com/in/michaelcarlo/",
    "https://www.linkedin.com/in/mthierba/",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument(
        "--episode-number",
        type=int,
        help="Override the next detected repo episode number",
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep downloaded metadata and captions for inspection",
    )
    return parser.parse_args()


def run_command(command: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    )


def ytdlp_command() -> list[str]:
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    return [sys.executable, "-m", "yt_dlp"]


def fetch_metadata(url: str) -> dict:
    command = ytdlp_command() + ["--dump-single-json", url]
    result = run_command(command, cwd=REPO_ROOT)
    return json.loads(result.stdout)


def download_captions(url: str, work_dir: Path) -> Path:
    output_template = str(work_dir / "transcript")
    command = ytdlp_command() + [
        "--write-auto-sub",
        "--sub-lang",
        "en",
        "--skip-download",
        "-o",
        output_template,
        url,
    ]
    run_command(command, cwd=REPO_ROOT)
    matches = sorted(work_dir.glob("transcript*.vtt"))
    if not matches:
        raise FileNotFoundError("yt-dlp did not produce a VTT caption file")
    return matches[0]


def next_episode_number() -> int:
    numbers: list[int] = []
    for path in EPISODES_DIR.glob("ep*.mdx"):
        match = re.match(r"ep(\d+)-", path.name)
        if match:
            numbers.append(int(match.group(1)))
    return (max(numbers) if numbers else 0) + 1


def strip_episode_prefix(title: str) -> str:
    patterns = [
        r"^\s*(?:agentic thinking\s*[:-]\s*)?(?:ep(?:isode)?\.?\s*#?\d+\s*[:-]\s*)",
        r"^\s*#\d+\s*[:-]\s*",
        r"^\s*\d+\s*[:-]\s*",
    ]
    cleaned = title
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or title.strip()


def slugify(value: str) -> str:
    lowered = strip_episode_prefix(value).lower()
    lowered = re.sub(r"['’]", "", lowered)
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    return lowered.strip("-") or "untitled-episode"


def format_duration(seconds: int | float | None) -> str:
    total = int(seconds or 0)
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def format_date(upload_date: str | None) -> str:
    if not upload_date or len(upload_date) != 8 or not upload_date.isdigit():
        raise ValueError("upload_date is missing or invalid")
    return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"


def normalize_link(url: str) -> str:
    parsed = urlparse(url)
    if "youtube.com" in parsed.netloc and parsed.path == "/redirect":
        redirected = parse_qs(parsed.query).get("q", [])
        if redirected:
            return unquote(redirected[0])
    return url


def append_utm(url: str, campaign: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    query["utm_source"] = ["agentic_thinking"]
    query["utm_medium"] = ["website"]
    query["utm_campaign"] = [campaign]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


def extract_urls(text: str) -> list[str]:
    urls = re.findall(r"https?://\S+", text)
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in urls:
        normalized = normalize_link(raw.rstrip(").,]"))
        if normalized not in seen:
            seen.add(normalized)
            cleaned.append(normalized)
    return cleaned


def detect_guest(description: str) -> dict[str, str]:
    for line in description.splitlines():
        if "linkedin.com/in/" not in line.lower():
            continue
        raw_match = re.search(r"https?://\S+", line)
        if not raw_match:
            continue
        linkedin = normalize_link(raw_match.group(0).rstrip(").,]"))
        canonical = linkedin.rstrip("/") + "/"
        if canonical in HOST_LINKEDIN_URLS:
            continue
        if "linkedin.com/in/" not in canonical.lower():
            continue
        left = line[: raw_match.start()].strip(" -|")
        guest_name = left.split(" - ")[-1].strip() if left else ""
        role_match = re.search(r"[,|]\s*([^,|]+)$", left)
        role = ""
        if role_match and guest_name and role_match.group(1).strip() != guest_name:
            role = role_match.group(1).strip()
        result = {
            "guest": guest_name or "Guest",
            "guestLinkedIn": canonical,
        }
        if role:
            result["guestRole"] = role
        return result
    return {}


def sentenceish_blurb(description: str, title: str) -> str:
    lines = [line.strip() for line in description.splitlines() if line.strip()]
    candidates = [line for line in lines if not line.startswith("http")]
    if candidates:
        text = candidates[0]
    else:
        text = f"{strip_episode_prefix(title)} from Agentic Thinking."
    text = re.sub(r"\s+", " ", text)
    if len(text) > 240:
        text = text[:237].rsplit(" ", 1)[0] + "..."
    return text


def normalize_tags(tags: Iterable[str] | None) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for tag in tags or []:
        cleaned = re.sub(r"\s+", " ", str(tag).strip().lower())
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
        if len(result) == 6:
            break
    if not result:
        return ["agentic thinking", "youtube"]
    return result


def placeholder_chapters(duration_seconds: int | float | None) -> list[tuple[int, str]]:
    total = max(int(duration_seconds or 0), 1)
    labels = [
        "intro",
        "context",
        "problem framing",
        "working session",
        "practical takeaways",
        "closing thoughts",
        "wrap up",
    ]
    chapter_count = 6 if total < 2100 else 7
    if total > 3300:
        chapter_count = 8
        labels.insert(-1, "deeper dive")
    points = [0]
    for index in range(1, chapter_count - 1):
        points.append(int(total * index / (chapter_count - 1)))
    points.append(max(total - 60, points[-1]))
    deduped: list[int] = []
    for point in points:
        if not deduped or point > deduped[-1]:
            deduped.append(point)
    return list(zip(deduped, labels[: len(deduped)]))


def escape_yaml(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def build_links_section(urls: list[str], campaign: str) -> str:
    if not urls:
        return "- ▸ Add relevant episode links here"
    lines = []
    for url in urls[:8]:
        parsed = urlparse(url)
        label = parsed.netloc.replace("www.", "") or url
        lines.append(f"- ▸ [{label}]({append_utm(url, campaign)})")
    return "\n".join(lines)


def build_mdx(metadata: dict, episode_number: int, target_path: Path) -> str:
    title = strip_episode_prefix(metadata["title"])
    date = format_date(metadata.get("upload_date"))
    campaign = date.replace("-", "")
    guest = detect_guest(metadata.get("description", ""))
    tags = normalize_tags(metadata.get("tags"))
    links = [
        url for url in extract_urls(metadata.get("description", ""))
        if "linkedin.com/in/" not in url.lower()
    ]
    chapters = placeholder_chapters(metadata.get("duration"))

    frontmatter: list[str] = [
        "---",
        f"title: {escape_yaml(title)}",
        f"episodeNumber: {episode_number}",
        f"date: {escape_yaml(date)}",
        f"youtubeId: {escape_yaml(metadata['id'])}",
        f"duration: {escape_yaml(format_duration(metadata.get('duration')))}",
        f"blurb: {escape_yaml(sentenceish_blurb(metadata.get('description', ''), title))}",
        "tags: [" + ", ".join(escape_yaml(tag) for tag in tags) + "]",
    ]
    for key in ("guest", "guestRole", "guestLinkedIn"):
        if guest.get(key):
            frontmatter.append(f"{key}: {escape_yaml(guest[key])}")
    frontmatter.append("chapters:")
    for t_value, label in chapters:
        frontmatter.append(f"  - {{ t: {t_value}, label: {escape_yaml(label)} }}")
    frontmatter.extend(["transcript: []", "---", ""])

    body = [
        "## Summary",
        "",
        "Draft a 3 to 5 sentence summary for this episode after reviewing the transcript.",
        "",
        "## Key Takeaways",
        "",
        "- ▸ Replace this with a concrete takeaway from the episode",
        "- ▸ Replace this with a concrete takeaway from the episode",
        "- ▸ Replace this with a concrete takeaway from the episode",
        "- ▸ Replace this with a concrete takeaway from the episode",
        "- ▸ Replace this with a concrete takeaway from the episode",
        "",
        "## Links",
        "",
        build_links_section(links, campaign),
        "",
    ]
    return "\n".join(frontmatter + body)


def inject_transcript(vtt_path: Path, mdx_path: Path) -> None:
    command = [sys.executable, str(CLEAN_VTT), str(vtt_path), str(mdx_path)]
    run_command(command, cwd=REPO_ROOT)


def main() -> int:
    args = parse_args()
    episode_number = args.episode_number or next_episode_number()
    metadata = fetch_metadata(args.url)
    title = strip_episode_prefix(metadata["title"])
    slug = slugify(title)
    target_path = EPISODES_DIR / f"ep{episode_number:03d}-{slug}.mdx"
    if target_path.exists():
        raise FileExistsError(f"Target file already exists: {target_path}")

    mdx = build_mdx(metadata, episode_number, target_path)
    target_path.write_text(mdx, encoding="utf-8")

    work_dir_path: Path | None = None
    try:
        with tempfile.TemporaryDirectory(prefix=f"agentic-ep{episode_number:03d}-") as temp_dir:
            work_dir_path = Path(temp_dir)
            vtt_path = download_captions(args.url, work_dir_path)
            inject_transcript(vtt_path, target_path)
            output = {
                "episodeNumber": episode_number,
                "title": title,
                "path": str(target_path.relative_to(REPO_ROOT)),
                "vtt": str(vtt_path),
            }
            print(json.dumps(output, indent=2))
            if args.keep_temp:
                persistent = REPO_ROOT / ".tmp" / work_dir_path.name
                persistent.parent.mkdir(parents=True, exist_ok=True)
                if persistent.exists():
                    shutil.rmtree(persistent)
                shutil.copytree(work_dir_path, persistent)
                print(f"Kept temp files at {persistent}")
    except Exception:
        if target_path.exists():
            target_path.unlink()
        raise

    return 0


if __name__ == "__main__":
    raise SystemExit(main())