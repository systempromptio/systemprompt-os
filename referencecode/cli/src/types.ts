/**
 * CLI types and interfaces
 */

export interface CommandModule {
  name: string;
  description: string;
  options?: CommandOption[];
  execute( args: any): Promise<void>;
}

export interface CommandOption {
  name: string;
  alias?: string;
  type: 'string' | 'boolean' | 'number';
  description: string;
  default?: any;
}

export interface CLICommand {
  name: string;
  description: string;
  options?: CommandOption[];
  execute?: (context: CLIContext) => Promise<void>;
}

export interface CLIContext {
  args: Record<string, any>;
  flags: Record<string, any>;
  cwd: string;
  env: Record<string, string>;
}