/**
 * @fileoverview MCP Registry service for managing tools, prompts, and resources
 * @module modules/core/mcp/services
 */

import type { Logger } from '../../../types.js';
import type {
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPModule,
  MCPRegistry
} from '../types/index.js';

export class MCPRegistryService {
  private registry: MCPRegistry = {
    tools: new Map(),
    prompts: new Map(),
    resources: new Map()
  };
  
  private modules: Map<string, MCPModule> = new Map();
  
  constructor(private logger: Logger) {}
  
  /**
   * Register a module with its components
   */
  registerModule(module: MCPModule): void {
    if (this.modules.has(module.id)) {
      this.logger.warn(`Module already registered: ${module.id}`);
      return;
    }
    
    this.modules.set(module.id, module);
    
    // Register tools
    if (module.tools) {
      for (const tool of module.tools) {
        this.registerTool(tool, module.id);
      }
    }
    
    // Register prompts
    if (module.prompts) {
      for (const prompt of module.prompts) {
        this.registerPrompt(prompt, module.id);
      }
    }
    
    // Register resources
    if (module.resources) {
      for (const resource of module.resources) {
        this.registerResource(resource, module.id);
      }
    }
    
    this.logger.info(`Registered module: ${module.id}`, {
      tools: module.tools?.length || 0,
      prompts: module.prompts?.length || 0,
      resources: module.resources?.length || 0
    });
  }
  
  /**
   * Unregister a module and its components
   */
  unregisterModule(moduleId: string): void {
    const module = this.modules.get(moduleId);
    if (!module) {
      this.logger.warn(`Module not found: ${moduleId}`);
      return;
    }
    
    // Unregister tools
    if (module.tools) {
      for (const tool of module.tools) {
        this.unregisterTool(tool.name);
      }
    }
    
    // Unregister prompts
    if (module.prompts) {
      for (const prompt of module.prompts) {
        this.unregisterPrompt(prompt.name);
      }
    }
    
    // Unregister resources
    if (module.resources) {
      for (const resource of module.resources) {
        this.unregisterResource(resource.uri);
      }
    }
    
    this.modules.delete(moduleId);
    this.logger.info(`Unregistered module: ${moduleId}`);
  }
  
  /**
   * Register a tool
   */
  registerTool(tool: MCPTool, moduleId?: string): void {
    if (this.registry.tools.has(tool.name)) {
      this.logger.warn(`Tool already registered: ${tool.name}`);
      return;
    }
    
    // Add module ID to metadata
    if (moduleId) {
      tool.metadata = {
        ...tool.metadata,
        moduleId
      };
    }
    
    this.registry.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }
  
  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    if (!this.registry.tools.has(name)) {
      this.logger.warn(`Tool not found: ${name}`);
      return;
    }
    
    this.registry.tools.delete(name);
    this.logger.debug(`Unregistered tool: ${name}`);
  }
  
  /**
   * Register a prompt
   */
  registerPrompt(prompt: MCPPrompt, moduleId?: string): void {
    if (this.registry.prompts.has(prompt.name)) {
      this.logger.warn(`Prompt already registered: ${prompt.name}`);
      return;
    }
    
    // Add module ID to metadata
    if (moduleId) {
      prompt.metadata = {
        ...prompt.metadata,
        moduleId
      };
    }
    
    this.registry.prompts.set(prompt.name, prompt);
    this.logger.debug(`Registered prompt: ${prompt.name}`);
  }
  
  /**
   * Unregister a prompt
   */
  unregisterPrompt(name: string): void {
    if (!this.registry.prompts.has(name)) {
      this.logger.warn(`Prompt not found: ${name}`);
      return;
    }
    
    this.registry.prompts.delete(name);
    this.logger.debug(`Unregistered prompt: ${name}`);
  }
  
  /**
   * Register a resource
   */
  registerResource(resource: MCPResource, moduleId?: string): void {
    if (this.registry.resources.has(resource.uri)) {
      this.logger.warn(`Resource already registered: ${resource.uri}`);
      return;
    }
    
    // Add module ID to metadata
    if (moduleId) {
      resource.metadata = {
        ...resource.metadata,
        moduleId
      };
    }
    
    this.registry.resources.set(resource.uri, resource);
    this.logger.debug(`Registered resource: ${resource.uri}`);
  }
  
  /**
   * Unregister a resource
   */
  unregisterResource(uri: string): void {
    if (!this.registry.resources.has(uri)) {
      this.logger.warn(`Resource not found: ${uri}`);
      return;
    }
    
    this.registry.resources.delete(uri);
    this.logger.debug(`Unregistered resource: ${uri}`);
  }
  
  /**
   * Get a tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.registry.tools.get(name);
  }
  
  /**
   * Get all tools
   */
  getTools(): Map<string, MCPTool> {
    return this.registry.tools;
  }
  
  /**
   * Get a prompt by name
   */
  getPrompt(name: string): MCPPrompt | undefined {
    return this.registry.prompts.get(name);
  }
  
  /**
   * Get all prompts
   */
  getPrompts(): Map<string, MCPPrompt> {
    return this.registry.prompts;
  }
  
  /**
   * Get a resource by URI
   */
  getResource(uri: string): MCPResource | undefined {
    return this.registry.resources.get(uri);
  }
  
  /**
   * Get all resources
   */
  getResources(): Map<string, MCPResource> {
    return this.registry.resources;
  }
  
  /**
   * Get a module by ID
   */
  getModule(id: string): MCPModule | undefined {
    return this.modules.get(id);
  }
  
  /**
   * Get all modules
   */
  getModules(): Map<string, MCPModule> {
    return this.modules;
  }
  
  /**
   * Clear the registry
   */
  clear(): void {
    this.registry.tools.clear();
    this.registry.prompts.clear();
    this.registry.resources.clear();
    this.modules.clear();
    this.logger.info('Registry cleared');
  }
  
  /**
   * Get registry statistics
   */
  getStats(): {
    modules: number;
    tools: number;
    prompts: number;
    resources: number;
  } {
    return {
      modules: this.modules.size,
      tools: this.registry.tools.size,
      prompts: this.registry.prompts.size,
      resources: this.registry.resources.size
    };
  }
  
  /**
   * Get registry health status
   */
  getHealth(): {
    healthy: boolean;
    stats: ReturnType<MCPRegistryService['getStats']>;
  } {
    return {
      healthy: true,
      stats: this.getStats()
    };
  }
  
  /**
   * Export registry as JSON
   */
  toJSON(): {
    modules: Array<MCPModule>;
    tools: Array<[string, MCPTool]>;
    prompts: Array<[string, MCPPrompt]>;
    resources: Array<[string, MCPResource]>;
  } {
    return {
      modules: Array.from(this.modules.values()),
      tools: Array.from(this.registry.tools.entries()),
      prompts: Array.from(this.registry.prompts.entries()),
      resources: Array.from(this.registry.resources.entries())
    };
  }
  
  /**
   * Import registry from JSON
   */
  fromJSON(data: ReturnType<MCPRegistryService['toJSON']>): void {
    this.clear();
    
    // Import modules
    for (const module of data.modules) {
      this.modules.set(module.id, module);
    }
    
    // Import tools
    for (const [name, tool] of data.tools) {
      this.registry.tools.set(name, tool);
    }
    
    // Import prompts
    for (const [name, prompt] of data.prompts) {
      this.registry.prompts.set(name, prompt);
    }
    
    // Import resources
    for (const [uri, resource] of data.resources) {
      this.registry.resources.set(uri, resource);
    }
    
    this.logger.info('Registry imported', this.getStats());
  }
}