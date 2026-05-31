---
name: agentic-pod-post
description: Create an Agentic Thinking episode post from a YouTube URL. Use when given a YouTube video for the show and you need to download metadata and captions, scaffold the MDX episode file, inject the cleaned transcript, and finish the post in this repo.
---

# Agentic Thinking Podcast Post

Create a complete episode post for this repository from a YouTube episode URL.

## Repository Contract

- Repo root: `c:\Repos\agentic-thinking-site`
- Episode content lives in `src/content/episodes/`
- Episode schema is defined in `src/content.config.ts`
- Transcript injection is handled by `scripts/clean_vtt.py`
- The helper bootstrap script for this workflow is `scripts/create_episode_post.py`

## Inputs

- Required: a YouTube video URL
- Optional: an explicit episode number if the repo sequence should be overridden

## Workflow

1. Run the helper script from the repo root.

   ```bash
   python scripts/create_episode_post.py "YOUTUBE_URL"
   ```

   Optional override:

   ```bash
   python scripts/create_episode_post.py "YOUTUBE_URL" --episode-number 13
   ```

2. The helper script will:
   - fetch YouTube metadata with `yt-dlp`
   - determine the target file name under `src/content/episodes/`
   - create an MDX file with valid frontmatter and `transcript: []`
   - download English auto-captions
   - run `scripts/clean_vtt.py` to inject transcript entries

3. After the script completes, open the generated MDX file and finish the human-facing content:
   - replace placeholder chapter labels with meaningful chapter titles
   - rewrite the `## Summary` section based on the transcript
   - replace placeholder key takeaways with concrete bullets
   - review the generated links list and delete anything irrelevant
   - if guest detection is wrong or incomplete, fix it manually instead of guessing

4. Validate the result:

   ```bash
   yarn build
   ```

5. Stop after validation. Do not commit or push unless explicitly asked.

## Guardrails

- Treat `src/content.config.ts` as the source of truth for frontmatter fields.
- Keep `transcript: []` exactly as written until `clean_vtt.py` injects the transcript.
- Omit `guest`, `guestRole`, and `guestLinkedIn` entirely when no non-host guest is detected.
- Use the next available repo episode number by default. If the YouTube title implies a conflicting number, prefer the repo sequence unless the user asks otherwise.
- The helper script creates placeholder chapters so the file is valid immediately; refine them before considering the post complete.

## Host LinkedIn Profiles

Ignore these profiles when detecting guests from the description:

- Mike Carlo: `https://www.linkedin.com/in/michaelcarlo/`
- Mathias Thierbach: `https://www.linkedin.com/in/mthierba/`

## Validation Checklist

- Generated file path matches `src/content/episodes/epNNN-slug.mdx`
- Frontmatter parses against the content collection schema
- Transcript block is populated by `clean_vtt.py`
- Chapter labels are not left as generic placeholders in the final pass
- `yarn build` succeeds

## Reference Asset

Read the adjacent `Agentic-Post.md` file for the target MDX shape, chapter conventions, guest detection rules, and link expectations.
