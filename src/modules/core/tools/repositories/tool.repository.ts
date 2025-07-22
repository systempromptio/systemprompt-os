/**
 * @fileoverview Tool repository for database operations
 * @module tools/repositories/tool
 */

import type { ModuleDatabaseAdapter, ModulePreparedStatement } from '../../database/adapters/module-adapter.js';
import type { DBTool, ToolScope, ToolFilterOptions, UpdateToolData } from '../types/index.js';

/**
 * Repository for tool database operations
 * Implements the repository pattern for data access
 */
export class ToolRepository {
  private readonly findAllStmt: ModulePreparedStatement<DBTool>;
  private readonly findByNameStmt: ModulePreparedStatement<DBTool>;
  private readonly findByScopeStmt: ModulePreparedStatement<DBTool>;
  private readonly findByModuleStmt: ModulePreparedStatement<DBTool>;
  private readonly findEnabledStmt: ModulePreparedStatement<DBTool>;
  private readonly insertStmt: ModulePreparedStatement;
  private readonly updateStmt: ModulePreparedStatement;
  private readonly updateEnabledStmt: ModulePreparedStatement;
  private readonly deleteStmt: ModulePreparedStatement;
  private readonly deleteByModuleStmt: ModulePreparedStatement;

  constructor(private readonly db: ModuleDatabaseAdapter) {
    this.findAllStmt = this.db.prepare<DBTool>(
      'SELECT * FROM tools ORDER BY module_name, name ASC'
    );
    
    this.findByNameStmt = this.db.prepare<DBTool>(
      'SELECT * FROM tools WHERE name = ?'
    );
    
    this.findByScopeStmt = this.db.prepare<DBTool>(
      'SELECT * FROM tools WHERE scope = ? OR scope = \'all\' ORDER BY name ASC'
    );
    
    this.findByModuleStmt = this.db.prepare<DBTool>(
      'SELECT * FROM tools WHERE module_name = ? ORDER BY name ASC'
    );
    
    this.findEnabledStmt = this.db.prepare<DBTool>(
      'SELECT * FROM tools WHERE enabled = 1 ORDER BY name ASC'
    );
    
    this.insertStmt = this.db.prepare(
      `INSERT INTO tools (name, description, input_schema, handler_path, module_name, scope, enabled, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    this.updateStmt = this.db.prepare(
      `UPDATE tools 
       SET description = ?, input_schema = ?, handler_path = ?, scope = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
       WHERE name = ?`
    );
    
    this.updateEnabledStmt = this.db.prepare(
      'UPDATE tools SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?'
    );
    
    this.deleteStmt = this.db.prepare(
      'DELETE FROM tools WHERE name = ?'
    );
    
    this.deleteByModuleStmt = this.db.prepare(
      'DELETE FROM tools WHERE module_name = ?'
    );
  }

  /**
   * Retrieves all tools from the database
   * @returns Array of database tool records
   */
  findAll(): DBTool[] {
    return this.findAllStmt.all();
  }

  /**
   * Finds a tool by name
   * @param name - The unique name of the tool
   * @returns The tool record if found, undefined otherwise
   */
  findByName(name: string): DBTool | undefined {
    return this.findByNameStmt.get(name);
  }

  /**
   * Finds tools by scope
   * @param scope - The scope to filter by ('remote' or 'local')
   * @returns Array of tools matching the scope or having 'all' scope
   */
  findByScope(scope: 'remote' | 'local'): DBTool[] {
    return this.findByScopeStmt.all(scope);
  }

  /**
   * Finds tools by module name
   * @param moduleName - The module name to filter by
   * @returns Array of tools from the specified module
   */
  findByModule(moduleName: string): DBTool[] {
    return this.findByModuleStmt.all(moduleName);
  }

  /**
   * Finds all enabled tools
   * @returns Array of enabled tools
   */
  findEnabled(): DBTool[] {
    return this.findEnabledStmt.all();
  }

  /**
   * Finds tools with filters
   * @param filters - Filter options
   * @returns Array of tools matching the filters
   */
  findWithFilters(filters: ToolFilterOptions): DBTool[] {
    let sql = 'SELECT * FROM tools WHERE 1=1';
    const params: any[] = [];

    if (filters.scope) {
      sql += ' AND (scope = ? OR scope = \'all\')';
      params.push(filters.scope);
    }

    if (filters.enabled !== undefined) {
      sql += ' AND enabled = ?';
      params.push(filters.enabled ? 1 : 0);
    }

    if (filters.moduleName) {
      sql += ' AND module_name = ?';
      params.push(filters.moduleName);
    }

    sql += ' ORDER BY module_name, name ASC';

    const stmt = this.db.prepare<DBTool>(sql);
    return stmt.all(...params);
  }

  /**
   * Creates a new tool in the database
   * @param data - The tool data to create
   * @returns The created tool record
   * @throws Error if the tool already exists
   */
  create(data: {
    name: string;
    description: string;
    input_schema: any;
    handler_path: string;
    module_name: string;
    scope: ToolScope;
    enabled?: boolean;
    metadata?: any;
  }): DBTool {
    const inputSchemaJson = JSON.stringify(data.input_schema);
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
    
    this.insertStmt.run(
      data.name,
      data.description,
      inputSchemaJson,
      data.handler_path,
      data.module_name,
      data.scope,
      data.enabled !== false ? 1 : 0,
      metadataJson
    );
    
    const created = this.findByName(data.name);
    if (!created) {
      throw new Error(`Failed to create tool: ${data.name}`);
    }
    
    return created;
  }

  /**
   * Updates an existing tool
   * @param name - The name of the tool to update
   * @param data - The update data
   * @returns The updated tool record if found, undefined otherwise
   */
  update(name: string, data: UpdateToolData & { handler_path?: string }): DBTool | undefined {
    const existing = this.findByName(name);
    if (!existing) {
      return undefined;
    }

    const newDescription = data.description ?? existing.description;
    const newInputSchema = data.input_schema 
      ? JSON.stringify(data.input_schema) 
      : existing.input_schema;
    const newHandlerPath = data.handler_path ?? existing.handler_path;
    const newScope = data.scope ?? existing.scope;
    const newMetadata = data.metadata !== undefined
      ? (data.metadata ? JSON.stringify(data.metadata) : null)
      : existing.metadata;

    this.updateStmt.run(
      newDescription,
      newInputSchema,
      newHandlerPath,
      newScope,
      newMetadata,
      name
    );

    if (data.enabled !== undefined) {
      this.updateEnabledStmt.run(data.enabled ? 1 : 0, name);
    }
    
    return this.findByName(name);
  }

  /**
   * Updates the enabled status of a tool
   * @param name - The name of the tool
   * @param enabled - Whether to enable or disable the tool
   * @returns True if the tool was updated, false otherwise
   */
  updateEnabled(name: string, enabled: boolean): boolean {
    const result = this.updateEnabledStmt.run(enabled ? 1 : 0, name);
    return result.changes > 0;
  }

  /**
   * Deletes a tool from the database
   * @param name - The name of the tool to delete
   * @returns True if the tool was deleted, false otherwise
   */
  delete(name: string): boolean {
    const result = this.deleteStmt.run(name);
    return result.changes > 0;
  }

  /**
   * Deletes all tools from a specific module
   * @param moduleName - The module name
   * @returns Number of tools deleted
   */
  deleteByModule(moduleName: string): number {
    const result = this.deleteByModuleStmt.run(moduleName);
    return result.changes;
  }

  /**
   * Executes a function within a database transaction
   * @param fn - The function to execute
   * @returns The result of the function
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn);
  }
}