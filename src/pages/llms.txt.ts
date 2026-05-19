import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const episodes = (await getCollection('episodes'))
    .sort((a, b) => b.data.episodeNumber - a.data.episodeNumber);

  const siteBase = (import.meta.env.SITE as string).replace(/\/$/, '');

  const lines: string[] = [
    '# Agentic Thinking',
    '',
    '> CLI-native conversations on agent systems — orchestration, memory, evals, and the unglamorous infra of running LLMs in anger. Hosted by Mike Carlo and Mathias Thierbach.',
    '',
    '## Pages',
    '',
    `- [Home](${siteBase}/): Podcast homepage with latest episodes and episode index`,
    `- [Episodes](${siteBase}/episodes/): Full episode archive with transcripts, chapters, and show notes`,
    `- [About](${siteBase}/about/): Host bios, show manifesto, and what Agentic Thinking covers`,
    `- [Subscribe](${siteBase}/subscribe/): Platform links — YouTube, Apple Podcasts, Spotify`,
    '',
    '## Episodes',
    '',
  ];

  for (const ep of episodes) {
    const epNum = String(ep.data.episodeNumber).padStart(3, '0');
    const slug = ep.id.replace(/\/index\.mdx?$/, '').replace(/\.mdx?$/, '');
    const url = `${siteBase}/episodes/${slug}/`;
    lines.push(`- [EP${epNum} · ${ep.data.title}](${url}): ${ep.data.blurb}`);
  }

  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
