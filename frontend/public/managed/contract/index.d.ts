import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  get_private_score(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  get_invite_secret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  operator_secret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  claim_access(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  rotate_room(context: __compactRuntime.CircuitContext<PS>,
              new_threshold_0: bigint,
              new_room_0: Uint8Array,
              new_expiry_0: bigint,
              new_issuer_0: Uint8Array,
              new_limit_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  lock_room(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unlock_room(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  claim_access(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  rotate_room(context: __compactRuntime.CircuitContext<PS>,
              new_threshold_0: bigint,
              new_room_0: Uint8Array,
              new_expiry_0: bigint,
              new_issuer_0: Uint8Array,
              new_limit_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  lock_room(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unlock_room(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  operator_commitment_for(secret_0: Uint8Array): Uint8Array;
  derive_redemption_token(invite_0: Uint8Array, room_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  claim_access(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  rotate_room(context: __compactRuntime.CircuitContext<PS>,
              new_threshold_0: bigint,
              new_room_0: Uint8Array,
              new_expiry_0: bigint,
              new_issuer_0: Uint8Array,
              new_limit_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  lock_room(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unlock_room(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  operator_commitment_for(context: __compactRuntime.CircuitContext<PS>,
                          secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  derive_redemption_token(context: __compactRuntime.CircuitContext<PS>,
                          invite_0: Uint8Array,
                          room_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly claim_threshold: bigint;
  readonly room_id: Uint8Array;
  readonly claim_expiry: bigint;
  readonly issuer_id: Uint8Array;
  readonly operator_commitment: Uint8Array;
  readonly room_open: boolean;
  readonly claims: bigint;
  readonly claim_limit: bigint;
  redeemed_tokens: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  claim_receipts: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  readonly release: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               threshold_0: bigint,
               room_0: Uint8Array,
               expiry_0: bigint,
               issuer_0: Uint8Array,
               operator_hash_0: Uint8Array,
               limit_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
