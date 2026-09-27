// Shared helpers for the newsletter Pages Functions (/api/subscribe, /api/confirm).
//
// Double opt-in is stateless: /api/subscribe emails a signed, expiring token and
// nothing is stored until the reader confirms, so unconfirmed addresses never
// reach the mailing list.

export interface Env {
  RESEND_API_KEY?: string;
  RESEND_SEGMENT_ID?: string;
  NEWSLETTER_FROM?: string;
  NEWSLETTER_SIGNING_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export type Handler = (context: { request: Request; env: Env }) => Response | Promise<Response>;

export interface Config {
  apiKey: string;
  segmentId: string;
  from: string;
  secret: string;
}

const RESEND_API = "https://api.resend.com";
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const encoder = new TextEncoder();

export function readConfig(env: Env): Config | null {
  const { RESEND_API_KEY, RESEND_SEGMENT_ID, NEWSLETTER_FROM, NEWSLETTER_SIGNING_SECRET } = env;
  if (!RESEND_API_KEY || !RESEND_SEGMENT_ID || !NEWSLETTER_FROM || !NEWSLETTER_SIGNING_SECRET) {
    return null;
  }
  return {
    apiKey: RESEND_API_KEY,
    segmentId: RESEND_SEGMENT_ID,
    from: NEWSLETTER_FROM,
    secret: NEWSLETTER_SIGNING_SECRET,
  };
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function redirect(request: Request, path: string): Response {
  return Response.redirect(new URL(path, request.url).toString(), 303);
}

// --- Signed confirmation tokens -------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signToken(email: string, secret: string, now = Date.now()): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ e: email, x: now + TOKEN_TTL_MS })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the email the token was issued for, or null if it is forged, malformed, or expired. */
export async function verifyToken(token: unknown, secret: string, now = Date.now()): Promise<string | null> {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;

    const { e, x } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return typeof e === "string" && typeof x === "number" && x > now ? e : null;
  } catch {
    return null;
  }
}

// --- Turnstile (optional bot check) ---------------------------------------

export async function verifyTurnstile(secret: string, token: unknown, ip: string | null): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!res.ok) return false;
  const result = (await res.json()) as { success?: boolean };
  return result.success === true;
}

// --- Resend ---------------------------------------------------------------

function resend(config: Config, path: string, method: string, body: unknown): Promise<Response> {
  return fetch(`${RESEND_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function assertOk(res: Response, action: string): Promise<void> {
  if (!res.ok) throw new Error(`Resend ${action} failed: ${res.status} ${await res.text()}`);
}

export async function sendConfirmationEmail(config: Config, email: string, confirmUrl: string): Promise<void> {
  const res = await resend(config, "/emails", "POST", {
    from: config.from,
    to: [email],
    subject: "Confirm your subscription",
    html:
      `<p>Thanks for subscribing to new posts from varshithregatte.com.</p>` +
      `<p><a href="${confirmUrl}">Confirm your subscription</a></p>` +
      `<p>The link expires in 48 hours. If you didn't sign up, you can ignore this email and nothing will happen.</p>`,
    text:
      `Thanks for subscribing to new posts from varshithregatte.com.\n\n` +
      `Confirm your subscription: ${confirmUrl}\n\n` +
      `The link expires in 48 hours. If you didn't sign up, ignore this email and nothing will happen.`,
  });
  await assertOk(res, "send confirmation email");
}

/** Adds the address to the newsletter segment, re-subscribing it if it had unsubscribed. */
export async function addSubscriber(config: Config, email: string): Promise<void> {
  const update = await resend(config, `/contacts/${encodeURIComponent(email)}`, "PATCH", { unsubscribed: false });
  if (update.ok) return;
  if (update.status !== 404) return assertOk(update, "update contact");

  const create = await resend(config, "/contacts", "POST", {
    email,
    unsubscribed: false,
    segments: [{ id: config.segmentId }],
  });
  await assertOk(create, "create contact");
}
