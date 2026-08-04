#!/usr/bin/env bash
# Deploy follow-on UI: Platform page (invites + events), Files page, nav.
set -uo pipefail
NODE=/usr/bin/node
NEXT=/opt/ollalink/node_modules/next/dist/bin/next
echo "=== place UI files ==="
cp /tmp/platform_page.tsx "/opt/ollalink/apps/app/src/app/[locale]/(dashboard)/platform/page.tsx"
mkdir -p "/opt/ollalink/apps/app/src/app/[locale]/(dashboard)/files"
cp /tmp/files_page.tsx    "/opt/ollalink/apps/app/src/app/[locale]/(dashboard)/files/page.tsx"
cp /tmp/navigation.tsx    "/opt/ollalink/apps/app/src/app/[locale]/(dashboard)/_components/navigation.tsx"
echo ok
echo "=== rebuild (Node) ==="
cd /opt/ollalink/apps/app
set -e
"$NODE" "$NEXT" build
set +e
echo "=== restart ==="
systemctl restart ollalink-app.service
sleep 6
echo "app: $(systemctl is-active ollalink-app.service)"
for r in platform files jobs; do
  curl -fsSL -o /dev/null -w "/en/$r -> %{http_code}\n" "http://127.0.0.1:3000/en/$r" || echo "/en/$r failed"
done
echo "FOLLOWONS_UI_DONE"
