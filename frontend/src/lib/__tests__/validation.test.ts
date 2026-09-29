import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromHex, isContractAddress, parseBytes32, parseCapacity, parseContractAddress, parseExpiry, parseScore, parseThreshold, toHex } from '../validation.js';

test('rejects malformed byte and address input', () => {
  assert.throws(() => fromHex('abc'), /Invalid hexadecimal/);
  assert.throws(() => parseBytes32('00'), /exactly 32 bytes/);
  assert.throws(() => parseContractAddress(`0x${'a'.repeat(64)}`), /exactly 64 hexadecimal/);
  assert.equal(isContractAddress('a'.repeat(64)), true);
  assert.equal(isContractAddress('a'.repeat(63)), false);
});

test('parses bounded integer values without clamping', () => {
  assert.equal(parseScore('100'), 100n);
  assert.equal(parseThreshold(0), 0n);
  assert.equal(parseCapacity(1), 1n);
  assert.throws(() => parseScore(101), /between 0 and 100/);
  assert.throws(() => parseCapacity(0), /between 1 and/);
  assert.throws(() => parseScore('1.5'), /whole number/);
});

test('requires a future expiry and preserves bytes', () => {
  assert.equal(parseExpiry('200', 100), 200n);
  const bytes = parseBytes32('ab'.repeat(32));
  assert.equal(toHex(bytes), 'ab'.repeat(32));
  assert.throws(() => parseExpiry('100', 100), /future/);
});
