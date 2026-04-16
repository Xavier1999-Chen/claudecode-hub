#!/bin/bash
cd "$(dirname "$0")"

node src/proxy/index.js &
PROXY=$!

node src/admin/index.js &
ADMIN=$!

stop() {
  echo ""
  kill $PROXY $ADMIN 2>/dev/null
  wait $PROXY $ADMIN 2>/dev/null
}

trap stop INT TERM
wait $PROXY $ADMIN
