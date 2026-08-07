#!/usr/bin/env bash
# Deploy the Jobs module: place files, redeploy Convex, restart echo backend, rebuild dashboard.
set -euo pipefail
NODE=/usr/bin/node
NEXT=/opt/ollalink/node_modules/next/dist/bin/next
CVX=/opt/ollalink/node_modules/convex/bin/main.js

echo "=== place files ==="
cp /tmp/jobs.ts    /opt/ollalink/backend/convex/convex/jobs.ts
cp /tmp/schema.ts  /opt/ollalink/backend/convex/convex/schema.ts
cp /tmp/http.ts    /opt/ollalink/backend/convex/convex/http.ts
cp /tmp/server.mjs /opt/ollalink/backend/reference-api/server.mjs
mkdir -p "/opt/ollalink/frontend/dashboard/src/app/[locale]/(dashboard)/jobs"
cp /tmp/jobs_page.tsx  "/opt/ollalink/frontend/dashboard/src/app/[locale]/(dashboard)/jobs/page.tsx"
cp /tmp/navigation.tsx "/opt/ollalink/frontend/dashboard/src/app/[locale]/(dashboard)/_components/navigation.tsx"
echo ok

echo "=== redeploy Convex (Node) ==="
cd /opt/ollalink/backend/convex
"$NODE" "$CVX" deploy -y

echo "=== restart echo backend ==="
systemctl restart ollalink-echo.service
sleep 2
echo "echo: $(systemctl is-active ollalink-echo.service)"

echo "=== rebuild dashboard (Node) ==="
cd /opt/ollalink/frontend/dashboard
"$NODE" "$NEXT" build

echo "=== restart dashboard ==="
systemctl restart ollalink-app.service
sleep 6
echo "app: $(systemctl is-active ollalink-app.service)"
curl -fsSL -o /dev/null -w "/en/jobs -> %{http_code}\n" http://127.0.0.1:3000/en/jobs || echo "/en/jobs (auth redirect expected)"
echo "JOBS_DEPLOY_DONE"
