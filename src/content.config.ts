import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string().default('Agentic Thinking'),
    tags: z.array(z.string()).default([]),
    featuredImage: image().optional(),
    excerpt: z.string().optional(),
  })
});

export const collections = { blog };
