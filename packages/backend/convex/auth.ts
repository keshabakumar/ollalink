import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPReset, ResendOTPVerify } from "./passwordProviders";

// Rebuild a proper multi-line PEM from the JWT_PRIVATE_KEY regardless of how it was stored.
// Convex env vars sometimes collapse real newlines/\n escapes into spaces, producing a single-
// line string that jose cannot parse. We strip all whitespace from the base64 body and
// re-wrap at 64 characters to produce a standards-compliant PEM block.
if (process.env.JWT_PRIVATE_KEY) {
  const raw = process.env.JWT_PRIVATE_KEY;
  // Extract base64 body by removing both header/footer and ALL whitespace
  const base64Body = raw
    .replace(/-----BEGIN[^-]+-----/g, "")
    .replace(/-----END[^-]+-----/g, "")
    .replace(/\\n/g, "") // literal \n escapes
    .replace(/[\r\n\s]+/g, ""); // real whitespace
  // Re-wrap at 64 chars per line (standard PEM format)
  const lines = base64Body.match(/.{1,64}/g) ?? [];
  process.env.JWT_PRIVATE_KEY =
    "-----BEGIN PRIVATE KEY-----\n" +
    lines.join("\n") +
    "\n-----END PRIVATE KEY-----";
}

// Full auth: email+password (with strength policy, email verification, and password reset),
// magic email OTP, and Google OAuth (set AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET to activate).
const PasswordWithFlows = Password({
  verify: ResendOTPVerify,
  reset: ResendOTPReset,
  validatePasswordRequirements: (password: string) => {
    if (
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new ConvexError(
        "Password must be at least 8 characters and include upper, lower, and a number.",
      );
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordWithFlows, ResendOTP, Google],
  // Brute-force protection: per-email token bucket (default is 10/hr) on password + OTP.
  signIn: { maxFailedAttempsPerHour: 5 },
});
