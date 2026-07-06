---
name: agentic-thinking-podcast-post
description: Create an MDX episode file for the Agentic Thinking podcast. Use when given a YouTube URL for an episode. Downloads transcript, generates chapters, detects any guest from LinkedIn URLs in the description, and formats a complete MDX file ready for the site.
---

# Agentic Thinking Podcast — Episode Post

Create a full MDX episode file from an Agentic Thinking podcast YouTube episode for the `agentic-thinking-site` repository.

## Hosts

- **Mike Carlo** — LinkedIn: `https://www.linkedin.com/in/michaelcarlo/`
- **Mathias Thierbach** — LinkedIn: `https://www.linkedin.com/in/mthierba/`

## Input Required

A YouTube URL for the podcast episode, e.g.:
```
https://www.youtube.com/watch?v=iBHErQuPO5A
```

## Prerequisites

- `yt-dlp` installed and on PATH
- Python 3 available
- Scripts exist in `scripts/` at the repo root (see **Scripts** section below)
- Node.js and Yarn available (for site builds)
- Working directory: repo root of `agentic-thinking-site`

## Repository

- **GitHub:** https://github.com/MikeCarlo/agentic-thinking-site
- **Local:** `~/projects/agentic-thinking-site` (or wherever it is checked out)
- **Episodes path:** `src/content/episodes/`

---

## Architecture: Parallel Pipeline

```
┌───────────────────────┐
│  Main Agent            │
│  (orchestrator)        │
├───────────────────────┤
│ 1. Extract info        │ ← yt-dlp metadata (title, description, date)
│ 2. Detect guest        │ ← scan description for LinkedIn URLs
│ 3. Download VTT        │ ← yt-dlp transcript (parallel with step 4)
│ 4. Spawn Post Writer   │ ← writes MDX with transcript: []
│ 5. Wait for both       │
│ 6. Run clean_vtt.py    │ ← rolling-window dedupe + group + inject YAML
│ 7. Commit & push       │
└───────────────────────┘
```

**`clean_vtt.py` handles everything automatically:** rolling-window deduplication, HTML entity decoding, `>>` speaker-marker removal, filler-word removal, spell corrections (e.g. Agentyc→Agentic, Matas→Mathias), and grouping into entries of ≤50 words with ≥10 s gaps.

---

## Scripts

Located in `scripts/` at the repo root. If these scripts do not exist, create them before proceeding.

### `scripts/clean_vtt.py` ← **primary transcript script**

Converts a downloaded `.vtt` file directly into clean MDX transcript entries and injects them into the MDX file in one command.

```bash
python scripts/clean_vtt.py /tmp/epNNN/transcript.en.vtt \
  src/content/episodes/epNNN-slug.mdx
```

- Rolling-window deduplication (removes overlapping YouTube caption fragments)
- Decodes HTML entities (`&gt;` → `>`) and strips `>>` speaker markers
- Removes filler words: uh, um, you know, kind of, sort of, I mean
- Applies built-in spell corrections (Agentyc→Agentic, Matas→Mathias, etc.)
- Groups fragments into entries: **≤ 50 words each**, **≥ 10 s apart**
- Replaces the `transcript: []` block in the MDX frontmatter in-place
- Safe to run multiple times — always replaces the entire `transcript:` block

Dry-run (shows stats, does not modify MDX):

```bash
python scripts/clean_vtt.py --dry-run /tmp/epNNN/transcript.en.vtt
```

### `scripts/split-transcript.py` / `scripts/merge-transcript.py`

Legacy scripts kept for reference. No longer used in the main workflow.

---

## Workflow

### Step 1: Extract Episode Info

```bash
mkdir -p /tmp/epNNN
yt-dlp --dump-json "VIDEO_URL" > /tmp/epNNN/meta.json
```

From the JSON metadata, extract:
- **`title`** — e.g., `"Power BI + MCP + GitHub Copilot Demo"`
- **`episodeNumber`** — look for `Ep.NNN`, `Episode NNN`, `EP NNN`, `#NNN`, or a leading number in the title. If not found, check the channel's episode list.
- **`youtubeId`** — the video ID string (e.g., `c-vlxZ7RCt0`)
- **`upload_date`** — convert `YYYYMMDD` → `YYYY-MM-DD`
- **`duration`** — convert seconds to `MM:SS` or `H:MM:SS`
- **`description`** — full description text for guest and link extraction
- **`tags`** — YouTube tags to seed the MDX `tags` field (filter to relevant topic tags)

#### Guest Detection

Scan the video description for a **LinkedIn URL**. The pattern in the description is:

```
Guest Name - https://www.linkedin.com/in/profile-slug/
```

or (common variation):
```
Guest Name - https://linkedin.com/in/profile-slug/
```

YouTube often wraps links in redirect URLs like:
```
https://www.youtube.com/redirect?...&q=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fprofile-slug%2F&...
```
Decode the `q=` parameter to get the real LinkedIn URL before checking it.

**⚠️ Always ignore the hosts' own LinkedIn profiles.** These appear in every episode description and are NOT guests:
- Mike Carlo: `https://www.linkedin.com/in/michaelcarlo/`
- Mathias Thierbach: `https://www.linkedin.com/in/mthierba/`

A **guest** is any LinkedIn URL that is NOT one of the two host profiles above.

- The text **immediately to the left** of the ` - ` separator before the LinkedIn URL is the guest's name.
- Extract the full decoded LinkedIn URL as `guestLinkedIn`.
- If the description contains additional context about the guest's title or role (e.g., "CEO at Acme", "Senior Engineer"), capture it as `guestRole`. Otherwise leave `guestRole` empty.
- If **no non-host LinkedIn URL** is found in the description, there is no guest — omit `guest`, `guestRole`, and `guestLinkedIn` from the frontmatter entirely.

### Step 2: Download Transcript VTT

```bash
yt-dlp --write-auto-sub --sub-lang en --skip-download \
  -o "/tmp/epNNN/transcript" "VIDEO_URL"
```

(If `yt-dlp` is not on PATH, use `python -m yt_dlp` instead.)

This can run **in parallel** with Step 3 (Post Writer sub-agent).

### Step 3: Spawn Post Writer Sub-Agent

Fire the **Post Writer** sub-agent (see template below) while the VTT is downloading.

- Writes the full MDX file with `transcript: []` as a placeholder
- Generates chapters, summary, key takeaways, and links
- Does NOT touch the transcript — just creates the file

### Step 4: Inject Transcript

Once both the VTT download and the Post Writer are complete:

```bash
python scripts/clean_vtt.py \
  /tmp/epNNN/transcript.en.vtt \
  src/content/episodes/epNNN-slug.mdx
```

This replaces `transcript: []` with properly formatted entries (≤50 words, ≥10 s gaps, no artifacts).

### Step 5: Commit & Push

```bash
git pull
git add src/content/episodes/
git commit -m "Add podcast post: Ep. NNN — Episode Title

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin main
```

### Step 6: Clean Up

```bash
rm -rf /tmp/epNNN
```

---

## MDX Template

File location: `src/content/episodes/ep{NNN}-{slug}.mdx`
- `{NNN}` = episode number, zero-padded to 3 digits (e.g., `003`)
- `{slug}` = episode title in kebab-case (e.g., `power-bi-mcp-github-copilot-demo`)

```mdx
---
title: "Episode Title"
episodeNumber: NNN
date: "YYYY-MM-DD"
youtubeId: "VIDEO_ID"
duration: "MM:SS"
blurb: "One to two sentence description of the episode. What is it about and why should someone listen?"
tags: ["tag1", "tag2", "tag3"]
guest: "Guest Full Name"        # omit this line entirely if no guest
guestRole: "Guest Role/Title"   # omit this line entirely if no guest or role unknown
guestLinkedIn: "https://www.linkedin.com/in/profile-slug/"  # omit entirely if no guest
chapters:
  - { t: 0, label: "intro" }
  - { t: 120, label: "chapter two label" }
  - { t: 360, label: "chapter three label" }
  - { t: 720, label: "chapter four label" }
  - { t: 1200, label: "chapter five label" }
  - { t: 1800, label: "chapter six label" }
  - { t: 2400, label: "chapter seven label" }
  - { t: 3000, label: "wrap up" }
transcript: []
---

## Summary

[One paragraph summarizing what the episode covers — what the hosts discuss, the core argument or demo, and why it matters. 3–5 sentences.]

## Key Takeaways

- ▸ [Takeaway 1]
- ▸ [Takeaway 2]
- ▸ [Takeaway 3]
- ▸ [Takeaway 4]
- ▸ [Takeaway 5]

## Links

- ▸ [Link Title](https://example.com?utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260520)
- ▸ [Link Title](https://example.com?utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260520)
```

**Schema rules (do not break builds):**
- `transcript: []` must appear exactly as written — `clean_vtt.py` targets this line.
- `episodeNumber` must be a plain integer (no quotes).
- `date` must be a quoted ISO date string.
- Omit `guest`, `guestRole`, and `guestLinkedIn` entirely when there is no guest (do not leave them as empty strings).
- `blurb` is a single string — no markdown inside it.

---

## Sub-Agent Task Templates

### Post Writer Task

```
Write the MDX episode file (WITHOUT transcript entries) for Agentic Thinking Ep. NNN.

Video: VIDEO_URL
Video ID: VIDEO_ID
Title: EPISODE_TITLE
Episode number: NNN
Upload date: YYYY-MM-DD
Duration: MM:SS
YouTube description: [paste full description here]
Guest (if any): GUEST_NAME
Guest LinkedIn (if any): GUEST_LINKEDIN_URL
Guest role (if any): GUEST_ROLE

Working directory: ~/projects/agentic-thinking-site (or wherever the repo is cloned)

Steps:
1. git pull
2. Create the MDX file at src/content/episodes/ep{NNN}-{slug}.mdx using the template from .github/workflows/Agentic-Post.md.
3. For `tags`: use 3–6 topic tags drawn from the video description, YouTube tags, and title. Use lowercase, short phrases.
4. For `blurb`: 1–2 sentences. What is the episode about and why should someone watch it?
5. For `chapters`: generate 6–10 chapters from the transcript context. The first chapter must always be { t: 0, label: "intro" }. Base chapter boundaries on topic shifts visible in the transcript. Use concise, lowercase labels (e.g., "what is MCP?", "live demo", "DAX generation", "wrap up").
6. Leave `transcript: []` exactly as written — do NOT fill it in.
7. For the MDX body:
   - Write a ## Summary paragraph (3–5 sentences) explaining what the episode covers.
   - Write 5–6 ## Key Takeaways bullets using the ▸ prefix.
   - Write a ## Links section with any URLs found in the video description (omit LinkedIn and social links — those go in frontmatter). **Append UTM params to every URL: add `?utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260520` (or `&utm_source=...` if URL already has a query string).**
8. For guest: if GUEST_NAME is provided, include guest, guestRole (if known), and guestLinkedIn in the frontmatter. If not provided, omit all three fields entirely.
9. DO NOT commit or push — just create the file.
```

---

## Chapter Generation Guidelines

Since Agentic Thinking episodes do not use YouTube chapter markers, generate chapters from the transcript and topic flow.

- Always start with `{ t: 0, label: "intro" }`
- Aim for **6–10 chapters** per episode (fewer for short episodes, more for long ones)
- Chapter labels should be **short, lowercase, descriptive** — 2–5 words
  - ✅ `"what is model context protocol?"`
  - ✅ `"live demo walkthrough"`
  - ✅ `"DAX generation via copilot"`
  - ❌ `"Chapter 3: The discussion about..."`
- Base chapter boundaries on topic shifts in the transcript content:
  - Start of demo / live walkthrough
  - Major topic pivot
  - Guest introduction (if applicable)
  - Wrap-up / next steps
- Always end with a `"wrap up"` or `"closing thoughts"` chapter

---

## Guest Detection Rules

**Pattern to look for in the YouTube description:**
```
First Last - https://www.linkedin.com/in/profile/
```

YouTube often wraps description links in redirect URLs:
```
https://www.youtube.com/redirect?...&q=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fprofile%2F&...
```
Always URL-decode the `q=` parameter to get the real LinkedIn URL before processing.

**⚠️ Always ignore the hosts' own LinkedIn profiles:**
- Mike Carlo: `https://www.linkedin.com/in/michaelcarlo/`
- Mathias Thierbach: `https://www.linkedin.com/in/mthierba/`

These appear in every episode description. Only flag a LinkedIn URL as a guest if it does **not** match either host profile.

**Extraction rules:**
- The guest name is the text **directly to the left** of the ` - ` dash before the LinkedIn URL.
- If the description contains the guest's title or role (e.g., "CEO at Acme Corp"), extract it as `guestRole`.
- Store the full decoded LinkedIn URL as `guestLinkedIn`.
- If there are **multiple non-host LinkedIn URLs**, the episode has multiple guests. Handle the first as the primary guest in frontmatter; mention additional guests in the `## Links` section of the show notes.
- If **no non-host LinkedIn URL** is found, there is no guest. Do not guess.

---

## Transcript Rules

### What the transcript is for

The transcript array powers the interactive player on the site — users can click any entry to jump to that moment in the video. It is verbatim spoken content, not summaries.

### How it's generated

Run `scripts/clean_vtt.py` on the downloaded VTT — it handles everything automatically:

| What | How |
|---|---|
| Rolling-caption deduplication | Word-level overlap detection |
| HTML entities & `>>` markers | `html.unescape()` + regex strip |
| Filler words | Regex removal (uh, um, you know, kind of, sort of, I mean) |
| Spell corrections | Agentyc→Agentic, Matas→Mathias, and others |
| Entry size | ≤ 50 words per entry |
| Entry spacing | ≥ 10 seconds between entries |

Do **not** attempt to build or inject the transcript manually — always use the script.

---

## Show Notes (MDX Body) Guidelines

### Summary

- 3–5 sentences
- What the episode is about, who's on it, what's demonstrated or argued, and why it matters
- Written for someone deciding whether to watch

### Key Takeaways

- 5–6 bullets using the `▸` prefix
- Concrete insights or learnings, not vague summaries
- Example: `▸ An MCP server for Power BI exposes model metadata (tables, columns, measures)`

### Links

- Any URLs mentioned in the video description, formatted as `▸ [Title](URL)`
- Omit LinkedIn profile URLs and social links (those go in frontmatter for the guest card)
- Omit internal YouTube links (shorts, playlists, subscribe links)
- Each link should have a descriptive title, not a raw URL
- **Append campaign UTM parameters to every external URL.** Add `?utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260520` to URLs with no query string, or `&utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260520` if the URL already contains a `?`.

---

## Checklist

- [ ] Episode number and slug extracted
- [ ] Date, duration, and youtubeId correct
- [ ] Blurb is 1–2 sentences, no markdown inside it
- [ ] Tags are 3–6 relevant topic tags
- [ ] Guest detected from non-host LinkedIn URL in description (or omitted if none)
- [ ] `guest`, `guestRole`, `guestLinkedIn` included when applicable (omit entirely when no guest)
- [ ] Chapters generated (6–10 entries, starts at t=0 with "intro")
- [ ] Transcript injected via `clean_vtt.py` (≤50 w/entry, ≥10 s gaps, no VTT artifacts, spell-corrected)
- [ ] `## Summary` — 3–5 sentences
- [ ] `## Key Takeaways` — 5–6 bullets with ▸ prefix
- [ ] `## Links` — URLs from description (no LinkedIn, no YouTube-internal links)
- [ ] File at `src/content/episodes/ep{NNN}-{slug}.mdx`
- [ ] Build passes: `yarn build`
- [ ] Committed and pushed to main
