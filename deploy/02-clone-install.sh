#!/usr/bin/env bash
# Clone the Ollalink repo into /opt/ollalink on the VM and install deps.
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"

APP_DIR=/opt/ollalink
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ -z "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  echo "=== clone ollalink/ollalink ==="
  git clone https://github.com/ollalink/ollalink.git .
else
  echo "=== /opt/ollalink not empty, skipping clone ==="
fi

echo "=== bun install ==="
bun install

echo "=== top level ==="
ls -A
echo "CLONE_INSTALL_DONE"
