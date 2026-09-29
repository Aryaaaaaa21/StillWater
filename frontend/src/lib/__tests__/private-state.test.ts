import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateStateProvider } from '../midnight.js';

const addressA = 'a'.repeat(64);
const addressB = 'b'.repeat(64);

test('private state is real, scoped, and not localStorage-backed', async () => {
  const provider = createPrivateStateProvider();
  provider.setContractAddress(addressA as any);
  await provider.set('StillwaterPrivateState', { marker: 'a' });
  assert.deepEqual(await provider.get('StillwaterPrivateState'), { marker: 'a' });
  provider.setContractAddress(addressB as any);
  assert.equal(await provider.get('StillwaterPrivateState'), null);
  await provider.set('StillwaterPrivateState', { marker: 'b' });
  provider.setContractAddress(addressA as any);
  assert.deepEqual(await provider.get('StillwaterPrivateState'), { marker: 'a' });
  await assert.rejects(() => provider.exportPrivateStates(), /encrypted recovery/);
});

test('private state requires a valid scope and signing keys are independently scoped', async () => {
  const provider = createPrivateStateProvider();
  await assert.rejects(() => provider.get('state'), /no contract scope/);
  provider.setContractAddress(addressA as any);
  await provider.setSigningKey(addressA as any, 'memory-only' as any);
  assert.equal(await provider.getSigningKey(addressA as any), 'memory-only');
  await provider.clearSigningKeys();
  assert.equal(await provider.getSigningKey(addressA as any), null);
});
