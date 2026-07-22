import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pillarSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: pillarSchema,
});

const bookNotes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/book-notes' }),
  schema: pillarSchema.extend({
    author: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
  }),
});

const homelab = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/homelab' }),
  schema: pillarSchema,
});

const aiNews = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/ai-news' }),
  schema: pillarSchema,
});

export const collections = {
  writing,
  'book-notes': bookNotes,
  homelab,
  'ai-news': aiNews,
};
