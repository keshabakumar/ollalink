#!/usr/bin/env bash
# Write production .env for both Next apps (pointing at the VM's Convex backend),
# then build the whole monorepo. Sequential build to stay within the VM's RAM.
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
VM_IP=10.1.30.14
cd /opt/ollalink

echo "=== frontend/dashboard/.env ==="
cat > frontend/dashboard/.env <<EOF
NEXT_PUBLIC_CONVEX_URL=http://${VM_IP}:3210
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=
OPENPANEL_SECRET_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
EOF

echo "=== frontend/marketing/.env ==="
cat > frontend/marketing/.env <<EOF
NEXT_PUBLIC_CONVEX_URL=http://${VM_IP}:3210
NEXT_PUBLIC_APP_URL=http://${VM_IP}:3000
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=
OPENPANEL_SECRET_KEY=
NEXT_PUBLIC_CAL_LINK=
EOF

echo "=== build (turbo, concurrency=1) ==="
bun run build --concurrency=1

echo "=== build outputs ==="
ls -d frontend/dashboard/.next frontend/marketing/.next 2>/dev/null && echo "both .next dirs present"
echo "BUILD_DONE"
