#!/usr/bin/env bash
set -uo pipefail
cd /opt/ollalink/backend/convex
N=/usr/bin/node; C=/opt/ollalink/node_modules/convex/bin/main.js
rm -f /tmp/cvxlogs.txt
( timeout 12 "$N" "$C" logs > /tmp/cvxlogs.txt 2>&1 & )
sleep 3
"$N" "$C" run auth:signIn '{"provider":"resend-otp","params":{"email":"cap2@ollalink.test"}}' >/dev/null 2>&1
sleep 5
echo "=== cvxlogs tail ==="
tail -15 /tmp/cvxlogs.txt
echo "=== grep ==="
grep -iE "OTP for cap2" /tmp/cvxlogs.txt || echo NO_CAPTURE
