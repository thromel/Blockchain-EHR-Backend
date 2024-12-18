/**
 * @file Records Controller
 * @description Handles health record operations (add, get, list, update)
 */

import { Request, Response, NextFunction } from 'express';
import db from '../services/database';
import { AppError } from '../middleware/errorHandler';
import { PatientRecordsService } from '../services/blockchain/PatientRecordsService';
import { createStorageService } from '../services/storage';
import * as aesGcm from '../utils/aes-gcm';
import * as ecies from '../utils/ecies';
import { sha256 } from '../utils/hash';
import crypto from 'crypto';

/**
 * Add new health record
 * Encrypts data, stores off-chain, and registers on blockchain
 */
export async function addRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { fhirData, recipientPublicKeys } = req.body;

    // Only patients can add their own records
    if (role !== 'patient') {
      throw new AppError('Only patients can add records', 403, 'FORBIDDEN');
    }

    // Get patient contract address
    const user = await db.one(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (!user.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    // Generate AES key for record encryption
    const aesKey = crypto.randomBytes(32);

    // Encrypt FHIR data with AES-GCM
    const fhirDataStr = JSON.stringify(fhirData);
    const encrypted = aesGcm.encrypt(fhirDataStr, aesKey);

    // Calculate content digest
    const encryptedBlob = Buffer.concat([
      encrypted.iv,
      encrypted.ciphertext,
      encrypted.authTag,
    ]);
    const contentDigest = '0x' + sha256(encryptedBlob);

    // Store encrypted blob
    const storageService = createStorageService();
    const storageResult = await storageService.store(encryptedBlob, {
      contentDigest: contentDigest.slice(2), // Remove 0x prefix
    });

    // Wrap AES key for patient (self-access)
    const patientUser = await db.one(
      'SELECT wallet_address FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    // Get patient's public key from blockchain
    const keyRegistryService = require('../services/blockchain/KeyRegistryService').KeyRegistryService;
    const keyRegistry = new keyRegistryService();
    const patientKeyInfo = await keyRegistry.getPublicKey(walletAddress);
    const wrappedKeyForPatient = await ecies.wrapKey(aesKey, patientKeyInfo.publicKey);

    // Add record to blockchain
    const patientRecordsService = new PatientRecordsService(user.patient_contract_address);
    const addRecordResult = await patientRecordsService.addRecord(
      req.wallet!,
      storageResult.pointer,
      contentDigest,
      wrappedKeyForPatient
    );

    // Store record metadata in database
    await db.none(
      `INSERT INTO records (patient_wallet, record_id, storage_pointer, content_digest)
       VALUES ($1, $2, $3, $4)`,
      [walletAddress, addRecordResult.recordId, storageResult.pointer, contentDigest]
    );

    // Grant access to specified recipients if provided
    if (recipientPublicKeys && recipientPublicKeys.length > 0) {
      for (const recipient of recipientPublicKeys) {
        const wrappedKey = await ecies.wrapKey(aesKey, recipient.publicKey);

        const expiration = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year

        await patientRecordsService.grantPermission(
          req.wallet!,
          recipient.address,
          [addRecordResult.recordId],
          wrappedKey,
          expiration
        );
      }
    }

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [
        walletAddress,
        'record_added',
        addRecordResult.transactionHash,
        {
          recordId: addRecordResult.recordId,
          storagePointer: storageResult.pointer,
          contentDigest,
        },
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Record added successfully',
      data: {
        recordId: addRecordResult.recordId,
        storagePointer: storageResult.pointer,
        contentDigest,
        transactionHash: addRecordResult.transactionHash,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single record
 * Retrieves and decrypts record if user has access
 */
export async function getRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Check access
    const hasAccess = await patientRecordsService.checkAccess(walletAddress, parseInt(recordId));
    if (!hasAccess) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Get record metadata from blockchain
    const recordMetadata = await patientRecordsService.getRecord(parseInt(recordId));

    // Get wrapped key for user
    const wrappedKey = await patientRecordsService.getWrappedKey(
      walletAddress,
      parseInt(recordId)
    );

    // Retrieve encrypted data from storage
    const storageService = createStorageService();
    const encryptedBlob = await storageService.retrieve(
      recordMetadata.storagePointer,
      recordMetadata.contentDigest.slice(2) // Remove 0x prefix
    );

    // Unwrap AES key
    const aesKey = await ecies.unwrapKey(wrappedKey, req.wallet!.privateKey);

    // Decrypt record
    const iv = encryptedBlob.slice(0, 12);
    const authTag = encryptedBlob.slice(-16);
    const ciphertext = encryptedBlob.slice(12, -16);

    const decrypted = aesGcm.decrypt(
      {
        iv,
        ciphertext,
        authTag,
      },
      aesKey
    );

    const fhirData = JSON.parse(decrypted.toString('utf-8'));

    // Log access
    if (req.user!.role !== 'patient' || walletAddress !== patientAddress) {
      await db.none(
        `INSERT INTO access_logs (record_id, accessor_wallet, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [recordId, walletAddress, req.ip, req.get('user-agent')]
      );
    }

    res.json({
      success: true,
      data: {
        recordId: parseInt(recordId),
        fhirData,
        metadata: {
          storagePointer: recordMetadata.storagePointer,
          contentDigest: recordMetadata.contentDigest,
          timestamp: recordMetadata.timestamp,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all accessible records for a patient
 */
export async function listRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { patientAddress, offset = 0, limit = 50 } = req.query;

    const targetPatient = (patientAddress as string) || walletAddress;

    // Get patient contract address
    const patient = await db.oneOrNone(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [targetPatient]
    );

    if (!patient?.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);

    // If requesting own records (patient)
    if (walletAddress.toLowerCase() === targetPatient.toLowerCase()) {
      const recordCount = await patientRecordsService.getRecordCount();
      const records = await patientRecordsService.listRecords(
        parseInt(offset as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: {
          records,
          total: recordCount,
          offset: parseInt(offset as string),
          limit: parseInt(limit as string),
        },
      });
      return;
    }

    // If requesting someone else's records (doctor/admin)
    const accessibleRecords = await patientRecordsService.getAccessibleRecords(
      walletAddress,
      parseInt(offset as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        records: accessibleRecords,
        offset: parseInt(offset as string),
        limit: parseInt(limit as string),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get record access history
 * Shows who accessed a specific record
 */
export async function getRecordAccessHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { recordId } = req.params;
    const { patientAddress } = req.query;

    if (!patientAddress) {
      throw new AppError('Patient address required', 400, 'MISSING_PATIENT_ADDRESS');
    }

    // Only patient can view their own access history
    if (role !== 'patient' && role !== 'admin') {
      throw new AppError('Only patients and admins can view access history', 403, 'FORBIDDEN');
    }

    if (role === 'patient' && walletAddress.toLowerCase() !== (patientAddress as string).toLowerCase()) {
      throw new AppError('Cannot view other patients access history', 403, 'FORBIDDEN');
    }

    // Get access logs from database
    const accessLogs = await db.manyOrNone(
      `SELECT al.accessor_wallet, al.accessed_at, al.ip_address, al.user_agent, u.name, u.role
       FROM access_logs al
       JOIN users u ON al.accessor_wallet = u.wallet_address
       WHERE al.record_id = $1
       ORDER BY al.accessed_at DESC
       LIMIT 100`,
      [recordId]
    );

    res.json({
      success: true,
      data: {
        recordId: parseInt(recordId),
        accessLogs,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Search records by FHIR resource type
 * Note: This is a simplified version - full FHIR search would be more complex
 */
export async function searchRecords(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.user!;
    const { patientAddress, resourceType, offset = 0, limit = 50 } = req.query;

    const targetPatient = (patientAddress as string) || walletAddress;

    // Get patient contract address
    const patient = await db.oneOrNone(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [targetPatient]
    );

    if (!patient?.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);

    // Get accessible records
    let recordIds: number[];

    if (walletAddress.toLowerCase() === targetPatient.toLowerCase()) {
      const recordCount = await patientRecordsService.getRecordCount();
      recordIds = Array.from({ length: recordCount }, (_, i) => i);
    } else {
      const accessible = await patientRecordsService.getAccessibleRecords(walletAddress, 0, 1000);
      recordIds = accessible.map((r: any) => r.recordId);
    }

    // Note: This is a simplified implementation
    // In production, you'd want to index FHIR resources for efficient searching
    const matchingRecords = [];

    for (const recordId of recordIds.slice(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string)
    )) {
      // For demo purposes, just return record IDs
      // In production, you'd decrypt and filter by resourceType
      matchingRecords.push({ recordId });
    }

    res.json({
      success: true,
      data: {
        records: matchingRecords,
        total: recordIds.length,
        offset: parseInt(offset as string),
        limit: parseInt(limit as string),
      },
    });
  } catch (error) {
    next(error);
  }
}
