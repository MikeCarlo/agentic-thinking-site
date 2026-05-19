/**
 * Episode content collection schema.
 *
 * When the CI/CD AI bot creates a new episode, it should add an MDX file at:
 *   src/content/episodes/ep{NNN}-{slug}.mdx
 *
 * Required frontmatter fields:
 *   title: string           — Episode title (e.g. "Entering the AI Mind Palace")
 *   episodeNumber: number   — Episode number (e.g. 1, 2, 3...)
 *   date: string            — ISO date (e.g. "2025-05-12")
 *   youtubeId: string       — YouTube video ID (e.g. "iBHErQuPO5A")
 *   duration: string        — Duration as "MM:SS" or "H:MM:SS" (e.g. "58:12")
 *   blurb: string           — Short description (1-2 sentences)
 *   tags: string[]          — Topic tags (e.g. ["AI", "Power BI", "agents"])
 *   chapters: array         — [{t: seconds, label: "chapter title"}, ...]
 *   transcript: array       — [{t: seconds, s: "host_a"|"host_b"|"guest", text: "..."}, ...]
 *
 * Optional frontmatter fields:
 *   guest: string           — Guest name
 *   guestRole: string       — Guest role/title
 *
 * The MDX body becomes the "show notes" tab content (key takeaways, links, etc.)
 */
import { defineCollection, z } from 'astro:content';

const episodes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    episodeNumber: z.number(),
    date: z.coerce.date(),
    youtubeId: z.string(),
    duration: z.string(),
    guest: z.string().optional(),
    guestRole: z.string().optional(),
    tags: z.array(z.string()).default([]),
    blurb: z.string(),
    chapters: z.array(z.object({
      t: z.number(),
      label: z.string(),
    })).default([]),
    transcript: z.array(z.object({
      t: z.number(),
      s: z.string(),
      text: z.string(),
    })).default([]),
  })
});

export const collections = { episodes };
