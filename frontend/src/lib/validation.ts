export type IntegerInput = string | number | bigint;
export type Bytes32Input = string | Uint8Array;
export const UINT32_MAX = (1n << 32n) - 1n;
export const UINT64_MAX = (1n << 64n) - 1n;

export function toHex(value: Uint8Array | readonly number[] | string): string {
  if (typeof value === 'string') return normalizeHex(value);
  if (!(value instanceof Uint8Array) && (!Array.isArray(value) || value.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255))) {
    throw new Error('Expected a byte array.');
  }
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeHex(value: string): string {
  if (typeof value !== 'string') throw new Error('Expected hexadecimal text.');
  const normalized = value.trim().replace(/^0x/i, '');
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized)) throw new Error('Invalid hexadecimal input.');
  return normalized.toLowerCase();
}

export function fromHex(value: string): Uint8Array {
  const normalized = normalizeHex(value);
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function parseBytes32(value: Bytes32Input, label = 'Value'): Uint8Array {
  const bytes = typeof value === 'string' ? fromHex(value) : value;
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw new Error(`${label} must be exactly 32 bytes (64 hexadecimal characters).`);
  return bytes.slice();
}

/** Stillwater persists the SDK's 32-byte contract address as exactly 64 hexadecimal characters. */
export function parseContractAddress(value: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^[0-9a-f]{64}$/i.test(normalized)) throw new Error('Contract address must be exactly 64 hexadecimal characters.');
  return normalized.toLowerCase();
}

export function isContractAddress(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim());
}

export function parseInteger(value: IntegerInput, label: string, minimum = 0n, maximum = UINT64_MAX): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(`${label} must be a safe whole number.`);
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') throw new Error(`${label} must be a whole number.`);
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be a non-negative whole number.`);
  const result = BigInt(text);
  if (result < minimum || result > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  return result;
}

export const parseScore = (value: IntegerInput) => parseInteger(value, 'Self-attested score', 0n, 100n);
export const parseThreshold = (value: IntegerInput) => parseInteger(value, 'Threshold', 0n, 100n);
export const parseCapacity = (value: IntegerInput) => parseInteger(value, 'Capacity', 1n, UINT32_MAX);
export function parseExpiry(value: IntegerInput, nowSeconds = Math.floor(Date.now() / 1000)): bigint {
  const expiry = parseInteger(value, 'Expiry', 1n, UINT64_MAX);
  if (expiry <= BigInt(nowSeconds)) throw new Error('Expiry must be a future Unix timestamp in seconds.');
  return expiry;
}

export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
