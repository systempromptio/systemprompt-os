/**
 * Role repository implementation
 */

import { BaseRepository } from './base.repository.js';
import type { Role, RoleCreateInput, RoleUpdateInput } from '../types/index.js';
import type { Logger } from '../../../types.js';

export class RoleRepository extends BaseRepository {
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * Find all roles
   */
  async findAll(): Promise<Role[]> {
    const rows = await this.query<any>(`
      SELECT id, name, description, is_system, created_at, updated_at
      FROM roles
      ORDER BY name
    `);

    return rows.map(this.mapRowToRole);
  }

  /**
   * Find role by ID
   */
  async findById(id: string): Promise<Role | null> {
    const row = await this.get<any>(
      'SELECT * FROM roles WHERE id = ?',
      [id],
    );

    return row ? this.mapRowToRole(row) : null;
  }

  /**
   * Find role by name
   */
  async findByName(name: string): Promise<Role | null> {
    const row = await this.get<any>(
      'SELECT * FROM roles WHERE name = ?',
      [name.toLowerCase()],
    );

    return row ? this.mapRowToRole(row) : null;
  }

  /**
   * Create a new role
   */
  async create(input: RoleCreateInput): Promise<Role> {
    const id = this.generateId();
    const now = new Date();

    await this.run(`
      INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      input.name.toLowerCase(),
      input.description || null,
      false,
      now.toISOString(),
      now.toISOString(),
    ]);

    this.logger.info('Role created', { id, name: input.name });

    const role: Role = {
      id,
      name: input.name,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    if (input.description) {
      role.description = input.description;
    }
    return role;
  }

  /**
   * Update role
   */
  async update(id: string, input: RoleUpdateInput): Promise<Role | null> {
    const role = await this.findById(id);
    if (!role) {
      return null;
    }

    if (role.isSystem) {
      throw new Error('Cannot update system role');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name.toLowerCase());
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    await this.run(
      `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    return await this.findById(id);
  }

  /**
   * Delete role
   */
  async delete(id: string): Promise<boolean> {
    const role = await this.findById(id);
    if (!role) {
      return false;
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    await this.run('DELETE FROM roles WHERE id = ?', [id]);

    this.logger.info('Role deleted', { id, name: role.name });
    return true;
  }

  /**
   * Get role members count
   */
  async getMembersCount(roleId: string): Promise<number> {
    const result = await this.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [roleId],
    );

    return result?.count || 0;
  }

  /**
   * Map database row to Role object
   */
  private mapRowToRole(row: any): Role {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: Boolean(row.is_system),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}