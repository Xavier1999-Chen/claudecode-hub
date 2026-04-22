import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePlanTier,
  mergeSubscriptionFromOAuthTokenResponse,
  extractPlanFromAccessTokenJwt,
  pickPlanFromAnthropicProfileBody,
} from '../src/shared/oauth-plan.js';

test('normalizePlanTier maps common labels (#21)', () => {
  assert.equal(normalizePlanTier('PRO'), 'pro');
  assert.equal(normalizePlanTier('max'), 'max');
  assert.equal(normalizePlanTier('FREE_TIER'), 'free');
  assert.equal(normalizePlanTier('none'), 'free');
  assert.equal(normalizePlanTier('unknown_tier'), null);
});

test('mergeSubscriptionFromOAuthTokenResponse reads OAuth token JSON (#21)', () => {
  const creds = { accessToken: 'x' };
  mergeSubscriptionFromOAuthTokenResponse(creds, {
    subscription_type: 'free',
  });
  assert.equal(creds.subscriptionType, 'free');
});

test('mergeSubscriptionFromOAuthTokenResponse reads nested account fields (#21)', () => {
  const creds = {};
  mergeSubscriptionFromOAuthTokenResponse(creds, {
    account: { subscription_type: 'max' },
  });
  assert.equal(creds.subscriptionType, 'max');
});

test('extractPlanFromAccessTokenJwt reads nested subscription in JWT payload (#21)', () => {
  const payload = Buffer.from(JSON.stringify({ meta: { subscriptionType: 'free' } })).toString(
    'base64url',
  );
  const tok = `x.${payload}.z`;
  assert.equal(extractPlanFromAccessTokenJwt(tok), 'free');
});

test('pickPlanFromAnthropicProfileBody finds tier in nested object (#21)', () => {
  const tier = pickPlanFromAnthropicProfileBody({
    user: { subscription_type: 'pro' },
  });
  assert.equal(tier, 'pro');
});
