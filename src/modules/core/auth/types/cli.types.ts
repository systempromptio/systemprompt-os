/**
 *  * CLI context interface.
 */
export interface IICliContext {
  cwd: string;
  args: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 *  * CLI command interface.
 */
export interface IICliCommand {
  description: string;
  subcommands?: Record<string, ICliSubcommand>;
  execute?: (_context: ICliContext) => Promise<void>;
}

/**
 *  * CLI subcommand interface.
 */
export interface IICliSubcommand {
  description?: string;
  execute: (_context: ICliContext) => Promise<void>;
}
