#!/usr/bin/env bash
# One-off: verify the legacy admin account so password sign-in works under mandatory verification.
set -uo pipefail
N=/usr/bin/node; C=/opt/ollalink/node_modules/convex/bin/main.js
cd /opt/ollalink/backend/convex
OUT=$("$N" "$C" run auth:signIn '{"provider":"password","params":{"email":"admin@ollalink.test","password":"MyosAdmin#2026","flow":"signIn"}}' 2>&1)
CODE=$(printf '%s' "$OUT" | grep -oE "email verification code for admin@ollalink.test: [0-9]+" | grep -oE '[0-9]+$' | tail -1)
echo "verify code=$CODE"
"$N" "$C" run auth:signIn "{\"provider\":\"password\",\"params\":{\"email\":\"admin@ollalink.test\",\"code\":\"$CODE\",\"flow\":\"email-verification\"}}" 2>&1 | tail -3
echo "-- admin password sign-in now: --"
"$N" "$C" run auth:signIn '{"provider":"password","params":{"email":"admin@ollalink.test","password":"MyosAdmin#2026","flow":"signIn"}}' 2>&1 | grep -q '"token"' && echo "ADMIN_SIGNIN_OK" || echo "STILL_BLOCKED"
