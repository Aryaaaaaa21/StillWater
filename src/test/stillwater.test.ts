import { beforeEach, describe, expect, it } from 'vitest';
import { createCircuitContext, createConstructorContext, dummyContractAddress, sampleUserAddress } from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, pureCircuits } from '../../contracts/managed/stillwater/contract/index.js';

const bytes = (seed: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, index) => (seed + index) & 0xff);
const NOW = 1_700_000_000;
const FUTURE = 4_102_444_800n;
const address = dummyContractAddress();
const user = sampleUserAddress();
const room = bytes(1);
const issuer = bytes(33);
const operatorSecret = bytes(65);
const operatorCommitment = pureCircuits.operator_commitment_for(operatorSecret);

let contract: Contract;
let state: any;
let score = 90n;
let invite = bytes(97);
let operator = operatorSecret;

function witnesses() {
  return {
    get_private_score: () => [{}, score],
    get_invite_secret: () => [{}, invite],
    operator_secret: () => [{}, operator],
  } as any;
}

function fresh(options: { threshold?: bigint; limit?: bigint; expiry?: bigint } = {}) {
  contract = new Contract(witnesses());
  const result = contract.initialState(
    createConstructorContext({}, user),
    options.threshold ?? 72n,
    room,
    options.expiry ?? FUTURE,
    issuer,
    operatorCommitment,
    options.limit ?? 2n,
  );
  state = result.currentContractState.data;
}

function call(name: 'claim_access' | 'lock_room' | 'unlock_room', time = NOW): any {
  const result = contract.circuits[name](createCircuitContext(address, user, state, {}, undefined, undefined, time));
  state = result.context.currentQueryContext.state;
  return result;
}

function rotate(newRoom: Uint8Array, threshold = 72n, limit = 2n, time = NOW): any {
  const result = contract.circuits.rotate_room(
    createCircuitContext(address, user, state, {}, undefined, undefined, time),
    threshold,
    newRoom,
    FUTURE,
    bytes(129),
    limit,
  );
  state = result.context.currentQueryContext.state;
  return result;
}

describe('Stillwater generated Compact contract', () => {
  beforeEach(() => {
    score = 90n;
    invite = bytes(97);
    operator = operatorSecret;
    fresh();
  });

  it('exposes the requested ledger fields and initial policy', () => {
    const value = ledger(state);
    expect(value.claim_threshold).toBe(72n);
    expect(value.room_id).toEqual(room);
    expect(value.claim_expiry).toBe(FUTURE);
    expect(value.issuer_id).toEqual(issuer);
    expect(value.operator_commitment).toEqual(operatorCommitment);
    expect(value.room_open).toBe(true);
    expect(value.claims).toBe(0n);
    expect(value.claim_limit).toBe(2n);
    expect(value.redeemed_tokens.isEmpty()).toBe(true);
    expect(value.claim_receipts.isEmpty()).toBe(true);
    expect(value.release).toHaveLength(32);
  });

  it('accepts a score exactly at the threshold', () => {
    score = 72n;
    call('claim_access');
    expect(ledger(state).claims).toBe(1n);
  });

  it('accepts the maximum score boundary', () => {
    score = 100n;
    call('claim_access');
    expect(ledger(state).claims).toBe(1n);
  });

  it('rejects a score below the threshold', () => {
    score = 71n;
    expect(() => call('claim_access')).toThrow(/does not meet the rule/);
    expect(ledger(state).claims).toBe(0n);
  });

  it('rejects a score above 100 even if the threshold is low', () => {
    fresh({ threshold: 0n });
    score = 101n;
    expect(() => call('claim_access')).toThrow(/between 0 and 100/);
  });

  it('rejects a claim after expiry', () => {
    expect(() => call('claim_access', Number(FUTURE))).toThrow(/expired/);
  });

  it('rejects a second claim using the same invite in the same room', () => {
    call('claim_access');
    expect(() => call('claim_access')).toThrow(/already been redeemed/);
    expect(ledger(state).claims).toBe(1n);
  });

  it('uses room-scoped tokens and records a receipt', () => {
    const token = pureCircuits.derive_redemption_token(invite, room);
    call('claim_access');
    const value = ledger(state);
    expect(value.redeemed_tokens.member(token)).toBe(true);
    expect(value.claim_receipts.lookup(token)).toEqual(room);
    expect(pureCircuits.derive_redemption_token(invite, bytes(2))).not.toEqual(token);
  });

  it('enforces the claim capacity', () => {
    call('claim_access');
    invite = bytes(98);
    call('claim_access');
    invite = bytes(99);
    expect(() => call('claim_access')).toThrow(/capacity reached/);
    expect(ledger(state).claims).toBe(2n);
  });

  it('rejects zero capacity in the constructor', () => {
    expect(() => fresh({ limit: 0n })).toThrow(/capacity must be positive/);
  });

  it('rejects a constructor threshold over 100', () => {
    expect(() => fresh({ threshold: 101n })).toThrow(/between 0 and 100/);
  });

  it('locks and unlocks only with the committed operator secret', () => {
    call('lock_room');
    expect(ledger(state).room_open).toBe(false);
    expect(() => call('claim_access')).toThrow(/room is locked/);
    call('unlock_room');
    expect(ledger(state).room_open).toBe(true);
  });

  it('rejects lifecycle controls with a bad operator witness', () => {
    operator = bytes(161);
    expect(() => call('lock_room')).toThrow(/authorization failed/);
    expect(() => rotate(bytes(2))).toThrow(/authorization failed/);
  });

  it('rejects rotation outside the threshold and capacity bounds', () => {
    expect(() => rotate(bytes(2), 101n)).toThrow(/between 0 and 100/);
    expect(() => rotate(bytes(2), 72n, 0n)).toThrow(/capacity must be positive/);
  });

  it('rotates to a new room and resets only that room capacity', () => {
    call('claim_access');
    rotate(bytes(2), 80n, 1n);
    const value = ledger(state);
    expect(value.room_id).toEqual(bytes(2));
    expect(value.claim_threshold).toBe(80n);
    expect(value.claims).toBe(0n);
    expect(value.claim_limit).toBe(1n);
    expect(value.room_open).toBe(true);
    // The old token remains in the append-only nullifier set.
    expect(value.redeemed_tokens.member(pureCircuits.derive_redemption_token(invite, room))).toBe(true);
  });

  it('cannot rotate back to an old room identifier', () => {
    rotate(bytes(2));
    expect(() => rotate(room)).toThrow(/already been used/);
  });

  it('does not let an old invite replay in a new room', () => {
    call('claim_access');
    rotate(bytes(2));
    call('claim_access');
    expect(ledger(state).claims).toBe(1n);
    expect(ledger(state).claim_receipts.size()).toBe(2n);
  });

  it('domain-separates operator commitments from redemption tokens', () => {
    const commitment = pureCircuits.operator_commitment_for(operatorSecret);
    const redemption = pureCircuits.derive_redemption_token(operatorSecret, room);
    expect(commitment).toHaveLength(32);
    expect(redemption).toHaveLength(32);
    expect(commitment).not.toEqual(redemption);
    expect(pureCircuits.operator_commitment_for(operatorSecret)).toEqual(commitment);
  });
});
