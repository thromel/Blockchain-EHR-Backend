/**
 * @file ECIES (Elliptic Curve Integrated Encryption Scheme) utilities
 * @description Implements ECIES encryption using secp256k1 curve
 * Configuration: ANSI X9.63 KDF with SHA-256, AES-128-CTR, HMAC-SHA-256
 */

// @ts-ignore - eccrypto has no type definitions
import * as eccrypto from 'eccrypto';
import { randomBytes } from 'crypto';
import { Wallet, utils } from 'ethers';
import { Keypair, ECIESEncrypted } from '../types';

const { keccak256, getAddress } = utils;

/**
 * Generate a new secp256k1 keypair
 */
export function generateKeypair(): Keypair {
  const privateKey = randomBytes(32);
  const publicKey = eccrypto.getPublic(privateKey);

  return {
    privateKey,
    publicKey,
  };
}

/**
 * Derive public key from private key
 */
export function getPublicKey(privateKey: Buffer | string): Buffer {
  const privKeyBuffer = Buffer.isBuffer(privateKey)
    ? privateKey
    : Buffer.from(privateKey.replace('0x', ''), 'hex');

  return eccrypto.getPublic(privKeyBuffer);
}

/**
 * Get public key from Ethereum wallet
 */
export function getPublicKeyFromWallet(wallet: Wallet): Buffer {
  const publicKey = wallet.publicKey.replace('0x', '');
  return Buffer.from(publicKey, 'hex');
}

/**
 * Encrypt data using ECIES
 */
export async function encrypt(
  publicKey: Buffer | string,
  data: Buffer | string
): Promise<ECIESEncrypted> {
  try {
    const publicKeyBuffer = Buffer.isBuffer(publicKey)
      ? publicKey
      : Buffer.from(publicKey.replace('0x', ''), 'hex');

    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Validate public key format
    if (publicKeyBuffer.length !== 65) {
      throw new Error('Public key must be 65 bytes (uncompressed secp256k1)');
    }

    if (publicKeyBuffer[0] !== 0x04) {
      throw new Error('Public key must start with 0x04 (uncompressed format)');
    }

    // Perform ECIES encryption
    const encrypted = await eccrypto.encrypt(publicKeyBuffer, dataBuffer);

    return {
      iv: encrypted.iv.toString('hex'),
      ephemPublicKey: encrypted.ephemPublicKey.toString('hex'),
      ciphertext: encrypted.ciphertext.toString('hex'),
      mac: encrypted.mac.toString('hex'),
    };
  } catch (error) {
    throw new Error(`ECIES encryption failed: ${(error as Error).message}`);
  }
}

/**
 * Decrypt data using ECIES
 */
export async function decrypt(
  privateKey: Buffer | string,
  encryptedData: ECIESEncrypted
): Promise<Buffer> {
  try {
    const privateKeyBuffer = Buffer.isBuffer(privateKey)
      ? privateKey
      : Buffer.from(privateKey.replace('0x', ''), 'hex');

    // Reconstruct encrypted structure
    const encrypted = {
      iv: Buffer.from(encryptedData.iv, 'hex'),
      ephemPublicKey: Buffer.from(encryptedData.ephemPublicKey, 'hex'),
      ciphertext: Buffer.from(encryptedData.ciphertext, 'hex'),
      mac: Buffer.from(encryptedData.mac, 'hex'),
    };

    // Perform ECIES decryption
    const decrypted = await eccrypto.decrypt(privateKeyBuffer, encrypted);

    return decrypted;
  } catch (error) {
    throw new Error(`ECIES decryption failed: ${(error as Error).message}`);
  }
}

/**
 * Encrypt symmetric key with recipient's public key (key wrapping)
 */
export async function wrapKey(
  recipientPublicKey: Buffer,
  symmetricKey: Buffer
): Promise<string> {
  try {
    const encrypted = await encrypt(recipientPublicKey, symmetricKey);

    // Serialize to single string for storage
    const wrapped = JSON.stringify(encrypted);
    return Buffer.from(wrapped).toString('hex');
  } catch (error) {
    throw new Error(`Key wrapping failed: ${(error as Error).message}`);
  }
}

/**
 * Decrypt symmetric key with private key (key unwrapping)
 */
export async function unwrapKey(
  privateKey: Buffer | string,
  wrappedKey: string
): Promise<Buffer> {
  try {
    const wrappedBuffer = Buffer.from(wrappedKey, 'hex');
    const encryptedData: ECIESEncrypted = JSON.parse(wrappedBuffer.toString());

    const symmetricKey = await decrypt(privateKey, encryptedData);
    return symmetricKey;
  } catch (error) {
    throw new Error(`Key unwrapping failed: ${(error as Error).message}`);
  }
}

/**
 * Convert public key to hex string for blockchain storage
 */
export function publicKeyToHex(publicKey: Buffer): string {
  return '0x' + publicKey.toString('hex');
}

/**
 * Convert hex string to public key buffer
 */
export function hexToPublicKey(hexString: string): Buffer {
  return Buffer.from(hexString.replace('0x', ''), 'hex');
}

/**
 * Validate public key format
 */
export function isValidPublicKey(publicKey: Buffer | string): boolean {
  try {
    const publicKeyBuffer = Buffer.isBuffer(publicKey)
      ? publicKey
      : Buffer.from(publicKey.replace('0x', ''), 'hex');

    if (publicKeyBuffer.length !== 65) {
      return false;
    }

    if (publicKeyBuffer[0] !== 0x04) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Derive wallet address from public key
 */
export function publicKeyToAddress(publicKey: Buffer): string {
  // Remove 0x04 prefix
  const pubKey = publicKey.subarray(1);

  // Hash with keccak256
  const hash = keccak256(pubKey);

  // Take last 20 bytes
  const address = '0x' + hash.slice(-40);

  return getAddress(address); // Checksum format
}
