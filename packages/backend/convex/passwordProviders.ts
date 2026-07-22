import { Email } from "@convex-dev/auth/providers/Email";
import { internal } from "./_generated/api";

// Email providers for password-reset and email-verification codes.
// The code is logged (dev fallback) AND, when SMTP is configured, emailed via the
// Node smtp action (e.g. a local Mailpit inbox).
//
// IMPORTANT: sendVerificationRequest re-throws on failure so the client-side
// signIn() promise rejects and the user sees an error instead of waiting
// forever for a code that was never sent.

type Ctx = { runAction: (ref: unknown, args: unknown) => Promise<unknown> };

function genCode() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => (x % 10).toString()).join("");
}
async function send(ctx: Ctx | undefined, label: string, email: string, token: string) {
  console.warn(`[auth] ${label} code for ${email}: ${token}`); // dev fallback
  try {
    await ctx?.runAction(internal.email.sendEmail, {
      to: email,
      subject: `Your ${label} code`,
      text: `Your ${label} code is ${token}`,
    });
  } catch (e) {
    console.error(`[email] ${label} send failed for ${email}: ${(e as Error).message}`);
    // Re-throw so the client signIn() rejects and the UI can show an error
    // instead of silently telling the user "code sent" when it wasn't.
    throw new Error(`Could not send ${label} email. Please try again or contact support.`);
  }
}

export const ResendOTPVerify = Email({
  id: "verify-otp",
  apiKey: process.env.RESEND_API_KEY,
  maxAge: 60 * 15,
  generateVerificationToken: async () => genCode(),
  sendVerificationRequest: async (
    { identifier, token }: { identifier: string; token: string },
    ctx?: Ctx,
  ) => send(ctx, "email verification", identifier, token),
});

export const ResendOTPReset = Email({
  id: "password-reset",
  apiKey: process.env.RESEND_API_KEY,
  maxAge: 60 * 15,
  generateVerificationToken: async () => genCode(),
  sendVerificationRequest: async (
    { identifier, token }: { identifier: string; token: string },
    ctx?: Ctx,
  ) => send(ctx, "password reset", identifier, token),
});
