#!/bin/bash
set -e
cd "$(dirname "$0")"

# ── Check Node.js ────────────────────────────────────────────────────────────
NODE_MAJOR=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null || echo "0")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js 18 or higher is required (found: $(node --version 2>/dev/null || echo 'not installed'))"
  exit 1
fi

echo "Node.js $(node --version) detected"

# ── Install root dependencies ────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
npm install

# ── Build frontend ───────────────────────────────────────────────────────────
echo ""
echo "Building frontend..."
cd src/admin/frontend
npm install
npm run build
cd ../../..

# ── Create config directory ──────────────────────────────────────────────────
mkdir -p config

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "Installation complete."
echo ""
echo "Next steps:"
echo "  1. Run: bash start.sh"
echo "  2. Open admin UI: http://127.0.0.1:3182"
echo "  3. Add a Claude account via the admin UI to get started"
