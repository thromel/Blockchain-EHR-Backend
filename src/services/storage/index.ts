/**
 * @file Storage Service Abstraction Layer
 * @description Unified interface for IPFS, S3, and dual storage
 */

import config from '../../config';
import { IPFSStorage } from './ipfs-storage';
import { S3Storage } from './s3-storage';
import { DualStorage } from './dual-storage';
import { IStorage } from '../../types';

/**
 * Create storage service based on configuration
 */
function createStorageService(): IStorage {
  const storageType = config.storage.type;

  switch (storageType) {
    case 'ipfs':
      return new IPFSStorage(config.storage.ipfs);

    case 's3':
      return new S3Storage(config.storage.s3);

    case 'dual':
      return new DualStorage(config.storage.ipfs, config.storage.s3) as unknown as IStorage;

    default:
      throw new Error(`Unsupported storage type: ${storageType}`);
  }
}

// Export singleton instance
let storageInstance: IStorage | null = null;

export function getStorageService(): IStorage {
  if (!storageInstance) {
    storageInstance = createStorageService();
  }
  return storageInstance;
}

export { createStorageService, IPFSStorage, S3Storage, DualStorage };
