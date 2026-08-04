#!/usr/bin/env bash
# Deploy full auth (password+verify+reset+google) + rebuild app + restart log capture.
set -uo pipefail
NODE=/usr/bin/node; NEXT=/opt/ollalink/node_modules/next/dist/bin/next; CVX=/opt/ollalink/node_modules/convex/bin/main.js
cp /tmp/auth.ts /opt/ollalink/packages/backend/convex/auth.ts
cp /tmp/passwordProviders.ts /opt/ollalink/packages/backend/convex/passwordProviders.ts
cp /tmp/auth-form.tsx /opt/ollalink/apps/app/src/components/auth-form.tsx
cp /tmp/login_page.tsx "/opt/ollalink/apps/app/src/app/[locale]/(public)/login/page.tsx"

cd /opt/ollalink/packages/backend
echo "=== deploy convex ==="
"$NODE" "$CVX" deploy -y 2>&1 | tail -6

echo "=== rebuild app ==="
cd /opt/ollalink/apps/app
"$NODE" "$NEXT" build 2>&1 | tail -5
systemctl restart ollalink-app; sleep 6; echo "app=$(systemctl is-active ollalink-app)"

echo "=== restart log capture (for verify/reset codes) ==="
systemctl stop cvxlogs 2>/dev/null; systemctl reset-failed cvxlogs 2>/dev/null; rm -f /tmp/cvxlogs.txt
systemd-run --unit=cvxlogs --working-directory=/opt/ollalink/packages/backend /bin/bash -lc "/usr/bin/node /opt/ollalink/node_modules/convex/bin/main.js logs > /tmp/cvxlogs.txt 2>&1" >/dev/null 2>&1
sleep 3; echo "cvxlogs=$(systemctl is-active cvxlogs)"
echo AUTH_DEPLOY_DONE
