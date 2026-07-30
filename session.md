# Session Log — Ollalink Auth Debugging

## Date: 2026-07-23

## Project

- **Frontend (Vercel):** https://ollalink-app.vercel.app
- **Convex Backend (Prod):** https://good-kingfisher-535.convex.cloud
- **Convex Backend (Dev):** https://fantastic-emu-179.convex.cloud
- **Convex Team:** keshaba-kumar-maharana
- **Convex Project:** ollalink

---

## What Was Done

### 1. Diagnosed the Auth Issue
- Tested all routes on the Vercel deployment — all working (login 200, dashboard redirects to login correctly)
- Found the Convex URL (`good-kingfisher-535.convex.cloud`) from the client-side JS chunks
- Tested auth endpoints directly via Convex API
- **Root cause found:** `JWT_PRIVATE_KEY` environment variable was missing on the Convex deployment, causing `generateToken()` in `tokens.js` to throw "Missing environment variable `JWT_PRIVATE_KEY`"

### 2. Generated JWT Keypair
- Ran `scripts/generateKeys.mjs` (fixed for Windows — original script wrote to `/tmp` which doesn't exist on Windows)
- Generated keys saved to:
  - `tmp/jwt_private_key` — RSA private key (PKCS8 format, with real newlines)
  - `tmp/jwks` — JWKS public key JSON

### 3. Logged In to Convex CLI
- Used `npx convex login` (device flow via browser)
- Authenticated successfully to team `keshaba-kumar-maharana`

### 4. Set Environment Variables on PRODUCTION Deployment
All set on `good-kingfisher-535` (prod):
- `JWT_PRIVATE_KEY` — RSA private key (PKCS8)
- `JWKS` — JWKS public key JSON
- `SITE_URL` — `https://ollalink-app.vercel.app`
- `AUTH_GOOGLE_ID` — `dummy` (replace with real Google OAuth client ID)
- `AUTH_GOOGLE_SECRET` — `dummy` (replace with real Google OAuth client secret)
- `POLAR_ORGANIZATION_TOKEN` — `dummy` (replace with real Polar token)
- `POLAR_WEBHOOK_SECRET` — `dummy` (replace with real Polar webhook secret)

Already set by user:
- `RESEND_API_KEY` — `re_***redacted***`
- `RESEND_SENDER_EMAIL_AUTH` — `onboarding@resend.dev`

### 5. Deployed Backend to Production
- Ran `npx convex deploy` — deployed to `https://good-kingfisher-535.convex.cloud`
- Auth functions now load (no more `JWT_PRIVATE_KEY` missing error)

### 6. Initial Auth Flow Tests (previous session)
- **Email OTP** (`resend-otp`): ✅ Works — returns `{"started":true}`, code sent
- **Password sign-in** (`flow:"signIn"`): ❌ `InvalidSecret` — password didn't match stored hash
- **Password sign-up** (`flow:"signUp"`): ❌ Account already exists for `keshabakumarmaharana@gmail.com`
- **Password reset** (`flow:"reset"`): ✅ Reset code generated and logged: `37319672`
- **Password reset verification** (`flow:"reset-verification"`): ❌ `InvalidCharacterError: Failed to execute 'atob': Invalid byte 92, offset 0`

### 7. RESOLVED — Password reset verification now works (current session)

The previous `atob`/`InvalidCharacterError` (byte 92 = backslash) blocker is **gone**. `JWT_PRIVATE_KEY` on prod is now in a format that `jose`'s `importPKCS8` accepts (the env list shows spaces where newlines were — `jose` strips whitespace before base64 decoding, so this is valid).

All three Convex auth flows have been verified end-to-end via `npx convex run auth:signIn --prod`:

- **resend-otp** (request + verify): ✅ Code `00329545` generated; verification returns `{ tokens: { refreshToken, token } }`
- **password reset** (`flow:"reset"`): ✅ Reset code `22349633` generated
- **password reset-verification** (`flow:"reset-verification"`): ✅ With `newPassword: "Test@1234"` returns tokens — NO `atob` error
- **password signIn** (`flow:"signIn"`): ✅ With `password: "Test@1234"` returns tokens

> Note: `npx convex run` on Windows prints `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94` after successful output — this is a known Node.js/uv process-cleanup bug on Windows and does NOT indicate an auth failure. The JSON output above the assertion is the real result.

---

## Remaining Tasks

### A. Set real Google OAuth credentials
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set to `dummy`
- Google sign-in won't work until real credentials are set
- Google OAuth redirect URI should be: `https://good-kingfisher-535.convex.site/api/auth/callback/google`

### B. Set real Polar credentials
- `POLAR_ORGANIZATION_TOKEN` and `POLAR_WEBHOOK_SECRET` are set to `dummy`
- Billing won't work until real credentials are set
- Polar webhook URL should be: `https://good-kingfisher-535.convex.site/polar/events`

### C. Redeploy Vercel frontend (if needed)
- The frontend already has `NEXT_PUBLIC_CONVEX_URL=https://good-kingfisher-535.convex.cloud`
- No redeploy needed unless env vars on Vercel changed

---

## File Locations
- JWT Private Key: `convex-ready-template-main/convex-ready-template-main/tmp/jwt_private_key`
- JWKS Public Key: `convex-ready-template-main/convex-ready-template-main/tmp/jwks`
- Backend .env.local: `convex-ready-template-main/convex-ready-template-main/packages/backend/.env.local`
- Auth config: `convex-ready-template-main/convex-ready-template-main/packages/backend/convex/auth.ts`
- Key generation script: `convex-ready-template-main/convex-ready-template-main/scripts/generateKeys.mjs`

## Convex CLI Commands Reference
```bash
# Login
cd packages/backend && npx convex login

# Set env var on prod
npx convex env set <NAME> --prod -- "<value>"

# List env vars on prod
npx convex env list --prod

# Deploy to prod
npx convex deploy --yes

# Run a function on prod
npx convex run auth:signIn --prod '{"provider":"password","params":{"email":"...","password":"...","flow":"signIn"}}'

# Watch logs
npx convex logs --prod
```

---

## Status Summary

| Item                        | Status                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| Vercel frontend             | ✅ Deployed and working                                               |
| Convex backend deployed     | ✅ Deployed to prod (good-kingfisher-535)                             |
| JWT keys generated          | ✅ In `tmp/` folder                                                   |
| JWT_PRIVATE_KEY set on prod | ✅ Working (spaces instead of newlines — `jose` strips whitespace)    |
| JWKS set on prod            | ✅ Working                                                            |
| Email OTP auth              | ✅ Verified end-to-end (code generated + JWT issued)                  |
| Password reset              | ✅ Verified end-to-end (reset code → reset-verification → JWT issued) |
| Password sign-in            | ✅ Verified with new password `Test@1234`                             |
| Google OAuth                | ❌ Dummy credentials (AUTH_GOOGLE_ID=dummy)                           |
| Polar billing               | ❌ Dummy credentials                                                  |
| Test account                | `keshabakumarmaharana@gmail.com`, password reset to `Test@1234`       |
