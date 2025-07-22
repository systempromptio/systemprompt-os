/**
 * @fileoverview Prompt service for business logic and MCP SDK integration
 * @module prompts/services/prompt
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ModuleDatabaseAdapter } from '../../database/adapters/module-adapter.js';
import type { 
  DBPrompt, 
  PromptArgument, 
  PromptWithMessages, 
  CreatePromptData, 
  UpdatePromptData 
} from '../types/index.js';
import { PromptRepository } from '../repositories/prompt.repository.js';

/**
 * Service layer for prompt operations
 * Handles business logic and data transformation between database and MCP SDK types
 */
export class PromptService {
  private readonly repository: PromptRepository;

  constructor(db: ModuleDatabaseAdapter) {
    this.repository = new PromptRepository(db);
  }

  /**
   * Lists all available prompts
   * @returns Array of MCP SDK Prompt objects
   */
  async listPrompts(): Promise<Prompt[]> {
    const dbPrompts = this.repository.findAll();
    return dbPrompts.map(dbPrompt => this.toMCPPrompt(dbPrompt));
  }

  /**
   * Retrieves a prompt with its messages by name
   * @param name - The unique name of the prompt
   * @returns The prompt with messages if found, null otherwise
   */
  async getPrompt(name: string): Promise<PromptWithMessages | null> {
    const dbPrompt = this.repository.findByName(name);
    if (!dbPrompt) {
      return null;
    }
    
    return this.toPromptWithMessages(dbPrompt);
  }

  /**
   * Creates a new prompt
   * @param data - The prompt creation data
   * @returns The created prompt with messages
   * @throws Error if prompt creation fails
   */
  async createPrompt(data: CreatePromptData): Promise<PromptWithMessages> {
    const dbPrompt = this.repository.create(data);
    return this.toPromptWithMessages(dbPrompt);
  }

  /**
   * Updates an existing prompt
   * @param name - The name of the prompt to update
   * @param data - The update data
   * @returns The updated prompt with messages if found, null otherwise
   */
  async updatePrompt(name: string, data: UpdatePromptData): Promise<PromptWithMessages | null> {
    const dbPrompt = this.repository.update(name, data);
    if (!dbPrompt) {
      return null;
    }
    
    return this.toPromptWithMessages(dbPrompt);
  }

  /**
   * Deletes a prompt
   * @param name - The name of the prompt to delete
   * @returns True if the prompt was deleted, false otherwise
   */
  async deletePrompt(name: string): Promise<boolean> {
    return this.repository.delete(name);
  }

  /**
   * Converts a database prompt to MCP SDK Prompt format
   * @param dbPrompt - The database prompt record
   * @returns MCP SDK Prompt object
   */
  private toMCPPrompt(dbPrompt: DBPrompt): Prompt {
    const prompt: Prompt = {
      name: dbPrompt.name,
      description: dbPrompt.description
    };

    if (dbPrompt.arguments) {
      const args = JSON.parse(dbPrompt.arguments) as PromptArgument[];
      if (args.length > 0) {
        prompt.arguments = args.map(arg => ({
          name: arg.name,
          description: arg.description,
          required: arg.required
        }));
      }
    }

    return prompt;
  }

  /**
   * Converts a database prompt to PromptWithMessages format
   * @param dbPrompt - The database prompt record
   * @returns Prompt with messages
   */
  private toPromptWithMessages(dbPrompt: DBPrompt): PromptWithMessages {
    const prompt = this.toMCPPrompt(dbPrompt) as PromptWithMessages;
    prompt.messages = JSON.parse(dbPrompt.messages) as PromptMessage[];
    return prompt;
  }
}