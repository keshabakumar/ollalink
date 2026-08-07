#!/usr/bin/env bash
# Pagination/load-more on jobs + files.
set -uo pipefail
NODE=/usr/bin/node; NEXT=/opt/ollalink/node_modules/next/dist/bin/next; CVX=/opt/ollalink/node_modules/convex/bin/main.js
cp /tmp/jobs.ts  /opt/ollalink/backend/convex/convex/jobs.ts
cp /tmp/files.ts /opt/ollalink/backend/convex/convex/files.ts
cp /tmp/jobs_page.tsx  "/opt/ollalink/frontend/dashboard/src/app/[locale]/(dashboard)/jobs/page.tsx"
cp /tmp/files_page.tsx "/opt/ollalink/frontend/dashboard/src/app/[locale]/(dashboard)/files/page.tsx"
cd /opt/ollalink/backend/convex
set -e
"$NODE" "$CVX" deploy -y 2>&1 | tail -2
cd /opt/ollalink/frontend/dashboard
"$NODE" "$NEXT" build 2>&1 | tail -4
set +e
systemctl restart ollalink-app; sleep 6
echo "app=$(systemctl is-active ollalink-app)"
echo PAGINATION_DONE
