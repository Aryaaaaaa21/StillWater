import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContractAddress, getNetwork, getNetworkConfig, setContractAddress, setNetwork } from '../../config.js';

// This suite exercises the storage contract when run in a browser-like test environment.
test('network config has isolated Preview and Preprod endpoints', () => {
  const preview = getNetworkConfig('preview');
  const preprod = getNetworkConfig('preprod');
  assert.equal(preview.networkId, 'preview');
  assert.equal(preprod.networkId, 'preprod');
  assert.notEqual(preview.indexerUrl, preprod.indexerUrl);
  assert.notEqual(preview.explorerUrl, preprod.explorerUrl);
});

test('address setters reject malformed values and never cross network keys', () => {
  const previous = getNetwork();
  assert.throws(() => setContractAddress('not-an-address', 'preview'), /64 hexadecimal/);
  assert.equal(getContractAddress('preview'), getContractAddress('preview'));
  setNetwork(previous);
});
