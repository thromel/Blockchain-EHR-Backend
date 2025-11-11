/**
 * @file Type Definitions
 * @description Central type definitions for the blockchain EHR system
 */

import { Wallet } from 'ethers';

// ============================================================================
// Configuration Types
// ============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}

export interface BlockchainConfig {
  network: string;
  rpcUrl: string;
  chainId: number;
  keyRegistryAddress: string;
  factoryAddress: string;
}

export interface JWTConfig {
  secret: string;
  expiry: string;
  refreshExpiry: string;
}

export interface StorageIPFSConfig {
  host: string;
  port: number;
  protocol: string;
}

export interface StorageS3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
}

export interface StorageConfig {
  type: 'ipfs' | 's3' | 'dual';
  ipfs: StorageIPFSConfig;
  s3: StorageS3Config;
}

export interface Config {
  env: string;
  port: number;
  apiPrefix: string;
  database: DatabaseConfig;
  blockchain: BlockchainConfig;
  jwt: JWTConfig;
  encryption: {
    masterKey: string;
  };
  storage: StorageConfig;
  security: {
    bcryptRounds: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  cors: {
    origin: string;
  };
  logging: {
    level: string;
    file: string;
  };
  fhir: {
    version: string;
    strictValidation: boolean;
  };
  emergency: {
    accessDuration: number;
    justificationRequired: boolean;
  };
  features: {
    accessLogging: boolean;
    fhirValidation: boolean;
    rateLimiting: boolean;
  };
}

// ============================================================================
// Cryptography Types
// ============================================================================

export interface Keypair {
  privateKey: Buffer;
  publicKey: Buffer;
}

export interface ECIESEncrypted {
  iv: string;
  ephemPublicKey: string;
  ciphertext: string;
  mac: string;
}

export interface AESGCMEncrypted {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export interface AESGCMEncryptedHex {
  encrypted: string;
  iv: string;
  authTag: string;
}

export interface EncryptedRecord {
  encrypted: string;
  iv: string;
  authTag: string;
  metadata: Record<string, any>;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageResult {
  pointer: string;
  contentDigest: string;
  size: number;
  timestamp: number;
  key?: string;
}

export interface StorageOptions {
  pin?: boolean;
  contentDigest?: string;
}

export interface StorageStats {
  size: number;
  numLinks?: number;
  blockSize?: number;
  lastModified?: Date;
  contentType?: string;
  metadata?: Record<string, any>;
}

export interface IStorage {
  store(encryptedBlob: Buffer, options?: StorageOptions): Promise<StorageResult>;
  retrieve(pointer: string, expectedDigest?: string | null): Promise<Buffer>;
  verify(pointer: string, expectedDigest: string): Promise<boolean>;
  exists(pointer: string): Promise<boolean>;
  getType(): string;
  close(): Promise<void>;
}

// ============================================================================
// Blockchain Types
// ============================================================================

export interface HealthRecordMetadata {
  storagePointer: string;
  contentDigest: string;
  timestamp: number;
  lastUpdated: number;
}

export interface Permission {
  permissionId: number;
  grantedTo: string;
  recordIds: number[];
  wrappedKey: string;
  expirationTime: number;
  grantedAt: number;
  isRevoked: boolean;
}

export interface EmergencyAccess {
  emergencyId: string;
  physician1: string;
  physician2: string;
  recordIds: number[];
  justificationCode: number;
  wrappedKey: string;
  expirationTime: number;
  isActive: boolean;
  isConfirmed: boolean;
  confirmedAt: number;
}

export interface PublicKeyInfo {
  publicKey: string;
  version: number;
  timestamp: number;
}

// ============================================================================
// EIP-712 Types
// ============================================================================

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface GrantPermissionMessage {
  grantedTo: string;
  recordIds: number[];
  wrappedKey: string;
  expirationTime: number;
  nonce: number;
}

export interface RevokePermissionMessage {
  permissionId: number;
  nonce: number;
}

export interface SignatureComponents {
  r: string;
  s: string;
  v: number;
}

// ============================================================================
// Database Types
// ============================================================================

export interface User {
  wallet_address: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'patient' | 'doctor' | 'admin';
  patient_contract_address: string | null;
  created_at: Date;
}

export interface Record {
  id: number;
  patient_wallet: string;
  record_id: number;
  storage_pointer: string;
  content_digest: string;
  created_at: Date;
  updated_at: Date;
}

export interface PermissionDB {
  id: number;
  patient_wallet: string;
  grantee_wallet: string;
  record_id: number;
  expiration: Date;
  revoked: boolean;
  granted_at: Date;
  nonce: string;
}

export interface AccessLog {
  id: number;
  record_id: number;
  accessor_wallet: string;
  accessed_at: Date;
  details_hash: string;
}

export interface EmergencyGrant {
  grant_id: string;
  patient_wallet: string;
  record_id: number;
  physician1_wallet: string;
  physician2_wallet: string;
  justification_code: number;
  expiration: Date;
  confirmed: boolean;
  confirmed_at: Date | null;
}

// ============================================================================
// API Types
// ============================================================================

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  role: 'patient' | 'doctor';
  publicKey: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: {
    walletAddress: string;
    name: string;
    email: string;
    role: string;
    contractAddress?: string;
  };
}

export interface AddRecordRequest {
  fhirResource: any;
  metadata?: Record<string, any>;
}

export interface AddRecordResponse {
  recordId: number;
  storagePointer: string;
  contentDigest: string;
  transactionHash: string;
}

export interface GrantPermissionRequest {
  grantedTo: string;
  recordIds: number[];
  expirationTime: number;
  signature?: string;
}

export interface EmergencyAccessRequest {
  physician1: string;
  physician2: string;
  recordIds: number[];
  justificationCode: number;
}

// ============================================================================
// FHIR Types
// ============================================================================

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: any;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'collection' | 'document' | 'message' | 'transaction' | 'batch';
  entry: Array<{
    resource: FHIRResource;
  }>;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

// ============================================================================
// Express Request Extensions
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        walletAddress: string;
        email: string;
        role: string;
      };
      wallet?: Wallet;
    }
  }
}

export {};
