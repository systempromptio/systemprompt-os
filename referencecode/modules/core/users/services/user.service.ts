/**
 * User management service
 */

import type { UserRepository } from '../repositories/user.repository.js';
import type {
  User,
  UserWithRoles,
  UserCreateInput,
  UserUpdateInput,
  UserFilter,
} from '../types/index.js';
import { randomBytes } from 'crypto';

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly logger: any,
  ) {}

  /**
   * List users with optional filters
   */
  async listUsers(filter?: UserFilter): Promise<UserWithRoles[]> {
    try {
      const users = await this.userRepo.findAll(filter);

      // TODO: Get roles from auth module
      // For now, return users with empty roles
      return users.map((user) => ({
        ...user,
        roles: [],
      }));
    } catch (error) {
      this.logger?.error('Failed to list users', error);
      throw error;
    }
  }

  /**
   * Get user by ID or email
   */
  async getUser(idOrEmail: string): Promise<UserWithRoles | null> {
    try {
      const user = await this.userRepo.findByIdOrEmail(idOrEmail);

      if (!user) {
        return null;
      }

      // TODO: Get roles from auth module
      return {
        ...user,
        roles: [],
      };
    } catch (error) {
      this.logger?.error('Failed to get user', error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async createUser(input: UserCreateInput): Promise<User> {
    try {
      // Validate email format
      if (!this.isValidEmail(input.email)) {
        throw new Error('Invalid email format');
      }

      // Check if user already exists
      const existing = await this.userRepo.findByEmail(input.email);
      if (existing) {
        throw new Error('User with this email already exists');
      }

      // Generate user ID
      const id = this.generateUserId();

      // Create user
      const user: User = {
        id,
        email: input.email.toLowerCase(),
        name: input.name,
        status: 'active',
        provider: input.provider,
        providerId: input.providerId,
        metadata: input.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.userRepo.create(user);

      this.logger?.info('User created', { userId: user.id, email: user.email });

      return user;
    } catch (error) {
      this.logger?.error('Failed to create user', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(id: string, input: UserUpdateInput): Promise<User> {
    try {
      const user = await this.userRepo.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate email if provided
      if (input.email && !this.isValidEmail(input.email)) {
        throw new Error('Invalid email format');
      }

      // Check if new email is already taken
      if (input.email && input.email !== user.email) {
        const existing = await this.userRepo.findByEmail(input.email);
        if (existing) {
          throw new Error('Email already in use');
        }
      }

      // Update user
      const updatedUser = await this.userRepo.update(id, {
        ...input,
        email: input.email?.toLowerCase(),
        updatedAt: new Date(),
      });

      this.logger?.info('User updated', { userId: id });

      return updatedUser;
    } catch (error) {
      this.logger?.error('Failed to update user', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    try {
      const user = await this.userRepo.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      await this.userRepo.delete(id);

      this.logger?.info('User deleted', { userId: id });
    } catch (error) {
      this.logger?.error('Failed to delete user', error);
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.userRepo.updateLastLogin(userId);
    } catch (error) {
      this.logger?.error('Failed to update last login', error);
      throw error;
    }
  }

  /**
   * Find user by provider
   */
  async findByProvider(provider: string, providerId: string): Promise<User | null> {
    try {
      return await this.userRepo.findByProvider(provider, providerId);
    } catch (error) {
      this.logger?.error('Failed to find user by provider', error);
      throw error;
    }
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
