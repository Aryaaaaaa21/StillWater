import { pureCircuits } from '../managed/contract/index.js';
import { fromHex, parseBytes32, toHex } from './validation';

export type PrivateIdentity = { secret: string; label: string; createdAt: number };
const STORAGE_KEY = 'stillwater.private-identity.v1';
let memoryIdentity: PrivateIdentity | null = null;

export function randomSecret(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') throw new Error('Secure randomness is unavailable.');
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function validIdentity(value: unknown): value is PrivateIdentity {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PrivateIdentity>;
  return typeof candidate.secret === 'string' && /^[0-9a-f]{64}$/i.test(candidate.secret)
    && typeof candidate.label === 'string' && typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt);
}

function readSession(): PrivateIdentity | null {
  try {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return validIdentity(parsed) ? { ...parsed, secret: parsed.secret.toLowerCase() } : null;
  } catch { return null; }
}

function writeSession(identity: PrivateIdentity | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (identity) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* private memory remains available for this tab */ }
}

export function getIdentity(): PrivateIdentity {
  if (memoryIdentity) return { ...memoryIdentity };
  const stored = readSession();
  memoryIdentity = stored || { secret: randomSecret(), label: 'Private room invite', createdAt: Date.now() };
  if (!stored) writeSession(memoryIdentity);
  return { ...memoryIdentity };
}

/** Returns a user-controlled plaintext backup. It must never be sent to analytics or logged. */
export function exportIdentity(identity = getIdentity()): string {
  if (!validIdentity(identity)) throw new Error('Cannot export an invalid private identity.');
  return JSON.stringify({ format: 'stillwater-private-identity', version: 1, ...identity, secret: identity.secret.toLowerCase() });
}

export function importIdentity(serialized: string | PrivateIdentity): PrivateIdentity {
  let value: unknown = serialized;
  if (typeof serialized === 'string') {
    try { value = JSON.parse(serialized); } catch { throw new Error('Identity backup is not valid JSON.'); }
    if ((value as { format?: unknown })?.format !== 'stillwater-private-identity') throw new Error('Identity backup format is not supported.');
  }
  if (!validIdentity(value)) throw new Error('Identity backup must contain a 32-byte hexadecimal secret.');
  memoryIdentity = { secret: value.secret.toLowerCase(), label: value.label, createdAt: value.createdAt };
  writeSession(memoryIdentity);
  return { ...memoryIdentity };
}

export function clearIdentity(): void {
  memoryIdentity = null;
  writeSession(null);
}

export function publicFingerprint(secret: string): string {
  const secretBytes = parseBytes32(secret, 'Invite secret');
  return toHex(pureCircuits.derive_redemption_token(secretBytes, new Uint8Array(32)));
}

export function sessionToken(secret: string, room: Uint8Array): Uint8Array {
  return pureCircuits.derive_redemption_token(parseBytes32(secret, 'Invite secret'), parseBytes32(room, 'Room ID'));
}

export function hasRedeemedInvite(secret: string, state: unknown): boolean {
  const candidate = state as { room_id?: unknown; redeemed_tokens?: unknown } | null;
  if (!candidate?.room_id) return false;
  let token: Uint8Array;
  try { token = sessionToken(secret, candidate.room_id as Uint8Array); } catch { return false; }
  const target = toHex(token);
  const redeemed = candidate.redeemed_tokens as { member?: (value: Uint8Array) => boolean } | Iterable<Uint8Array> | undefined;
  try {
    if (redeemed && 'member' in redeemed && typeof redeemed.member === 'function' && redeemed.member(token)) return true;
    if (redeemed && Symbol.iterator in Object(redeemed)) for (const value of redeemed as Iterable<Uint8Array>) if (toHex(value) === target) return true;
  } catch { return false; }
  return false;
}

export { fromHex };
