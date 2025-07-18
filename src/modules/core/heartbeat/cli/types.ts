/**
 * CLI types for heartbeat module
 */

export interface CLIOption {
  name: string;
  alias?: string;
  type: 'string' | 'boolean' | 'number';
  description: string;
  default?: any;
  required?: boolean;
}

export interface CLICommand {
  name: string;
  description: string;
  options?: CLIOption[];
  execute?: (context: CLIContext) => Promise<void>;
}

export interface CLIContext {
  args: Record<string, any>;
  flags: Record<string, any>;
  cwd: string;
  env: Record<string, string>;
}