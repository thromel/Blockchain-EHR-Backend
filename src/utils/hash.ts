/**
 * @file Hashing utilities
 * @description SHA-256 and other hashing functions for content integrity
 */

import { createHash } from 'crypto';

/**
 * Calculate SHA-256 hash of data
 */
export function sha256(data: Buffer | string): string {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Calculate SHA-256 hash with 0x prefix (for blockchain)
 */
export function sha256Hex(data: Buffer | string): string {
  return '0x' + sha256(data);
}

/**
 * Verify data against expected hash
 */
export function verifySHA256(
  data: Buffer | string,
  expectedHash: string
): boolean {
  const actualHash = sha256(data);
  const cleanExpectedHash = expectedHash.replace('0x', '');
  return actualHash === cleanExpectedHash;
}

/**
 * Calculate hash of multiple data pieces
 */
export function sha256Multi(...data: Array<Buffer | string>): string {
  const hash = createHash('sha256');

  for (const piece of data) {
    const buffer = Buffer.isBuffer(piece) ? piece : Buffer.from(piece);
    hash.update(buffer);
  }

  return hash.digest('hex');
}

/**
 * Calculate hash of JSON object (deterministic)
 */
export function sha256JSON(obj: Record<string, any>): string {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  return sha256(json);
}
