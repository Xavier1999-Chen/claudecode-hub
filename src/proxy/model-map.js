/**
 * Apply a relay-station model mapping to an outgoing Anthropic-API request body.
 *
 * Third-party relays often only serve a subset of Claude model names (e.g. a
 * station that has `claude-opus-4-5-20250929` but not `claude-opus-4-7`). The
 * admin configures `modelMap: { opus?, sonnet?, haiku? }` per relay account;
 * this function rewrites `body.model` based on its prefix so requests succeed.
 *
 * - Matching is by prefix on `claude-opus*` / `claude-sonnet*` / `claude-haiku*`
 * - Any unset tier passes through unchanged
 * - Non-claude models and non-JSON bodies are returned as-is
 *
 * @param {Buffer} bodyBuf Raw request body
 * @param {{opus?:string, sonnet?:string, haiku?:string}|null|undefined} modelMap
 * @returns {Buffer} New buffer (or the original if nothing to rewrite)
 */
export function applyModelMap(bodyBuf, modelMap) {
  if (!modelMap || Object.keys(modelMap).length === 0) return bodyBuf;
  let parsed;
  try {
    parsed = JSON.parse(bodyBuf.toString());
  } catch {
    return bodyBuf;
  }
  const model = parsed?.model;
  if (typeof model !== 'string') return bodyBuf;

  let target = null;
  if (model.startsWith('claude-opus') && modelMap.opus) target = modelMap.opus;
  else if (model.startsWith('claude-sonnet') && modelMap.sonnet) target = modelMap.sonnet;
  else if (model.startsWith('claude-haiku') && modelMap.haiku) target = modelMap.haiku;

  if (!target || target === model) return bodyBuf;
  parsed.model = target;
  return Buffer.from(JSON.stringify(parsed));
}
