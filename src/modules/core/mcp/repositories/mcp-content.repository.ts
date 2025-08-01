/**
 * MCP content repository for managing prompts and resources.
 * @file MCP content repository.
 * @module modules/core/mcp/repositories/mcp-content.repository
 */

import { DatabaseService } from '@/modules/core/database/services/database.service';
import type {
  IPromptScanData,
  IResourceScanData,
} from '@/modules/core/mcp/types/manual';

/**
 * Interface for existing prompt data from database.
 */
export interface IExistingPrompt {
  name: string;
  file_path: string;
  last_synced_at: string;
}

/**
 * Interface for existing resource data from database.
 */
export interface IExistingResource {
  uri: string;
  file_path: string;
  last_synced_at: string;
}

/**
 * Repository for MCP content operations (prompts and resources).
 */
export class MCPContentRepository {
  private static instance: MCPContentRepository;
  private readonly database: DatabaseService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.database = DatabaseService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The repository instance.
   */
  static getInstance(): MCPContentRepository {
    MCPContentRepository.instance ||= new MCPContentRepository();
    return MCPContentRepository.instance;
  }

  /**
   * Remove all MCP content for a module.
   * @param moduleName - Name of the module to remove content for.
   * @returns Promise that resolves when content is removed.
   */
  async removeModuleContent(moduleName: string): Promise<void> {
    const { database } = this;

    await Promise.all([
      database.execute('DELETE FROM mcp_prompts WHERE module_name = ?', [moduleName]),
      database.execute('DELETE FROM mcp_resources WHERE module_name = ?', [moduleName]),
      database.execute(
        'DELETE FROM mcp_resource_templates WHERE module_name = ?',
        [moduleName],
      ),
    ]);
  }

  /**
   * Get existing prompts from database.
   * @param moduleName - Name of the module.
   * @returns Promise that resolves to array of existing prompts.
   */
  async getExistingPrompts(moduleName: string): Promise<IExistingPrompt[]> {
    return await this.database.query<IExistingPrompt>(
      'SELECT name, file_path, last_synced_at FROM mcp_prompts WHERE module_name = ?',
      [moduleName],
    );
  }

  /**
   * Insert or update a prompt in the database.
   * @param moduleName - Name of the module.
   * @param relativePath - Relative file path.
   * @param promptData - Parsed prompt data.
   * @param messages - Parsed messages.
   * @returns Promise that resolves when operation is complete.
   */
  async upsertPrompt(
    moduleName: string,
    relativePath: string,
    promptData: IPromptScanData,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    const insertQuery = `
      INSERT INTO mcp_prompts (
        name, description, messages, arguments, module_name, 
        file_path, metadata, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        messages = excluded.messages,
        arguments = excluded.arguments,
        file_path = excluded.file_path,
        metadata = excluded.metadata,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.database.execute(insertQuery, [
      promptData.name,
      promptData.description ?? null,
      JSON.stringify(messages),
      promptData.arguments ? JSON.stringify(promptData.arguments) : null,
      moduleName,
      relativePath,
      null
    ]);
  }

  /**
   * Remove obsolete prompts from database.
   * @param moduleName - Name of the module.
   * @param promptNames - Names of prompts to delete.
   * @returns Promise that resolves when prompts are removed.
   */
  async removeObsoletePrompts(moduleName: string, promptNames: string[]): Promise<void> {
    if (promptNames.length === 0) {
      return;
    }

    const placeholders = promptNames.map(() => { return '?' }).join(',');
    await this.database.execute(
      `DELETE FROM mcp_prompts WHERE module_name = ? AND name IN (${placeholders})`,
      [moduleName, ...promptNames],
    );
  }

  /**
   * Get existing resources from database.
   * @param moduleName - Name of the module.
   * @returns Promise that resolves to array of existing resources.
   */
  async getExistingResources(moduleName: string): Promise<IExistingResource[]> {
    return await this.database.query<IExistingResource>(
      'SELECT uri, file_path, last_synced_at FROM mcp_resources WHERE module_name = ?',
      [moduleName],
    );
  }

  /**
   * Insert or update a resource in the database.
   * @param moduleName - Name of the module.
   * @param relativePath - Relative file path.
   * @param resourceData - Resource data.
   * @param content - File content.
   * @param contentType - Content type.
   * @param mimeType - MIME type.
   * @param fileSize - File size.
   * @returns Promise that resolves when operation is complete.
   */
  async upsertResource(
    moduleName: string,
    relativePath: string,
    resourceData: IResourceScanData,
    content: Buffer | string,
    contentType: 'text' | 'blob',
    mimeType: string,
    fileSize?: number,
  ): Promise<void> {
    const insertQuery = `
      INSERT INTO mcp_resources (
        uri, name, description, mime_type, content_type,
        content, blob_content, size, module_name, file_path,
        metadata, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(uri) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        mime_type = excluded.mime_type,
        content_type = excluded.content_type,
        content = excluded.content,
        blob_content = excluded.blob_content,
        size = excluded.size,
        file_path = excluded.file_path,
        metadata = excluded.metadata,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.database.execute(insertQuery, [
      resourceData.uri,
      resourceData.name,
      resourceData.description ?? null,
      resourceData.mimeType ?? mimeType,
      contentType,
      contentType === 'text' ? content.toString() : null,
      contentType === 'blob' ? content : null,
      fileSize,
      moduleName,
      relativePath,
      null
    ]);
  }

  /**
   * Remove obsolete resources from database.
   * @param moduleName - Name of the module.
   * @param resourceUris - URIs of resources to delete.
   * @returns Promise that resolves when resources are removed.
   */
  async removeObsoleteResources(moduleName: string, resourceUris: string[]): Promise<void> {
    if (resourceUris.length === 0) {
      return;
    }

    const placeholders = resourceUris.map(() => { return '?' }).join(',');
    await this.database.execute(
      `DELETE FROM mcp_resources WHERE module_name = ? AND uri IN (${placeholders})`,
      [moduleName, ...resourceUris],
    );
  }
}
