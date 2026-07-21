export type PillarKey = "writing" | "book-notes" | "homelab" | "ai-news";

interface Pillar {
  name: string;
  slug: string;
  description: string;
  badgeClass: string;
  accentClass: string;
}

// Tailwind class strings are written out in full (not built from template
// literals) so the build-time scanner can find and generate them.
export const PILLARS: Record<PillarKey, Pillar> = {
  writing: {
    name: "Writing",
    slug: "writing",
    description: "Business management and life-skills lessons.",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    accentClass: "text-amber-600 dark:text-amber-400",
  },
  "book-notes": {
    name: "Book Notes",
    slug: "books",
    description: "Summaries and personal takeaways from what I'm reading.",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    accentClass: "text-violet-600 dark:text-violet-400",
  },
  homelab: {
    name: "Homelab",
    slug: "homelab",
    description: "Build logs, upgrades, and lessons from running my own infrastructure.",
    badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
    accentClass: "text-teal-600 dark:text-teal-400",
  },
  "ai-news": {
    name: "AI News",
    slug: "ai-news",
    description: "Notable AI developments and my take on them.",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    accentClass: "text-sky-600 dark:text-sky-400",
  },
};

export const PILLAR_ENTRIES = Object.entries(PILLARS) as [PillarKey, Pillar][];

export function pillarBySlug(slug: string): [PillarKey, Pillar] | undefined {
  return PILLAR_ENTRIES.find(([, pillar]) => pillar.slug === slug);
}
