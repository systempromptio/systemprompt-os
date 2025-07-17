/**
 * Base module interface that all modules must implement
 */

export interface Module {
  /**
   * Module name (must match directory name)
   */
  name: string;
  
  /**
   * Module type
   */
  type: 'daemon' | 'service' | 'plugin';
  
  /**
   * Module version
   */
  version: string;
  
  /**
   * Module description
   */
  description: string;
  
  /**
   * Initialize the module
   */
  initialize(): Promise<void>;
  
  /**
   * Shutdown the module gracefully
   */
  shutdown(): Promise<void>;
}

export interface ModuleConfig {
  name: string;
  type: 'daemon' | 'service' | 'plugin';
  version: string;
  description: string;
  author?: string;
  dependencies?: string[];
  config?: Record<string, any>;
}