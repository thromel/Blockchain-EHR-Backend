/**
 * @file EIP-712 Typed Structured Data Signing utilities
 * @description Implements EIP-712 for human-readable structured data signing
 */

import { Wallet, verifyTypedData, TypedDataEncoder, Signature } from 'ethers';
import {
  EIP712Domain,
  GrantPermissionMessage,
  RevokePermissionMessage,
  SignatureComponents,
} from '../types';

/**
 * Create EIP-712 domain for PatientHealthRecords contract
 */
export function createDomain(contractAddress: string, chainId: number): EIP712Domain {
  return {
    name: 'PatientHealthRecords',
    version: '1',
    chainId,
    verifyingContract: contractAddress,
  };
}

/**
 * EIP-712 type definitions for GrantPermission
 */
export const GRANT_PERMISSION_TYPES = {
  GrantPermission: [
    { name: 'grantedTo', type: 'address' },
    { name: 'recordIds', type: 'uint256[]' },
    { name: 'wrappedKey', type: 'bytes' },
    { name: 'expirationTime', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

/**
 * EIP-712 type definitions for RevokePermission
 */
export const REVOKE_PERMISSION_TYPES = {
  RevokePermission: [
    { name: 'permissionId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

/**
 * Sign a GrantPermission message using EIP-712
 */
export async function signGrantPermission(
  wallet: Wallet,
  contractAddress: string,
  chainId: number,
  message: GrantPermissionMessage
): Promise<string> {
  try {
    const domain = createDomain(contractAddress, chainId);

    // Convert wrappedKey to bytes if it's a Buffer
    const messageFormatted = {
      ...message,
      wrappedKey: Buffer.isBuffer(message.wrappedKey)
        ? '0x' + message.wrappedKey.toString('hex')
        : message.wrappedKey,
    };

    const signature = await wallet.signTypedData(
      domain,
      GRANT_PERMISSION_TYPES,
      messageFormatted
    );

    return signature;
  } catch (error) {
    throw new Error(`EIP-712 signing failed: ${(error as Error).message}`);
  }
}

/**
 * Sign a RevokePermission message using EIP-712
 */
export async function signRevokePermission(
  wallet: Wallet,
  contractAddress: string,
  chainId: number,
  message: RevokePermissionMessage
): Promise<string> {
  try {
    const domain = createDomain(contractAddress, chainId);

    const signature = await wallet.signTypedData(
      domain,
      REVOKE_PERMISSION_TYPES,
      message
    );

    return signature;
  } catch (error) {
    throw new Error(`EIP-712 signing failed: ${(error as Error).message}`);
  }
}

/**
 * Verify an EIP-712 signature
 */
export function verifySignature(
  domain: EIP712Domain,
  types: Record<string, Array<{ name: string; type: string }>>,
  message: Record<string, any>,
  signature: string
): string {
  try {
    const recoveredAddress = verifyTypedData(domain, types, message, signature);

    return recoveredAddress;
  } catch (error) {
    throw new Error(`Signature verification failed: ${(error as Error).message}`);
  }
}

/**
 * Verify a GrantPermission signature
 */
export function verifyGrantPermissionSignature(
  contractAddress: string,
  chainId: number,
  message: GrantPermissionMessage,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const domain = createDomain(contractAddress, chainId);

    const messageFormatted = {
      ...message,
      wrappedKey: Buffer.isBuffer(message.wrappedKey)
        ? '0x' + message.wrappedKey.toString('hex')
        : message.wrappedKey,
    };

    const recoveredAddress = verifySignature(
      domain,
      GRANT_PERMISSION_TYPES,
      messageFormatted,
      signature
    );

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Generate a unique nonce for replay protection
 */
export function generateNonce(): number {
  return Date.now();
}

/**
 * Hash typed data (for manual verification)
 */
export function hashTypedData(
  domain: EIP712Domain,
  types: Record<string, Array<{ name: string; type: string }>>,
  message: Record<string, any>
): string {
  return TypedDataEncoder.hash(domain, types, message);
}

/**
 * Get domain separator hash
 */
export function getDomainSeparator(contractAddress: string, chainId: number): string {
  const domain = createDomain(contractAddress, chainId);
  return TypedDataEncoder.hashDomain(domain);
}

/**
 * Encode typed data for contract verification
 */
export function encodeTypedData(
  domain: EIP712Domain,
  types: Record<string, Array<{ name: string; type: string }>>,
  message: Record<string, any>
): {
  domainSeparator: string;
  structHash: string;
  encodedData: string;
} {
  const encoder = TypedDataEncoder.from(types);

  return {
    domainSeparator: TypedDataEncoder.hashDomain(domain),
    structHash: encoder.hash(message),
    encodedData: encoder.encode(message),
  };
}

/**
 * Create a permission grant message (helper)
 */
export function createGrantPermissionMessage(
  grantedTo: string,
  recordIds: number[],
  wrappedKey: string | Buffer,
  expirationTime: number,
  nonce: number | null = null
): GrantPermissionMessage {
  return {
    grantedTo,
    recordIds,
    wrappedKey: Buffer.isBuffer(wrappedKey)
      ? '0x' + wrappedKey.toString('hex')
      : wrappedKey,
    expirationTime,
    nonce: nonce || generateNonce(),
  };
}

/**
 * Create a permission revocation message (helper)
 */
export function createRevokePermissionMessage(
  permissionId: number,
  nonce: number | null = null
): RevokePermissionMessage {
  return {
    permissionId,
    nonce: nonce || generateNonce(),
  };
}

/**
 * Parse signature into components (r, s, v)
 */
export function parseSignature(signature: string): SignatureComponents {
  const sig = Signature.from(signature);

  return {
    r: sig.r,
    s: sig.s,
    v: sig.v,
  };
}

/**
 * Combine signature components into signature string
 */
export function combineSignature(r: string, s: string, v: number): string {
  return Signature.from({ r, s, v }).serialized;
}
