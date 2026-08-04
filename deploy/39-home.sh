#!/usr/bin/env bash
# Home overview: stats query + dashboard home rebuild.
set -uo pipefail
NODE=/usr/bin/node; NEXT=/opt/ollalink/node_modules/next/dist/bin/next; CVX=/opt/ollalink/node_modules/convex/bin/main.js
cp /tmp/dashboard.ts /opt/ollalink/packages/backend/convex/dashboard.ts
cp /tmp/home_page.tsx "/opt/ollalink/apps/app/src/app/[locale]/(dashboard)/page.tsx"
cd /opt/ollalink/packages/backend
set -e
"$NODE" "$CVX" deploy -y 2>&1 | tail -2
cd /opt/ollalink/apps/app
"$NODE" "$NEXT" build 2>&1 | tail -5
set +e
systemctl restart ollalink-app; sleep 6
echo "app=$(systemctl is-active ollalink-app)"
echo HOME_DONE
