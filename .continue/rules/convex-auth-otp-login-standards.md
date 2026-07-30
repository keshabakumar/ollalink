---
description: When fixing login/OTP issues in Convex Auth + Next.js apps
alwaysApply: false
---

When working with @convex-dev/auth email OTP login flows:

1. ALWAYS add `router.push("/")` + `router.refresh()` after successful `signIn()` calls in client components — the middleware only runs on navigation, so without an explicit redirect the user stays on the login page even after the auth cookie is set.

2. ALWAYS set `JWT_PRIVATE_KEY` as a single-line string (newlines replaced with spaces) — never a multi-line PEM. Use the repo's `scripts/generateKeys.mjs` to generate a matched keypair.

3. ALWAYS set `JWT_PRIVATE_KEY` and `JWKS` together as a matched pair — if they don't correspond, token verification fails with a crypto error.

4. In Convex Auth `sendVerificationRequest`, ALWAYS re-throw on email-sending failure (don't just `console.warn`). Otherwise the client `signIn()` resolves successfully and the user is told "code sent" when no code was ever sent.

5. In Next.js middleware using `next-international` with `urlMappingStrategy: "rewrite"`, the route matcher MUST include locale-prefixed variants (e.g. `["/login", "/:locale/login"]`) — a bare `/login` matcher misses `/en/login`, `/fr/login`, etc.

6. `CONVEX_SITE_URL` is a built-in Convex env var and CANNOT be set via the API — it's managed by Convex automatically based on the deployment.