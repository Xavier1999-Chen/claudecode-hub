// Covers the URL-classification step for the email-verification redirect flow
// (see GitHub #6). The bug: QQ Mail / WeChat in-app scanners GET the
// Supabase verify URL before the user does, consuming the one-time token.
// The fix routes the email click through an on-domain "click to confirm"
// page that calls verifyOtp explicitly — this helper picks that mode up
// from URL params.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyAuthRedirect } from '../src/admin/frontend/src/auth-redirect.js';

test('classifyAuthRedirect: empty URL is "normal"', () => {
  assert.deepEqual(
    classifyAuthRedirect(new URLSearchParams('')),
    { mode: 'normal' },
  );
});

test('classifyAuthRedirect: token_hash + type routes to confirm-email page', () => {
  // This is the fix path: user-initiated click on /auth/confirm?token_hash=...&type=...
  // triggers verifyOtp in the frontend instead of Supabase's auto-consume verify endpoint.
  const sp = new URLSearchParams('?token_hash=abc123&type=signup');
  assert.deepEqual(
    classifyAuthRedirect(sp),
    { mode: 'confirm-email', tokenHash: 'abc123', type: 'signup' },
  );
});

test('classifyAuthRedirect: accepts type=email (Supabase docs default) too', () => {
  const sp = new URLSearchParams('?token_hash=xyz&type=email');
  assert.deepEqual(
    classifyAuthRedirect(sp),
    { mode: 'confirm-email', tokenHash: 'xyz', type: 'email' },
  );
});

test('classifyAuthRedirect: error_code surfaces to an error page (previously a silent redirect to login)', () => {
  // Happens when the scanner already consumed the token — Supabase 302s back
  // with ?error=access_denied&error_code=otp_expired. Before the fix, the user
  // landed on the login page with no indication anything went wrong.
  const sp = new URLSearchParams(
    '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );
  assert.deepEqual(
    classifyAuthRedirect(sp),
    {
      mode: 'verify-error',
      errorCode: 'otp_expired',
      errorDescription: 'Email link is invalid or has expired',
    },
  );
});

test('classifyAuthRedirect: partial params (token_hash without type) falls back to normal', () => {
  const sp = new URLSearchParams('?token_hash=abc');
  assert.deepEqual(classifyAuthRedirect(sp), { mode: 'normal' });
});

test('classifyAuthRedirect: partial params (type without token_hash) falls back to normal', () => {
  const sp = new URLSearchParams('?type=signup');
  assert.deepEqual(classifyAuthRedirect(sp), { mode: 'normal' });
});

test('classifyAuthRedirect: error takes precedence over token_hash (never try to verify a poisoned link)', () => {
  const sp = new URLSearchParams(
    '?token_hash=stale&type=signup&error_code=otp_expired&error_description=expired',
  );
  const result = classifyAuthRedirect(sp);
  assert.equal(result.mode, 'verify-error');
  assert.equal(result.errorCode, 'otp_expired');
});