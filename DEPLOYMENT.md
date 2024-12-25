# 🚀 Deployment Checklist & Guide

## Pre-Deployment Checklist

### ✅ 1. Environment Setup

- [ ] Copy `.env.example` to `.env`
- [ ] Configure all environment variables
- [ ] Set strong JWT secrets
- [ ] Configure database credentials
- [ ] Set up blockchain provider (Hardhat/Mainnet/Testnet)
- [ ] Configure storage (IPFS/S3)

```bash
cp .env.example .env
# Edit .env with your configuration
```

### ✅ 2. Database Setup

- [ ] Create PostgreSQL database
- [ ] Run migrations
- [ ] Verify database connection
- [ ] Generate Prisma Client (if using Prisma)

```bash
# Create database
createdb Blockchain-Healthcare

# Run migrations
npm run migrate

# Generate Prisma Client
npm run prisma:generate

# Verify connection
npm run db:test
```

### ✅ 3. Smart Contract Deployment

- [ ] Configure Hardhat network
- [ ] Fund deployment account with ETH
- [ ] Deploy KeyRegistry contract
- [ ] Deploy PatientRecordsFactory contract
- [ ] Update .env with contract addresses
- [ ] Verify contracts on block explorer (if mainnet/testnet)

```bash
# Deploy contracts
npm run deploy

# Update .env with addresses
KEY_REGISTRY_ADDRESS=0x...
FACTORY_ADDRESS=0x...
```

### ✅ 4. Security Checklist

- [ ] JWT secrets are strong (32+ characters)
- [ ] Database credentials are secure
- [ ] Private keys are not in code
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Helmet security headers are active
- [ ] No secrets in logs
- [ ] HTTPS enabled (production)

### ✅ 5. Testing

- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Run E2E tests
- [ ] Test API endpoints manually
- [ ] Verify blockchain interactions
- [ ] Test authentication flow

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:contracts
npm run test:unit
npm run test:integration
```

### ✅ 6. Build & Compile

- [ ] Build TypeScript
- [ ] Compile smart contracts
- [ ] Verify no build errors
- [ ] Check bundle size

```bash
npm run build
npm run compile
```

---

## Deployment Methods

### Method 1: Docker Compose (Recommended for Production)

```bash
# 1. Build Docker image
docker-compose build

# 2. Start all services
docker-compose up -d

# 3. Check logs
docker-compose logs -f

# 4. Verify health
curl http://localhost:3000/health
```

### Method 2: Kubernetes

```bash
# 1. Build and push image
docker build -t your-registry/blockchain-ehr:v1.0.0 .
docker push your-registry/blockchain-ehr:v1.0.0

# 2. Apply Kubernetes manifests
kubectl apply -f k8s/

# 3. Check deployment
kubectl get pods
kubectl logs -f deployment/blockchain-ehr-backend
```

### Method 3: Direct Node.js Deployment

```bash
# 1. Install dependencies
npm ci --production

# 2. Build application
npm run build

# 3. Run migrations
npm run migrate

# 4. Start application
npm start

# Or use PM2 for process management
pm2 start dist/server.js --name blockchain-ehr
```

### Method 4: Cloud Platforms

#### AWS ECS/Fargate

```bash
# 1. Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t blockchain-ehr .
docker tag blockchain-ehr:latest <account>.dkr.ecr.us-east-1.amazonaws.com/blockchain-ehr:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/blockchain-ehr:latest

# 2. Update ECS service
aws ecs update-service --cluster blockchain-ehr --service backend --force-new-deployment
```

#### Google Cloud Run

```bash
# Deploy to Cloud Run
gcloud run deploy blockchain-ehr \
  --image gcr.io/PROJECT_ID/blockchain-ehr \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Post-Deployment Verification

### ✅ 1. Health Checks

```bash
# Check API health
curl http://your-domain/health

# Expected response:
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-11T10:00:00.000Z",
  "uptime": 123.45,
  "version": "2.0.0"
}
```

### ✅ 2. Database Connection

```bash
# Test database
curl http://your-domain/api/health/db

# Or check logs
docker-compose logs backend | grep "Database connection"
```

### ✅ 3. Blockchain Connection

```bash
# Test contract interaction
curl -X POST http://your-domain/api/keys/test

# Check logs for blockchain connection
```

### ✅ 4. API Endpoints

```bash
# Test authentication
curl -X POST http://your-domain/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test with JWT token
curl http://your-domain/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Monitoring & Maintenance

### Monitoring Checklist

- [ ] Set up application logging (Winston)
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Configure database monitoring
- [ ] Monitor blockchain gas prices
- [ ] Set up alerts for errors
- [ ] Track API response times

### Log Management

```bash
# View logs
docker-compose logs -f backend

# View database logs
docker-compose logs -f postgres

# Export logs
docker-compose logs backend > backend.log
```

### Backup Strategy

```bash
# Backup database
pg_dump -U postgres -d Blockchain-Healthcare > backup.sql

# Backup with timestamp
pg_dump -U postgres -d Blockchain-Healthcare > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore database
psql -U postgres -d Blockchain-Healthcare < backup.sql
```

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3  # Run 3 instances
    environment:
      - NODE_ENV=production
```

### Database Connection Pooling

```typescript
// Already configured in Prisma
// Max connections: 30 (configured in src/services/database/index.ts)
```

### Load Balancing

```nginx
# Nginx configuration
upstream backend {
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

---

## Troubleshooting

### Common Issues

**Issue: Database connection failed**
```bash
# Check database is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**Issue: Smart contract deployment failed**
```bash
# Check network connection
curl http://localhost:8545

# Check account balance
npx hardhat run scripts/check-balance.ts

# Verify Hardhat node is running
docker-compose ps hardhat
```

**Issue: TypeScript build errors**
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

**Issue: Tests failing**
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test
npx hardhat test test/contracts/BasicTest.test.js
```

---

## Security Best Practices

### Production Security Checklist

- [ ] Use HTTPS/TLS certificates
- [ ] Enable rate limiting
- [ ] Set up WAF (Web Application Firewall)
- [ ] Configure DDoS protection
- [ ] Regular security audits
- [ ] Dependency vulnerability scanning
- [ ] Database encryption at rest
- [ ] Secure backup storage
- [ ] Access control (least privilege)
- [ ] Security headers (Helmet.js)

### Environment Variables Security

```bash
# Never commit .env file
echo ".env" >> .gitignore

# Use secrets management
# AWS Secrets Manager, HashiCorp Vault, etc.

# Rotate secrets regularly
# - JWT secrets every 90 days
# - Database passwords every 90 days
# - API keys every 90 days
```

---

## Rollback Procedure

### Quick Rollback

```bash
# Docker Compose
docker-compose down
docker-compose up -d --force-recreate --no-deps backend

# Kubernetes
kubectl rollout undo deployment/blockchain-ehr-backend

# With specific revision
kubectl rollout undo deployment/blockchain-ehr-backend --to-revision=2
```

### Database Rollback

```bash
# Restore from backup
psql -U postgres -d Blockchain-Healthcare < backup-20250111.sql

# Or rollback migration
npm run migrate:rollback
```

---

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for frequently queried fields
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_health_records_patient ON health_records(patient_wallet);
CREATE INDEX idx_permissions_grantee ON permissions(grantee_wallet);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

### Caching Strategy

```typescript
// Implement Redis caching for frequently accessed data
// - User sessions
// - Contract ABIs
// - Public keys
```

### CDN Configuration

- Use CDN for static assets
- Configure cache headers
- Enable gzip compression

---

## Compliance & Audit

### HIPAA Compliance Checklist (if applicable)

- [ ] Encrypt data at rest
- [ ] Encrypt data in transit (TLS)
- [ ] Access logging enabled
- [ ] Audit trail implementation
- [ ] User authentication
- [ ] Regular security assessments
- [ ] Business Associate Agreements (BAAs)

### Audit Logs

```bash
# Query audit logs
SELECT * FROM audit_log
WHERE wallet_address = '0x...'
ORDER BY created_at DESC
LIMIT 100;

# Export audit logs
pg_dump -U postgres -d Blockchain-Healthcare -t audit_log > audit_export.sql
```

---

## Support & Resources

- **Documentation**: README.md, DOCKER.md, ARCHITECTURE.md
- **Issue Tracker**: GitHub Issues
- **CI/CD**: .github/workflows/
- **Tests**: npm test
- **Health Check**: /health endpoint

---

**Last Updated**: January 2025
**Version**: 2.0.0
**Status**: ✅ Production Ready
