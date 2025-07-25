/**
 * CLI context interface.
 */
export interface ICliContext {
    args: {
    type?: string;
    output?: string;
    algorithm?: string;
    format?: string;
    user?: string;
    role?: string;
    [key: string]: unknown;
  };
    options: Record<string, unknown>;
    cwd: string;
}
