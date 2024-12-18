/**
 * @file S3 Storage Implementation
 * @description Store encrypted healthcare records on AWS S3 or compatible services
 */

import { createHash, randomBytes } from 'crypto';
import { IStorage, StorageResult, StorageOptions, StorageS3Config } from '../../types';

export class S3Storage implements IStorage {
  private config: StorageS3Config;
  private client: any = null;

  constructor(config: StorageS3Config) {
    this.config = config;
  }

  /**
   * Initialize S3 client (lazy loading to avoid AWS SDK dependency if not used)
   */
  async initialize(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      // Lazy load AWS SDK
      const { S3Client } = await import('@aws-sdk/client-s3');

      const clientConfig: any = {
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      };

      // Support custom endpoints (e.g., MinIO, DigitalOcean Spaces)
      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
        clientConfig.forcePathStyle = true;
      }

      this.client = new S3Client(clientConfig);
    } catch (error) {
      throw new Error(`S3 initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Store encrypted blob on S3
   */
  async store(encryptedBlob: Buffer, options: StorageOptions = {}): Promise<StorageResult> {
    try {
      await this.initialize();

      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      // Calculate SHA-256 digest
      const contentDigest = createHash('sha256').update(encryptedBlob).digest('hex');

      // Generate unique key
      const timestamp = Date.now();
      const randomId = randomBytes(16).toString('hex');
      const key = `healthcare-records/${timestamp}-${randomId}.enc`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: encryptedBlob,
        ContentType: 'application/octet-stream',
        Metadata: {
          'content-digest': contentDigest,
          'upload-timestamp': timestamp.toString(),
        },
        ServerSideEncryption: 'AES256', // Additional layer of encryption at rest
      });

      await this.client.send(command);

      // Construct S3 URL
      const pointer = this.config.endpoint
        ? `${this.config.endpoint}/${this.config.bucketName}/${key}`
        : `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${key}`;

      return {
        pointer,
        contentDigest: '0x' + contentDigest,
        size: encryptedBlob.length,
        timestamp,
        key,
      };
    } catch (error) {
      throw new Error(`S3 storage failed: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve encrypted blob from S3
   */
  async retrieve(pointer: string, expectedDigest: string | null = null): Promise<Buffer> {
    try {
      await this.initialize();

      const { GetObjectCommand } = await import('@aws-sdk/client-s3');

      // Extract key from URL if needed
      const key = this.extractKeyFromPointer(pointer);

      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const blob = Buffer.concat(chunks);

      // Verify integrity if digest provided
      if (expectedDigest) {
        const actualDigest = '0x' + createHash('sha256').update(blob).digest('hex');

        if (actualDigest !== expectedDigest) {
          throw new Error('Content digest mismatch - data may be corrupted');
        }
      }

      return blob;
    } catch (error) {
      throw new Error(`S3 retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify blob integrity
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
   * Delete object from S3
   */
  async delete(pointer: string): Promise<void> {
    try {
      await this.initialize();

      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      const key = this.extractKeyFromPointer(pointer);

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(`S3 deletion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get object metadata
   */
  async getMetadata(
    pointer: string
  ): Promise<{
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, string>;
  }> {
    try {
      await this.initialize();

      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

      const key = this.extractKeyFromPointer(pointer);

      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      throw new Error(`Failed to get S3 metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Check if object exists
   */
  async exists(pointer: string): Promise<boolean> {
    try {
      await this.getMetadata(pointer);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract S3 key from URL or return as-is if already a key
   */
  private extractKeyFromPointer(pointer: string): string {
    // If it's already a key (no protocol), return as-is
    if (!pointer.startsWith('http')) {
      return pointer;
    }

    // Extract key from URL
    const url = new URL(pointer);
    const pathname = url.pathname;

    // Remove leading slash and bucket name if present
    let key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    // Remove bucket name from path if path-style URL
    if (key.startsWith(this.config.bucketName + '/')) {
      key = key.slice(this.config.bucketName.length + 1);
    }

    return key;
  }

  /**
   * Get storage type identifier
   */
  getType(): string {
    return 's3';
  }

  /**
   * Close connection (cleanup)
   */
  async close(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}
