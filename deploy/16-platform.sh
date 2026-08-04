#!/usr/bin/env bash
# Deploy Phase 2 platform modules (audit, usage, apiKeys, orgs) + wired jobs + verify-key route.
set -euo pipefail
NODE=/usr/bin/node
CVX=/opt/ollalink/node_modules/convex/bin/main.js

echo "=== place files ==="
cp /tmp/schema.ts  /opt/ollalink/packages/backend/convex/schema.ts
cp /tmp/audit.ts   /opt/ollalink/packages/backend/convex/audit.ts
cp /tmp/usage.ts   /opt/ollalink/packages/backend/convex/usage.ts
cp /tmp/apiKeys.ts /opt/ollalink/packages/backend/convex/apiKeys.ts
cp /tmp/orgs.ts    /opt/ollalink/packages/backend/convex/orgs.ts
cp /tmp/http.ts    /opt/ollalink/packages/backend/convex/http.ts
cp /tmp/jobs.ts    /opt/ollalink/packages/backend/convex/jobs.ts
echo ok

echo "=== redeploy Convex (Node) ==="
cd /opt/ollalink/packages/backend
"$NODE" "$CVX" deploy -y
echo "PLATFORM_DEPLOY_DONE"
