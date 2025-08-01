/**
 * Development repository implementation.
 * @file Development repository implementation.
 * @module dev/repositories
 */

import type { IDevProfilesRow, IDevSessionsRow } from '@/modules/core/dev/types/database.generated';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDevProfileConfig, IDevSessionMetadata } from '@/modules/core/dev/types/manual';

/**
 * Repository for managing development profiles and sessions.
 */
export class DevRepository {
  private static instance: DevRepository;
  private logger!: ILogger;
  private dbService!: DatabaseService;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns DevRepository instance.
   */
  public static getInstance(): DevRepository {
    DevRepository.instance ||= new DevRepository();
    return DevRepository.instance;
  }

  /**
   * Initialize the repository.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    this.dbService = DatabaseService.getInstance();

    this.initialized = true;
    this.logger.info(LogSource.DEV, 'DevRepository initialized');
  }

  /**
   * Create a new development profile.
   * @param name - Profile name.
   * @param description - Profile description.
   * @param config - Profile configuration.
   * @returns Created profile.
   */
  async createProfile(
    name: string,
    description?: string,
    config?: IDevProfileConfig
  ): Promise<IDevProfilesRow> {
    this.ensureInitialized();

    const insertSql = `
      INSERT INTO dev_profiles (
        name, description, config_enabled, config_auto_save, config_debug_mode
      ) VALUES (?, ?, ?, ?, ?)
    `;

    await this.dbService.execute(insertSql, [
      name,
      description ?? null,
      config?.enabled ? 1 : 0,
      config?.autoSave ? 1 : 0,
      config?.debugMode ? 1 : 0
    ]);

    const profiles = await this.dbService.query<IDevProfilesRow>(
      'SELECT * FROM dev_profiles WHERE name = ? ORDER BY id DESC LIMIT 1',
      [name]
    );

    const profile = profiles[0];
    if (!profile) {
      throw new Error(`Failed to create profile: ${name}`);
    }

    this.logger.info(LogSource.DEV, `Created dev profile: ${name}`, { id: profile.id });
    return profile;
  }

  /**
   * Get profile by name.
   * @param name - Profile name.
   * @returns Profile or null.
   */
  async getProfileByName(name: string): Promise<IDevProfilesRow | null> {
    this.ensureInitialized();

    const profiles = await this.dbService.query<IDevProfilesRow>(
      'SELECT * FROM dev_profiles WHERE name = ?',
      [name]
    );

    return profiles[0] ?? null;
  }

  /**
   * Get profile by ID.
   * @param id - Profile ID.
   * @returns Profile or null.
   */
  async getProfileById(id: number): Promise<IDevProfilesRow | null> {
    this.ensureInitialized();

    const profiles = await this.dbService.query<IDevProfilesRow>(
      'SELECT * FROM dev_profiles WHERE id = ?',
      [id]
    );

    return profiles[0] ?? null;
  }

  /**
   * Get all profiles.
   * @returns Array of profiles.
   */
  async getAllProfiles(): Promise<IDevProfilesRow[]> {
    this.ensureInitialized();

    return await this.dbService.query<IDevProfilesRow>(
      'SELECT * FROM dev_profiles ORDER BY created_at DESC'
    );
  }

  /**
   * Update profile.
   * @param id - Profile ID.
   * @param updates - Profile updates.
   * @param updates.name
   * @param updates.description
   * @param updates.config
   * @returns Updated profile.
   */
  async updateProfile(
    id: number,
    updates: {
      name?: string;
      description?: string;
      config?: IDevProfileConfig;
    }
  ): Promise<IDevProfilesRow> {
    this.ensureInitialized();

    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description);
    }

    if (updates.config !== undefined) {
      setClauses.push('config_enabled = ?');
      values.push(updates.config.enabled ? 1 : 0);
      setClauses.push('config_auto_save = ?');
      values.push(updates.config.autoSave ? 1 : 0);
      setClauses.push('config_debug_mode = ?');
      values.push(updates.config.debugMode ? 1 : 0);
    }

    values.push(id);

    await this.dbService.execute(
      `UPDATE dev_profiles SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    const profile = await this.getProfileById(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    return profile;
  }

  /**
   * Delete profile.
   * @param id - Profile ID.
   */
  async deleteProfile(id: number): Promise<void> {
    this.ensureInitialized();

    await this.dbService.execute('DELETE FROM dev_sessions WHERE profile_id = ?', [id]);

    await this.dbService.execute('DELETE FROM dev_profiles WHERE id = ?', [id]);

    this.logger.info(LogSource.DEV, `Deleted dev profile: ${id}`);
  }

  /**
   * Start a development session.
   * @param type - Session type.
   * @param profileId - Optional profile ID.
   * @returns Created session.
   */
  async startSession(type: string, profileId?: number): Promise<IDevSessionsRow> {
    this.ensureInitialized();

    await this.dbService.execute(`
      INSERT INTO dev_sessions (profile_id, type, status)
      VALUES (?, ?, 'active')
    `, [profileId ?? null, type]);

    const sessions = await this.dbService.query<IDevSessionsRow>(
      'SELECT * FROM dev_sessions WHERE type = ? AND status = \'active\' ORDER BY id DESC LIMIT 1',
      [type]
    );

    const session = sessions[0];
    if (!session) {
      throw new Error(`Failed to create session: ${type}`);
    }

    this.logger.info(LogSource.DEV, `Started ${type} session`, { id: session.id });
    return session;
  }

  /**
   * End a development session.
   * @param sessionId - Session ID.
   * @param status - Final status.
   * @param metadata - Session metadata.
   */
  async endSession(
    sessionId: number,
    status: string,
    metadata?: IDevSessionMetadata
  ): Promise<void> {
    this.ensureInitialized();

    await this.dbService.execute(`
      UPDATE dev_sessions 
      SET status = ?, ended_at = CURRENT_TIMESTAMP,
          exit_code = ?, output_lines = ?, error_count = ?
      WHERE id = ?
    `, [
      status,
      metadata?.exitCode ?? null,
      metadata?.outputLines ?? null,
      metadata?.errorCount ?? null,
      sessionId
    ]);

    this.logger.info(LogSource.DEV, `Ended session ${sessionId} with status: ${status}`);
  }

  /**
   * Get session by ID.
   * @param id - Session ID.
   * @returns Session or null.
   */
  async getSessionById(id: number): Promise<IDevSessionsRow | null> {
    this.ensureInitialized();

    const sessions = await this.dbService.query<IDevSessionsRow>(
      'SELECT * FROM dev_sessions WHERE id = ?',
      [id]
    );

    return sessions[0] ?? null;
  }

  /**
   * Get active sessions.
   * @param profileId - Optional profile ID filter.
   * @returns Array of active sessions.
   */
  async getActiveSessions(profileId?: number): Promise<IDevSessionsRow[]> {
    this.ensureInitialized();

    let query = 'SELECT * FROM dev_sessions WHERE status = \'active\'';
    const params: unknown[] = [];

    if (profileId !== undefined) {
      query += ' AND profile_id = ?';
      params.push(profileId);
    }

    query += ' ORDER BY started_at DESC';

    return await this.dbService.query<IDevSessionsRow>(query, params);
  }

  /**
   * Get all sessions.
   * @param profileId - Optional profile ID filter.
   * @returns Array of sessions.
   */
  async getAllSessions(profileId?: number): Promise<IDevSessionsRow[]> {
    this.ensureInitialized();

    let query = 'SELECT * FROM dev_sessions';
    const params: unknown[] = [];

    if (profileId !== undefined) {
      query += ' WHERE profile_id = ?';
      params.push(profileId);
    }

    query += ' ORDER BY started_at DESC';

    return await this.dbService.query<IDevSessionsRow>(query, params);
  }

  /**
   * Get session statistics.
   * @param profileId - Optional profile ID filter.
   * @returns Session statistics.
   */
  async getSessionStats(profileId?: number): Promise<{
    total: number;
    active: number;
    completed: number;
    failed: number;
    averageDuration: number;
  }> {
    this.ensureInitialized();

    let whereClause = '';
    const params: unknown[] = [];

    if (profileId !== undefined) {
      whereClause = ' WHERE profile_id = ?';
      params.push(profileId);
    }

    const results = await this.dbService.query<{
      total: number;
      active: number;
      completed: number;
      failed: number;
      averageDuration: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(
          CASE 
            WHEN ended_at IS NOT NULL 
            THEN (julianday(ended_at) - julianday(started_at)) * 86400
            ELSE NULL 
          END
        ) as averageDuration
      FROM dev_sessions${whereClause}
    `, params);

    const stats = results[0];
    if (!stats) {
      return {
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        averageDuration: 0
      };
    }

    return {
      total: stats.total ?? 0,
      active: stats.active ?? 0,
      completed: stats.completed ?? 0,
      failed: stats.failed ?? 0,
      averageDuration: stats.averageDuration ?? 0
    };
  }

  /**
   * Ensure repository is initialized.
   * @throws Error if not initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('DevRepository not initialized');
    }
  }
}
