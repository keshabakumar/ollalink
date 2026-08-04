#!/usr/bin/env bash
# Frontend: member-management UI + error boundary + 404.
set -uo pipefail
NODE=/usr/bin/node; NEXT=/opt/ollalink/node_modules/next/dist/bin/next
cp /tmp/platform_page.tsx "/opt/ollalink/apps/app/src/app/[locale]/(dashboard)/platform/page.tsx"
cp /tmp/error.tsx     "/opt/ollalink/apps/app/src/app/[locale]/error.tsx"
cp /tmp/not-found.tsx "/opt/ollalink/apps/app/src/app/[locale]/not-found.tsx"
cd /opt/ollalink/apps/app
set -e
"$NODE" "$NEXT" build 2>&1 | tail -8
set +e
systemctl restart ollalink-app; sleep 6
echo "app=$(systemctl is-active ollalink-app)"
echo FRONTEND_DONE
