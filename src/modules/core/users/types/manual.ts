/**
 * Display options for CLI output formatting.
 */
export interface IDisplayOptions {
    format?: string;
}

/**
 * CLI arguments for updating a user.
 */
export interface IUpdateUserArgs {
    id?: string;
    email?: string;
    status?: string;
    format?: string;
}
