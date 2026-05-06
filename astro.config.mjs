// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE || 'https://mikecarlo.github.io/agentic-thinking-site';
const base = process.env.BASE_PATH || '/agentic-thinking-site';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  image: {
    formats: ['avif', 'webp'],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [mdx(), sitemap()],
  compressHTML: true,
});
