#!/usr/bin/env bash
# Phase 1b: point Convex cloud origin + app build at the CF tunnel URLs (real TLS).
set -uo pipefail
NODE=/usr/bin/node; NEXT=/opt/ollalink/node_modules/next/dist/bin/next; CVX=/opt/ollalink/node_modules/convex/bin/main.js
# shellcheck disable=SC1091
source /opt/ollalink/.tunnel-urls
echo "APP_URL=$APP_URL"; echo "CVX_URL=$CVX_URL"
[ -n "$APP_URL" ] && [ -n "$CVX_URL" ] || { echo "missing tunnel URLs"; exit 1; }

cat > /opt/ollalink/self-hosted/.env <<EOF
DISABLE_BEACON=true
PORT=3210
SITE_PROXY_PORT=3211
DASHBOARD_PORT=6791
CONVEX_CLOUD_ORIGIN=$CVX_URL
CONVEX_SITE_ORIGIN=http://10.1.30.14:3211
NEXT_PUBLIC_DEPLOYMENT_URL=$CVX_URL
EOF
( cd /opt/ollalink/self-hosted && docker compose up -d )
sleep 6

cd /opt/ollalink/backend/convex
"$NODE" "$CVX" env set -- SITE_URL "$APP_URL" >/dev/null && echo "SITE_URL set"

cat > /opt/ollalink/frontend/dashboard/.env <<EOF
NEXT_PUBLIC_CONVEX_URL=$CVX_URL
NEXT_PUBLIC_BACKEND_URL=http://10.1.30.14:4000
EOF
cd /opt/ollalink/frontend/dashboard
"$NODE" "$NEXT" build 2>&1 | tail -4
systemctl restart ollalink-app; sleep 6
echo "app=$(systemctl is-active ollalink-app)"
echo "=== checks ==="
curl -s -o /dev/null -w "app tunnel /en/login: %{http_code}\n" -L "$APP_URL/en/login"
curl -s -o /dev/null -w "cvx tunnel /version: %{http_code}\n" "$CVX_URL/version"
echo CF_CUTOVER_DONE
