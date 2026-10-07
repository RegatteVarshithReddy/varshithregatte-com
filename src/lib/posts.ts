import { getCollection, type CollectionEntry } from "astro:content";
import { PILLAR_ENTRIES, type PillarKey } from "./pillars";

export interface PostEntry {
  key: PillarKey;
  post: CollectionEntry<PillarKey>;
}

/** Every published post across all pillars, newest first. Drafts show in dev only. */
export async function getAllPosts(): Promise<PostEntry[]> {
  const perPillar = await Promise.all(
    PILLAR_ENTRIES.map(async ([key]) => {
      const posts = await getCollection(key, ({ data }) => import.meta.env.DEV || !data.draft);
      return posts.map((post) => ({ key, post }));
    })
  );
  return perPillar.flat().sort((a, b) => b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf());
}

export const tagSlug = (tag: string) =>
  tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Tags grouped by slug, most-used first. The first spelling seen is the display label. */
export async function getTags() {
  const tags = new Map<string, { slug: string; label: string; posts: PostEntry[] }>();
  for (const entry of await getAllPosts()) {
    for (const label of entry.post.data.tags) {
      const slug = tagSlug(label);
      if (!slug) continue;
      const tag = tags.get(slug) ?? { slug, label, posts: [] };
      tag.posts.push(entry);
      tags.set(slug, tag);
    }
  }
  return [...tags.values()].sort((a, b) => b.posts.length - a.posts.length || a.slug.localeCompare(b.slug));
}
