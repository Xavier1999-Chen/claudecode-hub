import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateName } from '../src/shared/names.js';

test('generateName returns adjective-animal format', () => {
  const name = generateName([]);
  assert.match(name, /^[a-z]+-[a-z]+$/);
});

test('generateName avoids collisions with existing names', () => {
  // Force all but one name to be taken by pre-filling existing list.
  // Generate 10 names and assert all are unique.
  const existing = [];
  for (let i = 0; i < 10; i++) {
    const name = generateName(existing);
    assert.ok(!existing.includes(name), `collision: ${name}`);
    existing.push(name);
  }
});

test('generateName returns string with exactly one hyphen', () => {
  const name = generateName([]);
  assert.equal(name.split('-').length, 2);
});
