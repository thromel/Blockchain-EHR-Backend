/**
 * @file Permissions Controller
 * @description Handles access permission operations (grant, revoke, check)
 */

import { Request, Response, NextFunction } from 'express';
import db from '../services/database';
import { AppError } from '../middleware/errorHandler';
import { PatientRecordsService } from '../services/blockchain/PatientRecordsService';
import * as ecies from '../utils/ecies';
import { KeyRegistryService } from '../services/blockchain/KeyRegistryService';

/**
 * Grant permission to access records
 * Patient grants doctor/other user access to specific records
 */
export async function grantPermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { grantedTo, recordIds, expirationTime, wrappedKey } = req.body;

    // Only patients can grant permissions
    if (role !== 'patient') {
      throw new AppError('Only patients can grant permissions', 403, 'FORBIDDEN');
    }

    // Get patient contract address
    const patient = await db.one(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (!patient.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    // Verify grantee exists
    const grantee = await db.oneOrNone(
      'SELECT wallet_address FROM users WHERE wallet_address = $1',
      [grantedTo]
    );

    if (!grantee) {
      throw new AppError('Grantee user not found', 404, 'USER_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);

    // Grant permission on blockchain
    const result = await patientRecordsService.grantPermission(
      req.wallet!,
      grantedTo,
      recordIds,
      wrappedKey,
      expirationTime
    );

    // Cache permission in database
    await db.none(
      `INSERT INTO permissions (patient_wallet, grantee_wallet, record_id, permission_id, wrapped_key, expiration, transaction_hash)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)`,
      [
        walletAddress,
        grantedTo,
        recordIds[0], // For simplicity, storing first record ID
        result.permissionId,
        wrappedKey,
        expirationTime,
        result.transactionHash,
      ]
    );

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [
        walletAddress,
        'permission_granted',
        result.transactionHash,
        {
          grantedTo,
          recordIds,
          permissionId: result.permissionId,
          expirationTime,
        },
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Permission granted successfully',
      data: {
        permissionId: result.permissionId,
        grantedTo,
        recordIds,
        expirationTime,
        transactionHash: result.transactionHash,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Grant permission with signature (EIP-712)
 * Allows off-chain signing for permission grants
 */
export async function grantPermissionWithSignature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { patientAddress, grantedTo, recordIds, wrappedKey, expirationTime, nonce, signature } =
      req.body;

    // Get patient contract address
    const patient = await db.oneOrNone(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [patientAddress]
    );

    if (!patient?.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);

    // Grant permission using signature
    const result = await patientRecordsService.grantPermissionBySig(
      grantedTo,
      recordIds,
      wrappedKey,
      expirationTime,
      nonce,
      signature
    );

    // Cache permission in database
    await db.none(
      `INSERT INTO permissions (patient_wallet, grantee_wallet, record_id, permission_id, wrapped_key, expiration, nonce, transaction_hash)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7, $8)`,
      [
        patientAddress,
        grantedTo,
        recordIds[0],
        result.permissionId,
        wrappedKey,
        expirationTime,
        nonce,
        result.transactionHash,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Permission granted successfully via signature',
      data: {
        permissionId: result.permissionId,
        grantedTo,
        recordIds,
        expirationTime,
        transactionHash: result.transactionHash,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke permission
 * Patient revokes previously granted access
 */
export async function revokePermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { permissionId } = req.params;

    // Only patients can revoke permissions
    if (role !== 'patient') {
      throw new AppError('Only patients can revoke permissions', 403, 'FORBIDDEN');
    }

    // Get patient contract address
    const patient = await db.one(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (!patient.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);

    // Revoke permission on blockchain
    const result = await patientRecordsService.revokePermission(
      req.wallet!,
      parseInt(permissionId)
    );

    // Update database cache
    await db.none(
      `UPDATE permissions
       SET revoked = TRUE
       WHERE permission_id = $1 AND patient_wallet = $2`,
      [permissionId, walletAddress]
    );

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [
        walletAddress,
        'permission_revoked',
        result.transactionHash,
        { permissionId: parseInt(permissionId) },
      ]
    );

    res.json({
      success: true,
      message: 'Permission revoked successfully',
      data: {
        permissionId: parseInt(permissionId),
        transactionHash: result.transactionHash,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user has access to record
 */
export async function checkAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.user!;
    const { recordId } = req.params;
    const { patientAddress } = req.query;

    if (!patientAddress) {
      throw new AppError('Patient address required', 400, 'MISSING_PATIENT_ADDRESS');
    }

    // Get patient contract address
    const patient = await db.oneOrNone(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [patientAddress]
    );

    if (!patient?.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);

    // Check access on blockchain
    const hasAccess = await patientRecordsService.checkAccess(walletAddress, parseInt(recordId));

    res.json({
      success: true,
      data: {
        recordId: parseInt(recordId),
        hasAccess,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all permissions granted by patient
 */
export async function listGrantedPermissions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;

    // Only patients can view their granted permissions
    if (role !== 'patient') {
      throw new AppError('Only patients can view granted permissions', 403, 'FORBIDDEN');
    }

    // Get permissions from database cache
    const permissions = await db.manyOrNone(
      `SELECT p.permission_id, p.grantee_wallet, p.record_id, p.expiration, p.revoked, p.granted_at,
              u.name AS grantee_name, u.role AS grantee_role
       FROM permissions p
       JOIN users u ON p.grantee_wallet = u.wallet_address
       WHERE p.patient_wallet = $1
       ORDER BY p.granted_at DESC`,
      [walletAddress]
    );

    res.json({
      success: true,
      data: {
        permissions,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all permissions received by user (doctor)
 */
export async function listReceivedPermissions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.user!;

    // Get permissions from database cache
    const permissions = await db.manyOrNone(
      `SELECT p.permission_id, p.patient_wallet, p.record_id, p.expiration, p.revoked, p.granted_at,
              u.name AS patient_name
       FROM permissions p
       JOIN users u ON p.patient_wallet = u.wallet_address
       WHERE p.grantee_wallet = $1 AND p.revoked = FALSE AND p.expiration > NOW()
       ORDER BY p.granted_at DESC`,
      [walletAddress]
    );

    res.json({
      success: true,
      data: {
        permissions,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get permission details
 */
export async function getPermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.user!;
    const { permissionId } = req.params;
    const { patientAddress } = req.query;

    if (!patientAddress) {
      throw new AppError('Patient address required', 400, 'MISSING_PATIENT_ADDRESS');
    }

    // Get patient contract address
    const patient = await db.oneOrNone(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [patientAddress]
    );

    if (!patient?.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);

    // Get permission from blockchain
    const permission = await patientRecordsService.getPermission(parseInt(permissionId));

    res.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Batch grant permissions to multiple users
 */
export async function batchGrantPermissions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { grants } = req.body; // Array of { grantedTo, recordIds, expirationTime }

    // Only patients can grant permissions
    if (role !== 'patient') {
      throw new AppError('Only patients can grant permissions', 403, 'FORBIDDEN');
    }

    // Get patient contract address
    const patient = await db.one(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (!patient.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);
    const keyRegistryService = new KeyRegistryService();

    const results = [];

    for (const grant of grants) {
      // Get grantee's public key
      const granteeKey = await keyRegistryService.getPublicKey(grant.grantedTo);

      // Get AES key for records and wrap it for grantee
      // Note: This is simplified - in production, you'd need to get the AES key for each record
      const dummyKey = Buffer.from('a'.repeat(64), 'hex'); // Placeholder
      const wrappedKey = await ecies.wrapKey(dummyKey, granteeKey.publicKey);

      const result = await patientRecordsService.grantPermission(
        req.wallet!,
        grant.grantedTo,
        grant.recordIds,
        wrappedKey,
        grant.expirationTime
      );

      results.push({
        grantedTo: grant.grantedTo,
        permissionId: result.permissionId,
        transactionHash: result.transactionHash,
      });

      // Cache in database
      await db.none(
        `INSERT INTO permissions (patient_wallet, grantee_wallet, record_id, permission_id, wrapped_key, expiration, transaction_hash)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)`,
        [
          walletAddress,
          grant.grantedTo,
          grant.recordIds[0],
          result.permissionId,
          wrappedKey,
          grant.expirationTime,
          result.transactionHash,
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: `Granted ${results.length} permissions successfully`,
      data: {
        grants: results,
      },
    });
  } catch (error) {
    next(error);
  }
}
