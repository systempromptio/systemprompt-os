/**
 * @fileoverview Tool service for business logic and MCP SDK integration
 * @module tools/services/tool
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ModuleDatabaseAdapter } from '../../database/adapters/module-adapter.js';
import type { 
  DBTool, 
  ExtendedTool, 
  ToolFilterOptions,
  ToolHandler,
  ToolContext,
  ToolMetadata
} from '../types/index.js';
import { ToolRepository } from '../repositories/tool.repository.js';
import { ToolScanner } from '../scanner/tool-scanner.js';

/**
 * Service layer for tool operations
 * Handles business logic, validation, and coordination between scanner and repository
 */
export class ToolService {
  private readonly repository: ToolRepository;
  private readonly scanner: ToolScanner;
  private toolHandlers: Map<string, ToolHandler> = new Map();

  constructor(db: ModuleDatabaseAdapter, baseModulesDir?: string) {
    this.repository = new ToolRepository(db);
    this.scanner = new ToolScanner(baseModulesDir);
  }

  /**
   * Lists all available tools
   * @returns Array of MCP SDK Tool objects with extended properties
   */
  async listTools(): Promise<ExtendedTool[]> {
    const dbTools = this.repository.findAll();
    return dbTools.map(dbTool => this.toExtendedTool(dbTool));
  }

  /**
   * Gets tools filtered by scope
   * @param scope - The scope to filter by ('remote' or 'local')
   * @returns Array of tools matching the scope
   */
  async getToolsByScope(scope: 'remote' | 'local'): Promise<ExtendedTool[]> {
    const dbTools = this.repository.findByScope(scope);
    return dbTools.map(dbTool => this.toExtendedTool(dbTool));
  }

  /**
   * Gets enabled tools for a specific scope
   * @param scope - The scope to filter by ('remote' or 'local')
   * @returns Array of enabled tools matching the scope
   */
  async getEnabledToolsByScope(scope: 'remote' | 'local'): Promise<Tool[]> {
    const dbTools = this.repository.findWithFilters({ scope, enabled: true });
    return dbTools.map(dbTool => this.toMCPTool(dbTool));
  }

  /**
   * Gets tools with custom filters
   * @param filters - Filter options
   * @returns Array of tools matching the filters
   */
  async getToolsWithFilters(filters: ToolFilterOptions): Promise<ExtendedTool[]> {
    const dbTools = this.repository.findWithFilters(filters);
    return dbTools.map(dbTool => this.toExtendedTool(dbTool));
  }

  /**
   * Gets a specific tool by name
   * @param name - The unique name of the tool
   * @returns The tool if found, null otherwise
   */
  async getTool(name: string): Promise<ExtendedTool | null> {
    const dbTool = this.repository.findByName(name);
    if (!dbTool) {
      return null;
    }
    
    return this.toExtendedTool(dbTool);
  }

  /**
   * Enables a tool
   * @param name - The name of the tool to enable
   * @returns True if the tool was enabled, false if not found
   */
  async enableTool(name: string): Promise<boolean> {
    return this.repository.updateEnabled(name, true);
  }

  /**
   * Disables a tool
   * @param name - The name of the tool to disable
   * @returns True if the tool was disabled, false if not found
   */
  async disableTool(name: string): Promise<boolean> {
    return this.repository.updateEnabled(name, false);
  }

  /**
   * Refreshes the tool registry by scanning all modules
   * @param force - Force refresh even if tools already exist
   * @returns Summary of the refresh operation
   */
  async refreshTools(force: boolean = false): Promise<{
    discovered: number;
    added: number;
    updated: number;
    removed: number;
  }> {
    const discoveredTools = await this.scanner.discoverTools();
    const existingTools = this.repository.findAll();
    
    let added = 0;
    let updated = 0;
    let removed = 0;
    
    return this.repository.transaction(() => {
      const existingByName = new Map(existingTools.map(t => [t.name, t]));
      const discoveredByName = new Map(discoveredTools.map(t => [t.definition.name, t]));
      
      for (const discovered of discoveredTools) {
        const existing = existingByName.get(discovered.definition.name);
        
        if (!existing) {
          this.repository.create({
            name: discovered.definition.name,
            description: discovered.definition.description,
            input_schema: discovered.definition.inputSchema,
            handler_path: discovered.filePath,
            module_name: discovered.moduleName,
            scope: discovered.definition.scope,
            enabled: true,
            metadata: discovered.definition.metadata
          });
          added++;
        } else if (force || this.hasToolChanged(existing, discovered)) {
          this.repository.update(discovered.definition.name, {
            description: discovered.definition.description,
            input_schema: discovered.definition.inputSchema,
            scope: discovered.definition.scope,
            metadata: discovered.definition.metadata,
            handler_path: discovered.filePath
          });
          updated++;
        }
      }
      
      for (const existing of existingTools) {
        if (!discoveredByName.has(existing.name)) {
          this.repository.delete(existing.name);
          removed++;
        }
      }
      
      return {
        discovered: discoveredTools.length,
        added,
        updated,
        removed
      };
    });
  }

  /**
   * Executes a tool with given parameters
   * @param name - The name of the tool to execute
   * @param params - Parameters to pass to the tool
   * @param context - Optional context for the tool execution
   * @returns The result of the tool execution
   * @throws Error if tool not found, disabled, or execution fails
   */
  async executeTool(name: string, params: any, context?: Partial<ToolContext>): Promise<any> {
    const dbTool = this.repository.findByName(name);
    if (!dbTool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    if (!dbTool.enabled) {
      throw new Error(`Tool is disabled: ${name}`);
    }
    
    const handler = await this.loadToolHandler(dbTool);
    if (!handler) {
      throw new Error(`Tool handler not found: ${name}`);
    }
    
    const fullContext: ToolContext = {
      moduleName: dbTool.module_name,
      ...context
    };
    
    try {
      return await handler(params, fullContext);
    } catch (error) {
      throw new Error(`Tool execution failed: ${error}`);
    }
  }

  /**
   * Loads a tool handler
   * @param dbTool - The database tool record
   * @returns The tool handler function or null if not found
   */
  private async loadToolHandler(dbTool: DBTool): Promise<ToolHandler | null> {
    if (this.toolHandlers.has(dbTool.name)) {
      return this.toolHandlers.get(dbTool.name)!;
    }
    
    try {
      const module = await import(dbTool.handler_path);
      const handler = module.handler || module.default?.handler || module.execute;
      
      if (typeof handler === 'function') {
        this.toolHandlers.set(dbTool.name, handler);
        return handler;
      }
    } catch (error) {
      console.error(`Error loading tool handler from ${dbTool.handler_path}:`, error);
    }
    
    return null;
  }

  /**
   * Checks if a tool has changed
   * @param existing - Existing tool record
   * @param discovered - Discovered tool
   * @returns True if the tool has changed
   */
  private hasToolChanged(existing: DBTool, discovered: any): boolean {
    return existing.description !== discovered.definition.description ||
           existing.handler_path !== discovered.filePath ||
           existing.scope !== discovered.definition.scope ||
           JSON.stringify(JSON.parse(existing.input_schema)) !== JSON.stringify(discovered.definition.inputSchema);
  }

  /**
   * Converts a database tool to MCP SDK Tool format
   * @param dbTool - The database tool record
   * @returns MCP SDK Tool object
   */
  private toMCPTool(dbTool: DBTool): Tool {
    return {
      name: dbTool.name,
      description: dbTool.description,
      inputSchema: JSON.parse(dbTool.input_schema)
    };
  }

  /**
   * Converts a database tool to ExtendedTool format
   * @param dbTool - The database tool record
   * @returns Extended tool with additional properties
   */
  private toExtendedTool(dbTool: DBTool): ExtendedTool {
    const metadata: ToolMetadata | undefined = dbTool.metadata 
      ? JSON.parse(dbTool.metadata) 
      : undefined;
    
    return {
      name: dbTool.name,
      description: dbTool.description,
      inputSchema: JSON.parse(dbTool.input_schema),
      handlerPath: dbTool.handler_path,
      moduleName: dbTool.module_name,
      scope: dbTool.scope,
      enabled: dbTool.enabled === 1,
      metadata
    };
  }

  /**
   * Clears the tool handler cache
   */
  clearHandlerCache(): void {
    this.toolHandlers.clear();
  }
}