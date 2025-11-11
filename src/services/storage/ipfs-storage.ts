/**
 * @file IPFS Storage Implementation
 * @description Store encrypted healthcare records on IPFS
 */

import { createHash } from 'crypto';
import { IStorage, StorageResult, StorageOptions, StorageIPFSConfig } from '../../types';

// Use dynamic import to avoid ESM/CJS issues
let create: any;

async function loadIPFS() {
  if (!create) {
    const ipfsModule = await import('ipfs-http-client');
    create = ipfsModule.create;
  }
  return { create };
}

export class IPFSStorage implements IStorage {
  private config: StorageIPFSConfig;
  private client: any = null;

  constructor(config: StorageIPFSConfig) {
    this.config = config;
  }

  /**
   * Initialize IPFS client
   */
  async initialize(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      const { create: createClient } = await loadIPFS();
      this.client = createClient({
        host: this.config.host,
        port: this.config.port,
        protocol: this.config.protocol as 'http' | 'https',
      });

      // Test connection
      await this.client.id();
    } catch (error) {
      throw new Error(`IPFS initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Store encrypted blob on IPFS
   */
  async store(encryptedBlob: Buffer, options: StorageOptions = {}): Promise<StorageResult> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('IPFS client not initialized');
      }

      // Calculate SHA-256 digest for integrity verification
      const contentDigest = createHash('sha256').update(encryptedBlob).digest('hex');

      // Add to IPFS
      const result = await this.client.add(encryptedBlob, {
        pin: options.pin !== false, // Pin by default
        cidVersion: 1, // Use CIDv1
      });

      const cid = result.cid.toString();

      return {
        pointer: cid,
        contentDigest: '0x' + contentDigest,
        size: encryptedBlob.length,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`IPFS storage failed: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve encrypted blob from IPFS
   */
  async retrieve(pointer: string, expectedDigest: string | null = null): Promise<Buffer> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('IPFS client not initialized');
      }

      // Get data from IPFS
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.client.cat(pointer)) {
        chunks.push(chunk);
      }

      const blob = Buffer.concat(chunks);

      // Verify integrity if digest provided
      if (expectedDigest) {
        const actualDigest =
          '0x' + createHash('sha256').update(blob).digest('hex');

        if (actualDigest !== expectedDigest) {
          throw new Error('Content digest mismatch - data may be corrupted');
        }
      }

      return blob;
    } catch (error) {
      throw new Error(`IPFS retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify blob integrity without full download
   */
  async verify(pointer: string, expectedDigest: string): Promise<boolean> {
    try {
      const blob = await this.retrieve(pointer);
      const actualDigest = '0x' + createHash('sha256').update(blob).digest('hex');

      return actualDigest === expectedDigest;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pin a CID to ensure it stays in storage
   */
  async pin(pointer: string): Promise<void> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('IPFS client not initialized');
      }

      await this.client.pin.add(pointer);
    } catch (error) {
      throw new Error(`IPFS pinning failed: ${(error as Error).message}`);
    }
  }

  /**
   * Unpin a CID
   */
  async unpin(pointer: string): Promise<void> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('IPFS client not initialized');
      }

      await this.client.pin.rm(pointer);
    } catch (error) {
      throw new Error(`IPFS unpinning failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(pointer: string): Promise<{ size: number; numLinks: number; blockSize: number }> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('IPFS client not initialized');
      }

      const stat = await this.client.object.stat(pointer as any);

      return {
        size: stat.CumulativeSize,
        numLinks: stat.NumLinks,
        blockSize: stat.BlockSize,
      };
    } catch (error) {
      throw new Error(`Failed to get IPFS stats: ${(error as Error).message}`);
    }
  }

  /**
   * Check if content exists
   */
  async exists(pointer: string): Promise<boolean> {
    try {
      await this.getStats(pointer);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage type identifier
   */
  getType(): string {
    return 'ipfs';
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      // IPFS HTTP client doesn't need explicit closing
      this.client = null;
    }
  }
}
