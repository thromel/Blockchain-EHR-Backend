/**
 * @file Dual Storage Implementation
 * @description Store encrypted healthcare records on both IPFS and S3 for redundancy
 */

import { IPFSStorage } from './ipfs-storage';
import { S3Storage } from './s3-storage';
import {
  IStorage,
  StorageResult,
  StorageOptions,
  StorageIPFSConfig,
  StorageS3Config,
} from '../../types';

export class DualStorage implements IStorage {
  private ipfsStorage: IPFSStorage;
  private s3Storage: S3Storage;

  constructor(ipfsConfig: StorageIPFSConfig, s3Config: StorageS3Config) {
    this.ipfsStorage = new IPFSStorage(ipfsConfig);
    this.s3Storage = new S3Storage(s3Config);
  }

  /**
   * Store encrypted blob on both IPFS and S3
   */
  async store(encryptedBlob: Buffer, options: StorageOptions = {}): Promise<StorageResult> {
    try {
      // Store on both platforms in parallel
      const [ipfsResult, s3Result] = await Promise.all([
        this.ipfsStorage.store(encryptedBlob, options),
        this.s3Storage.store(encryptedBlob, options),
      ]);

      // Verify digests match
      if (ipfsResult.contentDigest !== s3Result.contentDigest) {
        throw new Error('Content digest mismatch between IPFS and S3');
      }

      return {
        pointer: JSON.stringify({
          ipfs: ipfsResult.pointer,
          s3: s3Result.pointer,
        }),
        contentDigest: ipfsResult.contentDigest,
        size: ipfsResult.size,
        timestamp: ipfsResult.timestamp,
      };
    } catch (error) {
      throw new Error(`Dual storage failed: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve encrypted blob (tries IPFS first, falls back to S3)
   */
  async retrieve(pointer: string, expectedDigest: string | null = null): Promise<Buffer> {
    try {
      const pointers = JSON.parse(pointer);

      // Try IPFS first (typically faster for small files)
      try {
        return await this.ipfsStorage.retrieve(pointers.ipfs, expectedDigest);
      } catch (ipfsError) {
        console.warn(
          'IPFS retrieval failed, falling back to S3:',
          (ipfsError as Error).message
        );

        // Fallback to S3
        return await this.s3Storage.retrieve(pointers.s3, expectedDigest);
      }
    } catch (error) {
      throw new Error(`Dual storage retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify blob integrity on both platforms
   * Returns true only if both IPFS and S3 have valid copies
   */
  async verify(pointer: string, expectedDigest: string): Promise<boolean> {
    try {
      const pointers = JSON.parse(pointer);

      const [ipfsValid, s3Valid] = await Promise.allSettled([
        this.ipfsStorage.verify(pointers.ipfs, expectedDigest),
        this.s3Storage.verify(pointers.s3, expectedDigest),
      ]);

      // Return true only if both storage backends have valid data
      return (
        ipfsValid.status === 'fulfilled' &&
        s3Valid.status === 'fulfilled' &&
        ipfsValid.value &&
        s3Valid.value
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify blob integrity on both platforms with detailed status
   */
  async verifyDetailed(
    pointer: string,
    expectedDigest: string
  ): Promise<{
    ipfs: boolean;
    s3: boolean;
    both: boolean;
    error?: string;
  }> {
    try {
      const pointers = JSON.parse(pointer);

      const [ipfsValid, s3Valid] = await Promise.allSettled([
        this.ipfsStorage.verify(pointers.ipfs, expectedDigest),
        this.s3Storage.verify(pointers.s3, expectedDigest),
      ]);

      return {
        ipfs: ipfsValid.status === 'fulfilled' ? ipfsValid.value : false,
        s3: s3Valid.status === 'fulfilled' ? s3Valid.value : false,
        both:
          ipfsValid.status === 'fulfilled' &&
          s3Valid.status === 'fulfilled' &&
          ipfsValid.value &&
          s3Valid.value,
      };
    } catch (error) {
      return {
        ipfs: false,
        s3: false,
        both: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if content exists on both platforms
   */
  async exists(pointer: string): Promise<boolean> {
    try {
      const pointers = JSON.parse(pointer);

      const [ipfsExists, s3Exists] = await Promise.allSettled([
        this.ipfsStorage.exists(pointers.ipfs),
        this.s3Storage.exists(pointers.s3),
      ]);

      const bothExist =
        ipfsExists.status === 'fulfilled' &&
        s3Exists.status === 'fulfilled' &&
        ipfsExists.value &&
        s3Exists.value;

      return bothExist;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete from both platforms
   */
  async delete(
    pointer: string
  ): Promise<{
    ipfs: boolean;
    s3: boolean;
    both: boolean;
  }> {
    try {
      const pointers = JSON.parse(pointer);

      const [ipfsResult, s3Result] = await Promise.allSettled([
        this.ipfsStorage.unpin(pointers.ipfs).catch(() => {}), // IPFS doesn't delete, just unpin
        this.s3Storage.delete(pointers.s3),
      ]);

      return {
        ipfs: ipfsResult.status === 'fulfilled',
        s3: s3Result.status === 'fulfilled',
        both: ipfsResult.status === 'fulfilled' && s3Result.status === 'fulfilled',
      };
    } catch (error) {
      throw new Error(`Dual storage deletion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Repair missing data (copy from one platform to another)
   */
  async repair(
    pointer: string,
    expectedDigest: string
  ): Promise<{
    repaired: boolean;
    ipfsRepaired: boolean;
    s3Repaired: boolean;
  }> {
    try {
      const pointers = JSON.parse(pointer);
      const existsStatus = await this.verifyDetailed(pointer, expectedDigest);

      const results = {
        repaired: false,
        ipfsRepaired: false,
        s3Repaired: false,
      };

      // If both exist, no repair needed
      if (existsStatus.both) {
        return results;
      }

      // Repair IPFS from S3
      if (!existsStatus.ipfs && existsStatus.s3) {
        const blob = await this.s3Storage.retrieve(pointers.s3, expectedDigest);
        await this.ipfsStorage.store(blob);
        results.ipfsRepaired = true;
        results.repaired = true;
      }

      // Repair S3 from IPFS
      if (!existsStatus.s3 && existsStatus.ipfs) {
        const blob = await this.ipfsStorage.retrieve(pointers.ipfs, expectedDigest);
        await this.s3Storage.store(blob);
        results.s3Repaired = true;
        results.repaired = true;
      }

      return results;
    } catch (error) {
      throw new Error(`Dual storage repair failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get storage type identifier
   */
  getType(): string {
    return 'dual';
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await Promise.all([this.ipfsStorage.close(), this.s3Storage.close()]);
  }
}
