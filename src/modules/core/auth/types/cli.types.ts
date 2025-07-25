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
    [key: string]: any;
  };
    options: Record<string, any>;
    cwd: string;
}
