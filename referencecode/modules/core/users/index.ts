/**
 * @fileoverview Users module - User management and session handling
 * @module modules/core/users
 */

import { Service, Inject } from 'typedi';
import type { GlobalConfiguration } from '@/modules/core/config/types/index.js';
import type { IModule } from '@/modules/core/modules/types/index.js';
import { ModuleStatus } from '@/modules/core/modules/types/index.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import { UserService } from './services/user.service.js';
import { SessionService } from './services/session.service.js';
import { ActivityService } from './services/activity.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { SessionRepository } from './repositories/session.repository.js';
import { ActivityRepository } from './repositories/activity.repository.js';
import type {
  User,
  UserWithRoles,
  UserCreateInput,
  UserUpdateInput,
  UserFilter,
  UserSession,
  UserActivity,
  SessionCreateInput,
  ActivityCreateInput,
} from './types/index.js';

@Service()
export class UsersModule implements IModule {
  name = 'users';
  version = '1.0.0';
  type = 'service' as const;
  status = ModuleStatus.STOPPED;

  private config: any;
  private userService!: UserService;
  private sessionService!: SessionService;
  private activityService!: ActivityService;

  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Config) private readonly globalConfig: GlobalConfiguration,
  ) {}

  async initialize(): Promise<void> {
    this.config = this.globalConfig?.modules?.[users] || {};

    // Initialize repositories
    const userRepo = new UserRepository(this.logger);
    const sessionRepo = new SessionRepository(this.logger);
    const activityRepo = new ActivityRepository(this.logger);

    // Initialize services
    this.userService = new UserService(userRepo, this.logger);
    this.sessionService = new SessionService(sessionRepo, this.config.session || {}, this.logger);
    this.activityService = new ActivityService(activityRepo, this.logger);

    // TODO: Initialize database connection when available

    this.logger.info('Users module initialized');
  }

  async start(): Promise<void> {
    // Start session cleanup interval
    if (this.config.session?.cleanupInterval) {
      await this.sessionService.startCleanup(this.config.session.cleanupInterval);
    }

    // Start activity cleanup if retention is set
    if (this.config.activity?.retentionDays) {
      await this.activityService.startCleanup(this.config.activity.retentionDays);
    }

    this.logger.info('Users module started');
  }

  async stop(): Promise<void> {
    // Stop cleanup intervals
    await this.sessionService.stopCleanup();
    await this.activityService.stopCleanup();

    this.logger.info('Users module stopped');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    // TODO: Check database connection
    // const dbHealthy = await this.userService.checkDatabaseConnection();

    return {
      healthy: true,
      message: 'Users module is healthy',
    };
  }

  // Public API methods

  /**
   * List users with optional filters
   */
  async listUsers(filter?: UserFilter): Promise<UserWithRoles[]> {
    return this.userService.listUsers(filter);
  }

  /**
   * Get user by ID or email
   */
  async getUser(idOrEmail: string): Promise<UserWithRoles | null> {
    return this.userService.getUser(idOrEmail);
  }

  /**
   * Create a new user
   */
  async createUser(input: UserCreateInput): Promise<User> {
    const user = await this.userService.createUser(input);

    // Record activity
    await this.activityService.recordActivity({
      userId: user.id,
      type: 'user.created',
      action: 'User account created',
      details: { email: user.email },
    });

    return user;
  }

  /**
   * Update user information
   */
  async updateUser(id: string, input: UserUpdateInput): Promise<User> {
    const user = await this.userService.updateUser(id, input);

    // Record activity
    await this.activityService.recordActivity({
      userId: user.id,
      type: 'user.updated',
      action: 'User information updated',
      details: input,
    });

    return user;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    const user = await this.userService.getUser(id);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userService.deleteUser(id);

    // Note: Activity can't be recorded since user is deleted
    this.logger.info('User deleted', { userId: id, email: user.email });
  }

  /**
   * Enable user account
   */
  async enableUser(id: string): Promise<User> {
    const user = await this.userService.updateUser(id, { status: 'active' });

    await this.activityService.recordActivity({
      userId: user.id,
      type: 'user.enabled',
      action: 'User account enabled',
    });

    return user;
  }

  /**
   * Disable user account
   */
  async disableUser(id: string, reason?: string): Promise<User> {
    const user = await this.userService.updateUser(id, { status: 'disabled' });

    await this.activityService.recordActivity({
      userId: user.id,
      type: 'user.disabled',
      action: 'User account disabled',
      details: reason ? { reason } : undefined,
    });

    // Revoke all active sessions
    await this.sessionService.revokeUserSessions(id);

    return user;
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId?: string): Promise<UserSession[]> {
    return this.sessionService.getUserSessions(userId);
  }

  /**
   * Create user session
   */
  async createSession(input: SessionCreateInput): Promise<UserSession> {
    const session = await this.sessionService.createSession(input);

    await this.activityService.recordActivity({
      userId: input.userId,
      type: 'session.created',
      action: 'New session created',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return session;
  }

  /**
   * Revoke user sessions
   */
  async revokeUserSessions(userId: string, sessionId?: string): Promise<void> {
    await this.sessionService.revokeUserSessions(userId, sessionId);

    await this.activityService.recordActivity({
      userId,
      type: 'session.revoked',
      action: sessionId ? 'Session revoked' : 'All sessions revoked',
    });
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId?: string, days: number = 7): Promise<UserActivity[]> {
    return this.activityService.getUserActivity(userId, days);
  }

  /**
   * Record user activity
   */
  async recordActivity(input: ActivityCreateInput): Promise<void> {
    return this.activityService.recordActivity(input);
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(userId?: string, days: number = 7): Promise<any> {
    return this.activityService.getActivityStats(userId, days);
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userService.updateLastLogin(userId);
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<UserSession | null> {
    return this.sessionService.validateSession(token);
  }

  /**
   * Get CLI command for this module
   */
  async getCommand(): Promise<any> {
    const { createUsersCommand } = await import('./cli/index.js');
    return createUsersCommand(this);
  }
}

// Export for dynamic loading
export default UsersModule;
