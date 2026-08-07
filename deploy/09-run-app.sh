#!/usr/bin/env bash
# Build frontend/dashboard (the dashboard app) under Node and run it as a systemd service on :3000.
set -uo pipefail
NODE=/usr/bin/node
NEXT=/opt/ollalink/node_modules/next/dist/bin/next
VM_IP=10.1.30.14

echo "=== write frontend/dashboard/.env ==="
cat > /opt/ollalink/frontend/dashboard/.env <<EOF
NEXT_PUBLIC_CONVEX_URL=http://${VM_IP}:3210
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=
OPENPANEL_SECRET_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
EOF

echo "=== build frontend/dashboard (Node) ==="
cd /opt/ollalink/frontend/dashboard
set -e
"$NODE" "$NEXT" build
set +e

echo "=== systemd unit (Next under Node) ==="
cat > /etc/systemd/system/ollalink-app.service <<'UNIT'
[Unit]
Description=Ollalink dashboard (Next.js frontend/dashboard)
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/ollalink/frontend/dashboard
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node /opt/ollalink/node_modules/next/dist/bin/next start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now ollalink-app.service
sleep 7
echo "=== status ==="
systemctl --no-pager --full status ollalink-app.service | head -14
echo "=== curl checks ==="
curl -fsSL -o /dev/null -w "/ -> %{http_code}\n" http://127.0.0.1:3000/ || echo "/ failed"
curl -fsSL -o /dev/null -w "/en/login -> %{http_code}\n" http://127.0.0.1:3000/en/login || echo "/en/login failed"
echo "RUN_APP_DONE"
