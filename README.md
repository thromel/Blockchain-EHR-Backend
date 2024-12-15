# Blockchain-Based Electronic Health Records (EHR) System

A complete rewrite of the EHR system implementing blockchain-based health records with ECIES encryption, EIP-712 signatures, and FHIR R4 support.

## 🏗️ Architecture

### Smart Contracts (Solidity 0.8.20)
- **KeyRegistry**: On-chain public key management with rotation support
- **PatientHealthRecords**: Individual patient record contract with permissions
- **PatientRecordsFactory**: Factory pattern for deploying patient contracts

### Backend (TypeScript + Node.js + Express)
- **Controllers**: Auth, Records, Permissions, Keys, Emergency
- **Services**: Blockchain, Storage (IPFS/S3), Database
- **Middleware**: Authentication (JWT), Validation, Error Handling
- **Database**: PostgreSQL with 7 tables

### Cryptography
- **ECIES** (secp256k1): Public key encryption for key wrapping
- **AES-256-GCM**: Symmetric encryption with AEAD for records
- **EIP-712**: Typed structured data signatures
- **SHA-256**: Content integrity verification

## 📦 Installation

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 14
- IPFS node (optional)
- Hardhat local network OR Ethereum testnet

### Setup

1. **Clone and install dependencies**
```bash
npm install --legacy-peer-deps
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Create database**
```bash
psql -U postgres -c "CREATE DATABASE \"Blockchain-Healthcare\";"
```

4. **Run migrations**
```bash
npm run migrate
```

5. **Compile smart contracts**
```bash
npm run compile
```

6. **Start local blockchain**
```bash
# Terminal 1
npm run node
```

7. **Deploy smart contracts**
```bash
# Terminal 2
npm run deploy
```

8. **Update .env with deployed contract addresses**
```bash
# Copy addresses from deployment output to .env
KEY_REGISTRY_ADDRESS=0x...
FACTORY_CONTRACT_ADDRESS=0x...
```

9. **Start backend server**
```bash
npm run dev
```

Server will be running at `http://localhost:3000`

## 🧪 Testing

### Run all tests
```bash
# Smart contract tests (15 tests)
npm run test:contracts

# Run specific test files
npx hardhat test test/contracts/BasicTest.test.js
npx hardhat test test/services/BlockchainServices.test.js
npx hardhat test test/utils/CryptoUtils.test.js
npx hardhat test test/middleware/Auth.test.js
```

### Test Results
- ✅ Smart Contracts: 15/15 (100%)
- ✅ Crypto Utilities: 15/15 (100%)
- ✅ Blockchain Services: 23/25 (92%)
- ✅ Middleware Patterns: 21/21 (100%)
- ✅ Database Layer: All passing
- **Overall: 74/76 tests (97.4%)**

## 📚 API Documentation

Base URL: `http://localhost:3000/api`

### Authentication

#### POST `/auth/signup`
Register new user account
```json
{
  "name": "Dr. John Doe",
  "email": "doctor@example.com",
  "password": "SecurePass123",
  "role": "doctor",
  "publicKey": "0x04...",
  "privateKey": "0x..." // optional, will generate if not provided
}
```

#### POST `/auth/signin`
Sign in and get tokens
```json
{
  "email": "doctor@example.com",
  "password": "SecurePass123",
  "privateKey": "0x..." // optional but recommended
}
```

#### POST `/auth/refresh`
Refresh access token
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Records

#### POST `/records`
Add new health record (Patient only)
```json
{
  "fhirData": {
    "resourceType": "Observation",
    "status": "final",
    "code": { ... }
  },
  "recipientPublicKeys": [
    {
      "address": "0x...",
      "publicKey": "0x04..."
    }
  ]
}
```

#### GET `/records/:recordId?patientAddress=0x...`
Get single record (requires access)

#### GET `/records?patientAddress=0x...&offset=0&limit=50`
List all accessible records

### Permissions

#### POST `/permissions`
Grant permission to access records (Patient only)
```json
{
  "grantedTo": "0x...",
  "recordIds": [0, 1, 2],
  "wrappedKey": "0x...",
  "expirationTime": 1735689600
}
```

#### DELETE `/permissions/:permissionId`
Revoke permission (Patient only)

#### GET `/permissions/granted`
List all permissions granted by patient

### Emergency Access

#### POST `/emergency/request`
Request emergency access (Doctor only)
```json
{
  "patientAddress": "0x...",
  "recordId": 0,
  "justificationCode": 1
}
```
Justification codes: 1=Trauma, 2=Unconscious, 3=Critical

## 🗄️ Database Schema

### Tables
1. **users**: User accounts (patients, doctors, admins)
2. **records**: Health records metadata
3. **permissions**: Access permissions cache
4. **access_logs**: Record access tracking
5. **emergency_grants**: Emergency access requests
6. **sessions**: User session management
7. **audit_log**: Blockchain transaction audit trail

## 🔐 Security Features

- **Encryption**: ECIES + AES-256-GCM with authentication tags
- **Key Management**: On-chain public key registry with rotation
- **Access Control**: Blockchain-based permissions with expiration
- **Signatures**: EIP-712 typed structured data
- **Content Integrity**: SHA-256 digest verification
- **JWT Authentication**: Access + refresh token pattern
- **Password Hashing**: bcrypt with configurable rounds

## 📁 Project Structure

```
Backend/
├── contracts/               # Smart contracts
│   ├── KeyRegistry.sol
│   ├── PatientHealthRecords.sol
│   └── PatientRecordsFactory.sol
├── src/
│   ├── controllers/        # API controllers
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   ├── utils/              # Cryptography utilities
│   ├── app.ts              # Express app
│   └── server.ts           # Server entry point
├── test/                   # Test suites
├── migrations/             # Database migrations
└── scripts/                # Deployment scripts
```

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## 📝 License

MIT License
