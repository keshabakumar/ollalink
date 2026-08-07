#!/usr/bin/env bash
# Place the password login UI (was missed in cutover) and rebuild.
set -euo pipefail
NODE=/usr/bin/node
NEXT=/opt/ollalink/node_modules/next/dist/bin/next
cp /tmp/password-signin.tsx /opt/ollalink/frontend/dashboard/src/components/password-signin.tsx
cp /tmp/login_page.tsx "/opt/ollalink/frontend/dashboard/src/app/[locale]/(public)/login/page.tsx"
cd /opt/ollalink/frontend/dashboard
"$NODE" "$NEXT" build 2>&1 | tail -6
systemctl restart ollalink-app
sleep 6
echo "app=$(systemctl is-active ollalink-app)"
curl -sk -o /dev/null -w "login: %{http_code}\n" -L https://10.1.30.14/en/login
echo LOGIN_UI_DONE
