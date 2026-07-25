import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPReset, ResendOTPVerify } from "./passwordProviders";

// Auto-sanitize JWT_PRIVATE_KEY to single-line format expected by @convex-dev/auth & jose (strips byte 92 '\\n')
if (process.env.JWT_PRIVATE_KEY) {
  process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY
    .replace(/\\n/g, " ")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .trim();
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
