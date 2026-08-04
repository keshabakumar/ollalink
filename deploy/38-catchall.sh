#!/usr/bin/env bash
set -uo pipefail
NODE=/usr/bin/node; NEXT=/opt/ollalink/node_modules/next/dist/bin/next
mkdir -p "/opt/ollalink/apps/app/src/app/[locale]/[...rest]"
cp /tmp/catchall_page.tsx "/opt/ollalink/apps/app/src/app/[locale]/[...rest]/page.tsx"
cd /opt/ollalink/apps/app
set -e
"$NODE" "$NEXT" build 2>&1 | tail -6
set +e
systemctl restart ollalink-app; sleep 6
echo "app=$(systemctl is-active ollalink-app)"
echo CATCHALL_DONE
