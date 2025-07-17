/**
 * CLI types and interfaces
 */

export interface CommandModule {
  name: string;
  description: string;
  options?: CommandOption[];
  execute(args: any): Promise<void>;
}

export interface CommandOption {
  name: string;
  alias?: string;
  type: 'string' | 'boolean' | 'number';
  description: string;
  default?: any;
}