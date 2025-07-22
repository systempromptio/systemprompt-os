/**
 * @fileoverview Prompt repository for database operations
 * @module prompts/repositories/prompt
 */

import type { ModuleDatabaseAdapter, ModulePreparedStatement } from '../../database/adapters/module-adapter.js';
import type { DBPrompt, CreatePromptData, UpdatePromptData } from '../types/index.js';

/**
 * Repository for prompt database operations
 * Implements the repository pattern for data access
 */
export class PromptRepository {
  private readonly findAllStmt: ModulePreparedStatement<DBPrompt>;
  private readonly findByNameStmt: ModulePreparedStatement<DBPrompt>;
  private readonly insertStmt: ModulePreparedStatement;
  private readonly updateStmt: ModulePreparedStatement;
  private readonly deleteStmt: ModulePreparedStatement;

  constructor(private readonly db: ModuleDatabaseAdapter) {
    this.findAllStmt = this.db.prepare<DBPrompt>(
      'SELECT * FROM prompts ORDER BY name ASC'
    );
    
    this.findByNameStmt = this.db.prepare<DBPrompt>(
      'SELECT * FROM prompts WHERE name = ?'
    );
    
    this.insertStmt = this.db.prepare(
      `INSERT INTO prompts (name, description, arguments, messages)
       VALUES (?, ?, ?, ?)`
    );
    
    this.updateStmt = this.db.prepare(
      `UPDATE prompts 
       SET description = ?, arguments = ?, messages = ?, updated_at = CURRENT_TIMESTAMP
       WHERE name = ?`
    );
    
    this.deleteStmt = this.db.prepare(
      'DELETE FROM prompts WHERE name = ?'
    );
  }

  /**
   * Retrieves all prompts from the database
   * @returns Array of database prompt records
   */
  findAll(): DBPrompt[] {
    return this.findAllStmt.all();
  }

  /**
   * Finds a prompt by name
   * @param name - The unique name of the prompt
   * @returns The prompt record if found, undefined otherwise
   */
  findByName(name: string): DBPrompt | undefined {
    return this.findByNameStmt.get(name);
  }

  /**
   * Creates a new prompt in the database
   * @param data - The prompt data to create
   * @returns The created prompt record
   * @throws Error if the prompt already exists
   */
  create(data: CreatePromptData): DBPrompt {
    const argumentsJson = data.arguments ? JSON.stringify(data.arguments) : null;
    const messagesJson = JSON.stringify(data.messages);
    
    this.insertStmt.run(
      data.name,
      data.description,
      argumentsJson,
      messagesJson
    );
    
    const created = this.findByName(data.name);
    if (!created) {
      throw new Error(`Failed to create prompt: ${data.name}`);
    }
    
    return created;
  }

  /**
   * Updates an existing prompt
   * @param name - The name of the prompt to update
   * @param data - The update data
   * @returns The updated prompt record if found, undefined otherwise
   */
  update(name: string, data: UpdatePromptData): DBPrompt | undefined {
    const existing = this.findByName(name);
    if (!existing) {
      return undefined;
    }

    const newDescription = data.description ?? existing.description;
    const newArguments = data.arguments 
      ? JSON.stringify(data.arguments) 
      : existing.arguments;
    const newMessages = data.messages 
      ? JSON.stringify(data.messages) 
      : existing.messages;

    this.updateStmt.run(
      newDescription,
      newArguments,
      newMessages,
      name
    );
    
    return this.findByName(name);
  }

  /**
   * Deletes a prompt from the database
   * @param name - The name of the prompt to delete
   * @returns True if the prompt was deleted, false otherwise
   */
  delete(name: string): boolean {
    const result = this.deleteStmt.run(name);
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