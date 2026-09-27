# varshithregatte.com

Personal site and newsletter. Writing on business and life skills, book notes, homelab builds, and AI news.

Built with [Astro](https://astro.build) 7, Tailwind 4 and TypeScript, hosted on Cloudflare Pages.

## Content

Posts are Markdown files in `src/content/<collection>/`. There are four collections ("pillars"):

| Collection   | URL           | Purpose                                     |
| ------------ | ------------- | ------------------------------------------- |
| `writing`    | `/writing`    | Business management and life-skills lessons |
| `book-notes` | `/books`      | Summaries and takeaways from reading        |
| `homelab`    | `/homelab`    | Build logs and lessons from self-hosting    |
| `ai-news`    | `/ai-news`    | Notable AI developments and my take         |

Frontmatter, validated in `src/content.config.ts`:

```yaml
---
title: "Post title"
description: "One sentence used for the listing, SEO and RSS."
pubDate: 2026-07-22
tags: [one, two]        # optional
draft: true             # optional: shown in dev, left out of production builds, the feed and the newsletter
---
```

`book-notes` also accepts `author` and `rating` (1-5). `updatedDate` is optional on all of them.

To add a pillar, register it in both `src/content.config.ts` and `src/lib/pillars.ts`; routes, navigation, the feed and badges pick it up from there.

## Commands

Run from the repo root. Requires Node 22.12 or newer.

| Command                    | Action                                                           |
| :------------------------- | :--------------------------------------------------------------- |
| `npm install`              | Install dependencies                                             |
| `npm run dev`              | Dev server at `localhost:4321` (pages only, no `/api` functions) |
| `npm run build`            | Build the site to `dist/`                                        |
| `npm run preview`          | Preview the production build                                     |
| `npx astro check`          | Typecheck                                                        |
| `npm run dev:functions`    | Build, then serve with the Cloudflare Functions (docs/newsletter.md) |
| `npm run newsletter:draft` | Create Resend newsletter drafts for recent posts (docs/newsletter.md) |

## Deployment

Pushing to `master` runs `.github/workflows/deploy.yml`: build, deploy to Cloudflare Pages, then create
newsletter drafts for any new posts. It needs the `CLOUDFLARE_API_TOKEN` secret and the
`CLOUDFLARE_ACCOUNT_ID` variable in the GitHub repo settings.

The RSS feed is at `/rss.xml` and the sitemap at `/sitemap-index.xml`.

## Newsletter

Signup and sending run on Resend through two Cloudflare Pages Functions in `functions/`. New posts become
unsent drafts that you review and send by hand. Setup, required secrets, and local testing are covered in
[`docs/newsletter.md`](docs/newsletter.md).
