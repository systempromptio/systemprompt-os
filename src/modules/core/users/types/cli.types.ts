/**
 * CLI arguments for the update user command.
 */
export interface IUpdateUserArgs {
  id?: string;
  email?: string;
  status?: string;
  format?: string;
}

/**
 * Options for displaying user information.
 */
export interface IDisplayOptions {
  format?: string;
}
