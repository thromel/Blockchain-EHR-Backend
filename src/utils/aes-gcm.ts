/**
 * @file AES-256-GCM encryption utilities
 * @description Authenticated encryption with associated data (AEAD)
 * Provides confidentiality, integrity, and authenticity
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';
import { AESGCMEncrypted, AESGCMEncryptedHex, EncryptedRecord } from '../types';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Generate a random AES-256 key
 */
export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

/**
 * Generate a random initialization vector (nonce)
 */
export function generateIV(): Buffer {
  return randomBytes(IV_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(
  data: Buffer | string,
  key: Buffer,
  iv: Buffer | null = null,
  aad: string | null = null
): AESGCMEncrypted {
  try {
    // Validate key
    if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
      throw new Error(`Key must be ${KEY_LENGTH} bytes`);
    }

    // Generate IV if not provided
    const ivBuffer = iv || generateIV();

    if (ivBuffer.length !== IV_LENGTH) {
      throw new Error(`IV must be ${IV_LENGTH} bytes`);
    }

    // Convert data to buffer
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, ivBuffer);

    // Add AAD if provided
    if (aad) {
      cipher.setAAD(Buffer.from(aad), {
        plaintextLength: dataBuffer.length,
      });
    }

    // Encrypt
    const ciphertext = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: ivBuffer,
      authTag,
    };
  } catch (error) {
    throw new Error(`AES-GCM encryption failed: ${(error as Error).message}`);
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  aad: string | null = null
): Buffer {
  try {
    // Validate inputs
    if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
      throw new Error(`Key must be ${KEY_LENGTH} bytes`);
    }

    if (!Buffer.isBuffer(iv) || iv.length !== IV_LENGTH) {
      throw new Error(`IV must be ${IV_LENGTH} bytes`);
    }

    if (!Buffer.isBuffer(authTag) || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Auth tag must be ${AUTH_TAG_LENGTH} bytes`);
    }

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);

    // Set authentication tag
    decipher.setAuthTag(authTag);

    // Add AAD if provided
    if (aad) {
      decipher.setAAD(Buffer.from(aad), {
        plaintextLength: ciphertext.length,
      });
    }

    // Decrypt
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return plaintext;
  } catch (error) {
    throw new Error(`AES-GCM decryption failed: ${(error as Error).message}`);
  }
}

/**
 * Encrypt and return combined format (for easy storage)
 */
export function encryptToHex(
  data: Buffer | string,
  key: Buffer,
  aad: string | null = null
): AESGCMEncryptedHex {
  const { ciphertext, iv, authTag } = encrypt(data, key, null, aad);

  return {
    encrypted: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt from hex format
 */
export function decryptFromHex(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string,
  key: Buffer,
  aad: string | null = null
): Buffer {
  const ciphertext = Buffer.from(encryptedHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  return decrypt(ciphertext, key, iv, authTag, aad);
}

/**
 * Encrypt and return as single base64 string
 * Format: iv(12) + authTag(16) + ciphertext
 */
export function encryptToBase64(
  data: Buffer | string,
  key: Buffer,
  aad: string | null = null
): string {
  const { ciphertext, iv, authTag } = encrypt(data, key, null, aad);

  // Combine: iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, ciphertext]);

  return combined.toString('base64');
}

/**
 * Decrypt from single base64 string
 */
export function decryptFromBase64(
  encryptedBase64: string,
  key: Buffer,
  aad: string | null = null
): Buffer {
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  return decrypt(ciphertext, key, iv, authTag, aad);
}

/**
 * Encrypt healthcare record with metadata as AAD
 */
export function encryptRecord(
  recordData: Record<string, any> | string,
  key: Buffer,
  metadata: Record<string, any> = {}
): EncryptedRecord {
  try {
    // Serialize record data
    const dataString =
      typeof recordData === 'string' ? recordData : JSON.stringify(recordData);

    // Serialize metadata for AAD
    const aad = JSON.stringify(metadata);

    // Encrypt
    const { ciphertext, iv, authTag } = encrypt(dataString, key, null, aad);

    return {
      encrypted: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      metadata,
    };
  } catch (error) {
    throw new Error(`Record encryption failed: ${(error as Error).message}`);
  }
}

/**
 * Decrypt healthcare record
 */
export function decryptRecord(
  encryptedRecord: EncryptedRecord,
  key: Buffer
): Record<string, any> | string {
  try {
    const { encrypted, iv, authTag, metadata } = encryptedRecord;

    // Serialize metadata for AAD
    const aad = JSON.stringify(metadata);

    // Decrypt
    const plaintext = decrypt(
      Buffer.from(encrypted, 'base64'),
      key,
      Buffer.from(iv, 'base64'),
      Buffer.from(authTag, 'base64'),
      aad
    );

    // Try to parse as JSON
    try {
      return JSON.parse(plaintext.toString());
    } catch {
      return plaintext.toString();
    }
  } catch (error) {
    throw new Error(`Record decryption failed: ${(error as Error).message}`);
  }
}

/**
 * Key derivation using PBKDF2
 */
export function deriveKey(
  password: string,
  salt: Buffer,
  iterations: number = 100000
): Buffer {
  return pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
}

/**
 * Generate a random salt
 */
export function generateSalt(): Buffer {
  return randomBytes(16);
}

export { KEY_LENGTH, IV_LENGTH, AUTH_TAG_LENGTH };
