import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOAuthRevoked } from '../src/proxy/permission-guard.js';

test('isOAuthRevoked: 403 with permission_error is true', () => {
  const body = '{"type":"error","error":{"type":"permission_error","message":"OAuth authentication is currently not allowed for this organization."}}';
  assert.equal(isOAuthRevoked(403, body), true);
});

test('isOAuthRevoked: 403 with other error type is false', () => {
  const body = '{"type":"error","error":{"type":"authentication_error","message":"bad token"}}';
  assert.equal(isOAuthRevoked(403, body), false);
});

test('isOAuthRevoked: 403 with missing error.type is false', () => {
  const body = '{"type":"error","error":{"message":"no type"}}';
  assert.equal(isOAuthRevoked(403, body), false);
});

test('isOAuthRevoked: 403 with non-JSON body is false', () => {
  assert.equal(isOAuthRevoked(403, '<html>forbidden</html>'), false);
});

test('isOAuthRevoked: 401 with permission_error body is false', () => {
  const body = '{"type":"error","error":{"type":"permission_error"}}';
  assert.equal(isOAuthRevoked(401, body), false);
});

test('isOAuthRevoked: 200 returns false', () => {
  assert.equal(isOAuthRevoked(200, '{}'), false);
});

test('isOAuthRevoked: accepts pre-parsed object', () => {
  const obj = { type: 'error', error: { type: 'permission_error' } };
  assert.equal(isOAuthRevoked(403, obj), true);
});

// ── 400 + invalid_request_error ban detection ─────────────────────────────

test('isOAuthRevoked: 400 with invalid_request_error "organization disabled" is true', () => {
  const body = '{"type":"error","error":{"type":"invalid_request_error","message":"This organization has been disabled."}}';
  assert.equal(isOAuthRevoked(400, body), true);
});

test('isOAuthRevoked: 400 with invalid_request_error "account banned" is true', () => {
  const body = '{"type":"error","error":{"type":"invalid_request_error","message":"Account has been banned."}}';
  assert.equal(isOAuthRevoked(400, body), true);
});

test('isOAuthRevoked: 400 with invalid_request_error "access revoked" is true', () => {
  const body = '{"type":"error","error":{"type":"invalid_request_error","message":"Access has been revoked."}}';
  assert.equal(isOAuthRevoked(400, body), true);
});

test('isOAuthRevoked: 400 with invalid_request_error non-ban message is false', () => {
  const body = '{"type":"error","error":{"type":"invalid_request_error","message":"invalid model specified"}}';
  assert.equal(isOAuthRevoked(400, body), false);
});

test('isOAuthRevoked: 400 with other error type is false', () => {
  const body = '{"type":"error","error":{"type":"authentication_error","message":"bad request"}}';
  assert.equal(isOAuthRevoked(400, body), false);
});

// ── x-should-retry header ─────────────────────────────────────────────────

test('isOAuthRevoked: x-should-retry: false returns true regardless of status', () => {
  const body = '{"type":"error","error":{"type":"unknown_error","message":"unknown"}}';
  assert.equal(isOAuthRevoked(500, body, { 'x-should-retry': 'false' }), true);
});

test('isOAuthRevoked: x-should-retry: true does not trigger', () => {
  const body = '{"type":"error","error":{"type":"invalid_request_error","message":"disabled"}}';
  assert.equal(isOAuthRevoked(400, body, { 'x-should-retry': 'true' }), true); // message match wins
});

test('isOAuthRevoked: missing headers param works (backward compat)', () => {
  const body = '{"type":"error","error":{"type":"permission_error","message":"revoked"}}';
  assert.equal(isOAuthRevoked(403, body), true);
});
