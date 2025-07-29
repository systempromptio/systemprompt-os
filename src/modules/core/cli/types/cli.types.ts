/**
 * CLI command types.
 */

export interface SetupArgs {
  action: 'install' | 'clean' | 'update' | 'validate';
  force?: boolean;
}
