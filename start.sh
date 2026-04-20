#!/bin/bash
cd "$(dirname "$0")"

# Load nvm if present, so `node` is on PATH even if the shell hasn't sourced
# ~/.bashrc since install.sh finished.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Preflight: install.sh is responsible for writing .env with Supabase config.
if [ ! -f .env ] || ! grep -q '^SUPABASE_URL=' .env || ! grep -q '^SUPABASE_ANON_KEY=' .env; then
  echo "Error: .env is missing or incomplete. Run 'bash install.sh' first."
  exit 1
fi

# Preflight: node must be on PATH.
if ! command -v node >/dev/null 2>&1; then
  echo "Error: 'node' not found on PATH."
  echo "If you just finished 'bash install.sh', open a new shell or run:"
  echo "  source ~/.bashrc && bash start.sh"
  exit 1
fi

node --env-file-if-exists=.env src/proxy/index.js &
PROXY=$!

node --env-file-if-exists=.env src/admin/index.js &
ADMIN=$!

stop() {
  echo ""
  kill $PROXY $ADMIN 2>/dev/null
  wait $PROXY $ADMIN 2>/dev/null
}

trap stop INT TERM
wait $PROXY $ADMIN
