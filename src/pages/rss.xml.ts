import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { PILLAR_ENTRIES } from '../lib/pillars';

export async function GET(context: APIContext) {
  const postsByPillar = await Promise.all(
    PILLAR_ENTRIES.map(async ([key, pillar]) => {
      const posts = await getCollection(key, ({ data }) => !data.draft);
      return posts.map((post) => ({ pillar, post }));
    })
  );

  const items = postsByPillar
    .flat()
    .sort((a, b) => b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf())
    .map(({ pillar, post }) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/${pillar.slug}/${post.id}/`,
      categories: [pillar.name, ...post.data.tags],
    }));

  return rss({
    title: 'Varshith Regatte',
    description: 'Writing on business & life skills, book notes, homelab builds, and AI news.',
    site: context.site!,
    items,
  });
}
