import { Service, Inject } from 'typedi';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { IDatabaseService } from '@/modules/core/database/types/index.js';
import { TYPES } from '@/modules/core/types.js';
import * as fs from 'fs/promises';
import type { Stats } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import mime from 'mime-types';

interface MCPResourceData {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  metadata?: Record<string, any>;
}

interface MCPPromptData {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
  };
}

interface FileInfo {
  path: string;
  relativePath: string;
  stats: Stats;
  hash?: string;
}

@Service()
export class MCPContentScannerService {
  constructor(
    @Inject(TYPES.Logger) private readonly logger: ILogger,
    @Inject(TYPES.Database) private readonly database: IDatabaseService,
  ) {}

  /**
   * Scan a module for MCP content (prompts and resources)
   */
  async scanModule(moduleName: string, modulePath: string): Promise<void> {
    this.logger.info(`Scanning module ${moduleName} for MCP content`, { modulePath });

    try {
      // Scan for prompts
      const promptFiles = await this.findFiles(modulePath, 'prompts/**/*.md');
      await this.syncPrompts(moduleName, promptFiles);

      // Scan for resources
      const resourceFiles = await this.findFiles(modulePath, 'resources/**/*');
      await this.syncResources(moduleName, resourceFiles);

      this.logger.info(`Completed MCP content scan for module ${moduleName}`, {
        promptsFound: promptFiles.length,
        resourcesFound: resourceFiles.length,
      });
    } catch (error) {
      this.logger.error(`Failed to scan MCP content for module ${moduleName}`, { error });
      throw error;
    }
  }

  /**
   * Find files matching a pattern within a module directory
   */
  private async findFiles(basePath: string, pattern: string): Promise<FileInfo[]> {
    const fullPattern = path.join(basePath, pattern);
    const files = await glob(fullPattern, { nodir: true });

    const fileInfos: FileInfo[] = [];
    for (const filePath of files) {
      try {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(basePath, filePath);
        fileInfos.push({
          path: filePath,
          relativePath,
          stats,
        });
      } catch (error) {
        this.logger.warn(`Failed to stat file ${filePath}`, { error });
      }
    }

    return fileInfos;
  }

  /**
   * Sync prompts from markdown files to database
   */
  private async syncPrompts(moduleName: string, files: FileInfo[]): Promise<void> {
    const db = this.database;

    // Get existing prompts for this module
    const existingPrompts = await db.all(
      'SELECT name, file_path, last_synced_at FROM mcp_prompts WHERE module_name = ?',
      [moduleName],
    );

    const existingMap = new Map(existingPrompts.map((p) => [p.file_path, p]));
    const processedPaths = new Set<string>();

    for (const file of files) {
      processedPaths.add(file.relativePath);

      try {
        // Check if file needs updating
        const existing = existingMap.get(file.relativePath);
        if (existing?.last_synced_at) {
          const lastSync = new Date((existing).last_synced_at).getTime();
          if (file.stats.mtime.getTime() <= lastSync) {
            continue; // Skip unchanged files
          }
        }

        // Parse the markdown file
        const content = await (fs.readFile as any)(file.path, 'utf-8');
        const parsed = matter(content);
        const promptData = parsed.data as MCPPromptData;

        if (!promptData.name) {
          this.logger.warn(`Prompt file missing 'name' field: ${file.path}`);
          continue;
        }

        // Parse content into messages
        const messages = this.parsePromptContent(parsed.content);

        // Upsert the prompt
        await db.run(
          `
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
        `,
          [
            promptData.name,
            promptData.description || null,
            JSON.stringify(messages),
            promptData.arguments ? JSON.stringify(promptData.arguments) : null,
            moduleName,
            file.relativePath,
            promptData.metadata ? JSON.stringify(promptData.metadata) : null,
          ],
        );

        this.logger.debug(`Synced prompt: ${promptData.name}`, { module: moduleName });
      } catch (error) {
        this.logger.error(`Failed to process prompt file: ${file.path}`, { error });
      }
    }

    // Remove prompts whose files no longer exist
    const toDelete = Array.from(existingMap.entries())
      .filter(([path]) => !processedPaths.has(path))
      .map(([_, prompt]) => prompt.name);

    if (toDelete.length > 0) {
      await db.run(
        `DELETE FROM mcp_prompts WHERE module_name = ? AND name IN (${toDelete.map(() => '?').join(',')})`,
        [moduleName, ...toDelete],
      );
      this.logger.info(`Removed ${toDelete.length} obsolete prompts`, { module: moduleName });
    }
  }

  /**
   * Parse prompt content into messages array
   */
  private parsePromptContent(content: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Simple parser - splits by ## headers for roles
    const sections = content.split(/^##\s+/m).filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      if (lines.length === 0) {continue;}
      const roleMatch = lines[0]?.toLowerCase().trim() || '';

      let role: string;
      if (roleMatch.includes('system')) {
        role = 'system';
      } else if (roleMatch.includes('user')) {
        role = 'user';
      } else if (roleMatch.includes('assistant')) {
        role = 'assistant';
      } else {
        continue; // Skip unknown sections
      }

      const content = lines.slice(1).join('\n').trim();
      if (content) {
        messages.push({ role, content });
      }
    }

    // If no sections found, treat entire content as a system message
    if (messages.length === 0 && content.trim()) {
      messages.push({ role: 'system', content: content.trim() });
    }

    return messages;
  }

  /**
   * Sync resources from files to database
   */
  private async syncResources(moduleName: string, files: FileInfo[]): Promise<void> {
    const db = this.database;

    // Get existing resources for this module
    const existingResources = await db.all(
      'SELECT uri, file_path, last_synced_at FROM mcp_resources WHERE module_name = ?',
      [moduleName],
    );

    const existingMap = new Map(existingResources.map((r) => [r.file_path, r]));
    const processedPaths = new Set<string>();

    for (const file of files) {
      processedPaths.add(file.relativePath);

      try {
        // Check if file needs updating
        const existing = existingMap.get(file.relativePath);
        if (existing?.last_synced_at) {
          const lastSync = new Date((existing).last_synced_at).getTime();
          if (file.stats.mtime.getTime() <= lastSync) {
            continue; // Skip unchanged files
          }
        }

        // Determine content type and MIME type
        const ext = path.extname(file.path).toLowerCase();
        const mimeType = mime.lookup(file.path) || 'application/octet-stream';
        const isText = this.isTextFile(mimeType, ext);

        let resourceData: MCPResourceData;
        let content: Buffer | string;
        let contentType: 'text' | 'blob';

        if (ext === '.md' && file.relativePath.startsWith('resources/')) {
          // Parse markdown files for metadata
          const fileContent = await fs.readFile(file.path, 'utf-8');
          const parsed = matter(fileContent);
          resourceData = parsed.data as MCPResourceData;
          content = parsed.content;
          contentType = 'text';

          // Generate URI if not provided
          if (!resourceData.uri) {
            resourceData.uri = this.generateResourceUri(moduleName, file.relativePath);
          }

          // Use filename as name if not provided
          if (!resourceData.name) {
            resourceData.name = path.basename(file.path, ext);
          }
        } else {
          // Handle non-markdown files
          content = await fs.readFile(file.path);
          contentType = isText ? 'text' : 'blob';

          resourceData = {
            uri: this.generateResourceUri(moduleName, file.relativePath),
            name: path.basename(file.path),
            mimeType: mimeType,
          };
        }

        // Content is ready for storage

        // Upsert the resource
        await db.run(
          `
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
        `,
          [
            resourceData.uri,
            resourceData.name,
            resourceData.description || null,
            resourceData.mimeType || mimeType,
            contentType,
            contentType === 'text' ? content.toString() : null,
            contentType === 'blob' ? content : null,
            file.stats.size,
            moduleName,
            file.relativePath,
            resourceData.metadata ? JSON.stringify(resourceData.metadata) : null,
          ],
        );

        this.logger.debug(`Synced resource: ${resourceData.uri}`, {
          module: moduleName,
          mimeType,
          size: file.stats.size,
        });
      } catch (error) {
        this.logger.error(`Failed to process resource file: ${file.path}`, { error });
      }
    }

    // Remove resources whose files no longer exist
    const toDelete = Array.from(existingMap.entries())
      .filter(([path]) => !processedPaths.has(path))
      .map(([_, resource]) => resource.uri);

    if (toDelete.length > 0) {
      await db.run(
        `DELETE FROM mcp_resources WHERE module_name = ? AND uri IN (${toDelete.map(() => '?').join(',')})`,
        [moduleName, ...toDelete],
      );
      this.logger.info(`Removed ${toDelete.length} obsolete resources`, { module: moduleName });
    }
  }

  /**
   * Generate a resource URI from module name and file path
   */
  private generateResourceUri(moduleName: string, relativePath: string): string {
    // Remove 'resources/' prefix and extension
    const cleanPath = relativePath
      .replace(/^resources\//, '')
      .replace(/\.[^.]+$/, '')
      .replace(/\\/g, '/'); // Normalize path separators

    return `module://${moduleName}/${cleanPath}`;
  }

  /**
   * Determine if a file should be treated as text based on MIME type
   */
  private isTextFile(mimeType: string, ext: string): boolean {
    // Text MIME types
    if (mimeType.startsWith('text/')) {return true;}

    // Application types that are text
    const textApplicationTypes = [
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript',
      'application/x-yaml',
      'application/x-sh',
      'application/sql',
    ];

    if (textApplicationTypes.includes(mimeType)) {return true;}

    // Check by extension as fallback
    const textExtensions = [
      '.txt',
      '.md',
      '.json',
      '.xml',
      '.yaml',
      '.yml',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.css',
      '.scss',
      '.sass',
      '.html',
      '.htm',
      '.svg',
      '.sh',
      '.bash',
      '.zsh',
      '.py',
      '.rb',
      '.php',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.go',
      '.rs',
      '.sql',
      '.graphql',
      '.env',
      '.conf',
      '.ini',
      '.toml',
      '.properties',
    ];

    return textExtensions.includes(ext);
  }

  /**
   * Remove all MCP content for a module (used when module is uninstalled)
   */
  async removeModuleContent(moduleName: string): Promise<void> {
    const db = this.database;

    await db.run('DELETE FROM mcp_prompts WHERE module_name = ?', [moduleName]);
    await db.run('DELETE FROM mcp_resources WHERE module_name = ?', [moduleName]);
    await db.run('DELETE FROM mcp_resource_templates WHERE module_name = ?', [moduleName]);

    this.logger.info(`Removed all MCP content for module ${moduleName}`);
  }
}
