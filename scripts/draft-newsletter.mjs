// Creates a Resend broadcast *draft* for every recently published post that
// doesn't have one yet. Nothing is sent: review the draft in the Resend
// dashboard (Broadcasts) and press Send when you're happy with it.
//
// Reads the built site in dist/, so run it after `npm run build`. It is
// idempotent: drafts are named after the post's URL path, and posts that already
// have a broadcast (draft or sent) are skipped, so re-runs never duplicate.
//
//   RESEND_API_KEY, RESEND_SEGMENT_ID, NEWSLETTER_FROM   required (a missing API key skips with a warning)
//   NEWSLETTER_REPLY_TO                                  optional
//   NEWSLETTER_WINDOW_DAYS                               only posts this recent get drafts (default 14)
//   DRY_RUN=1                                            print what would be created, call nothing

import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "node-html-parser";

const {
  RESEND_API_KEY,
  RESEND_SEGMENT_ID,
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
  SITE_URL = "https://varshithregatte.com",
  NEWSLETTER_WINDOW_DAYS = "14",
  DIST_DIR = "dist",
  DRY_RUN,
} = process.env;

const dryRun = DRY_RUN === "1";

if (!RESEND_API_KEY && !dryRun) {
  console.log("::warning::Newsletter drafts skipped: RESEND_API_KEY is not set.");
  process.exit(0);
}
if (!dryRun && (!RESEND_SEGMENT_ID || !NEWSLETTER_FROM)) {
  console.error("::error::RESEND_SEGMENT_ID and NEWSLETTER_FROM must be set.");
  process.exit(1);
}

async function resend(path, init = {}) {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Resend ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const escapeHtml = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Post pages are dist/<section>/<slug>/index.html containing the [data-newsletter-body] marker. */
function findPosts() {
  const posts = [];
  for (const section of readdirSync(DIST_DIR, { withFileTypes: true })) {
    if (!section.isDirectory()) continue;
    for (const entry of readdirSync(join(DIST_DIR, section.name), { withFileTypes: true })) {
      const file = join(DIST_DIR, section.name, entry.name, "index.html");
      if (!entry.isDirectory() || !existsSync(file)) continue;

      const page = parse(readFileSync(file, "utf8"));
      const body = page.querySelector("[data-newsletter-body]");
      if (!body) continue;

      const title = page.querySelector("article h1")?.text.trim();
      const published = page.querySelector("article time")?.getAttribute("datetime");
      if (!title || !published) throw new Error(`${file}: could not find the post title and date`);

      const path = `/${section.name}/${entry.name}`;
      const url = new URL(`${path}/`, SITE_URL).href;

      // Emails have no base URL, so make every relative link and image absolute.
      for (const el of body.querySelectorAll("[href], [src]")) {
        for (const attr of ["href", "src"]) {
          const value = el.getAttribute(attr);
          if (value?.startsWith("#")) el.setAttribute(attr, url + value);
          else if (value?.startsWith("//")) el.setAttribute(attr, `https:${value}`);
          else if (value?.startsWith("/")) el.setAttribute(attr, new URL(value, SITE_URL).href);
        }
      }

      posts.push({
        path,
        url,
        title,
        description: page.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
        published: new Date(published),
        bodyHtml: body.innerHTML,
      });
    }
  }
  return posts;
}

async function existingBroadcastNames() {
  const names = new Set();
  let after;
  for (;;) {
    const page = await resend(`/broadcasts?limit=100${after ? `&after=${after}` : ""}`);
    for (const broadcast of page.data) if (broadcast.name) names.add(broadcast.name);
    if (!page.has_more) return names;
    after = page.data.at(-1).id;
  }
}

function renderEmail(post) {
  const date = post.published.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(post.title)}</title>
<style>
  body { margin: 0; padding: 0; background: #ffffff; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #171717; }
  .wrap h1 { font-size: 26px; line-height: 1.25; margin: 4px 0 16px; }
  .wrap h2, .wrap h3 { line-height: 1.3; margin: 28px 0 8px; }
  .wrap p, .wrap ul, .wrap ol { margin: 0 0 16px; }
  .wrap a { color: #171717; }
  .wrap img { max-width: 100%; height: auto; }
  .wrap pre { overflow-x: auto; background: #f5f5f5; padding: 12px; border-radius: 6px; }
  .meta { color: #737373; font-size: 14px; margin: 0; }
  .foot { border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 16px; color: #737373; font-size: 13px; }
  .foot a { color: #737373; }
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(post.description)}</div>
<div class="wrap">
  <p class="meta">${escapeHtml(date)}</p>
  <h1>${escapeHtml(post.title)}</h1>
  ${post.bodyHtml}
  <p><a href="${post.url}">Read this on the web</a></p>
  <div class="foot">
    You're getting this because you subscribed at varshithregatte.com.<br>
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>
  </div>
</div>
</body>
</html>`;
}

const cutoff = Date.now() - Number(NEWSLETTER_WINDOW_DAYS) * 24 * 60 * 60 * 1000;
const recent = findPosts().filter((post) => post.published.getTime() >= cutoff);

if (recent.length === 0) {
  console.log(`No posts published in the last ${NEWSLETTER_WINDOW_DAYS} days; nothing to draft.`);
  process.exit(0);
}

const existing = dryRun && !RESEND_API_KEY ? new Set() : await existingBroadcastNames();
const summary = [];

for (const post of recent) {
  const name = `post:${post.path}`;
  if (existing.has(name)) {
    console.log(`Skipping ${post.path}: a broadcast named "${name}" already exists.`);
    continue;
  }
  if (dryRun) {
    console.log(`[dry run] would create draft "${post.title}" (${name})`);
    continue;
  }

  const created = await resend("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      name,
      segment_id: RESEND_SEGMENT_ID,
      from: NEWSLETTER_FROM,
      ...(NEWSLETTER_REPLY_TO && { reply_to: NEWSLETTER_REPLY_TO }),
      subject: post.title,
      html: renderEmail(post),
      send: false,
    }),
  });
  console.log(`Created draft "${post.title}" (${created.id})`);
  summary.push(`- **${post.title}** — draft \`${created.id}\` (review and send in the Resend dashboard)`);
}

if (summary.length > 0 && process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Newsletter drafts\n\n${summary.join("\n")}\n`);
}
