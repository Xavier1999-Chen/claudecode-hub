/**
 * Relay account health check — probes a relay by sending a minimal
 * /v1/messages request and recording the result on acc.health.
 *
 * Designed to be called from a backend setInterval (once per poll cycle,
 * regardless of how many users are online).
 *
 * Accepts an optional fetchFn for testing.
 */

export const RELAY_HEALTH_POLL_MS = 60000;

const PROBE_TIMEOUT_MS = 15000;

/**
 * Determine which model to use for the health probe.
 * Priority: acc.probeModel  >  acc.modelMap.opus  >  null (skip).
 */
export function pickProbeModel(acc) {
  if (acc.probeModel && typeof acc.probeModel === 'string' && acc.probeModel.trim()) {
    return acc.probeModel.trim();
  }
  if (acc.modelMap?.opus && typeof acc.modelMap.opus === 'string' && acc.modelMap.opus.trim()) {
    return acc.modelMap.opus.trim();
  }
  return null;
}

/**
 * Fetch the relay's /v1/models endpoint and return an array of model ids
 * that contain "claude". Returns [] on any error.
 */
export async function listClaudeModels(acc, fetchFn) {
  const fetch = fetchFn ?? (await import('node-fetch')).default;
  const url = acc.baseUrl.replace(/\/$/, '') + '/v1/models';
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': acc.credentials.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const models = Array.isArray(data) ? data : (data?.data ?? []);
    if (!Array.isArray(models)) return [];
    return models
      .map(m => (typeof m === 'string' ? m : m?.id))
      .filter(id => typeof id === 'string' && id.includes('claude'));
  } catch {
    return [];
  }
}

/**
 * Probe a relay account's health by sending a minimal /v1/messages request.
 * Updates acc.health in place (memory only, not persisted to disk).
 *
 * If no probe model is configured, the function returns without setting acc.health.
 */
export async function syncRelayHealth(acc, fetchFn) {
  if (acc.type !== 'relay') return;

  const model = pickProbeModel(acc);
  if (!model) return;

  const fetch = fetchFn ?? (await import('node-fetch')).default;
  const url = acc.baseUrl.replace(/\/$/, '') + '/v1/messages';
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': acc.credentials.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - start;

    if (res.ok) {
      acc.health = { status: 'online', latencyMs, model, error: null };
    } else {
      const body = await res.text().catch(() => '');
      acc.health = {
        status: 'offline',
        latencyMs,
        model,
        error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    acc.health = {
      status: 'offline',
      latencyMs,
      model,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
    };
  }
}
