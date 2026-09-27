import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTx, createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';
import { Contract, pureCircuits } from '../managed/contract/index.js';
import { getNetwork, setContractAddress } from '../config';
import type { ConnectedSession } from './midnight';
import { parseBytes32, parseCapacity, parseContractAddress, parseExpiry, parseScore, parseThreshold, toHex, type Bytes32Input, type IntegerInput } from './validation';

export const STILLWATER_PRIVATE_STATE_ID = 'StillwaterPrivateState';
export type Operation = 'deploy' | 'claim_access' | 'lock_room' | 'unlock_room' | 'rotate_room';
export type ProgressStage = 'validating' | 'preparing' | 'proving' | 'balancing' | 'submitting' | 'submitted' | 'confirming' | 'confirmed';
export type TransactionProgress = { stage: ProgressStage; operation: Operation; message: string; txId?: string; contractAddress?: string };
export type ProgressOptions = { onProgress?: (event: TransactionProgress) => void; signal?: AbortSignal };

export type SubmittedTransaction = {
  status: 'submitted';
  operation: Operation;
  network: ReturnType<typeof getNetwork>;
  txId: string;
  contractAddress?: string;
};
export type ConfirmedTransaction = {
  status: 'confirmed';
  operation: Operation;
  network: ReturnType<typeof getNetwork>;
  txId: string;
  contractAddress?: string;
  blockHeight: number;
  blockHash: string;
  txHash: string;
  finalized: FinalizedTxData;
};

const pendingStateUpdates = new WeakMap<SubmittedTransaction, () => Promise<void>>();
const pendingConfirmations = new WeakMap<SubmittedTransaction, Promise<ConfirmedTransaction>>();

export class ConfirmationTimeoutError extends Error { constructor(message = 'Transaction confirmation timed out; inclusion is still unknown.') { super(message); this.name = 'ConfirmationTimeoutError'; } }
export class TransactionExecutionError extends Error {
  constructor(public readonly finalized: FinalizedTxData, message = 'The indexed transaction did not execute successfully.') { super(message); this.name = 'TransactionExecutionError'; }
}

function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The transaction was cancelled before submission.', 'AbortError');
}
function progress(options: ProgressOptions | undefined, event: TransactionProgress): void {
  try { options?.onProgress?.(event); } catch { /* UI callbacks must not interrupt transaction execution */ }
}
function ensureSession(session: ConnectedSession, options?: ProgressOptions): void {
  if (session.network !== getNetwork()) throw new Error(`Wallet session is on ${session.network}; Stillwater is set to ${getNetwork()}.`);
  checkSignal(options?.signal);
}
function bindWitnesses(values: { score?: bigint; inviteSecret?: Uint8Array; operatorSecret?: Uint8Array }) {
  const score = values.score;
  const inviteSecret = values.inviteSecret;
  const operatorSecret = values.operatorSecret;
  return {
    get_private_score: (context: any) => {
      if (score === undefined) throw new Error('A self-attested score witness is required.');
      return [context.privateState, score] as [unknown, bigint];
    },
    get_invite_secret: (context: any) => {
      if (!inviteSecret) throw new Error('An invite secret witness is required.');
      return [context.privateState, inviteSecret.slice()] as [unknown, Uint8Array];
    },
    operator_secret: (context: any) => {
      if (!operatorSecret) throw new Error('An operator secret witness is required.');
      return [context.privateState, operatorSecret.slice()] as [unknown, Uint8Array];
    },
  };
}

export function compileStillwaterContract(witnessValues: { score?: bigint; inviteSecret?: Uint8Array; operatorSecret?: Uint8Array }): any {
  const witnesses = bindWitnesses(witnessValues);
  const assets = new URL('/managed', window.location.origin).toString();
  return CompiledContract.make('StillwaterContract', Contract).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets(assets),
  ) as any;
}

function preparePrivateState(session: ConnectedSession, address: string): Promise<void> {
  const provider = session.providers.privateStateProvider;
  provider.setContractAddress(address as any);
  return provider.get(STILLWATER_PRIVATE_STATE_ID).then((state) => state === null ? provider.set(STILLWATER_PRIVATE_STATE_ID, {}) : undefined);
}

async function submit(
  session: ConnectedSession,
  operation: Operation,
  unprovenTx: any,
  address: string | undefined,
  options?: ProgressOptions,
): Promise<SubmittedTransaction> {
  progress(options, { stage: 'proving', operation, message: 'Generating a zero-knowledge proof.' });
  checkSignal(options?.signal);
  progress(options, { stage: 'balancing', operation, message: 'Balancing the transaction in the connected wallet.' });
  checkSignal(options?.signal);
  progress(options, { stage: 'submitting', operation, message: 'Submitting the finalized transaction to the network.' });
  const txId = await submitTxAsync(session.providers as any, { unprovenTx, circuitId: operation === 'deploy' ? undefined : operation } as any);
  // midnightProvider derives this from finalizedTransaction.identifiers(); no sentinel IDs.
  if (!txId || typeof txId !== 'string') throw new Error('Wallet submission returned no transaction identifier.');
  const result: SubmittedTransaction = { status: 'submitted', operation, network: session.network, txId, ...(address ? { contractAddress: address } : {}) };
  progress(options, { stage: 'submitted', operation, message: 'Transaction submitted. Inclusion is not confirmed yet.', txId, ...(address ? { contractAddress: address } : {}) });
  return result;
}

export type DeploySpaceInput = {
  threshold: IntegerInput;
  capacity: IntegerInput;
  expiry: IntegerInput;
  roomId: Bytes32Input;
  issuerId: Bytes32Input;
  operatorSecret: string;
};
export async function deploySpace(session: ConnectedSession, input: DeploySpaceInput, options?: ProgressOptions): Promise<SubmittedTransaction> {
  ensureSession(session, options);
  progress(options, { stage: 'validating', operation: 'deploy', message: 'Validating deployment inputs.' });
  const threshold = parseThreshold(input.threshold);
  const capacity = parseCapacity(input.capacity);
  const expiry = parseExpiry(input.expiry);
  const room = parseBytes32(input.roomId, 'Room ID');
  const issuer = parseBytes32(input.issuerId, 'Issuer ID');
  const operatorSecret = parseBytes32(input.operatorSecret, 'Operator secret');
  const commitment = pureCircuits.operator_commitment_for(operatorSecret);
  progress(options, { stage: 'preparing', operation: 'deploy', message: 'Preparing the Stillwater deployment.' });
  const compiledContract = compileStillwaterContract({ operatorSecret });
  const data = await createUnprovenDeployTx(session.providers as any, {
    compiledContract,
    args: [threshold, room, expiry, issuer, commitment, capacity],
    initialPrivateState: {},
    signingKey: sampleSigningKey(),
  } as any);
  const address = parseContractAddress(String(data.public.contractAddress));
  const submitted = await submit(session, 'deploy', data.private.unprovenTx, address, options);
  pendingStateUpdates.set(submitted, async () => {
    const provider = session.providers.privateStateProvider;
    provider.setContractAddress(address as any);
    await provider.set(STILLWATER_PRIVATE_STATE_ID, data.private.initialPrivateState);
  });
  return submitted;
}

export type ClaimAccessInput = { address: string; score: IntegerInput; inviteSecret: string };
export async function claimAccess(session: ConnectedSession, input: ClaimAccessInput, options?: ProgressOptions): Promise<SubmittedTransaction> {
  ensureSession(session, options);
  progress(options, { stage: 'validating', operation: 'claim_access', message: 'Validating the self-attested score and invite secret.' });
  const address = parseContractAddress(input.address);
  const score = parseScore(input.score);
  const inviteSecret = parseBytes32(input.inviteSecret, 'Invite secret');
  await preparePrivateState(session, address);
  progress(options, { stage: 'preparing', operation: 'claim_access', message: 'Preparing a private claim proof.' });
  const data = await createUnprovenCallTx(session.providers as any, {
    compiledContract: compileStillwaterContract({ score, inviteSecret }), contractAddress: address,
    circuitId: 'claim_access', privateStateId: STILLWATER_PRIVATE_STATE_ID, args: [],
  } as any);
  const submitted = await submit(session, 'claim_access', data.private.unprovenTx, address, options);
  pendingStateUpdates.set(submitted, async () => { await session.providers.privateStateProvider.set(STILLWATER_PRIVATE_STATE_ID, data.private.nextPrivateState); });
  return submitted;
}

export type OperatorActionInput = { address: string; operatorSecret: string };
async function operatorAction(session: ConnectedSession, operation: 'lock_room' | 'unlock_room', input: OperatorActionInput, options?: ProgressOptions): Promise<SubmittedTransaction> {
  ensureSession(session, options);
  progress(options, { stage: 'validating', operation, message: 'Validating the operator witness.' });
  const address = parseContractAddress(input.address);
  const operatorSecret = parseBytes32(input.operatorSecret, 'Operator secret');
  await preparePrivateState(session, address);
  const data = await createUnprovenCallTx(session.providers as any, {
    compiledContract: compileStillwaterContract({ operatorSecret }), contractAddress: address, circuitId: operation,
    privateStateId: STILLWATER_PRIVATE_STATE_ID, args: [],
  } as any);
  const submitted = await submit(session, operation, data.private.unprovenTx, address, options);
  pendingStateUpdates.set(submitted, async () => { await session.providers.privateStateProvider.set(STILLWATER_PRIVATE_STATE_ID, data.private.nextPrivateState); });
  return submitted;
}
export const lockRoom = (session: ConnectedSession, input: OperatorActionInput, options?: ProgressOptions) => operatorAction(session, 'lock_room', input, options);
export const unlockRoom = (session: ConnectedSession, input: OperatorActionInput, options?: ProgressOptions) => operatorAction(session, 'unlock_room', input, options);

export type RotateRoomInput = OperatorActionInput & { threshold: IntegerInput; capacity: IntegerInput; expiry: IntegerInput; roomId: Bytes32Input; issuerId: Bytes32Input };
export async function rotateRoom(session: ConnectedSession, input: RotateRoomInput, options?: ProgressOptions): Promise<SubmittedTransaction> {
  ensureSession(session, options);
  progress(options, { stage: 'validating', operation: 'rotate_room', message: 'Validating the next room policy.' });
  const address = parseContractAddress(input.address);
  const operatorSecret = parseBytes32(input.operatorSecret, 'Operator secret');
  const threshold = parseThreshold(input.threshold);
  const capacity = parseCapacity(input.capacity);
  const expiry = parseExpiry(input.expiry);
  const room = parseBytes32(input.roomId, 'Room ID');
  const issuer = parseBytes32(input.issuerId, 'Issuer ID');
  await preparePrivateState(session, address);
  const data = await createUnprovenCallTx(session.providers as any, {
    compiledContract: compileStillwaterContract({ operatorSecret }), contractAddress: address, circuitId: 'rotate_room',
    privateStateId: STILLWATER_PRIVATE_STATE_ID, args: [threshold, room, expiry, issuer, capacity],
  } as any);
  const submitted = await submit(session, 'rotate_room', data.private.unprovenTx, address, options);
  pendingStateUpdates.set(submitted, async () => { await session.providers.privateStateProvider.set(STILLWATER_PRIVATE_STATE_ID, data.private.nextPrivateState); });
  return submitted;
}

export type ConfirmationOptions = ProgressOptions & { timeoutMs?: number };
export async function waitForConfirmation(session: ConnectedSession, submitted: SubmittedTransaction, options: ConfirmationOptions = {}): Promise<ConfirmedTransaction> {
  const existing = pendingConfirmations.get(submitted);
  if (existing) return existing;
  const promise = waitForConfirmationInternal(session, submitted, options);
  pendingConfirmations.set(submitted, promise);
  return promise;
}

async function waitForConfirmationInternal(session: ConnectedSession, submitted: SubmittedTransaction, options: ConfirmationOptions = {}): Promise<ConfirmedTransaction> {
  ensureSession(session, options);
  if (submitted.network !== session.network) throw new Error('Transaction and wallet sessions use different networks.');
  progress(options, { stage: 'confirming', operation: submitted.operation, message: 'Waiting for indexer confirmation.', txId: submitted.txId, ...(submitted.contractAddress ? { contractAddress: submitted.contractAddress } : {}) });
  const watch = session.providers.publicDataProvider.watchForTxData(submitted.txId);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = options.timeoutMs === undefined ? undefined : new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ConfirmationTimeoutError()), options.timeoutMs); });
  try {
    const finalized = await (timeout ? Promise.race([watch, timeout]) : watch);
    if (String(finalized.status) !== 'SucceedEntirely') throw new TransactionExecutionError(finalized);
    await pendingStateUpdates.get(submitted)?.();
    if (submitted.operation === 'deploy' && submitted.contractAddress) setContractAddress(submitted.contractAddress, submitted.network);
    const confirmed: ConfirmedTransaction = { status: 'confirmed', operation: submitted.operation, network: submitted.network, txId: submitted.txId, ...(submitted.contractAddress ? { contractAddress: submitted.contractAddress } : {}), blockHeight: finalized.blockHeight, blockHash: finalized.blockHash, txHash: finalized.txHash, finalized };
    progress(options, { stage: 'confirmed', operation: submitted.operation, message: 'Transaction confirmed by the indexer.', txId: submitted.txId, ...(submitted.contractAddress ? { contractAddress: submitted.contractAddress } : {}) });
    return confirmed;
  } finally { if (timer) clearTimeout(timer); }
}

export function describeSecret(secret: Uint8Array): string { return toHex(secret).slice(0, 8); }
