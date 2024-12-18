/**
 * @file KeyRegistry Service
 * @description Service for interacting with KeyRegistry smart contract
 */

import { Contract, Wallet } from 'ethers';
import { getProvider } from './provider';
import config from '../../config';
import KeyRegistryArtifact from '../../../artifacts/contracts/KeyRegistry.sol/KeyRegistry.json';
import { PublicKeyInfo } from '../../types';

export class KeyRegistryService {
  private contract: Contract;

  constructor(contractAddress?: string) {
    const provider = getProvider();
    const address = contractAddress || config.blockchain.keyRegistryAddress;

    if (!address) {
      throw new Error('KeyRegistry contract address not configured');
    }

    this.contract = new Contract(address, KeyRegistryArtifact.abi, provider);
  }

  /**
   * Register a public key for a user
   */
  async registerKey(wallet: Wallet, publicKey: Buffer | string): Promise<string> {
    try {
      const publicKeyHex = Buffer.isBuffer(publicKey)
        ? '0x' + publicKey.toString('hex')
        : publicKey;

      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.registerKey(publicKeyHex);
      const receipt = await tx.wait();

      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Failed to register key: ${(error as Error).message}`);
    }
  }

  /**
   * Rotate to a new public key
   */
  async rotateKey(wallet: Wallet, newPublicKey: Buffer | string): Promise<string> {
    try {
      const publicKeyHex = Buffer.isBuffer(newPublicKey)
        ? '0x' + newPublicKey.toString('hex')
        : newPublicKey;

      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.rotateKey(publicKeyHex);
      const receipt = await tx.wait();

      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Failed to rotate key: ${(error as Error).message}`);
    }
  }

  /**
   * Revoke current active key
   */
  async revokeKey(wallet: Wallet): Promise<string> {
    try {
      const contractWithSigner = this.contract.connect(wallet);
      const tx = await contractWithSigner.revokeKey();
      const receipt = await tx.wait();

      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Failed to revoke key: ${(error as Error).message}`);
    }
  }

  /**
   * Get current public key for a user
   */
  async getPublicKey(userAddress: string): Promise<PublicKeyInfo> {
    try {
      const [publicKey, version, timestamp] = await this.contract.getPublicKey(userAddress);

      return {
        publicKey,
        version: version.toNumber(),
        timestamp: timestamp.toNumber(),
      };
    } catch (error) {
      throw new Error(`Failed to get public key: ${(error as Error).message}`);
    }
  }

  /**
   * Get public key by version
   */
  async getPublicKeyByVersion(
    userAddress: string,
    version: number
  ): Promise<{ publicKey: string; timestamp: number; isActive: boolean }> {
    try {
      const [publicKey, timestamp, isActive] = await this.contract.getPublicKeyByVersion(
        userAddress,
        version
      );

      return {
        publicKey,
        timestamp: timestamp.toNumber(),
        isActive,
      };
    } catch (error) {
      throw new Error(`Failed to get public key by version: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user is registered
   */
  async isRegistered(userAddress: string): Promise<boolean> {
    try {
      return await this.contract.isRegistered(userAddress);
    } catch (error) {
      throw new Error(`Failed to check registration: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user has active key
   */
  async hasActiveKey(userAddress: string): Promise<boolean> {
    try {
      return await this.contract.hasActiveKey(userAddress);
    } catch (error) {
      throw new Error(`Failed to check active key: ${(error as Error).message}`);
    }
  }

  /**
   * Get current version for user
   */
  async getCurrentVersion(userAddress: string): Promise<number> {
    try {
      const version = await this.contract.getCurrentVersion(userAddress);
      return version.toNumber();
    } catch (error) {
      throw new Error(`Failed to get current version: ${(error as Error).message}`);
    }
  }

  /**
   * Batch get public keys for multiple users
   */
  async getBatchPublicKeys(
    userAddresses: string[]
  ): Promise<{ publicKeys: string[]; versions: number[] }> {
    try {
      const [publicKeys, versions] = await this.contract.getBatchPublicKeys(userAddresses);

      return {
        publicKeys,
        versions: versions.map((v: any) => v.toNumber()),
      };
    } catch (error) {
      throw new Error(`Failed to get batch public keys: ${(error as Error).message}`);
    }
  }

  /**
   * Get contract address
   */
  getAddress(): string {
    return this.contract.address;
  }
}

// Export singleton instance
let keyRegistryInstance: KeyRegistryService | null = null;

export function getKeyRegistryService(): KeyRegistryService {
  if (!keyRegistryInstance) {
    keyRegistryInstance = new KeyRegistryService();
  }
  return keyRegistryInstance;
}
