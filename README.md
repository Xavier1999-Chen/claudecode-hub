# claudecode-hub

A self-hosted proxy that lets multiple Claude Code terminals share a pool of Anthropic accounts, with automatic rate-limit-aware routing and a web-based admin dashboard.

## Quick Start

**Prerequisites:** Node.js 18+, running on Linux / macOS / WSL

<details>
<summary>Install Node.js (if not already installed)</summary>

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install --lts
```

</details>

```bash
git clone https://github.com/Xavier1999-Chen/claudecode-hub.git
cd claudecode-hub
bash install.sh
bash start.sh
```

Then open the admin UI at **http://127.0.0.1:3182** and:

1. Click **添加账号** to log in with your Anthropic account via OAuth
2. Go to the **终端** tab and click **新建** to create a terminal — you'll get an API key (`sk-hub-...`)
3. Point Claude Code at the proxy:

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:3180
export ANTHROPIC_API_KEY=sk-hub-...   # the key from step 2
claude
```

## Ports

| Service | Default port | Override |
|---------|-------------|---------|
| Proxy   | 3180        | `PROXY_PORT` env var |
| Admin   | 3182        | `ADMIN_PORT` env var |

## Project structure

```
src/
  proxy/      # API proxy server (forwards requests to Anthropic)
  admin/      # Admin server + React dashboard
  shared/     # Config store, name generator
config/       # Runtime data (gitignored: accounts.json, terminals.json)
logs/         # Usage logs per account (gitignored)
```
