/**
 *  * CLI context interface.
 */
export interface ICliContext {
  cwd: string;
  args: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 *  * CLI command interface.
 */
export interface ICliCommand {
  description: string;
  subcommands?: Record<string, ICliSubcommand>;
  execute?: (_context: ICliContext) => Promise<void>;
}

/**
 *  * CLI subcommand interface.
 */
export interface ICliSubcommand {
  description?: string;
  execute: (_context: ICliContext) => Promise<void>;
}
