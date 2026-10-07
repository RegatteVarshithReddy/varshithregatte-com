import {
  readConfig,
  normalizeEmail,
  redirect,
  signToken,
  sendConfirmationEmail,
  verifyTurnstile,
  type Handler,
} from "../_lib/newsletter";

// Step 1 of double opt-in: email a signed confirmation link. Nothing is stored yet.
export const onRequestPost: Handler = async ({ request, env }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return redirect(request, "/newsletter/?error=invalid");

  // Hidden field real users never fill in. Report success so bots learn nothing.
  if (form.get("hp_contact")) return redirect(request, "/newsletter/check-email/");

  const email = normalizeEmail(form.get("email"));
  if (!email) return redirect(request, "/newsletter/?error=invalid");

  if (env.TURNSTILE_SECRET_KEY) {
    const human = await verifyTurnstile(
      env.TURNSTILE_SECRET_KEY,
      form.get("cf-turnstile-response"),
      request.headers.get("CF-Connecting-IP"),
    );
    if (!human) return redirect(request, "/newsletter/?error=captcha");
  }

  const config = readConfig(env);
  if (!config) {
    console.error("Newsletter is not configured: missing Resend or signing-secret variables");
    return redirect(request, "/newsletter/?error=server");
  }

  try {
    const token = await signToken(email, config.secret);
    const confirmUrl = new URL(`/newsletter/confirm/?token=${token}`, request.url).toString();
    await sendConfirmationEmail(config, email, confirmUrl);
  } catch (error) {
    console.error("Failed to send confirmation email", error);
    return redirect(request, "/newsletter/?error=server");
  }

  return redirect(request, "/newsletter/check-email/");
};
