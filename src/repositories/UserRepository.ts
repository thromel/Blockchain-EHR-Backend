/**
 * @file User Repository
 * @description Example repository implementation using Prisma
 * This demonstrates Clean Architecture with the Repository Pattern
 */

import { PrismaClient, User, Role } from '@prisma/client';
import { prismaClient } from '../services/database/prisma';

/**
 * User Repository Interface
 * This defines the contract for user data access
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByWalletAddress(walletAddress: string): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
  update(walletAddress: string, data: Partial<User>): Promise<User>;
  delete(walletAddress: string): Promise<void>;
  findAll(filters?: UserFilters): Promise<User[]>;
}

/**
 * Data Transfer Objects
 */
export interface CreateUserDTO {
  walletAddress: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  patientContractAddress?: string;
}

export interface UserFilters {
  role?: Role;
  limit?: number;
  offset?: number;
}

/**
 * Prisma User Repository Implementation
 * This implements the repository using Prisma ORM
 */
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient = prismaClient) {}

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { walletAddress },
      include: {
        sessions: true, // Include related sessions
      },
    });
  }

  /**
   * Create new user
   */
  async create(data: CreateUserDTO): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Update user
   */
  async update(walletAddress: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { walletAddress },
      data,
    });
  }

  /**
   * Delete user
   */
  async delete(walletAddress: string): Promise<void> {
    await this.prisma.user.delete({
      where: { walletAddress },
    });
  }

  /**
   * Find all users with optional filters
   */
  async findAll(filters: UserFilters = {}): Promise<User[]> {
    const { role, limit = 100, offset = 0 } = filters;

    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find users by role with statistics
   */
  async findByRoleWithStats(role: Role): Promise<{
    users: User[];
    count: number;
  }> {
    const [users, count] = await Promise.all([
      this.prisma.user.findMany({
        where: { role },
        include: {
          healthRecords: {
            select: { id: true },
          },
          grantedPermissions: {
            select: { id: true },
          },
        },
      }),
      this.prisma.user.count({
        where: { role },
      }),
    ]);

    return { users, count };
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email },
    });
    return count > 0;
  }

  /**
   * Get user with all relations (for detailed view)
   */
  async findWithRelations(walletAddress: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { walletAddress },
      include: {
        sessions: true,
        healthRecords: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Latest 10 records
        },
        grantedPermissions: {
          where: { isRevoked: false },
        },
        receivedPermissions: {
          where: { isRevoked: false },
        },
        keyHistory: {
          orderBy: { version: 'desc' },
          take: 5, // Latest 5 key rotations
        },
      },
    });
  }
}

/**
 * Example Usage in Controllers:
 *
 * ```typescript
 * import { PrismaUserRepository } from '../repositories/UserRepository';
 *
 * const userRepo = new PrismaUserRepository();
 *
 * // Find user
 * const user = await userRepo.findByEmail('patient@example.com');
 *
 * // Create user
 * const newUser = await userRepo.create({
 *   walletAddress: '0x123...',
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   passwordHash: hashedPassword,
 *   role: 'patient',
 * });
 *
 * // Find with relations
 * const userWithData = await userRepo.findWithRelations('0x123...');
 * ```
 */
