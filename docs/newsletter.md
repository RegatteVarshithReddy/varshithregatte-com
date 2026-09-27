# Newsletter

Email subscriptions run on [Resend](https://resend.com) (free tier: 1,000 contacts, broadcasts included).
There is no database. Signup uses two Cloudflare Pages Functions, and new posts become **unsent
drafts** in Resend that you review and send by hand.

```
Reader                Cloudflare Pages Functions                     Resend
  │  submit email          │                                            │
  ├──── POST /api/subscribe ──► signs a 48h token, emails the link ────►│ (transactional email)
  │  click link in email   │                                            │
  ├──── GET /newsletter/confirm/?token=…   (static page with a button)  │
  ├──── POST /api/confirm ────► verifies token, adds the contact ──────►│ (contact in segment)
                                                                        │
You merge a post ─► GitHub Actions deploy ─► scripts/draft-newsletter.mjs ─► broadcast DRAFT
You open Resend ─► review / edit the draft ─► Send
```

Why the confirm step is a button, not a plain link: mail scanners pre-fetch links, which would confirm
subscriptions nobody asked for. Scanners don't press buttons.

## One-time setup

### 1. Resend

1. Create a Resend account and **verify your domain** (Domains → Add; add the DNS records at your DNS host).
   The `from` address must be on that domain.
2. Create a **Segment** for subscribers (Audience / Segments) and copy its ID → `RESEND_SEGMENT_ID`.
3. Create an **API key** with full access → `RESEND_API_KEY`. Full access is needed because the site creates
   contacts and CI creates broadcasts. Use two separate keys if you'd rather revoke them independently.

### 2. Cloudflare Pages (runtime for the signup Functions)

Pages project `varshithregatte-com` → Settings → Variables and secrets → Production. Or use the CLI, which
prompts for each value:

```sh
npx wrangler pages secret put RESEND_API_KEY --project-name varshithregatte-com
npx wrangler pages secret put NEWSLETTER_SIGNING_SECRET --project-name varshithregatte-com   # openssl rand -base64 32
npx wrangler pages secret put RESEND_SEGMENT_ID --project-name varshithregatte-com
npx wrangler pages secret put NEWSLETTER_FROM --project-name varshithregatte-com             # Varshith Regatte <newsletter@varshithregatte.com>
```

Set the same names under **Preview** if you want signup to work on PR previews. Without them the form
redirects to a "something went wrong" message and logs `Newsletter is not configured`.

### 3. GitHub (draft creation in CI)

Repo → Settings → Secrets and variables → Actions:

| Kind     | Name                          | Value                                                    |
| -------- | ----------------------------- | -------------------------------------------------------- |
| Secret   | `RESEND_API_KEY`              | Resend API key                                           |
| Variable | `RESEND_SEGMENT_ID`           | Segment ID                                               |
| Variable | `NEWSLETTER_FROM`             | `Varshith Regatte <newsletter@varshithregatte.com>`      |
| Variable | `NEWSLETTER_REPLY_TO`         | Optional reply-to address                                |
| Variable | `PUBLIC_TURNSTILE_SITE_KEY`   | Optional, see below                                      |

Until `RESEND_API_KEY` is set, the deploy workflow still succeeds and prints a "drafts skipped" warning.

### 4. Bot protection (recommended)

The signup form can be abused to make your domain email strangers. It already has a honeypot; add
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) (free) on top:

1. Create a Turnstile widget for `varshithregatte.com`.
2. Site key → GitHub variable `PUBLIC_TURNSTILE_SITE_KEY` (baked into the build).
3. Secret key → Pages secret `TURNSTILE_SECRET_KEY`.

Set both or neither: with a site key but no secret the widget shows but isn't verified; with a secret but no
site key every signup is rejected.

## Sending a post

1. Merge a post to `master`. The deploy workflow publishes the site, then creates a draft in Resend named
   `post:/<section>/<slug>` (subject = post title, body = the post content, unsubscribe link included).
2. Resend → Broadcasts → open the draft, tweak if you like, send.

Details worth knowing:

- Drafts are only created for posts published in the last `NEWSLETTER_WINDOW_DAYS` (default 14), judged by
  the post's `pubDate`. That is what stops old posts from being backfilled. Widen it to draft an older post.
- It is idempotent. A post that already has a broadcast (draft *or* sent) is skipped, so re-running the
  workflow never duplicates. To get a fresh draft, delete the old one in Resend first.
- `draft: true` posts aren't built in production, so they never get a draft.
- Preview locally without touching Resend: `npm run build && DRY_RUN=1 NEWSLETTER_WINDOW_DAYS=365 npm run newsletter:draft`.

## Local development

`npm run dev` (Astro) serves the pages but not the Functions. To exercise `/api/*` locally:

```sh
cp .dev.vars.example .dev.vars   # fill in real or test values
npm run dev:functions            # builds, then serves at http://localhost:8788 via wrangler
```

`dev:functions` pins `--compatibility-date` because the workerd bundled with an older wrangler rejects
"today's" date. Upgrading wrangler removes the need.

## Removing someone / GDPR

Unsubscribe is handled by Resend (the link in every email). To delete a person entirely, remove the contact in
Resend → Contacts. No subscriber data is stored on this site.
