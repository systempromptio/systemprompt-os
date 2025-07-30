/**
 * Config service implementation.
 * @module modules/core/config/services/config.service
 */

import type {
 ConfigValue, IConfigEntry, IConfigService, IMcpServerConfig, IMcpServerEntry
} from '@/modules/core/config/types/index';
import type {
 IConfigsRow, IMcpServersRow, McpServersScope, McpServersStatus, McpServersTransport
} from '@/modules/core/config/types/database.generated';
import { DatabaseService } from '@/modules/core/database/services/database.service';

/**
 * Service for managing configuration with singleton pattern.
 * @class ConfigService
 */
export class ConfigService implements IConfigService {
  private static instance: ConfigService | undefined;
  private databaseService!: DatabaseService;
  private initialized = false;

  /**
   * Private constructor for singleton pattern. Private constructor for singleton.
   */
  private constructor() {
    Object.seal(this);
  }

  /**
   * Get singleton instance.
   * @returns {ConfigService} The singleton instance.
   */
  public static getInstance(): ConfigService {
    ConfigService.instance ??= new ConfigService();
    return ConfigService.instance;
  }

  /**
   * Initialize the service.
   * @returns {Promise<void>} Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.databaseService = DatabaseService.getInstance();
    this.initialized = true;
  }

  /**
   * Get a configuration value.
   * @param {string} key - Configuration key.
   * @returns {Promise<ConfigValue>} Configuration value.
   */
  async get(key: string): Promise<ConfigValue> {
    const query = 'SELECT * FROM configs WHERE key = ? LIMIT 1';
    const rows = await this.databaseService.query<IConfigsRow>(query, [key]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const result = rows[0];
    if (!result) {
      return null;
    }
    try {
      return JSON.parse(result.value);
    } catch {
      return result.value;
    }
  }

  /**
   * Set a configuration value.
   * @param {string} key - Configuration key.
   * @param {ConfigValue} value - Configuration value.
   * @returns {Promise<void>} Promise that resolves when value is set.
   */
  async set(key: string, value: ConfigValue): Promise<void> {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

    const query = `
      INSERT INTO configs (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.databaseService.execute(query, [key, serializedValue]);
  }

  /**
   * Delete a configuration value.
   * @param {string} key - Configuration key.
   * @returns {Promise<void>} Promise that resolves when value is deleted.
   */
  async delete(key: string): Promise<void> {
    const query = 'DELETE FROM configs WHERE key = ?';
    await this.databaseService.execute(query, [key]);
  }

  /**
   * List all configuration entries.
   * @returns {Promise<IConfigEntry[]>} All configuration entries.
   */
  async list(): Promise<IConfigEntry[]> {
    const query = 'SELECT * FROM configs ORDER BY key';
    const rows = await this.databaseService.query<IConfigsRow>(query);

    return rows.map(row => { return {
      key: row.key,
      value: this.parseValue(row.value),
      description: row.description ?? '',
      createdAt: new Date(row.created_at || ''),
      updatedAt: new Date(row.updated_at || '')
    } as IConfigEntry });
  }

  /**
   * Validate configuration.
   * @returns {Promise<{ valid: boolean; errors?: string[] }>} Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    try {
      const query = 'SELECT COUNT(*) as count FROM configs';
      await this.databaseService.query(query);
    } catch (error) {
      errors.push(`Database validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const EMPTY_ERRORS = 0;
    if (errors.length > EMPTY_ERRORS) {
      return {
        valid: false,
        errors,
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Parse configuration value from database.
   * @param {string} value - Raw value from database.
   * @returns {ConfigValue} Parsed configuration value.
   */
  private parseValue(value: string): ConfigValue {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Add a new MCP server configuration.
   * @param {IMcpServerConfig} config - MCP server configuration.
   * @returns {Promise<void>} Promise that resolves when server is added.
   */
  async addMcpServer(config: IMcpServerConfig): Promise<void> {
    const query = `
      INSERT INTO mcp_servers (
        name, command, args, env, scope, transport, description, metadata, oauth_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const args = config.args ? JSON.stringify(config.args) : null;
    const env = config.env ? JSON.stringify(config.env) : null;
    const metadata = config.metadata ? JSON.stringify(config.metadata) : null;
    const oauthConfig = config.oauthConfig ? JSON.stringify(config.oauthConfig) : null;

    await this.databaseService.execute(query, [
      config.name,
      config.command,
      args,
      env,
      config.scope || 'local',
      config.transport || 'stdio',
      config.description || null,
      metadata,
      oauthConfig
    ]);
  }

  /**
   * Delete an MCP server configuration.
   * @param {string} name - MCP server name.
   * @returns {Promise<void>} Promise that resolves when server is deleted.
   */
  async deleteMcpServer(name: string): Promise<void> {
    const query = 'DELETE FROM mcp_servers WHERE name = ?';
    await this.databaseService.execute(query, [name]);
  }

  /**
   * Get an MCP server configuration by name.
   * @param {string} name - MCP server name.
   * @returns {Promise<IMcpServerEntry | null>} MCP server entry or null if not found.
   */
  async getMcpServer(name: string): Promise<IMcpServerEntry | null> {
    const query = 'SELECT * FROM mcp_servers WHERE name = ? LIMIT 1';
    const rows = await this.databaseService.query<IMcpServersRow>(query, [name]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.mapRowToMcpServerEntry(row);
  }

  /**
   * List all MCP server configurations.
   * @returns {Promise<IMcpServerEntry[]>} Array of MCP server entries.
   */
  async listMcpServers(): Promise<IMcpServerEntry[]> {
    const query = 'SELECT * FROM mcp_servers ORDER BY name';
    const rows = await this.databaseService.query<IMcpServersRow>(query);

    return rows.map(row => { return this.mapRowToMcpServerEntry(row) });
  }

  /**
   * Update MCP server status.
   * @param {string} name - MCP server name.
   * @param {McpServersStatus} status - New status.
   * @param {string} [error] - Error message if status is 'error'.
   * @returns {Promise<void>} Promise that resolves when status is updated.
   */
  async updateMcpServerStatus(name: string, status: McpServersStatus, error?: string): Promise<void> {
    const query = `
      UPDATE mcp_servers 
      SET status = ?, last_error = ?, last_started_at = CASE WHEN ? = 'active' THEN CURRENT_TIMESTAMP ELSE last_started_at END
      WHERE name = ?
    `;

    await this.databaseService.execute(query, [status, error || null, status, name]);
  }

  /**
   * Map database row to MCP server entry.
   * @param {IMcpServersRow} row - Database row.
   * @returns {IMcpServerEntry} MCP server entry.
   */
  private mapRowToMcpServerEntry(row: IMcpServersRow): IMcpServerEntry {
    return {
      id: row.id,
      name: row.name,
      command: row.command,
      args: row.args ? JSON.parse(row.args) : null,
      env: row.env ? JSON.parse(row.env) : null,
      scope: row.scope,
      transport: row.transport,
      status: row.status,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      oauthConfig: row.oauth_config ? JSON.parse(row.oauth_config) : null,
      createdAt: new Date(row.created_at || ''),
      updatedAt: new Date(row.updated_at || ''),
      lastStartedAt: row.last_started_at ? new Date(row.last_started_at) : null,
      lastError: row.last_error
    };
  }
}
