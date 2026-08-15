---
name: agentic-pod-post-template
description: Reference template for creating Agentic Thinking episode posts in this repository.
---

# Agentic Thinking Episode Template

Use this as the output contract for generated episode files.

## File Path

`src/content/episodes/epNNN-slug.mdx`

- `NNN` is zero-padded to three digits
- `slug` is the cleaned episode title in kebab-case

## Required Frontmatter

```mdx
---
title: "Episode Title"
episodeNumber: 13
date: "2026-05-30"
youtubeId: "VIDEO_ID"
duration: "43:21"
blurb: "One or two sentences explaining what the episode covers and why it matters."
tags: ["agents", "github copilot", "youtube"]
chapters:
  - { t: 0, label: "intro" }
  - { t: 360, label: "meaningful chapter title" }
  - { t: 900, label: "meaningful chapter title" }
  - { t: 1800, label: "wrap up" }
transcript: []
---
```

## Optional Guest Fields

Only include these when the YouTube description clearly identifies a non-host guest.

```yaml
guest: "Guest Name"
guestRole: "Guest Role"
guestLinkedIn: "https://www.linkedin.com/in/profile-slug/"
```

If the role is not explicit, omit `guestRole`.

## Guest Detection Rules

- Scan the description for LinkedIn URLs.
- Decode YouTube redirect URLs and inspect the `q` query parameter.
- Ignore the host profiles:
  - `https://www.linkedin.com/in/michaelcarlo/`
  - `https://www.linkedin.com/in/mthierba/`
- The text immediately before ` - LINKEDIN_URL` is usually the guest name.
- If no non-host LinkedIn profile is present, omit all guest fields.

## Chapter Rules

- Always start with `{ t: 0, label: "intro" }`
- Use 6 to 10 chapters when possible
- End with `wrap up` or an equivalent closing label when the episode has a clear ending section
- Placeholder chapters are allowed during scaffolding, but the final content should use meaningful labels

## Body Structure

```mdx
## Summary

[3 to 5 sentence summary of the episode]

## Key Takeaways

- ▸ [Takeaway 1]
- ▸ [Takeaway 2]
- ▸ [Takeaway 3]
- ▸ [Takeaway 4]
- ▸ [Takeaway 5]

## Links

- ▸ [Link Title](https://example.com?utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260530)
- ▸ [Link Title](https://example.com?utm_source=agentic_thinking&utm_medium=website&utm_campaign=20260530)
```

## Link Rules

- Prefer links found in the YouTube description
- Append campaign parameters:
  - `utm_source=agentic_thinking`
  - `utm_medium=website`
  - `utm_campaign=YYYYMMDD`
- Drop links that are clearly irrelevant to the episode page

## Notes

- The transcript is populated after scaffolding by `scripts/clean_vtt.py`
- The initial scaffold may contain placeholders; the final pass should replace them with real content
