/**
 * Tests the OTP signIn flow via the Convex action API directly.
 * Bypasses the CLI (which strips JSON quotes on Windows).
 *
 * Usage:
 *   node test-otp-action.mjs              -> request a new code
 *   node test-otp-action.mjs <code>       -> verify the code
 */
const CONVEX_URL = "https://good-kingfisher-535.convex.cloud";
const EMAIL = "keshabakumarmaharana@gmail.com";
const code = process.argv[2];

const args = code
  ? { provider: "resend-otp", params: { email: EMAIL, code } }
  : { provider: "resend-otp", params: { email: EMAIL } };

// Convex action endpoint: POST /api/run
const body = {
  path: "auth:signIn",
  format: "json",
  args,
};

console.log(`\n=== Calling auth:signIn (${code ? "verify code " + code : "request code"}) ===`);
console.log("POST", `${CONVEX_URL}/api/run`);
console.log("Body:", JSON.stringify(body));

const res = await fetch(`${CONVEX_URL}/api/run`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(`\nStatus: ${res.status} ${res.statusText}`);
console.log("Response:", text);