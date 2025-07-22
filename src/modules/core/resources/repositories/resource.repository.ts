/**
 * @fileoverview Resource repository for database operations
 * @module resources/repositories/resource
 */

import type { ModuleDatabaseAdapter, ModulePreparedStatement } from '../../database/adapters/module-adapter.js';
import type { DBResource, CreateResourceData, UpdateResourceData } from '../types/index.js';

/**
 * Repository for resource database operations
 * Implements the repository pattern for data access
 */
export class ResourceRepository {
  private readonly findAllStmt: ModulePreparedStatement<DBResource>;
  private readonly findByUriStmt: ModulePreparedStatement<DBResource>;
  private readonly findByPatternStmt: ModulePreparedStatement<DBResource>;
  private readonly insertStmt: ModulePreparedStatement;
  private readonly updateStmt: ModulePreparedStatement;
  private readonly deleteStmt: ModulePreparedStatement;

  constructor(private readonly db: ModuleDatabaseAdapter) {
    this.findAllStmt = this.db.prepare<DBResource>(
      'SELECT * FROM resources ORDER BY uri ASC'
    );
    
    this.findByUriStmt = this.db.prepare<DBResource>(
      'SELECT * FROM resources WHERE uri = ?'
    );
    
    this.findByPatternStmt = this.db.prepare<DBResource>(
      'SELECT * FROM resources WHERE uri LIKE ? ORDER BY uri ASC'
    );
    
    this.insertStmt = this.db.prepare(
      `INSERT INTO resources (uri, name, description, mime_type, content_type, content, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    
    this.updateStmt = this.db.prepare(
      `UPDATE resources 
       SET name = ?, description = ?, mime_type = ?, content_type = ?, 
           content = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
       WHERE uri = ?`
    );
    
    this.deleteStmt = this.db.prepare(
      'DELETE FROM resources WHERE uri = ?'
    );
  }

  /**
   * Retrieves all resources from the database
   * @returns Array of database resource records
   */
  findAll(): DBResource[] {
    return this.findAllStmt.all();
  }

  /**
   * Finds a resource by URI
   * @param uri - The unique URI of the resource
   * @returns The resource record if found, undefined otherwise
   */
  findByUri(uri: string): DBResource | undefined {
    return this.findByUriStmt.get(uri);
  }

  /**
   * Finds resources matching a pattern
   * @param pattern - The URI pattern to match (supports SQL LIKE wildcards)
   * @returns Array of matching resource records
   */
  findByPattern(pattern: string): DBResource[] {
    const sqlPattern = pattern.replace(/\*/g, '%');
    return this.findByPatternStmt.all(sqlPattern);
  }

  /**
   * Creates a new resource in the database
   * @param data - The resource data to create
   * @returns The created resource record
   * @throws Error if the resource already exists or creation fails
   */
  create(data: CreateResourceData): DBResource {
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
    
    this.insertStmt.run(
      data.uri,
      data.name,
      data.description || null,
      data.mime_type || 'text/plain',
      data.content_type || 'text',
      data.content,
      metadataJson
    );
    
    const created = this.findByUri(data.uri);
    if (!created) {
      throw new Error(`Failed to create resource: ${data.uri}`);
    }
    
    return created;
  }

  /**
   * Updates an existing resource
   * @param uri - The URI of the resource to update
   * @param data - The update data
   * @returns The updated resource record if found, undefined otherwise
   */
  update(uri: string, data: UpdateResourceData): DBResource | undefined {
    const existing = this.findByUri(uri);
    if (!existing) {
      return undefined;
    }

    const newName = data.name ?? existing.name;
    const newDescription = data.description === undefined ? existing.description : data.description;
    const newMimeType = data.mime_type ?? existing.mime_type;
    const newContentType = data.content_type ?? existing.content_type;
    const newContent = data.content ?? existing.content;
    const newMetadata = data.metadata !== undefined 
      ? (data.metadata ? JSON.stringify(data.metadata) : null)
      : existing.metadata;

    this.updateStmt.run(
      newName,
      newDescription,
      newMimeType,
      newContentType,
      newContent,
      newMetadata,
      uri
    );
    
    return this.findByUri(uri);
  }

  /**
   * Deletes a resource from the database
   * @param uri - The URI of the resource to delete
   * @returns True if the resource was deleted, false otherwise
   */
  delete(uri: string): boolean {
    const result = this.deleteStmt.run(uri);
    return result.changes > 0;
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