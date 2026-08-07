#!/usr/bin/env bash
# Seed a large workspace and profile read-amplification of count-by-collect queries.
set -uo pipefail
N=/usr/bin/node; C=/opt/ollalink/node_modules/convex/bin/main.js
cp /tmp/seed.ts          /opt/ollalink/backend/convex/convex/seed.ts
cp /tmp/schema.ts        /opt/ollalink/backend/convex/convex/schema.ts
cp /tmp/notifications.ts /opt/ollalink/backend/convex/convex/notifications.ts
cd /opt/ollalink/backend/convex
echo "=== deploy (index backfill) ==="
"$N" "$C" deploy -y 2>&1 | tail -2
A=$("$N" "$C" run jobs:firstUserId 2>&1 | tail -1 | tr -d '"[:space:]')
WS=$("$N" "$C" run orgs:createWorkspaceForUser "{\"userId\":\"$A\",\"name\":\"LoadTest\"}" 2>&1 | tail -1 | tr -d '"[:space:]')
echo "seeding 8000 jobs + 5000 notifications (user=$A ws=$WS)..."
for i in 1 2 3 4; do "$N" "$C" run seed:seedJobs "{\"workspaceId\":\"$WS\",\"userId\":\"$A\",\"count\":2000}" >/dev/null 2>&1; done
for i in 1 2; do "$N" "$C" run seed:seedNotifications "{\"userId\":\"$A\",\"count\":2500}" >/dev/null 2>&1; done
echo "=== PROFILE (rowsRead = docs scanned per reactive re-render) ==="
printf 'dashboard.stats  -> '; "$N" "$C" run seed:profileStats "{\"workspaceId\":\"$WS\"}" 2>&1 | tail -1
printf 'unreadCount OLD  -> '; "$N" "$C" run seed:profileUnreadOld "{\"userId\":\"$A\"}" 2>&1 | tail -1
printf 'unreadCount NEW  -> '; "$N" "$C" run seed:profileUnreadNew "{\"userId\":\"$A\"}" 2>&1 | tail -1
echo PROFILE_DONE
