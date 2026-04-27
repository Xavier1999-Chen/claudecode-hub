function containsImageInContentArray(content) {
  if (!Array.isArray(content)) return false;
  for (const item of content) {
    if (item?.type === 'image') return true;
    // Images can be nested inside tool_result.content
    if (item?.type === 'tool_result' && Array.isArray(item.content)) {
      if (containsImageInContentArray(item.content)) return true;
    }
  }
  return false;
}

export function hasImageContent(body) {
  if (!body?.messages) return false;
  for (const msg of body.messages) {
    if (containsImageInContentArray(msg.content)) return true;
  }
  return false;
}

export function resolveAggregatedProvider(body, account) {
  const hasImage = hasImageContent(body);
  let route;

  if (hasImage) {
    route = account.routing?.image ?? account.routing?.opus;
  } else {
    const model = body.model ?? '';
    if (model.startsWith('claude-opus')) route = account.routing?.opus;
    else if (model.startsWith('claude-sonnet')) route = account.routing?.sonnet;
    else if (model.startsWith('claude-haiku')) route = account.routing?.haiku;
  }

  if (!route) return null;

  const provider = account.providers?.[route.providerIndex];
  if (!provider) return null;

  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.credentials?.apiKey,
    targetModel: route.model,
  };
}

export function rewriteModel(bodyBuf, targetModel) {
  try {
    const parsed = JSON.parse(bodyBuf.toString());
    if (typeof parsed.model === 'string' && parsed.model !== targetModel) {
      parsed.model = targetModel;
      return Buffer.from(JSON.stringify(parsed));
    }
  } catch {
    /* ignore invalid JSON */
  }
  return bodyBuf;
}
