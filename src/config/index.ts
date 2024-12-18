import { config as dotenvConfig } from 'dotenv';
import { Config } from '../types';

dotenvConfig();

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api',

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'Blockchain-Healthcare',
    user: process.env.DB_USER || 'romel',
    password: process.env.DB_PASSWORD || '',
  },

  // Blockchain Configuration
  blockchain: {
    network: process.env.BLOCKCHAIN_NETWORK || 'localhost',
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
    chainId: parseInt(process.env.CHAIN_ID || '1337', 10),
    keyRegistryAddress: process.env.KEY_REGISTRY_ADDRESS || '',
    factoryAddress: process.env.FACTORY_CONTRACT_ADDRESS || '',
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    expiry: process.env.JWT_EXPIRY || '24h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // Encryption Configuration
  encryption: {
    masterKey: process.env.ENCRYPTION_MASTER_KEY || '',
  },

  // Storage Configuration
  storage: {
    type: (process.env.STORAGE_TYPE as 'ipfs' | 's3' | 'dual') || 'ipfs',
    ipfs: {
      host: process.env.IPFS_HOST || 'localhost',
      port: parseInt(process.env.IPFS_PORT || '5001', 10),
      protocol: process.env.IPFS_PROTOCOL || 'http',
    },
    s3: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      bucketName: process.env.S3_BUCKET_NAME || '',
      endpoint: process.env.S3_ENDPOINT || '',
    },
  },

  // Security Settings
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS Settings
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // FHIR Configuration
  fhir: {
    version: process.env.FHIR_VERSION || 'R4',
    strictValidation: process.env.FHIR_STRICT_VALIDATION === 'true',
  },

  // Emergency Access Settings
  emergency: {
    accessDuration: parseInt(process.env.EMERGENCY_ACCESS_DURATION || '3600', 10),
    justificationRequired: process.env.EMERGENCY_JUSTIFICATION_REQUIRED !== 'false',
  },

  // Feature Flags
  features: {
    accessLogging: process.env.ENABLE_ACCESS_LOGGING !== 'false',
    fhirValidation: process.env.ENABLE_FHIR_VALIDATION !== 'false',
    rateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
  },
};

// Validation
const validateConfig = (): void => {
  const errors: string[] = [];

  if (config.env === 'production') {
    if (config.jwt.secret === 'your-secret-key-change-this-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
    if (!config.encryption.masterKey) {
      errors.push('ENCRYPTION_MASTER_KEY must be set');
    }
    if (!config.blockchain.keyRegistryAddress) {
      errors.push('KEY_REGISTRY_ADDRESS must be set');
    }
    if (!config.blockchain.factoryAddress) {
      errors.push('FACTORY_CONTRACT_ADDRESS must be set');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
};

validateConfig();

export default config;
