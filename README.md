# claudecode-hub

A self-hosted proxy that lets multiple Claude Code terminals share a pool of Anthropic accounts, with automatic rate-limit-aware routing and a web-based admin dashboard. Access is gated by Supabase email auth with role-based permissions (admin manages the account pool; regular users manage their own terminals).

## Quick Start

**Prerequisites:** Linux / macOS / WSL, a free [Supabase](https://supabase.com/) project. `install.sh` auto-installs the rest on demand (Node.js 22 via nvm, tmux via apt/brew, Claude Code CLI via npm).

```bash
git clone https://github.com/Xavier1999-Chen/claudecode-hub.git
cd claudecode-hub
bash install.sh          # interactive — prompts for Supabase URL + anon key, installs deps, builds frontend
```

Follow the manual steps `install.sh` prints at the end (Supabase migration + auth URLs + first-admin promotion). Then pick a startup mode:

- **`bash start.sh`** — runs in the foreground. Good for local dev or quick testing; services stop when the terminal closes.
- **`bash start-bg.sh`** — runs inside a detached tmux session. Good for servers — survives SSH disconnects. See [Running in the background](#running-in-the-background) for attach/stop commands.

Once logged in as admin:

1. Click **+ 添加账号** (admin-only) → log in with your Anthropic account via OAuth
2. Go to the **终端** tab, click **+ 新建终端** — you get an API key (`sk-hub-...`)
3. Point Claude Code at the proxy:

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:3180
export ANTHROPIC_API_KEY=sk-hub-...   # the key from step 2
claude
```

**From another machine on the same LAN**, replace `127.0.0.1` with the server's LAN IP (check with `ip addr` or `hostname -I`). For production or multi-user deployments, see the [Advanced — HTTPS with a custom domain](#advanced--https-with-a-custom-domain-caddy) section below.

## Ports

| Service | Default port | Override |
|---------|-------------|---------|
| Proxy   | 3180        | `PROXY_PORT` env var |
| Admin   | 3182        | `ADMIN_PORT` env var |

## Running in the background

`bash start.sh` runs in the foreground — convenient for local dev, but the services will stop when you close the terminal or disconnect SSH. On a server, use `start-bg.sh` instead, which runs `start.sh` inside a detached tmux session:

```bash
bash start-bg.sh                         # start (returns immediately)
tmux attach -t claudecode-hub            # see live logs; Ctrl+B then D to detach
tmux kill-session -t claudecode-hub      # stop
tmux ls                                  # check whether it's running
```

## Advanced — HTTPS with a custom domain (Caddy)

By default the services serve HTTP. This works but browsers disable several features over plain HTTP (most notably `navigator.clipboard`, so the "复制" buttons in the admin UI silently fail — see FAQ below). HTTPS also protects JWTs and API keys in transit.

The simplest path is [Caddy](https://caddyserver.com/) with automatic Let's Encrypt certificates. This assumes you have a domain pointing at the server (e.g. `hub.example.com`).

**1. DNS** — point two subdomains at your server's public IP:
- `hub.example.com`     → admin dashboard
- `api.hub.example.com` → Claude Code proxy

**2. Firewall / security group** — open `80` and `443` (80 is needed for Let's Encrypt's HTTP-01 challenge). You can close public access to `3180` and `3182` now that Caddy fronts them.

**3. Install Caddy** (Debian/Ubuntu):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

**4. Write `/etc/caddy/Caddyfile`** (replace with your domain):

```
hub.example.com {
  reverse_proxy localhost:3182
}

api.hub.example.com {
  reverse_proxy localhost:3180
}
```

Reload: `sudo systemctl reload caddy`. Caddy issues certs on first request (~30s) and auto-renews them.

**5. Update Supabase** — Authentication → URL Configuration:
- **Site URL**: `https://hub.example.com`
- **Redirect URLs**: add `https://hub.example.com/**`

**6. Update client config** — Claude Code users now set:

```bash
export ANTHROPIC_BASE_URL=https://api.hub.example.com
```

Note: no port — Caddy serves via the standard 443.

## FAQ

### 1. WSL2 + Clash: proxy receives no requests, Claude Code throws `UND_ERR_SOCKET`

**Symptom:** Claude Code fails with `UND_ERR_SOCKET`, the proxy prints no logs at all, but switching to a different subscription fixes it.

**Cause:** WSL2 inherits Windows's `http_proxy=http://127.0.0.1:7890`, so all outbound requests from Claude Code — including those to `127.0.0.1:3180` — go through Clash. Clash Verge's "proxy bypass" setting only applies to Windows apps, not WSL2. Node.js/undici also does not support wildcard patterns like `127.*` in `no_proxy`.

If the active subscription has no DIRECT rule for local IPs, Clash forwards the request to the remote proxy server, which cannot reach back to your machine — so the proxy never sees the request.

**Fix:** Use Clash Verge Rev's global extension script to prepend DIRECT rules for all subscriptions. This persists across subscription refreshes.

In the subscription list, scroll to the bottom → click the **全局扩展脚本（Script）** card → paste the following and save:

```javascript
function main(config) {
  const prependRules = [
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve"
  ];
  config.rules = [...prependRules, ...(config.rules || [])];
  return config;
}
```

<img src="assets/clash-verge-global-script.png" width="480" alt="Clash Verge Rev global extension script" />

After saving, click **使用** to re-apply the active subscription. The IP-CIDR DIRECT rules should appear at the top of Clash's rules list.

The three ranges above cover all standard private address spaces (RFC 1918). If your proxy server's LAN IP falls outside these ranges, add a matching `IP-CIDR` rule for it as well.

---

### 2. "复制链接" / "复制 Token" buttons appear to do nothing

**Symptom:** Clicking the copy buttons in the admin dashboard silently fails — nothing lands on the clipboard.

**Cause:** `navigator.clipboard.writeText` only works in a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts) — HTTPS, `http://localhost`, or `http://127.0.0.1`. Over plain HTTP on a LAN / public IP (e.g. `http://43.106.26.31:3182`) the API is undefined and the click is a no-op.

**Fix:** put the admin dashboard behind HTTPS. See the [Advanced — HTTPS with a custom domain](#advanced--https-with-a-custom-domain-caddy) section.

---

## Project structure

```
src/
  proxy/          # API proxy server (forwards requests to Anthropic)
  admin/          # Admin server + React dashboard
    auth.js       # Supabase JWT verification middleware
  shared/         # Config store, name generator
supabase/
  migrations/     # SQL migrations (user_requests table + triggers)
config/           # Runtime data (gitignored: accounts.json, terminals.json)
logs/             # Usage logs per account (gitignored)
```

## TODO

- [ ] Scheduled backup for `config/` (hourly tar.gz snapshots, 7-day retention). `terminals.json` is painful to restore since every user would need to update their `ANTHROPIC_API_KEY`.
- [ ] Custom SMTP in Supabase (e.g. [Resend](https://resend.com/)) to escape the free-tier 2-emails-per-hour limit before onboarding real users.
- [ ] Clean up legacy terminals with no `userId` — they show as "（无主）" for admins; decide whether to claim them or delete.
