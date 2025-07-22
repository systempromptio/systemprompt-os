/**
 * @fileoverview Tool scanner for discovering MCP tools in modules
 * @module tools/scanner/tool-scanner
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';
import type { DiscoveredTool, ToolDefinition, ToolScope } from '../types/index.js';

/**
 * Scanner for discovering MCP tools in module directories
 */
export class ToolScanner {
  private readonly baseDir: string;
  private readonly toolsDirName: string = 'tools';

  /**
   * Creates a new tool scanner
   * @param baseDir - Base directory containing modules (e.g., /app/src/modules)
   */
  constructor(baseDir: string = '/app/src/modules') {
    this.baseDir = baseDir;
  }

  /**
   * Discovers all tools across all modules
   * @returns Array of discovered tools with their metadata
   */
  async discoverTools(): Promise<DiscoveredTool[]> {
    const tools: DiscoveredTool[] = [];
    
    try {
      const moduleTypes = ['core', 'custom'];
      
      for (const moduleType of moduleTypes) {
        const typePath = join(this.baseDir, moduleType);
        if (!existsSync(typePath)) continue;
        
        const modules = await this.getDirectories(typePath);
        
        for (const moduleName of modules) {
          const modulePath = join(typePath, moduleName);
          const toolsPath = join(modulePath, this.toolsDirName);
          
          if (!existsSync(toolsPath)) continue;
          
          const moduleTools = await this.scanModuleTools(toolsPath, moduleName);
          tools.push(...moduleTools);
        }
      }
    } catch (error) {
      console.error('Error discovering tools:', error);
    }
    
    return tools;
  }

  /**
   * Scans a specific module for tools
   * @param moduleName - Name of the module to scan
   * @returns Array of discovered tools from the module
   */
  async scanModule(moduleName: string): Promise<DiscoveredTool[]> {
    const tools: DiscoveredTool[] = [];
    
    for (const moduleType of ['core', 'custom']) {
      const toolsPath = join(this.baseDir, moduleType, moduleName, this.toolsDirName);
      
      if (existsSync(toolsPath)) {
        const moduleTools = await this.scanModuleTools(toolsPath, moduleName);
        tools.push(...moduleTools);
      }
    }
    
    return tools;
  }

  /**
   * Scans a module's tools directory
   * @param toolsPath - Path to the tools directory
   * @param moduleName - Name of the module
   * @returns Array of discovered tools
   */
  private async scanModuleTools(toolsPath: string, moduleName: string): Promise<DiscoveredTool[]> {
    const tools: DiscoveredTool[] = [];
    
    try {
      const files = await readdir(toolsPath);
      
      for (const file of files) {
        const filePath = join(toolsPath, file);
        const stats = await stat(filePath);
        
        if (stats.isFile() && this.isToolFile(file)) {
          const tool = await this.loadToolDefinition(filePath, moduleName);
          if (tool) {
            tools.push(tool);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning tools in ${toolsPath}:`, error);
    }
    
    return tools;
  }

  /**
   * Loads a tool definition from a file
   * @param filePath - Path to the tool file
   * @param moduleName - Name of the module
   * @returns Discovered tool or null if invalid
   */
  private async loadToolDefinition(filePath: string, moduleName: string): Promise<DiscoveredTool | null> {
    try {
      const ext = extname(filePath);
      
      if (ext === '.json') {
        const content = await readFile(filePath, 'utf-8');
        const definition = JSON.parse(content) as ToolDefinition;
        
        if (this.validateToolDefinition(definition)) {
          return {
            definition,
            moduleName,
            filePath
          };
        }
      } else if (ext === '.js' || ext === '.ts') {
        try {
          const module = await import(filePath);
          const definition = module.default || module.tool;
          
          if (definition && this.validateToolDefinition(definition)) {
            return {
              definition,
              moduleName,
              filePath
            };
          }
        } catch (importError) {
          console.error(`Error importing tool from ${filePath}:`, importError);
        }
      }
    } catch (error) {
      console.error(`Error loading tool from ${filePath}:`, error);
    }
    
    return null;
  }

  /**
   * Validates a tool definition
   * @param definition - Tool definition to validate
   * @returns True if valid, false otherwise
   */
  private validateToolDefinition(definition: any): definition is ToolDefinition {
    if (!definition || typeof definition !== 'object') {
      return false;
    }
    
    if (!definition.name || typeof definition.name !== 'string') {
      return false;
    }
    
    if (!definition.description || typeof definition.description !== 'string') {
      return false;
    }
    
    if (!definition.inputSchema || typeof definition.inputSchema !== 'object') {
      return false;
    }
    
    if (!definition.handler && !definition.handlerPath) {
      return false;
    }
    
    const validScopes: ToolScope[] = ['remote', 'local', 'all'];
    if (!definition.scope || !validScopes.includes(definition.scope)) {
      return false;
    }
    
    return true;
  }

  /**
   * Checks if a file is a tool definition file
   * @param filename - Name of the file
   * @returns True if it's a tool file, false otherwise
   */
  private isToolFile(filename: string): boolean {
    const validExtensions = ['.json', '.js', '.ts'];
    const ext = extname(filename);
    
    return validExtensions.includes(ext) && 
           !filename.includes('.spec.') && 
           !filename.includes('.test.') &&
           !filename.startsWith('_') &&
           filename !== 'index.js' &&
           filename !== 'index.ts';
  }

  /**
   * Gets all directories in a path
   * @param path - Path to scan
   * @returns Array of directory names
   */
  private async getDirectories(path: string): Promise<string[]> {
    try {
      const entries = await readdir(path);
      const dirs: string[] = [];
      
      for (const entry of entries) {
        const fullPath = join(path, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          dirs.push(entry);
        }
      }
      
      return dirs;
    } catch {
      return [];
    }
  }
}