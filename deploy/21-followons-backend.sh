#!/usr/bin/env bash
# Deploy follow-ons: invite accept flow, workspace-scoped events, files module.
set -euo pipefail
NODE=/usr/bin/node
CVX=/opt/ollalink/node_modules/convex/bin/main.js
echo "=== place files ==="
for f in schema orgs backend http files; do
  cp "/tmp/$f.ts" "/opt/ollalink/backend/convex/convex/$f.ts"
done
echo ok
cd /opt/ollalink/backend/convex
"$NODE" "$CVX" deploy -y
echo "FOLLOWONS_DEPLOY_DONE"
