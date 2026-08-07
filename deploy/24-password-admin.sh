#!/usr/bin/env bash
# Deploy Password provider and create a test admin (email+password). Verify sign-in.
set -uo pipefail
NODE=/usr/bin/node
CVX=/opt/ollalink/node_modules/convex/bin/main.js
cp /tmp/auth.ts /opt/ollalink/backend/convex/convex/auth.ts
cd /opt/ollalink/backend/convex

echo "=== deploy (password provider) ==="
"$NODE" "$CVX" deploy -y 2>&1 | tail -5

echo "=== create admin (signUp) ==="
"$NODE" "$CVX" run auth:signIn '{"provider":"password","params":{"email":"admin@ollalink.test","password":"MyosAdmin#2026","flow":"signUp"}}' 2>&1 | tail -6 || echo "(signUp failed — may already exist)"

echo "=== verify admin sign-in (signIn) ==="
"$NODE" "$CVX" run auth:signIn '{"provider":"password","params":{"email":"admin@ollalink.test","password":"MyosAdmin#2026","flow":"signIn"}}' 2>&1 | tail -6

echo "=== admin user row ==="
"$NODE" "$CVX" data users 2>&1 | grep admin@ollalink.test || echo NO_ADMIN
echo "PWADMIN_DONE"
