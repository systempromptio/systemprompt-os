/**
 * @fileoverview Extension module - Extension and module management
 * @module modules/core/extension
 */

// Module interface defined locally
export interface ModuleInterface {
  name: string;
  version: string;
  type: 'core' | 'service' | 'extension';
  initialize(context: { config?: any; logger?: any }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { parse as parseYaml } from 'yaml';

interface ExtensionInfo {
  name: string;
  type: 'module' | 'server';
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  path: string;
}

export class ExtensionModule implements ModuleInterface {
  name = 'extension';
  version = '1.0.0';
  type = 'service' as const;
  
  private config: any;
  private logger: any;
  private extensions: Map<string, ExtensionInfo> = new Map();
  
  async initialize(context: { config?: any; logger?: any }): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;
    
    // Ensure extension directories exist
    const paths = [
      this.config.modulesPath || './src/modules',
      this.config.extensionsPath || './extensions',
      join(this.config.extensionsPath || './extensions', 'modules'),
      join(this.config.extensionsPath || './extensions', 'servers')
    ];
    
    paths.forEach(path => {
      const absolutePath = resolve(process.cwd(), path);
      if (!existsSync(absolutePath)) {
        mkdirSync(absolutePath, { recursive: true });
        this.logger?.info(`Created directory: ${absolutePath}`);
      }
    });
    
    // Discover extensions
    if (this.config.autoDiscover !== false) {
      await this.discoverExtensions();
    }
    
    this.logger?.info('Extension module initialized');
  }
  
  async start(): Promise<void> {
    this.logger?.info('Extension module started');
  }
  
  async stop(): Promise<void> {
    this.logger?.info('Extension module stopped');
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const modulesPath = resolve(process.cwd(), this.config.modulesPath || './src/modules');
      
      if (!existsSync(modulesPath)) {
        return { healthy: false, message: 'Modules directory not found' };
      }
      
      return { healthy: true };
    } catch (error) {
      return { healthy: false, message: `Health check failed: ${error}` };
    }
  }
  
  /**
   * Discover all installed extensions
   */
  async discoverExtensions(): Promise<void> {
    this.extensions.clear();
    
    // Discover core modules
    const coreModulesPath = resolve(process.cwd(), this.config.modulesPath || './src/modules', 'core');
    if (existsSync(coreModulesPath)) {
      this.discoverInDirectory(coreModulesPath, 'module');
    }
    
    // Discover custom modules
    const customModulesPath = resolve(process.cwd(), this.config.modulesPath || './src/modules', 'custom');
    if (existsSync(customModulesPath)) {
      this.discoverInDirectory(customModulesPath, 'module');
    }
    
    // Discover extension modules
    const extModulesPath = resolve(process.cwd(), this.config.extensionsPath || './extensions', 'modules');
    if (existsSync(extModulesPath)) {
      this.discoverInDirectory(extModulesPath, 'module');
    }
    
    // Discover extension servers
    const extServersPath = resolve(process.cwd(), this.config.extensionsPath || './extensions', 'servers');
    if (existsSync(extServersPath)) {
      this.discoverInDirectory(extServersPath, 'server');
    }
    
    this.logger?.info(`Discovered ${this.extensions.size} extensions`);
  }
  
  private discoverInDirectory(dirPath: string, type: 'module' | 'server'): void {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      
      entries.forEach(entry => {
        if (entry.isDirectory()) {
          const extensionPath = join(dirPath, entry.name);
          const configFile = join(extensionPath, type === 'module' ? 'module.yaml' : 'server.yaml');
          
          if (existsSync(configFile)) {
            try {
              const config = parseYaml(readFileSync(configFile, 'utf-8'));
              
              this.extensions.set(config.name || entry.name, {
                name: config.name || entry.name,
                type,
                version: config.version || '0.0.0',
                description: config.description,
                author: config.author,
                dependencies: config.dependencies,
                path: extensionPath
              });
            } catch (error) {
              this.logger?.error(`Failed to load extension config from ${configFile}:`, error);
            }
          }
        }
      });
    } catch (error) {
      this.logger?.error(`Failed to discover extensions in ${dirPath}:`, error);
    }
  }
  
  /**
   * Get all extensions
   */
  getExtensions(type?: 'module' | 'server'): ExtensionInfo[] {
    if (type) {
      return Array.from(this.extensions.values()).filter(ext => ext.type === type);
    }
    return Array.from(this.extensions.values());
  }
  
  /**
   * Get extension info
   */
  getExtension(name: string): ExtensionInfo | undefined {
    return this.extensions.get(name);
  }
  
  /**
   * Validate extension structure
   */
  validateExtension(path: string, strict: boolean = false): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!existsSync(path)) {
      errors.push('Extension path does not exist');
      return { valid: false, errors };
    }
    
    // Check for module.yaml or server.yaml
    const moduleConfig = join(path, 'module.yaml');
    const serverConfig = join(path, 'server.yaml');
    
    let config: any;
    let type: 'module' | 'server' | undefined;
    
    if (existsSync(moduleConfig)) {
      type = 'module';
      try {
        config = parseYaml(readFileSync(moduleConfig, 'utf-8'));
      } catch (error) {
        errors.push(`Invalid module.yaml: ${error}`);
      }
    } else if (existsSync(serverConfig)) {
      type = 'server';
      try {
        config = parseYaml(readFileSync(serverConfig, 'utf-8'));
      } catch (error) {
        errors.push(`Invalid server.yaml: ${error}`);
      }
    } else {
      errors.push('No module.yaml or server.yaml found');
    }
    
    if (config) {
      // Validate required fields
      if (!config.name) errors.push('Missing required field: name');
      if (!config.version) errors.push('Missing required field: version');
      if (!config.type && type === 'module') errors.push('Missing required field: type');
      
      // Validate module structure
      if (type === 'module') {
        const indexFile = join(path, 'index.ts');
        if (!existsSync(indexFile) && strict) {
          errors.push('Missing index.ts file');
        }
        
        // Check for CLI commands if defined
        if (config.cli?.commands) {
          const cliDir = join(path, 'cli');
          if (!existsSync(cliDir)) {
            errors.push('CLI directory missing but commands are defined');
          } else {
            config.cli.commands.forEach((cmd: any) => {
              const cmdFile = join(cliDir, `${cmd.name}.ts`);
              if (!existsSync(cmdFile)) {
                errors.push(`CLI command file missing: cli/${cmd.name}.ts`);
              }
            });
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Install an extension
   */
  async installExtension(_name: string, _options: any = {}): Promise<void> {
    // This is a simplified version - in production you'd handle:
    // - Package manager integration
    // - Registry downloads
    // - Dependency resolution
    // - Version management
    
    throw new Error('Extension installation not yet implemented');
  }
  
  /**
   * Remove an extension
   */
  async removeExtension(name: string, preserveConfig: boolean = false): Promise<void> {
    const extension = this.extensions.get(name);
    
    if (!extension) {
      throw new Error(`Extension not found: ${name}`);
    }
    
    // Prevent removal of core modules
    if (extension.path.includes('/core/')) {
      throw new Error('Cannot remove core modules');
    }
    
    // Remove the extension directory
    if (!preserveConfig) {
      rmSync(extension.path, { recursive: true, force: true });
      this.logger?.info(`Removed extension: ${name}`);
    } else {
      // Keep config files, remove everything else
      // This would need more sophisticated implementation
      this.logger?.info(`Removed extension (preserved config): ${name}`);
    }
    
    // Re-discover extensions
    await this.discoverExtensions();
  }
}