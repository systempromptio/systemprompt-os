/**
 * @fileoverview MCP Discovery service for finding and loading MCP components
 * @module modules/core/mcp/services
 */

import { join, resolve } from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { Logger } from '../../../types.js';
import type {
  MCPDiscoveryResult,
  MCPModule,
  MCPTool,
  MCPPrompt,
  MCPResource
} from '../types/index.js';
import { MCPRegistryService } from './registry.service.js';

interface DiscoveryConfig {
  scanIntervalMs: number;
  directories: string[];
}

export class MCPDiscoveryService {
  private lastScanTime?: Date;
  private isScanning = false;
  
  constructor(
    private config: DiscoveryConfig,
    private registryService: MCPRegistryService,
    private logger: Logger
  ) {}
  
  /**
   * Discover MCP components in configured directories
   */
  async discover(): Promise<MCPDiscoveryResult> {
    if (this.isScanning) {
      this.logger.warn('Discovery already in progress');
      return this.createEmptyResult();
    }
    
    this.isScanning = true;
    const startTime = Date.now();
    const modules: MCPModule[] = [];
    const errors: Array<{ module: string; error: string }> = [];
    
    try {
      this.logger.info('Starting MCP discovery', {
        directories: this.config.directories
      });
      
      // Clear existing registry
      this.registryService.clear();
      
      // Scan each configured directory
      for (const dir of this.config.directories) {
        const absoluteDir = resolve(process.cwd(), dir);
        if (!existsSync(absoluteDir)) {
          this.logger.warn(`Discovery directory not found: ${absoluteDir}`);
          continue;
        }
        
        await this.scanDirectory(absoluteDir, modules, errors);
      }
      
      // Register discovered modules
      for (const module of modules) {
        try {
          this.registryService.registerModule(module);
        } catch (error: any) {
          errors.push({
            module: module.id,
            error: error.message
          });
        }
      }
      
      this.lastScanTime = new Date();
      
      const result: MCPDiscoveryResult = {
        modules,
        errors,
        stats: {
          totalModules: modules.length,
          totalTools: modules.reduce((sum, m) => sum + (m.tools?.length || 0), 0),
          totalPrompts: modules.reduce((sum, m) => sum + (m.prompts?.length || 0), 0),
          totalResources: modules.reduce((sum, m) => sum + (m.resources?.length || 0), 0),
          scanTimeMs: Date.now() - startTime
        }
      };
      
      this.logger.info('MCP discovery completed', result.stats);
      
      return result;
    } catch (error) {
      this.logger.error('MCP discovery failed', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }
  
  /**
   * Scan a directory for MCP components
   */
  private async scanDirectory(
    dir: string,
    modules: MCPModule[],
    errors: Array<{ module: string; error: string }>
  ): Promise<void> {
    try {
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          // Check if this is a module directory
          const mcpConfigPath = join(fullPath, 'mcp.json');
          const moduleYamlPath = join(fullPath, 'module.yaml');
          
          if (existsSync(mcpConfigPath)) {
            await this.loadMCPModule(fullPath, mcpConfigPath, modules, errors);
          } else if (existsSync(moduleYamlPath)) {
            await this.scanModuleForMCP(fullPath, modules, errors);
          } else {
            // Recurse into subdirectory
            await this.scanDirectory(fullPath, modules, errors);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to scan directory: ${dir}`, error);
      errors.push({
        module: dir,
        error: error.message
      });
    }
  }
  
  /**
   * Load an MCP module from mcp.json
   */
  private async loadMCPModule(
    modulePath: string,
    configPath: string,
    modules: MCPModule[],
    errors: Array<{ module: string; error: string }>
  ): Promise<void> {
    try {
      const configContent = await readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      const module: MCPModule = {
        id: config.id || modulePath.split('/').pop()!,
        name: config.name || config.id,
        version: config.version || '1.0.0',
        metadata: config.metadata || {}
      };
      
      // Load tools
      if (config.tools) {
        module.tools = await this.loadTools(modulePath, config.tools);
      }
      
      // Load prompts
      if (config.prompts) {
        module.prompts = await this.loadPrompts(modulePath, config.prompts);
      }
      
      // Load resources
      if (config.resources) {
        module.resources = await this.loadResources(modulePath, config.resources);
      }
      
      modules.push(module);
    } catch (error: any) {
      this.logger.error(`Failed to load MCP module: ${configPath}`, error);
      errors.push({
        module: configPath,
        error: error.message
      });
    }
  }
  
  /**
   * Scan a regular module for MCP components
   */
  private async scanModuleForMCP(
    modulePath: string,
    modules: MCPModule[],
    errors: Array<{ module: string; error: string }>
  ): Promise<void> {
    try {
      const moduleId = modulePath.split('/').pop()!;
      const tools: MCPTool[] = [];
      const prompts: MCPPrompt[] = [];
      const resources: MCPResource[] = [];
      
      // Check for tools directory
      const toolsDir = join(modulePath, 'tools');
      if (existsSync(toolsDir)) {
        const toolFiles = await readdir(toolsDir);
        for (const file of toolFiles) {
          if (file.endsWith('.tool.ts') || file.endsWith('.tool.js')) {
            try {
              const tool = await this.loadToolFile(join(toolsDir, file));
              if (tool) tools.push(tool);
            } catch (error: any) {
              errors.push({
                module: `${moduleId}/tools/${file}`,
                error: error.message
              });
            }
          }
        }
      }
      
      // Check for prompts directory
      const promptsDir = join(modulePath, 'prompts');
      if (existsSync(promptsDir)) {
        const promptFiles = await readdir(promptsDir);
        for (const file of promptFiles) {
          if (file.endsWith('.prompt.json')) {
            try {
              const prompt = await this.loadPromptFile(join(promptsDir, file));
              if (prompt) prompts.push(prompt);
            } catch (error: any) {
              errors.push({
                module: `${moduleId}/prompts/${file}`,
                error: error.message
              });
            }
          }
        }
      }
      
      // Check for resources directory
      const resourcesDir = join(modulePath, 'resources');
      if (existsSync(resourcesDir)) {
        const resourceFiles = await readdir(resourcesDir);
        for (const file of resourceFiles) {
          if (file.endsWith('.resource.json')) {
            try {
              const resource = await this.loadResourceFile(join(resourcesDir, file));
              if (resource) resources.push(resource);
            } catch (error: any) {
              errors.push({
                module: `${moduleId}/resources/${file}`,
                error: error.message
              });
            }
          }
        }
      }
      
      // Only create module if components found
      if (tools.length > 0 || prompts.length > 0 || resources.length > 0) {
        modules.push({
          id: moduleId,
          name: moduleId,
          version: '1.0.0',
          tools: tools.length > 0 ? tools : undefined,
          prompts: prompts.length > 0 ? prompts : undefined,
          resources: resources.length > 0 ? resources : undefined
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to scan module: ${modulePath}`, error);
      errors.push({
        module: modulePath,
        error: error.message
      });
    }
  }
  
  /**
   * Load tools from configuration
   */
  private async loadTools(modulePath: string, toolsConfig: any[]): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];
    
    for (const toolConfig of toolsConfig) {
      if (typeof toolConfig === 'string') {
        // Load from file
        const toolPath = join(modulePath, toolConfig);
        const tool = await this.loadToolFile(toolPath);
        if (tool) tools.push(tool);
      } else {
        // Inline tool definition
        tools.push(toolConfig as MCPTool);
      }
    }
    
    return tools;
  }
  
  /**
   * Load a tool from file
   */
  private async loadToolFile(filePath: string): Promise<MCPTool | null> {
    try {
      if (filePath.endsWith('.json')) {
        const content = await readFile(filePath, 'utf8');
        return JSON.parse(content);
      } else if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
        // Dynamic import for tool modules
        const module = await import(filePath);
        return module.default || module.tool;
      }
    } catch (error) {
      this.logger.error(`Failed to load tool: ${filePath}`, error);
    }
    return null;
  }
  
  /**
   * Load prompts from configuration
   */
  private async loadPrompts(modulePath: string, promptsConfig: any[]): Promise<MCPPrompt[]> {
    const prompts: MCPPrompt[] = [];
    
    for (const promptConfig of promptsConfig) {
      if (typeof promptConfig === 'string') {
        // Load from file
        const promptPath = join(modulePath, promptConfig);
        const prompt = await this.loadPromptFile(promptPath);
        if (prompt) prompts.push(prompt);
      } else {
        // Inline prompt definition
        prompts.push(promptConfig as MCPPrompt);
      }
    }
    
    return prompts;
  }
  
  /**
   * Load a prompt from file
   */
  private async loadPromptFile(filePath: string): Promise<MCPPrompt | null> {
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to load prompt: ${filePath}`, error);
      return null;
    }
  }
  
  /**
   * Load resources from configuration
   */
  private async loadResources(modulePath: string, resourcesConfig: any[]): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];
    
    for (const resourceConfig of resourcesConfig) {
      if (typeof resourceConfig === 'string') {
        // Load from file
        const resourcePath = join(modulePath, resourceConfig);
        const resource = await this.loadResourceFile(resourcePath);
        if (resource) resources.push(resource);
      } else {
        // Inline resource definition
        resources.push(resourceConfig as MCPResource);
      }
    }
    
    return resources;
  }
  
  /**
   * Load a resource from file
   */
  private async loadResourceFile(filePath: string): Promise<MCPResource | null> {
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to load resource: ${filePath}`, error);
      return null;
    }
  }
  
  /**
   * Get last scan time
   */
  getLastScanTime(): Date | undefined {
    return this.lastScanTime;
  }
  
  /**
   * Check if currently scanning
   */
  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }
  
  /**
   * Create empty discovery result
   */
  private createEmptyResult(): MCPDiscoveryResult {
    return {
      modules: [],
      errors: [],
      stats: {
        totalModules: 0,
        totalTools: 0,
        totalPrompts: 0,
        totalResources: 0,
        scanTimeMs: 0
      }
    };
  }
}