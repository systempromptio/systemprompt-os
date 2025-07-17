/**
 * CLI command interface for module-provided commands
 */

export interface CLICommand {
  /**
   * Command name (without module prefix)
   */
  name: string;
  
  /**
   * Command description
   */
  description: string;
  
  /**
   * Command options
   */
  options?: CLIOption[];
  
  /**
   * Execute the command
   */
  execute(args: any, context: CLIContext): Promise<void>;
}

export interface CLIOption {
  /**
   * Option name (e.g., 'format')
   */
  name: string;
  
  /**
   * Short alias (e.g., 'f')
   */
  alias?: string;
  
  /**
   * Option type
   */
  type: 'string' | 'boolean' | 'number';
  
  /**
   * Option description
   */
  description: string;
  
  /**
   * Default value
   */
  default?: any;
  
  /**
   * Is this option required?
   */
  required?: boolean;
}

export interface CLIContext {
  /**
   * Module registry for accessing other modules
   */
  registry: any;
  
  /**
   * Configuration
   */
  config: any;
  
  /**
   * Logger
   */
  logger?: any;
}