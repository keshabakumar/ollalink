#!/usr/bin/env bash
# Increment 1: left sidebar shell + workspace context + responsive layout.
set -uo pipefail
NODE=/usr/bin/node; NEXT=/opt/ollalink/node_modules/next/dist/bin/next
cp /tmp/workspace-provider.tsx /opt/ollalink/frontend/dashboard/src/lib/workspace-provider.tsx
cp /tmp/useWorkspace.ts        /opt/ollalink/frontend/dashboard/src/lib/useWorkspace.ts
cp /tmp/sidebar.tsx   "/opt/ollalink/frontend/dashboard/src/app/[locale]/(dashboard)/_components/sidebar.tsx"
cp /tmp/layout.tsx    "/opt/ollalink/frontend/dashboard/src/app/[locale]/(dashboard)/layout.tsx"
echo "files placed"
cd /opt/ollalink/frontend/dashboard
set -e
"$NODE" "$NEXT" build 2>&1 | tail -8
set +e
systemctl restart ollalink-app; sleep 6
echo "app=$(systemctl is-active ollalink-app)"
echo SIDEBAR_DONE
