#!/bin/bash
set -e
cd "$(dirname "$0")"

# Ask yes/no with default Y. Returns 0 (yes) or 1 (no).
confirm_default_yes() {
  local prompt="$1"
  local ans
  read -r -p "$prompt [Y/n]: " ans
  case "$ans" in
    n|N|no|NO) return 1 ;;
    *) return 0 ;;
  esac
}

# ── Node.js check (auto-install via nvm if missing/old) ──────────────────────
node_major() {
  node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null || echo "0"
}

NODE_MAJOR=$(node_major)
if [ "$NODE_MAJOR" -lt 22 ]; then
  FOUND=$(node --version 2>/dev/null || echo "not installed")
  echo ""
  echo "Node.js 22+ is required (found: $FOUND)."
  echo "Install Node 22 via nvm now? This will:"
  echo "  - Install nvm to ~/.nvm (downloads install.sh from nvm-sh/nvm)"
  echo "  - Install and switch to Node 22"
  if confirm_default_yes ""; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    nvm alias default 22
    NODE_MAJOR=$(node_major)
    if [ "$NODE_MAJOR" -lt 22 ]; then
      echo ""
      echo "Error: Node 22 installation did not complete successfully."
      echo "Install manually: https://nodejs.org/  or  nvm install 22"
      exit 1
    fi
  else
    echo ""
    echo "Manual install:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
    echo "  source ~/.bashrc"
    echo "  nvm install 22 && nvm use 22"
    exit 1
  fi
fi
echo "Node.js $(node --version) detected"

# ── tmux check (auto-install if missing) ─────────────────────────────────────
if ! command -v tmux >/dev/null 2>&1; then
  echo ""
  echo "tmux is required (used by the OAuth login flow for adding Anthropic accounts)."
  INSTALL_CMD=""
  if command -v apt-get >/dev/null 2>&1; then
    INSTALL_CMD="sudo apt-get update && sudo apt-get install -y tmux"
  elif command -v brew >/dev/null 2>&1; then
    INSTALL_CMD="brew install tmux"
  else
    echo "Error: no supported package manager found (apt-get or brew)."
    echo "Install tmux manually from your distro's package repository."
    exit 1
  fi
  echo "Install tmux now? This will run:"
  echo "  $INSTALL_CMD"
  echo "(sudo may prompt for your password)"
  if confirm_default_yes ""; then
    eval "$INSTALL_CMD"
    if ! command -v tmux >/dev/null 2>&1; then
      echo ""
      echo "Error: tmux install did not complete successfully."
      exit 1
    fi
  else
    echo "Manual install:"
    echo "  $INSTALL_CMD"
    exit 1
  fi
fi
echo "tmux $(tmux -V | awk '{print $2}') detected"

# ── Claude Code CLI check (auto-install if missing) ──────────────────────────
# The OAuth login flow in src/admin/oauth-login.js spawns `claude login` inside
# a tmux session; without the CLI, users can't add Anthropic accounts.
if ! command -v claude >/dev/null 2>&1; then
  echo ""
  echo "Claude Code CLI (the \`claude\` command) is required to add Anthropic accounts"
  echo "through the OAuth flow. Install it globally via npm now?"
  echo "This will run: npm install -g @anthropic-ai/claude-code"
  if confirm_default_yes ""; then
    npm install -g @anthropic-ai/claude-code
    if ! command -v claude >/dev/null 2>&1; then
      echo ""
      echo "Error: claude CLI install did not complete successfully."
      echo "Try manually: npm install -g @anthropic-ai/claude-code"
      exit 1
    fi
  else
    echo ""
    echo "Manual install:"
    echo "  npm install -g @anthropic-ai/claude-code"
    exit 1
  fi
fi
echo "Claude Code CLI $(claude --version 2>/dev/null | head -1 || echo 'detected')"

# ── Supabase environment setup ───────────────────────────────────────────────
# Admin server requires SUPABASE_URL + SUPABASE_ANON_KEY to verify JWTs.
# Frontend requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY for auth.
if [ -f .env ] && grep -q '^SUPABASE_URL=' .env && grep -q '^SUPABASE_ANON_KEY=' .env; then
  echo "Supabase config found in .env — reusing."
  # Backfill marketing/.env.local for upgrades from older installs that
  # predate the marketing site (issue: re-running install.sh skipped the
  # interactive setup branch and never created marketing's env file).
  if [ ! -f marketing/.env.local ]; then
    SB_URL=$(grep '^SUPABASE_URL=' .env | cut -d= -f2-)
    SB_KEY=$(grep '^SUPABASE_ANON_KEY=' .env | cut -d= -f2-)
    cat > marketing/.env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SB_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SB_KEY
NEXT_PUBLIC_ADMIN_URL=http://localhost:3182
# Cross-subdomain cookie sharing in production (e.g. ".example.com").
# Leave empty for local dev — host-only cookies work across localhost ports.
NEXT_PUBLIC_COOKIE_DOMAIN=
EOF
    echo "marketing/.env.local created from existing .env (upgrade path)."
  fi
else
  cat <<'INFO'

────── Supabase setup ──────
This project uses Supabase for user login/registration.

  1. Create a free project:  https://supabase.com/dashboard
  2. Open the API settings:  https://supabase.com/dashboard/project/_/settings/api
     (Supabase will redirect `_` to your actual project.)
  3. Copy these two values and paste them below:
     - Project URL           (e.g.  https://xxxxxxxxxxxxxxxx.supabase.co)
     - anon public key       (e.g.  sb_publishable_xxxxx...)

INFO
  read -r -p "SUPABASE_URL: " SB_URL
  read -r -p "SUPABASE_ANON_KEY: " SB_KEY

  if [ -z "$SB_URL" ]; then
    echo ""
    echo "Error: SUPABASE_URL is empty."
    echo "Re-run 'bash install.sh' and paste the Project URL from"
    echo "  https://supabase.com/dashboard/project/_/settings/api"
    exit 1
  fi
  if [ -z "$SB_KEY" ]; then
    echo ""
    echo "Error: SUPABASE_ANON_KEY is empty."
    echo "Re-run 'bash install.sh' and paste the anon public key from"
    echo "  https://supabase.com/dashboard/project/_/settings/api"
    exit 1
  fi

  cat > .env <<EOF
SUPABASE_URL=$SB_URL
SUPABASE_ANON_KEY=$SB_KEY
EOF
  cat > src/admin/frontend/.env.local <<EOF
VITE_MOCK=false
VITE_SUPABASE_URL=$SB_URL
VITE_SUPABASE_ANON_KEY=$SB_KEY
# Cross-subdomain cookie sharing in production (e.g. ".example.com").
# Leave empty for local dev — host-only cookies work across localhost ports.
VITE_COOKIE_DOMAIN=
EOF
  # Marketing site (Next.js) reads NEXT_PUBLIC_ vars at build time.
  # ADMIN_URL points to the admin app for cross-app login/console links;
  # default to localhost during install — user should adjust for production
  # (e.g. https://app.example.com) and rebuild via 'cd marketing && npm run build'.
  cat > marketing/.env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SB_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SB_KEY
NEXT_PUBLIC_ADMIN_URL=http://localhost:3182
# Cross-subdomain cookie sharing in production (e.g. ".example.com").
# Leave empty for local dev — host-only cookies work across localhost ports.
NEXT_PUBLIC_COOKIE_DOMAIN=
EOF
  echo ".env, src/admin/frontend/.env.local, and marketing/.env.local written."
fi

# ── Install root dependencies ────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
npm install

# ── Build admin frontend ─────────────────────────────────────────────────────
echo ""
echo "Building admin frontend..."
cd src/admin/frontend
npm install
npm run build
cd ../../..

# ── Build marketing site (Next.js) ───────────────────────────────────────────
echo ""
echo "Building marketing site..."
cd marketing
npm install
npm run build
cd ..

# ── Create config directory ──────────────────────────────────────────────────
mkdir -p config

# ── Done ─────────────────────────────────────────────────────────────────────
cat <<'DONE'

Installation complete.

Remaining manual steps (all in the Supabase Dashboard):

  1. Apply the migration — SQL Editor:
       https://supabase.com/dashboard/project/_/sql/new
     Paste the contents of supabase/migrations/20260420000000_user_approval.sql and Run.

  2. Configure auth URLs — Authentication → URL Configuration:
       https://supabase.com/dashboard/project/_/auth/url-configuration
     - Site URL:        http://<your-host>:3182
     - Redirect URLs:   http://<your-host>:3182/**
                        http://localhost:3182/**

  3. Start the services (admin :3182 + proxy :3180 + marketing :3183):
       bash start.sh

  4. Visit:
     - Marketing site:   http://<your-host>:3183
     - Admin dashboard:  http://<your-host>:3182

  5. Register at http://<your-host>:3182, verify email, then promote yourself
     to admin via SQL Editor:
       UPDATE public.user_requests
       SET status='approved', role='admin'
       WHERE email='you@example.com';

  6. Sign out and sign back in to pick up the admin JWT.

  7. (Production only) If admin lives on a different host/port from
     localhost:3182, update marketing/.env.local's NEXT_PUBLIC_ADMIN_URL
     and rebuild: cd marketing && npm run build

DONE
