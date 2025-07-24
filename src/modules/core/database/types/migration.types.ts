/**
 * Migration definition.
 */
export interface IMigration {
  module: string;
  version: string;
  filename: string;
  sql: string;
  checksum: string;
}

/**
 * Executed migration record.
 */
export interface IExecutedMigration extends IMigration {
  executedAt: string;
  name?: string;
}
