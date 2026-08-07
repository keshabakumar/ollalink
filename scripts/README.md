# scripts/

Root-level one-off dev/utility scripts. None of these are part of the build
or the deploy runbook — they're manual helpers used during setup & debugging.

| File | Purpose |
| --- | --- |
| `generateKeys.mjs` | Generate the RS256 keypair (JWT_PRIVATE_KEY + JWKS) Convex Auth needs. Writes to OS tmp dir. |
| `set-jwks.mjs` | Set the `JWKS` env var on Convex prod by spawning the convex CLI (avoids Windows shell quote-stripping). Reads the JWKS from `../convex-ready-template-main/.../tmp/jwks`. |
| `set-jwks.ps1` | PowerShell equivalent of `set-jwks.mjs`. |
| `test-otp-action.mjs` | Hit the `auth:signIn` Convex action directly to request/verify an OTP code (bypasses the CLI). |
| `test-auth.json` / `test-signup.json` / `test-query.json` | Request bodies for manual `convex run` / `POST /api/run` calls. |
| `setup-config.json` | Config for the env-setup wizard (Convex + app + web env files). |
| `TEMPLATE.md` | The upstream "dashboard control-plane template" README (kept for reference). |

> Note: `deploy/generateKeys.mjs` is a **different** copy that writes to
> `/tmp/jwt_private_key` + `/tmp/jwks` (absolute) for the VM deploy runbook.
> Keep the two in sync if you change the key format.