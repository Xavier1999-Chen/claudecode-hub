import { randomBytes } from 'node:crypto';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { normalizePlanTier, pickPlanFromAnthropicProfileBody } from '../shared/oauth-plan.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const ROLES_URL = 'https://api.anthropic.com/api/oauth/claude_cli/roles';
const PROFILE_URL = 'https://api.anthropic.com/api/oauth/profile';

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy
               || process.env.HTTP_PROXY  || process.env.http_proxy;
const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

const PROXY_ENV_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'NO_PROXY', 'no_proxy'];

/**
 * Build argv for `tmux new-session`. Pure function; argv form bypasses /bin/sh,
 * so proxy env values containing shell metacharacters are passed through intact.
 */
export function buildTmuxNewSessionArgs({ tmuxSession, configDir, claudePath, env = {} }) {
  const args = [
    'new-session', '-d',
    '-x', '200', '-y', '50',
    '-s', tmuxSession,
    '-e', `CLAUDE_CONFIG_DIR=${configDir}`,
  ];
  for (const key of PROXY_ENV_KEYS) {
    if (env[key]) args.push('-e', `${key}=${env[key]}`);
  }
  args.push(`${claudePath} login`);
  return args;
}

/**
 * Start `claude login` in a detached tmux session with an isolated CLAUDE_CONFIG_DIR.
 * Forwards HTTPS_PROXY / HTTP_PROXY / NO_PROXY (and lowercase variants) from process.env
 * via tmux `-e`, so the child can reach api.anthropic.com behind an outbound proxy.
 * Handles two interactive prompts (theme + login method), then captures the authorization URL.
 * Returns { sessionId, configDir, tmuxSession, authUrl }
 */
export async function startTmuxLogin() {
  const sessionId = randomBytes(8).toString('hex');
  const configDir = `/tmp/hub-acc-${sessionId}`;
  const tmuxSession = `hub-${sessionId}`;

  await mkdir(configDir, { recursive: true });

  const claudePath = (await execAsync('which claude').catch(() => ({ stdout: 'claude' }))).stdout.trim();
  // Use execFile (argv form) to avoid /bin/sh interpreting proxy values that may
  // contain $, spaces, `;`, backticks, etc. — same rationale as submitAuthCode below.
  const args = buildTmuxNewSessionArgs({ tmuxSession, configDir, claudePath, env: process.env });
  await execFileAsync('tmux', args);

  // Step 1: wait for theme prompt, then press Enter to accept default
  await waitForText(tmuxSession, 'Choose the text style', 10000);
  await execAsync(`tmux send-keys -t ${tmuxSession} '' Enter`);
  await sleep(500);

  // Step 2: wait for login method prompt, then send "1" for Claude account
  await waitForText(tmuxSession, 'Select login method', 8000);
  await execAsync(`tmux send-keys -t ${tmuxSession} '1' Enter`);
  await sleep(500);

  // Step 3: wait for the authorization URL (up to 20 seconds)
  const authUrl = await pollForAuthUrl(tmuxSession, 20000);
  if (!authUrl) {
    await killTmuxSession(tmuxSession).catch(() => {});
    throw new Error('未能从 claude login 获取授权链接，请检查 claude 是否正确安装');
  }

  return { sessionId, configDir, tmuxSession, authUrl };
}

/**
 * Send the authentication code to the waiting tmux session.
 */
export async function submitAuthCode(tmuxSession, code) {
  // Use execFile to avoid shell interpretation of the code string
  await execFileAsync('tmux', ['send-keys', '-t', tmuxSession, code]);
  await sleep(100);
  await execFileAsync('tmux', ['send-keys', '-t', tmuxSession, 'Enter']);
}

/**
 * Poll for the .credentials.json file, then import it.
 * Cleans up tmux session and temp dir when done.
 * On timeout, captures tmux output for diagnosis (does NOT kill the session).
 */
export async function waitForCredentials(configDir, tmuxSession, timeoutMs = 60000) {
  const credsPath = join(configDir, '.credentials.json');
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const raw = await readFile(credsPath, 'utf8');
      const parsed = JSON.parse(raw);
      const creds = parsed.claudeAiOauth ?? parsed;
      if (creds.accessToken) {
        // Got credentials — clean up
        await killTmuxSession(tmuxSession).catch(() => {});
        const meData = await fetchMe(creds.accessToken);
        await rm(configDir, { recursive: true, force: true }).catch(() => {});
        return buildAccount(creds, meData);
      }
    } catch {
      // file not ready yet
    }
    await sleep(800);
  }

  // Timeout — capture tmux output for diagnosis but keep session alive for retry
  let tmuxOutput = '';
  try {
    const { stdout } = await execAsync(`tmux capture-pane -t ${tmuxSession} -p -S -30`);
    tmuxOutput = stdout.trim();
  } catch { /* session may be gone */ }

  const hint = tmuxOutput
    ? `\nclaude 输出：\n${tmuxOutput.slice(-500)}`
    : '';
  throw new Error(`等待凭证超时（60s）${hint}`);
}

// ── Legacy: manual terminal flow (kept for fallback) ───────────────────────

export function createLoginSession() {
  const sessionId = randomBytes(8).toString('hex');
  const configDir = `/tmp/hub-acc-${sessionId}`;
  const loginCmd = `CLAUDE_CONFIG_DIR=${configDir} claude login`;
  return { sessionId, configDir, loginCmd };
}

export async function importCredentials(configDir) {
  const credsPath = join(configDir, '.credentials.json');
  let raw;
  try {
    raw = await readFile(credsPath, 'utf8');
  } catch {
    throw new Error('未找到凭证文件，请先在终端完成 claude login');
  }

  const parsed = JSON.parse(raw);
  const creds = parsed.claudeAiOauth ?? parsed;

  if (!creds.accessToken) {
    throw new Error('凭证文件格式无效，请重新登录');
  }

  const meData = await fetchMe(creds.accessToken);
  try { await rm(configDir, { recursive: true, force: true }); } catch {}
  return buildAccount(creds, meData);
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function waitForText(tmuxSession, text, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { stdout } = await execAsync(`tmux capture-pane -pt ${tmuxSession} -S -100`);
      if (stdout.includes(text)) return true;
    } catch { /* not ready */ }
    await sleep(400);
  }
  return false;
}

async function pollForAuthUrl(tmuxSession, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const { stdout } = await execAsync(`tmux capture-pane -pt ${tmuxSession} -S -100`);
      // Find the line starting with https:// (the auth URL)
      const lines = stdout.split('\n');
      const startIdx = lines.findIndex(l => l.trimStart().startsWith('https://'));
      if (startIdx !== -1) {
        // Join lines until we hit a blank line or "Paste code" prompt
        // Terminal wraps long URLs across multiple lines
        const urlParts = [];
        for (let i = startIdx; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (!trimmed || trimmed.startsWith('Paste') || trimmed.startsWith('>')) break;
          urlParts.push(trimmed);
        }
        const fullUrl = urlParts.join('');
        if (fullUrl.startsWith('https://')) return fullUrl;
      }
    } catch {
      // tmux session may not be ready yet
    }
    await sleep(500);
  }
  return null;
}

async function killTmuxSession(tmuxSession) {
  await execAsync(`tmux kill-session -t ${tmuxSession}`);
}

function buildAccount(creds, meData) {
  const plan =
    normalizePlanTier(creds.subscriptionType) ??
    normalizePlanTier(meData.subscriptionType) ??
    'pro';
  return {
    id: `acc_${randomBytes(6).toString('hex')}`,
    email: meData.email ?? 'unknown@example.com',
    plan,
    credentials: {
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken ?? null,
      expiresAt: creds.expiresAt ?? Date.now() + 3600000,
      scopes: creds.scopes ?? ['org:create_api_key', 'user:profile', 'user:inference'],
    },
    status: 'idle',
    cooldownUntil: null,
    rateLimit: {
      window5h: { used: 0, limit: 100000, resetAt: Date.now() + 18000000 },
      weeklyTokens: { used: 0, limit: 1000000, resetAt: Date.now() + 604800000 },
    },
    addedAt: Date.now(),
  };
}

export async function fetchMe(accessToken) {
  try {
    const res = await fetch(ROLES_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
      ...(proxyAgent && { agent: proxyAgent }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    // email is embedded in organization_name: "user@example.com's Organization"
    const orgName = data.organization_name ?? '';
    const email = orgName.replace(/'s Organization$/i, '').trim() || null;
    const planFromRoles = pickPlanFromAnthropicProfileBody(data);
    return { email, subscriptionType: planFromRoles ?? undefined };
  } catch {
    return {};
  }
}

/**
 * GET /api/oauth/profile — current subscription tier when OAuth is still valid.
 * @returns {'free' | 'pro' | 'max' | null}
 */
export async function fetchProfilePlanTier(accessToken) {
  try {
    const res = await fetch(PROFILE_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
      ...(proxyAgent && { agent: proxyAgent }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return pickPlanFromAnthropicProfileBody(data);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
