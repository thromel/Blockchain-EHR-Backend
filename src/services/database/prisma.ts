/**
 * @file Prisma Client Service
 * @description Singleton Prisma Client instance with connection management
 */

import { PrismaClient } from '@prisma/client';

// Singleton instance
let prisma: PrismaClient;

/**
 * Get Prisma Client instance (singleton)
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'pretty',
    });

    // Handle connection errors
    prisma.$connect().catch((error) => {
      console.error('Failed to connect to database with Prisma:', error);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('beforeExit', async () => {
      await prisma.$disconnect();
    });
  }

  return prisma;
}

/**
 * Test Prisma connection
 */
export async function testPrismaConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    console.log('✅ Prisma connection successful');
    return true;
  } catch (error) {
    console.error('❌ Prisma connection failed:', (error as Error).message);
    return false;
  }
}

/**
 * Disconnect Prisma Client
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}

// Export singleton instance
export const prismaClient = getPrismaClient();

export default prismaClient;
