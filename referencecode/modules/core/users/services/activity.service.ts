/**
 * User activity tracking service
 */

import type { ActivityRepository } from '../repositories/activity.repository.js';
import type { UserActivity, ActivityCreateInput, ActivityType } from '../types/index.js';

export class ActivityService {
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly logger: any,
  ) {}

  /**
   * Record user activity
   */
  async recordActivity(input: ActivityCreateInput): Promise<void> {
    try {
      const activity: UserActivity = {
        id: this.generateActivityId(),
        userId: input.userId,
        type: input.type,
        action: input.action,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        timestamp: new Date(),
      };

      await this.activityRepo.create(activity);

      this.logger?.debug('Activity recorded', {
        userId: input.userId,
        type: input.type,
        action: input.action,
      });
    } catch (error) {
      // Don't throw errors for activity recording failures
      // This is a non-critical operation
      this.logger?.error('Failed to record activity', error);
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId?: string, days: number = 7): Promise<UserActivity[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      if (userId) {
        return await this.activityRepo.findByUserId(userId, since);
      }

      return await this.activityRepo.findAll(since);
    } catch (error) {
      this.logger?.error('Failed to get user activity', error);
      throw error;
    }
  }

  /**
   * Get activity by type
   */
  async getActivityByType(type: ActivityType, days: number = 7): Promise<UserActivity[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      return await this.activityRepo.findByType(type, since);
    } catch (error) {
      this.logger?.error('Failed to get activity by type', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(
    userId?: string,
    days: number = 7,
  ): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    uniqueUsers?: number;
    mostActiveHours: number[];
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const activities = userId
        ? await this.activityRepo.findByUserId(userId, since)
        : await this.activityRepo.findAll(since);

      // Calculate statistics
      const stats = {
        totalActivities: activities.length,
        activitiesByType: {} as Record<string, number>,
        uniqueUsers: userId ? undefined : new Set(activities.map((a) => a.userId)).size,
        mostActiveHours: new Array(24).fill(0),
      };

      // Count by type and hour
      activities.forEach((activity) => {
        // Count by type
        stats.activitiesByType[activity.type] = (stats.activitiesByType[activity.type] || 0) + 1;

        // Count by hour
        const hour = activity.timestamp.getHours();
        stats.mostActiveHours[hour]++;
      });

      return stats;
    } catch (error) {
      this.logger?.error('Failed to get activity stats', error);
      throw error;
    }
  }

  /**
   * Search activity
   */
  async searchActivity(
    search: string,
    filters?: {
      userId?: string;
      type?: ActivityType;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<UserActivity[]> {
    try {
      return await this.activityRepo.search(search, filters);
    } catch (error) {
      this.logger?.error('Failed to search activity', error);
      throw error;
    }
  }

  /**
   * Delete user activity
   */
  async deleteUserActivity(userId: string): Promise<void> {
    try {
      await this.activityRepo.deleteByUserId(userId);

      this.logger?.info('User activity deleted', { userId });
    } catch (error) {
      this.logger?.error('Failed to delete user activity', error);
      throw error;
    }
  }

  /**
   * Start activity cleanup interval
   */
  async startCleanup(retentionDays: number): Promise<void> {
    if (this.cleanupInterval) {
      return;
    }

    // Run cleanup immediately
    await this.cleanupOldActivity(retentionDays);

    // Set interval (run daily)
    this.cleanupInterval = setInterval(
      async () => {
        await this.cleanupOldActivity(retentionDays);
      },
      24 * 60 * 60 * 1000,
    );

    this.logger?.info('Activity cleanup started', { retentionDays });
  }

  /**
   * Stop activity cleanup
   */
  async stopCleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger?.info('Activity cleanup stopped');
    }
  }

  /**
   * Clean up old activity
   */
  private async cleanupOldActivity(retentionDays: number): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const count = await this.activityRepo.deleteOlderThan(cutoffDate);

      if (count > 0) {
        this.logger?.info('Cleaned up old activity', { count, retentionDays });
      }
    } catch (error) {
      this.logger?.error('Failed to cleanup activity', error);
    }
  }

  /**
   * Generate activity ID
   */
  private generateActivityId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
