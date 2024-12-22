# Docker Deployment Guide

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Using Make (Even Easier)

```bash
# Start all services
make docker-up

# Start in development mode with hot reload
make docker-up-dev

# View logs
make docker-logs

# Stop services
make docker-down
```

## Available Services

The docker-compose.yml includes:

1. **postgres** - PostgreSQL database (port 5432)
2. **hardhat** - Local Ethereum blockchain (port 8545)
3. **backend** - Node.js API server (port 3000)
4. **ipfs** - IPFS node (optional, ports 5001, 8080)
5. **pgadmin** - Database admin interface (optional, port 5050)

## Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=Blockchain-Healthcare

# Blockchain
BLOCKCHAIN_PROVIDER_URL=http://hardhat:8545
PRIVATE_KEY=your-private-key

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Storage
STORAGE_TYPE=ipfs
IPFS_API_URL=http://ipfs:5001
```

## Development Mode

Use the development override for hot-reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Or use Make:

```bash
make docker-up-dev
```

## Optional Services

### Start with IPFS

```bash
docker-compose --profile with-ipfs up -d
# Or: make start-with-ipfs
```

### Start with PgAdmin

```bash
docker-compose --profile with-pgadmin up -d
# Or: make start-with-pgadmin
```

### Start All Services

```bash
docker-compose --profile with-ipfs --profile with-pgadmin up -d
# Or: make start-all
```

## Building the Image

### Multi-stage Production Build

```bash
docker build -t blockchain-ehr-backend:latest .
```

### Development Build

```bash
docker build --target builder -t blockchain-ehr-backend:dev .
```

## Docker Image Details

The Dockerfile uses multi-stage builds for optimization:

- **Stage 1 (builder):** Compiles TypeScript and Solidity contracts
- **Stage 2 (production):** Minimal runtime image with only production dependencies

### Image Features

- ✅ Multi-stage build (smaller final image)
- ✅ Non-root user (security)
- ✅ dumb-init for proper signal handling
- ✅ Health checks
- ✅ Alpine Linux (minimal base)
- ✅ Layer caching optimization

## Health Checks

The backend includes a health check endpoint:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-11T10:00:00.000Z",
  "uptime": 123.45,
  "version": "2.0.0"
}
```

## Troubleshooting

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres
```

### Access Container Shell

```bash
# Backend container
docker-compose exec backend sh

# Database shell
docker-compose exec postgres psql -U postgres -d Blockchain-Healthcare
```

### Rebuild After Changes

```bash
docker-compose build
docker-compose up -d
```

### Clean Everything

```bash
# Stop and remove containers + volumes
docker-compose down -v

# Remove images
docker rmi blockchain-ehr-backend:latest
```

## Production Deployment

For production, use a container orchestration platform:

### Kubernetes

```bash
# Build and push to registry
docker build -t ghcr.io/your-org/blockchain-ehr-backend:v1.0.0 .
docker push ghcr.io/your-org/blockchain-ehr-backend:v1.0.0

# Deploy with kubectl
kubectl apply -f k8s/
```

### Docker Swarm

```bash
docker stack deploy -c docker-compose.yml blockchain-ehr
```

## CI/CD Integration

The project includes GitHub Actions workflows:

- **ci.yml** - Continuous Integration (tests, linting, security)
- **cd.yml** - Continuous Deployment (build, push, deploy)
- **codeql.yml** - Security code analysis

See `.github/workflows/` for details.

## Security Best Practices

✅ Non-root user in container
✅ Read-only filesystem where possible
✅ No secrets in image
✅ Health checks configured
✅ Security scanning with Trivy
✅ SBOM generation
✅ Minimal base image (Alpine)

## Performance

### Image Sizes

- Builder stage: ~1.5GB (includes dev dependencies)
- Production stage: ~300MB (optimized)

### Resource Limits

Add to docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
```

## Makefile Commands

```bash
make help                  # Show all commands
make docker-build          # Build Docker image
make docker-up             # Start services
make docker-up-dev         # Start in dev mode
make docker-down           # Stop services
make docker-logs           # View logs
make docker-ps             # List containers
make shell-backend         # Open backend shell
make shell-db              # Open database shell
make start-with-ipfs       # Start with IPFS
make start-with-pgadmin    # Start with PgAdmin
make start-all             # Start all services
```
