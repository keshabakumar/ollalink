#!/usr/bin/env bash
# Deploy the multi-tenant (workspace-scoped) backend refactor.
set -euo pipefail
NODE=/usr/bin/node
CVX=/opt/ollalink/node_modules/convex/bin/main.js
echo "=== place files ==="
for f in schema orgs jobs usage audit apiKeys; do
  cp "/tmp/$f.ts" "/opt/ollalink/backend/convex/convex/$f.ts"
done
echo ok
cd /opt/ollalink/backend/convex
"$NODE" "$CVX" deploy -y
echo "MT_DEPLOY_DONE"
