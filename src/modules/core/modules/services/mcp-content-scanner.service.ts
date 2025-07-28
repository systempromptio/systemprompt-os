/**
 * MCP content scanner service for scanning modules for prompts and resources.
 * Service for scanning and syncing MCP content from module directories.
 * @file MCP content scanner service.
 * @module modules/core/modules/services/mcp-content-scanner.service
 */

import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  IContentScanner,
  IFileInfo,
  IPromptScanData,
  IResourceScanData,
} from '@/modules/core/modules/types/index';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

/**
 * Service for scanning and syncing MCP content from module directories.
 */
export class MCPContentScannerService implements IContentScanner {
  private static instance: MCPContentScannerService;
  private readonly logger: ILogger;
  private readonly database: DatabaseService;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.logger = LoggerService.getInstance();
    this.database = DatabaseService.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The service instance.
   */
  static getInstance(): MCPContentScannerService {
    MCPContentScannerService.instance ||= new MCPContentScannerService();
    return MCPContentScannerService.instance;
  }

  /**
   * Scan a module for MCP content (prompts and resources).
   * @param moduleName - Name of the module to scan.
   * @param modulePath - Path to the module directory.
   * @returns Promise that resolves when scan is complete.
   */
  async scanModule(moduleName: string, modulePath: string): Promise<void> {
    this.logger.info(
      LogSource.MCP,
      `Scanning module ${moduleName} for MCP content`,
      { modulePath },
    );

    try {
      const promptFiles = await this.findFiles(modulePath, 'prompts/**/*.md');
      await this.syncPrompts(moduleName, promptFiles);

      const resourceFiles = await this.findFiles(modulePath, 'resources/**/*');
      await this.syncResources(moduleName, resourceFiles);

      this.logger.info(
        LogSource.MCP,
        `Completed MCP content scan for module ${moduleName}`,
        {
          promptsFound: promptFiles.length,
          resourcesFound: resourceFiles.length,
        },
      );
    } catch (error) {
      const processedError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        LogSource.MCP,
        `Failed to scan MCP content for module ${moduleName}`,
        { error: processedError },
      );
      throw error;
    }
  }

  /**
   * Remove all MCP content for a module (used when module is uninstalled).
   * @param moduleName - Name of the module to remove content for.
   * @returns Promise that resolves when content is removed.
   */
  async removeModuleContent(moduleName: string): Promise<void> {
    const {database} = this;

    await Promise.all([
      database.execute('DELETE FROM mcp_prompts WHERE module_name = ?', [moduleName]),
      database.execute('DELETE FROM mcp_resources WHERE module_name = ?', [moduleName]),
      database.execute(
        'DELETE FROM mcp_resource_templates WHERE module_name = ?',
        [moduleName],
      ),
    ]);

    this.logger.info(
      LogSource.MCP,
      `Removed all MCP content for module ${moduleName}`,
    );
  }

  /**
   * Find files matching a pattern within a module directory.
   * @param basePath - Base directory path.
   * @param pattern - Glob pattern to match files.
   * @returns Promise that resolves to array of file info.
   */
  private async findFiles(basePath: string, pattern: string): Promise<IFileInfo[]> {
    const fullPattern = path.join(basePath, pattern);
    const files = await glob(fullPattern, { nodir: true });

    const fileInfos: IFileInfo[] = [];
    for (const filePath of files) {
      try {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(basePath, filePath);
        fileInfos.push({
          path: filePath,
          relativePath,
          stats: stats as unknown as Record<string, unknown>,
        });
      } catch (error) {
        const processedError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          LogSource.MCP,
          `Failed to stat file ${filePath}`,
          { error: processedError },
        );
      }
    }

    return fileInfos;
  }

  /**
   * Sync prompts from markdown files to database.
   * @param moduleName - Name of the module.
   * @param files - Array of file info to process.
   * @returns Promise that resolves when sync is complete.
   */
  private async syncPrompts(moduleName: string, files: IFileInfo[]): Promise<void> {
    const existingPrompts = await this.getExistingPrompts(moduleName);
    const existingMap = new Map(existingPrompts.map((prompt) => { return [prompt.file_path, prompt] }));
    const processedPaths = new Set<string>();

    await this.processPromptFiles(moduleName, files, existingMap, processedPaths);
    await this.removeObsoletePrompts(moduleName, existingMap, processedPaths);
  }

  /**
   * Get existing prompts from database.
   * @param moduleName - Name of the module.
   * @returns Promise that resolves to array of existing prompts.
   */
  private async getExistingPrompts(
    moduleName: string,
  ): Promise<Array<{ name: string; file_path: string; last_synced_at: string }>> {
    const db = this.database;
    return await db.query<{ name: string; file_path: string; last_synced_at: string }>(
      'SELECT name, file_path, last_synced_at FROM mcp_prompts WHERE module_name = ?',
      [moduleName],
    );
  }

  /**
   * Process prompt files and sync to database.
   * @param moduleName - Name of the module.
   * @param files - Array of file info to process.
   * @param existingMap - Map of existing prompts.
   * @param processedPaths - Set to track processed paths.
   */
  private async processPromptFiles(
    moduleName: string,
    files: IFileInfo[],
    existingMap: Map<string, { name: string; file_path: string; last_synced_at: string }>,
    processedPaths: Set<string>,
  ): Promise<void> {
    for (const file of files) {
      processedPaths.add(file.relativePath);

      try {
        if (await this.isPromptFileUpToDate(file, existingMap)) {
          continue;
        }

        await this.syncSinglePromptFile(moduleName, file);
      } catch (error) {
        const processedError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          LogSource.MCP,
          `Failed to process prompt file: ${file.path}`,
          { error: processedError },
        );
      }
    }
  }

  /**
   * Check if prompt file is up to date.
   * @param file - File info to check.
   * @param existingMap - Map of existing prompts.
   * @returns True if file is up to date.
   */
  private async isPromptFileUpToDate(
    file: IFileInfo,
    existingMap: Map<string, { name: string; file_path: string; last_synced_at: string }>,
  ): Promise<boolean> {
    const existing = existingMap.get(file.relativePath);
    if (existing?.last_synced_at && file.stats.mtime) {
      const lastSync = new Date(existing.last_synced_at).getTime();
      const fileMtime = file.stats.mtime as Date;
      return fileMtime.getTime() <= lastSync;
    }
    return false;
  }

  /**
   * Sync a single prompt file to database.
   * @param moduleName - Name of the module.
   * @param file - File info to process.
   */
  private async syncSinglePromptFile(moduleName: string, file: IFileInfo): Promise<void> {
    const content = await fs.readFile(file.path, 'utf-8');
    const parsed = matter(content);
    const promptData = parsed.data as IPromptScanData;

    if (!promptData.name) {
      this.logger.warn(
        LogSource.MCP,
        `Prompt file missing 'name' field: ${file.path}`,
      );
      return;
    }

    const messages = this.parsePromptContent(parsed.content);
    await this.insertOrUpdatePrompt(moduleName, file, promptData, messages);

    this.logger.debug(
      LogSource.MCP,
      `Synced prompt: ${promptData.name}`,
      { module: moduleName },
    );
  }

  /**
   * Insert or update a prompt in the database.
   * @param moduleName - Name of the module.
   * @param file - File info.
   * @param promptData - Parsed prompt data.
   * @param messages - Parsed messages.
   */
  private async insertOrUpdatePrompt(
    moduleName: string,
    file: IFileInfo,
    promptData: IPromptScanData,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    const db = this.database;
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

    await db.execute(insertQuery, [
      promptData.name,
      promptData.description ?? null,
      JSON.stringify(messages),
      promptData.arguments ? JSON.stringify(promptData.arguments) : null,
      moduleName,
      file.relativePath,
      promptData.metadata ? JSON.stringify(promptData.metadata) : null,
    ]);
  }

  /**
   * Remove obsolete prompts from database.
   * @param moduleName - Name of the module.
   * @param existingMap - Map of existing prompts.
   * @param processedPaths - Set of processed paths.
   */
  private async removeObsoletePrompts(
    moduleName: string,
    existingMap: Map<string, { name: string; file_path: string; last_synced_at: string }>,
    processedPaths: Set<string>,
  ): Promise<void> {
    const toDelete = Array.from(existingMap.entries())
      .filter(([filePath]): boolean => {
        return !processedPaths.has(filePath);
      })
      .map(([, prompt]): string => {
        return prompt.name;
      });

    if (toDelete.length > 0) {
      const db = this.database;
      const placeholders = toDelete.map((): string => {
        return '?';
      }).join(',');
      await db.execute(
        `DELETE FROM mcp_prompts WHERE module_name = ? AND name IN (${placeholders})`,
        [moduleName, ...toDelete],
      );
      this.logger.info(
        LogSource.MCP,
        `Removed ${String(toDelete.length)} obsolete prompts`,
        { module: moduleName },
      );
    }
  }

  /**
   * Parse prompt content into messages array.
   * @param content - Markdown content to parse.
   * @returns Array of message objects with role and content.
   */
  private parsePromptContent(content: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    const sections = content.split(/^##\s+/mu).filter((s) => { return s.trim() });

    for (const section of sections) {
      const messageFromSection = this.parseMessageSection(section);
      if (messageFromSection) {
        messages.push(messageFromSection);
      }
    }

    if (messages.length === 0 && content.trim()) {
      messages.push({
        role: 'system',
        content: content.trim(),
      });
    }

    return messages;
  }

  /**
   * Parse a single message section.
   * @param section - Section content to parse.
   * @returns Parsed message or null if invalid.
   */
  private parseMessageSection(section: string): { role: string; content: string } | null {
    const lines = section.split('\n');
    if (lines.length === 0) {
      return null;
    }

    const firstLine = lines[0];
    if (!firstLine) {
      return null;
    }

    const roleMatch = firstLine.toLowerCase().trim();
    const role = this.extractRoleFromMatch(roleMatch);

    if (!role) {
      return null;
    }

    const messageContent = lines.slice(1).join('\n')
.trim();
    if (!messageContent) {
      return null;
    }

    return {
      role,
      content: messageContent,
    };
  }

  /**
   * Extract role from role match string.
   * @param roleMatch - Role match string.
   * @returns Role string or null if no match.
   */
  private extractRoleFromMatch(roleMatch: string): string | null {
    if (roleMatch.includes('system')) {
      return 'system';
    }
    if (roleMatch.includes('user')) {
      return 'user';
    }
    if (roleMatch.includes('assistant')) {
      return 'assistant';
    }
    return null;
  }

  /**
   * Sync resources from files to database.
   * @param moduleName - Name of the module.
   * @param files - Array of file info to process.
   * @returns Promise that resolves when sync is complete.
   */
  private async syncResources(moduleName: string, files: IFileInfo[]): Promise<void> {
    const existingResources = await this.getExistingResources(moduleName);
    const existingMap = new Map(existingResources.map((resource) => { return [resource.file_path, resource] }));
    const processedPaths = new Set<string>();

    await this.processResourceFiles(moduleName, files, existingMap, processedPaths);
    await this.removeObsoleteResources(moduleName, existingMap, processedPaths);
  }

  /**
   * Get existing resources from database.
   * @param moduleName - Name of the module.
   * @returns Promise that resolves to array of existing resources.
   */
  private async getExistingResources(
    moduleName: string,
  ): Promise<Array<{ uri: string; file_path: string; last_synced_at: string }>> {
    const db = this.database;
    return await db.query<{ uri: string; file_path: string; last_synced_at: string }>(
      'SELECT uri, file_path, last_synced_at FROM mcp_resources WHERE module_name = ?',
      [moduleName],
    );
  }

  /**
   * Process resource files and sync to database.
   * @param moduleName - Name of the module.
   * @param files - Array of file info to process.
   * @param existingMap - Map of existing resources.
   * @param processedPaths - Set to track processed paths.
   */
  private async processResourceFiles(
    moduleName: string,
    files: IFileInfo[],
    existingMap: Map<string, { uri: string; file_path: string; last_synced_at: string }>,
    processedPaths: Set<string>,
  ): Promise<void> {
    for (const file of files) {
      processedPaths.add(file.relativePath);

      try {
        if (await this.isResourceFileUpToDate(file, existingMap)) {
          continue;
        }

        await this.syncSingleResourceFile(moduleName, file);
      } catch (error) {
        const processedError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          LogSource.MCP,
          `Failed to process resource file: ${file.path}`,
          { error: processedError },
        );
      }
    }
  }

  /**
   * Check if resource file is up to date.
   * @param file - File info to check.
   * @param existingMap - Map of existing resources.
   * @returns True if file is up to date.
   */
  private async isResourceFileUpToDate(
    file: IFileInfo,
    existingMap: Map<string, { uri: string; file_path: string; last_synced_at: string }>,
  ): Promise<boolean> {
    const existing = existingMap.get(file.relativePath);
    if (existing?.last_synced_at && file.stats.mtime) {
      const lastSync = new Date(existing.last_synced_at).getTime();
      const fileMtime = file.stats.mtime as Date;
      return fileMtime.getTime() <= lastSync;
    }
    return false;
  }

  /**
   * Sync a single resource file to database.
   * @param moduleName - Name of the module.
   * @param file - File info to process.
   */
  private async syncSingleResourceFile(moduleName: string, file: IFileInfo): Promise<void> {
    const {
 resourceData, content, contentType, mimeType
}
      = await this.prepareResourceData(moduleName, file);

    await this.insertOrUpdateResource(
      moduleName,
      file,
      resourceData,
      content,
      contentType,
      mimeType,
    );

    this.logger.debug(
      LogSource.MCP,
      `Synced resource: ${resourceData.uri}`,
      {
        module: moduleName,
        mimeType,
        size: file.stats.size,
      },
    );
  }

  /**
   * Prepare resource data for database insertion.
   * @param moduleName - Name of the module.
   * @param file - File info to process.
   * @returns Prepared resource data.
   */
  private async prepareResourceData(
    moduleName: string,
    file: IFileInfo,
  ): Promise<{
    resourceData: IResourceScanData;
    content: Buffer | string;
    contentType: 'text' | 'blob';
    mimeType: string;
  }> {
    const ext = path.extname(file.path).toLowerCase();
    const mimeType = 'application/octet-stream';
    const isText = this.isTextFile(mimeType, ext);

    if (ext === '.md' && file.relativePath.startsWith('resources/')) {
      return await this.prepareMarkdownResourceData(moduleName, file, ext);
      
    }

    const content = await fs.readFile(file.path);
    const contentType: 'text' | 'blob' = isText ? 'text' : 'blob';

    const resourceData: IResourceScanData = {
      uri: this.generateResourceUri(moduleName, file.relativePath),
      name: path.basename(file.path),
      mimeType,
    };

    return {
 resourceData,
content,
contentType,
mimeType
};
  }

  /**
   * Prepare markdown resource data.
   * @param moduleName - Name of the module.
   * @param file - File info to process.
   * @param ext - File extension.
   * @returns Prepared markdown resource data.
   */
  private async prepareMarkdownResourceData(
    moduleName: string,
    file: IFileInfo,
    ext: string,
  ): Promise<{
    resourceData: IResourceScanData;
    content: string;
    contentType: 'text';
    mimeType: string;
  }> {
    const fileContent = await fs.readFile(file.path, 'utf-8');
    const parsed = matter(fileContent);
    const resourceData = parsed.data as IResourceScanData;
    const {content} = parsed;
    const contentType = 'text' as const;
    const mimeType = 'text/markdown';

    resourceData.uri = resourceData.uri ?? this.generateResourceUri(moduleName, file.relativePath);
    resourceData.name = resourceData.name ?? path.basename(file.path, ext);

    return {
 resourceData,
content,
contentType,
mimeType
};
  }

  /**
   * Insert or update a resource in the database.
   * @param moduleName - Name of the module.
   * @param file - File info.
   * @param resourceData - Resource data.
   * @param content - File content.
   * @param contentType - Content type.
   * @param mimeType - MIME type.
   */
  private async insertOrUpdateResource(
    moduleName: string,
    file: IFileInfo,
    resourceData: IResourceScanData,
    content: Buffer | string,
    contentType: 'text' | 'blob',
    mimeType: string,
  ): Promise<void> {
    const db = this.database;
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

    await db.execute(insertQuery, [
      resourceData.uri,
      resourceData.name,
      resourceData.description ?? null,
      resourceData.mimeType ?? mimeType,
      contentType,
      contentType === 'text' ? content.toString() : null,
      contentType === 'blob' ? content : null,
      file.stats.size as number | undefined,
      moduleName,
      file.relativePath,
      resourceData.metadata ? JSON.stringify(resourceData.metadata) : null,
    ]);
  }

  /**
   * Remove obsolete resources from database.
   * @param moduleName - Name of the module.
   * @param existingMap - Map of existing resources.
   * @param processedPaths - Set of processed paths.
   */
  private async removeObsoleteResources(
    moduleName: string,
    existingMap: Map<string, { uri: string; file_path: string; last_synced_at: string }>,
    processedPaths: Set<string>,
  ): Promise<void> {
    const toDelete = Array.from(existingMap.entries())
      .filter(([filePath]): boolean => {
        return !processedPaths.has(filePath);
      })
      .map(([, resource]): string => {
        return resource.uri;
      });

    if (toDelete.length > 0) {
      const db = this.database;
      const placeholders = toDelete.map((): string => {
        return '?';
      }).join(',');
      await db.execute(
        `DELETE FROM mcp_resources WHERE module_name = ? AND uri IN (${placeholders})`,
        [moduleName, ...toDelete],
      );
      this.logger.info(
        LogSource.MCP,
        `Removed ${String(toDelete.length)} obsolete resources`,
        { module: moduleName },
      );
    }
  }

  /**
   * Generate a resource URI from module name and file path.
   * @param moduleName - Name of the module.
   * @param relativePath - Relative path to the resource.
   * @returns Generated URI string.
   */
  private generateResourceUri(moduleName: string, relativePath: string): string {
    const cleanPath = relativePath
      .replace(/^resources\//u, '')
      .replace(/\.[^.]+$/u, '')
      .replace(/\\/gu, '/');

    return `module://${moduleName}/${cleanPath}`;
  }

  /**
   * Determine if a file should be treated as text based on MIME type.
   * @param mimeType - MIME type string.
   * @param ext - File extension.
   * @returns True if file should be treated as text.
   */
  private isTextFile(mimeType: string, ext: string): boolean {
    return (
      this.isTextMimeType(mimeType)
      || this.isTextApplicationType(mimeType)
      || this.isTextExtension(ext)
    );
  }

  /**
   * Check if MIME type starts with 'text/'.
   * @param mimeType - MIME type string.
   * @returns True if text MIME type.
   */
  private isTextMimeType(mimeType: string): boolean {
    return mimeType.startsWith('text/');
  }

  /**
   * Check if MIME type is a text application type.
   * @param mimeType - MIME type string.
   * @returns True if text application type.
   */
  private isTextApplicationType(mimeType: string): boolean {
    const textApplicationTypes = [
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript',
      'application/x-yaml',
      'application/x-sh',
      'application/sql',
    ];

    return textApplicationTypes.includes(mimeType);
  }

  /**
   * Check if file extension indicates text file.
   * @param ext - File extension.
   * @returns True if text extension.
   */
  private isTextExtension(ext: string): boolean {
    const textExtensions = new Set([
      '.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.js', '.ts',
      '.jsx', '.tsx', '.css', '.scss', '.sass', '.html', '.htm',
      '.svg', '.sh', '.bash', '.zsh', '.py', '.rb', '.php',
      '.java', '.c', '.cpp', '.h', '.go', '.rs', '.sql',
      '.graphql', '.env', '.conf', '.ini', '.toml', '.properties',
    ]);

    return textExtensions.has(ext);
  }
}
