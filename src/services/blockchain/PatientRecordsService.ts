/**
 * @file Patient Records Service
 * @description Service for interacting with PatientHealthRecords smart contract
 */

import { Contract, Wallet } from 'ethers';
import { getProvider } from './provider';
import PatientRecordsArtifact from '../../../artifacts/contracts/PatientHealthRecords.sol/PatientHealthRecords.json';
import { HealthRecordMetadata, Permission } from '../../types';

export class PatientRecordsService {
  private contract: Contract;

  constructor(contractAddress: string) {
    const provider = getProvider();

    if (!contractAddress) {
      throw new Error('Patient contract address is required');
    }

    this.contract = new Contract(contractAddress, PatientRecordsArtifact.abi, provider);
  }

  /**
   * Add a new health record
   */
  async addRecord(
    wallet: Wallet,
    storagePointer: string,
    contentDigest: string
  ): Promise<{
    recordId: number;
    transactionHash: string;
  }> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.addRecord(storagePointer, contentDigest);
      const receipt = await tx.wait();

      // Get record ID from event
      const event = receipt.events?.find((e: any) => e.event === 'RecordAdded');
      const recordId = event?.args?.recordId?.toNumber();

      return {
        recordId,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      throw new Error(`Failed to add record: ${(error as Error).message}`);
    }
  }

  /**
   * Update an existing record
   */
  async updateRecord(
    wallet: Wallet,
    recordId: number,
    newStoragePointer: string,
    newContentDigest: string
  ): Promise<string> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.updateRecord(recordId, newStoragePointer, newContentDigest);
      const receipt = await tx.wait();

      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Failed to update record: ${(error as Error).message}`);
    }
  }

  /**
   * Grant permission (on-chain call)
   */
  async grantPermission(
    wallet: Wallet,
    grantedTo: string,
    recordIds: number[],
    wrappedKey: string,
    expirationTime: number
  ): Promise<{
    permissionId: number;
    transactionHash: string;
  }> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.grantPermission(
        grantedTo,
        recordIds,
        wrappedKey,
        expirationTime
      );
      const receipt = await tx.wait();

      // Get permission ID from event
      const event = receipt.events?.find((e: any) => e.event === 'PermissionGranted');
      const permissionId = event?.args?.permissionId?.toNumber();

      return {
        permissionId,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      throw new Error(`Failed to grant permission: ${(error as Error).message}`);
    }
  }

  /**
   * Grant permission via signature (EIP-712)
   */
  async grantPermissionBySig(
    grantedTo: string,
    recordIds: number[],
    wrappedKey: string,
    expirationTime: number,
    nonce: number,
    signature: string
  ): Promise<{
    permissionId: number;
    transactionHash: string;
  }> {
    try {
      const tx = await this.contract.grantPermissionBySig(
        grantedTo,
        recordIds,
        wrappedKey,
        expirationTime,
        nonce,
        signature
      );
      const receipt = await tx.wait();

      const event = receipt.events?.find((e: any) => e.event === 'PermissionGranted');
      const permissionId = event?.args?.permissionId?.toNumber();

      return {
        permissionId,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      throw new Error(`Failed to grant permission by sig: ${(error as Error).message}`);
    }
  }

  /**
   * Revoke a permission
   */
  async revokePermission(wallet: Wallet, permissionId: number): Promise<string> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.revokePermission(permissionId);
      const receipt = await tx.wait();

      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Failed to revoke permission: ${(error as Error).message}`);
    }
  }

  /**
   * Request emergency access
   */
  async requestEmergencyAccess(
    wallet: Wallet,
    physician1: string,
    physician2: string,
    recordIds: number[],
    justificationCode: number,
    wrappedKey: string
  ): Promise<{
    emergencyId: string;
    transactionHash: string;
  }> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.requestEmergencyAccess(
        physician1,
        physician2,
        recordIds,
        justificationCode,
        wrappedKey
      );
      const receipt = await tx.wait();

      const event = receipt.events?.find((e: any) => e.event === 'EmergencyAccessRequested');
      const emergencyId = event?.args?.emergencyId;

      return {
        emergencyId,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      throw new Error(`Failed to request emergency access: ${(error as Error).message}`);
    }
  }

  /**
   * Confirm emergency access
   */
  async confirmEmergencyAccess(wallet: Wallet, emergencyId: string): Promise<string> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.confirmEmergencyAccess(emergencyId);
      const receipt = await tx.wait();

      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Failed to confirm emergency access: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user has access to a record
   */
  async checkAccess(
    userAddress: string,
    recordId: number
  ): Promise<{
    hasAccess: boolean;
    wrappedKey: string;
  }> {
    try {
      const [hasAccess, wrappedKey] = await this.contract.checkAccess(userAddress, recordId);

      return {
        hasAccess,
        wrappedKey,
      };
    } catch (error) {
      throw new Error(`Failed to check access: ${(error as Error).message}`);
    }
  }

  /**
   * Log access to a record
   */
  async logAccess(wallet: Wallet, recordId: number, detailsHash: string): Promise<string> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.logAccess(recordId, detailsHash);
      const receipt = await tx.wait();

      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Failed to log access: ${(error as Error).message}`);
    }
  }

  /**
   * Get record metadata
   */
  async getRecordMetadata(recordId: number): Promise<HealthRecordMetadata> {
    try {
      const [storagePointer, contentDigest, timestamp, lastUpdated] =
        await this.contract.getRecordMetadata(recordId);

      return {
        storagePointer,
        contentDigest,
        timestamp: timestamp.toNumber(),
        lastUpdated: lastUpdated.toNumber(),
      };
    } catch (error) {
      throw new Error(`Failed to get record metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Get all record IDs
   */
  async getAllRecordIds(): Promise<number[]> {
    try {
      const recordIds = await this.contract.getAllRecordIds();
      return recordIds.map((id: any) => id.toNumber());
    } catch (error) {
      throw new Error(`Failed to get all record IDs: ${(error as Error).message}`);
    }
  }

  /**
   * Get accessible records for a user
   */
  async getAccessibleRecords(userAddress: string): Promise<number[]> {
    try {
      const recordIds = await this.contract.getAccessibleRecords(userAddress);
      return recordIds.map((id: any) => id.toNumber());
    } catch (error) {
      throw new Error(`Failed to get accessible records: ${(error as Error).message}`);
    }
  }

  /**
   * Get access logs for a record
   */
  async getAccessLogs(
    recordId: number
  ): Promise<{
    accessors: string[];
    timestamps: number[];
  }> {
    try {
      const [accessors, timestamps] = await this.contract.getAccessLogs(recordId);

      return {
        accessors,
        timestamps: timestamps.map((t: any) => t.toNumber()),
      };
    } catch (error) {
      throw new Error(`Failed to get access logs: ${(error as Error).message}`);
    }
  }

  /**
   * Get record count
   */
  async getRecordCount(): Promise<number> {
    try {
      const count = await this.contract.getRecordCount();
      return count.toNumber();
    } catch (error) {
      throw new Error(`Failed to get record count: ${(error as Error).message}`);
    }
  }

  /**
   * Get patient address
   */
  async getPatient(): Promise<string> {
    try {
      return await this.contract.patient();
    } catch (error) {
      throw new Error(`Failed to get patient address: ${(error as Error).message}`);
    }
  }

  /**
   * Get EIP-712 domain separator
   */
  async getDomainSeparator(): Promise<string> {
    try {
      return await this.contract.getDomainSeparator();
    } catch (error) {
      throw new Error(`Failed to get domain separator: ${(error as Error).message}`);
    }
  }

  /**
   * Get contract address
   */
  getAddress(): string {
    return this.contract.address;
  }
}
