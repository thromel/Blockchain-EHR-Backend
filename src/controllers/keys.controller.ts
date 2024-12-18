/**
 * @file Keys Controller
 * @description Handles cryptographic key management (register, rotate, revoke)
 */

import { Request, Response, NextFunction } from 'express';
import db from '../services/database';
import { AppError } from '../middleware/errorHandler';
import { KeyRegistryService } from '../services/blockchain/KeyRegistryService';

/**
 * Register public key
 * User registers their secp256k1 public key on blockchain
 */
export async function registerKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.user!;
    const { publicKey } = req.body;

    // Validate public key format
    if (!publicKey.match(/^0x04[a-fA-F0-9]{128}$/)) {
      throw new AppError(
        'Invalid public key format (must be 65 bytes, uncompressed)',
        400,
        'INVALID_PUBLIC_KEY'
      );
    }

    const keyRegistryService = new KeyRegistryService();

    // Register key on blockchain
    const transactionHash = await keyRegistryService.registerKey(req.wallet!, publicKey);

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [walletAddress, 'key_registered', transactionHash, { publicKey }]
    );

    res.status(201).json({
      success: true,
      message: 'Public key registered successfully',
      data: {
        walletAddress,
        publicKey,
        transactionHash,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Rotate public key
 * User rotates to a new public key (key version increments)
 */
export async function rotateKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.user!;
    const { newPublicKey } = req.body;

    // Validate public key format
    if (!newPublicKey.match(/^0x04[a-fA-F0-9]{128}$/)) {
      throw new AppError(
        'Invalid public key format (must be 65 bytes, uncompressed)',
        400,
        'INVALID_PUBLIC_KEY'
      );
    }

    const keyRegistryService = new KeyRegistryService();

    // Get current key info
    const currentKeyInfo = await keyRegistryService.getPublicKey(walletAddress);

    // Rotate key on blockchain
    const transactionHash = await keyRegistryService.rotateKey(req.wallet!, newPublicKey);

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [
        walletAddress,
        'key_rotated',
        transactionHash,
        {
          oldPublicKey: currentKeyInfo.publicKey,
          newPublicKey,
          oldVersion: currentKeyInfo.version,
          newVersion: currentKeyInfo.version + 1,
        },
      ]
    );

    res.json({
      success: true,
      message: 'Public key rotated successfully',
      data: {
        walletAddress,
        newPublicKey,
        newVersion: currentKeyInfo.version + 1,
        transactionHash,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke public key
 * User revokes their public key (emergency measure)
 */
export async function revokeKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.user!;

    const keyRegistryService = new KeyRegistryService();

    // Get current key info
    const currentKeyInfo = await keyRegistryService.getPublicKey(walletAddress);

    // Revoke key on blockchain
    const transactionHash = await keyRegistryService.revokeKey(req.wallet!);

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [
        walletAddress,
        'key_revoked',
        transactionHash,
        {
          publicKey: currentKeyInfo.publicKey,
          version: currentKeyInfo.version,
        },
      ]
    );

    res.json({
      success: true,
      message: 'Public key revoked successfully',
      data: {
        walletAddress,
        transactionHash,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get public key info
 * Retrieve public key for any user
 */
export async function getPublicKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new AppError('Invalid Ethereum address', 400, 'INVALID_ADDRESS');
    }

    const keyRegistryService = new KeyRegistryService();

    // Get public key from blockchain
    const keyInfo = await keyRegistryService.getPublicKey(address);

    res.json({
      success: true,
      data: {
        walletAddress: address,
        publicKey: keyInfo.publicKey,
        version: keyInfo.version,
        isRevoked: keyInfo.isRevoked,
        registeredAt: keyInfo.registeredAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user's key info
 */
export async function getMyKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { walletAddress } = req.user!;

    const keyRegistryService = new KeyRegistryService();

    // Get public key from blockchain
    const keyInfo = await keyRegistryService.getPublicKey(walletAddress);

    res.json({
      success: true,
      data: {
        walletAddress,
        publicKey: keyInfo.publicKey,
        version: keyInfo.version,
        isRevoked: keyInfo.isRevoked,
        registeredAt: keyInfo.registeredAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Batch get public keys
 * Retrieve multiple public keys at once
 */
export async function batchGetPublicKeys(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new AppError('Addresses array required', 400, 'MISSING_ADDRESSES');
    }

    if (addresses.length > 50) {
      throw new AppError('Maximum 50 addresses per request', 400, 'TOO_MANY_ADDRESSES');
    }

    const keyRegistryService = new KeyRegistryService();

    const results = [];

    for (const address of addresses) {
      try {
        const keyInfo = await keyRegistryService.getPublicKey(address);
        results.push({
          walletAddress: address,
          publicKey: keyInfo.publicKey,
          version: keyInfo.version,
          isRevoked: keyInfo.isRevoked,
          registeredAt: keyInfo.registeredAt,
        });
      } catch (error) {
        results.push({
          walletAddress: address,
          error: (error as Error).message,
        });
      }
    }

    res.json({
      success: true,
      data: {
        keys: results,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get key rotation history
 * Shows all previous key versions for a user
 */
export async function getKeyHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new AppError('Invalid Ethereum address', 400, 'INVALID_ADDRESS');
    }

    // Get key rotation history from audit log
    const history = await db.manyOrNone(
      `SELECT action, transaction_hash, details, created_at
       FROM audit_log
       WHERE wallet_address = $1
         AND action IN ('key_registered', 'key_rotated', 'key_revoked')
       ORDER BY created_at ASC`,
      [address]
    );

    res.json({
      success: true,
      data: {
        walletAddress: address,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
}
