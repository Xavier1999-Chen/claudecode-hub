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
