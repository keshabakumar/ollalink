#!/usr/bin/env bash
# Deploy Phase 2 platform modules (audit, usage, apiKeys, orgs) + wired jobs + verify-key route.
set -euo pipefail
NODE=/usr/bin/node
CVX=/opt/ollalink/node_modules/convex/bin/main.js

echo "=== place files ==="
cp /tmp/schema.ts  /opt/ollalink/backend/convex/convex/schema.ts
cp /tmp/audit.ts   /opt/ollalink/backend/convex/convex/audit.ts
cp /tmp/usage.ts   /opt/ollalink/backend/convex/convex/usage.ts
cp /tmp/apiKeys.ts /opt/ollalink/backend/convex/convex/apiKeys.ts
cp /tmp/orgs.ts    /opt/ollalink/backend/convex/convex/orgs.ts
cp /tmp/http.ts    /opt/ollalink/backend/convex/convex/http.ts
cp /tmp/jobs.ts    /opt/ollalink/backend/convex/convex/jobs.ts
echo ok

echo "=== redeploy Convex (Node) ==="
cd /opt/ollalink/backend/convex
"$NODE" "$CVX" deploy -y
echo "PLATFORM_DEPLOY_DONE"
