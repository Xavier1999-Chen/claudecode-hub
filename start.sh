#!/bin/bash
cd "$(dirname "$0")"

# Preflight: install.sh is responsible for writing .env with Supabase config.
if [ ! -f .env ] || ! grep -q '^SUPABASE_URL=' .env || ! grep -q '^SUPABASE_ANON_KEY=' .env; then
  echo "Error: .env is missing or incomplete. Run 'bash install.sh' first."
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
