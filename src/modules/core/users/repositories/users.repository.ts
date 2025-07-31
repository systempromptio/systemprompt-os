/**
 * Users repository implementation - database operations.
 * Handles user data persistence without authentication concerns.
 */

import { type IUsersRow } from '@/modules/core/users/types/database.generated';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

/**
 * Repository for users data operations.
 */
export class UsersRepository {
  private static instance: UsersRepository;
  private dbService?: DatabaseService;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
  }

  /**
   * Get singleton instance.
   * @returns The repository instance.
   */
  static getInstance(): UsersRepository {
    UsersRepository.instance ||= new UsersRepository();
    return UsersRepository.instance;
  }

  /**
   * Initialize repository.
   * @returns Promise that resolves when initialized.
   */
  initialize(): void {
    this.dbService = DatabaseService.getInstance();
  }

  /**
   * Create a new user.
   * @param userData - User data to create.
   * @returns Promise resolving to created user.
   */
  public async createUser(userData: Omit<IUsersRow, 'id'> & { id: string }): Promise<IUsersRow> {
    const database = await this.getDatabase();
    const insertValues = this.buildInsertValues(userData);

    await this.executeInsert(database, insertValues);

    return this.buildUserResult(userData);
  }

  /**
   * Find user by ID.
   * @param id - User ID to find.
   * @returns Promise resolving to user or null if not found.
   */
  public async findById(id: string): Promise<IUsersRow | null> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    const { rows } = result;
    return rows[0] ?? null;
  }

  /**
   * Find user by username.
   * @param username - Username to find.
   * @returns Promise resolving to user or null if not found.
   */
  public async findByUsername(username: string): Promise<IUsersRow | null> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    const { rows } = result;
    return rows[0] ?? null;
  }

  /**
   * Find user by email.
   * @param email - Email to find.
   * @returns Promise resolving to user or null if not found.
   */
  public async findByEmail(email: string): Promise<IUsersRow | null> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const { rows } = result;
    return rows[0] ?? null;
  }

  /**
   * Find all users.
   * @returns Promise resolving to array of all users.
   */
  public async findAll(): Promise<IUsersRow[]> {
    const database = await this.getDatabase();

    const result = await database.query<IUsersRow>(
      'SELECT * FROM users ORDER BY created_at DESC'
    );

    return result.rows;
  }

  /**
   * Update user.
   * @param id - User ID to update.
   * @param data - Partial user data to update.
   * @returns Promise resolving to updated user.
   */
  public async updateUser(
    id: string,
    data: Partial<Omit<IUsersRow, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<IUsersRow> {
    const database = await this.getDatabase();
    const { updates, values } = this.buildUpdateQuery(data);

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = await database.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    );
    await stmt.run(values);
    await stmt.finalize();

    const user = await this.findById(id);
    if (user === null) {
      throw new Error(`User not found after update: ${id}`);
    }

    return user;
  }

  /**
   * Delete user.
   * @param id - User ID.
   */
  public async deleteUser(id: string): Promise<void> {
    const database = await this.getDatabase();

    const stmt = await database.prepare(
      'DELETE FROM users WHERE id = ?'
    );
    await stmt.run([id]);
    await stmt.finalize();
  }

  /**
   * Search users by query.
   * @param query - Search query.
   * @returns Array of matching users.
   */
  public async searchUsers(query: string): Promise<IUsersRow[]> {
    const database = await this.getDatabase();

    const searchPattern = `%${query}%`;
    const result = await database.query<IUsersRow>(
      `SELECT * FROM users 
       WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?
       ORDER BY created_at DESC`,
      [searchPattern, searchPattern, searchPattern]
    );

    return result.rows;
  }

  /**
   * Get database connection.
   * @returns Promise resolving to database connection.
   */
  private async getDatabase(): Promise<IDatabaseConnection> {
    if (this.dbService === undefined) {
      throw new Error('Repository not initialized');
    }
    return await this.dbService.getConnection();
  }

  /**
   * Build insert values array from user data.
   * @param userData - User data to process.
   * @returns Array of values for database insert.
   */
  private buildInsertValues(userData: Omit<IUsersRow, 'id'> & { id: string }): unknown[] {
    return [
      userData.id,
      userData.username,
      userData.email,
      userData.display_name ?? null,
      userData.avatar_url ?? null,
      userData.bio ?? null,
      userData.timezone ?? null,
      userData.language ?? null,
      userData.status,
      userData.email_verified ?? null,
      userData.preferences ?? null,
      userData.metadata ?? null,
      userData.created_at,
      userData.updated_at
    ];
  }

  /**
   * Execute database insert for user.
   * @param database - Database connection.
   * @param insertValues - Values to insert.
   */
  private async executeInsert(
    database: IDatabaseConnection,
    insertValues: unknown[]
  ): Promise<void> {
    const stmt = await database.prepare(
      `INSERT INTO users (
        id, username, email, display_name, avatar_url, bio,
        timezone, language, status, email_verified, preferences,
        metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    await stmt.run(insertValues);
    await stmt.finalize();
  }

  /**
   * Build user result object from input data.
   * @param userData - Input user data.
   * @returns Formatted user result.
   */
  private buildUserResult(userData: Omit<IUsersRow, 'id'> & { id: string }): IUsersRow {
    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      display_name: userData.display_name ?? null,
      avatar_url: userData.avatar_url ?? null,
      bio: userData.bio ?? null,
      timezone: userData.timezone ?? null,
      language: userData.language ?? null,
      status: userData.status,
      email_verified: userData.email_verified ?? null,
      preferences: userData.preferences ?? null,
      metadata: userData.metadata ?? null,
      created_at: userData.created_at,
      updated_at: userData.updated_at
    };
  }

  /**
   * Gets field mappings for database operations.
   * @returns Array of field mapping configurations.
   */
  private getFieldMappings(): Array<{
    field: string;
    column: string;
    transform?: (value: unknown) => unknown;
  }> {
    return [
      {
 field: 'username',
column: 'username'
},
      {
 field: 'email',
column: 'email'
},
      {
 field: 'display_name',
column: 'display_name'
},
      {
 field: 'avatar_url',
column: 'avatar_url'
},
      {
 field: 'bio',
column: 'bio'
},
      {
 field: 'timezone',
column: 'timezone'
},
      {
 field: 'language',
column: 'language'
},
      {
 field: 'status',
column: 'status'
},
      {
        field: 'email_verified',
        column: 'email_verified',
        transform: (value: unknown): number => { return value ? 1 : 0 }
      },
      {
 field: 'preferences',
column: 'preferences'
},
      {
 field: 'metadata',
column: 'metadata'
}
    ];
  }

  /**
   * Processes a single field mapping for updates.
   * @param mapping - Field mapping configuration.
   * @param mapping.field
   * @param data - Update data.
   * @param mapping.column
   * @param updates - Updates array to populate.
   * @param mapping.transform
   * @param values - Values array to populate.
   */
  private processFieldMapping(
    mapping: { field: string; column: string; transform?: (value: unknown) => unknown },
    data: Record<string, unknown>,
    updates: string[],
    values: unknown[]
  ): void {
    const {
 field, column, transform
} = mapping;
    if (data[field] !== undefined) {
      updates.push(`${column} = ?`);
      const transformedValue = transform ? transform(data[field]) : data[field];
      values.push(transformedValue);
    }
  }

  /**
   * Builds update query components from data.
   * @param data - Update data.
   * @returns Object with updates and values arrays.
   */
  private buildUpdateQuery(
    data: Partial<Omit<IUsersRow, 'id' | 'created_at' | 'updated_at'>>
  ): { updates: string[]; values: unknown[] } {
    const updates: string[] = [];
    const values: unknown[] = [];
    const fieldMappings = this.getFieldMappings();

    fieldMappings.forEach((mapping) => {
      this.processFieldMapping(mapping, data as Record<string, unknown>, updates, values);
    });

    return {
 updates,
values
};
  }
}
