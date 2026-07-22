import { Email } from "@convex-dev/auth/providers/Email";
import { internal } from "./_generated/api";

/**
 * Magic email OTP provider (passwordless). The code is logged (dev fallback) AND, when
 * SMTP is configured, emailed via the Node smtp action (e.g. local Mailpit inbox).
 *
 * IMPORTANT: sendVerificationRequest re-throws on failure so the client-side
 * signIn() promise rejects and the user sees an error instead of waiting
 * forever for a code that was never sent.
 */
export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.RESEND_API_KEY,
  maxAge: 60 * 15, // code valid for 15 minutes
  async generateVerificationToken() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => (b % 10).toString()).join("");
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ctx?: { runAction: (ref: unknown, args: unknown) => Promise<unknown> },
  ) {
    console.warn(`[auth] OTP for ${email}: ${token}`); // dev fallback (docker logs)
    try {
      await ctx?.runAction(internal.email.sendEmail, {
        to: email,
        subject: "Your sign-in code",
        text: `Your sign-in code is ${token}`,
      });
    } catch (e) {
      console.error(`[email] OTP send failed for ${email}: ${(e as Error).message}`);
      // Re-throw so the client signIn() rejects and the UI can show an error
      // instead of silently telling the user "code sent" when it wasn't.
      throw new Error("Could not send OTP email. Please try again or contact support.");
    }
  },
});
