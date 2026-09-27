import { readConfig, redirect, verifyToken, addSubscriber, type Handler } from "../_lib/newsletter";

// Step 2 of double opt-in. This only accepts POST: the emailed link opens a page
// with a button, because mail scanners that pre-fetch links would otherwise
// confirm subscriptions on the reader's behalf.
export const onRequestPost: Handler = async ({ request, env }) => {
  const config = readConfig(env);
  if (!config) {
    console.error("Newsletter is not configured: missing Resend or signing-secret variables");
    return redirect(request, "/newsletter/?error=server");
  }

  const form = await request.formData().catch(() => null);
  const email = await verifyToken(form?.get("token"), config.secret);
  if (!email) return redirect(request, "/newsletter/?error=expired");

  try {
    await addSubscriber(config, email);
  } catch (error) {
    console.error("Failed to add subscriber", error);
    return redirect(request, "/newsletter/?error=server");
  }

  return redirect(request, "/newsletter/confirmed/");
};
