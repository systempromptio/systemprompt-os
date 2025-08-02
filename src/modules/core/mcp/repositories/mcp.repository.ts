/**
 * MCP Repository classes for database operations.
 */

import type { IDatabaseService } from '@/modules/core/database/types/manual';
import type {
  IMCPContext,
  IMCPTool,
  IMCPResource,
  IMCPPrompt,
  IMCPContextPermission,
  ICreateContextDto,
  IUpdateContextDto,
  ICreateToolDto,
  ICreateResourceDto,
  ICreatePromptDto
} from '../types/manual';

/**
 * Repository for MCP Contexts
 */
export class MCPContextRepository {
  constructor(private db: IDatabaseService) {}

  async create(data: ICreateContextDto): Promise<IMCPContext> {
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await this.db.execute(
      `INSERT INTO mcp_contexts (id, name, description, version, server_config, auth_config, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.version || '1.0.0',
        JSON.stringify(data.server_config || {}),
        data.auth_config ? JSON.stringify(data.auth_config) : null,
        null // TODO: Get from auth context
      ]
    );
    const result = await this.db.query<IMCPContext>(
      'SELECT * FROM mcp_contexts WHERE id = ?',
      [id]
    );
    return this.parseContext(result[0]);
  }

  async update(id: string, data: IUpdateContextDto): Promise<IMCPContext> {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.version !== undefined) {
      updates.push('version = ?');
      values.push(data.version);
    }
    if (data.server_config !== undefined) {
      updates.push('server_config = ?');
      values.push(JSON.stringify(data.server_config));
    }
    if (data.auth_config !== undefined) {
      updates.push('auth_config = ?');
      values.push(JSON.stringify(data.auth_config));
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await this.db.execute(
      `UPDATE mcp_contexts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const result = await this.db.query<IMCPContext>(
      'SELECT * FROM mcp_contexts WHERE id = ?',
      [id]
    );
    return this.parseContext(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM mcp_contexts WHERE id = ?', [id]);
  }

  async findById(id: string): Promise<IMCPContext | null> {
    const result = await this.db.query<IMCPContext>(
      'SELECT * FROM mcp_contexts WHERE id = ?',
      [id]
    );
    return result[0] ? this.parseContext(result[0]) : null;
  }

  async findByName(name: string): Promise<IMCPContext | null> {
    const result = await this.db.query<IMCPContext>(
      'SELECT * FROM mcp_contexts WHERE name = ?',
      [name]
    );
    return result[0] ? this.parseContext(result[0]) : null;
  }

  async list(options?: { limit?: number; offset?: number; is_active?: boolean }): Promise<IMCPContext[]> {
    let query = 'SELECT * FROM mcp_contexts';
    const values: any[] = [];
    const conditions: string[] = [];
    
    if (options?.is_active !== undefined) {
      conditions.push('is_active = ?');
      values.push(options.is_active ? 1 : 0);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options?.limit !== undefined) {
      query += ' LIMIT ?';
      values.push(options.limit);
      
      if (options?.offset !== undefined) {
        query += ' OFFSET ?';
        values.push(options.offset);
      }
    }
    
    const result = await this.db.query<IMCPContext>(query, values);
    return result.map(r => this.parseContext(r));
  }

  private parseContext(row: any): IMCPContext {
    return {
      ...row,
      server_config: typeof row.server_config === 'string' ? JSON.parse(row.server_config) : row.server_config,
      auth_config: row.auth_config ? (typeof row.auth_config === 'string' ? JSON.parse(row.auth_config) : row.auth_config) : undefined,
      is_active: Boolean(row.is_active),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}

/**
 * Repository for MCP Tools
 */
export class MCPToolRepository {
  constructor(private db: IDatabaseService) {}

  async create(data: ICreateToolDto & { context_id: string }): Promise<IMCPTool> {
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await this.db.execute(
      `INSERT INTO mcp_tools (
        id, context_id, name, description, input_schema, annotations,
        required_permission, required_role, handler_type, handler_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.context_id,
        data.name,
        data.description || null,
        JSON.stringify(data.input_schema || {}),
        data.annotations ? JSON.stringify(data.annotations) : null,
        data.required_permission || null,
        data.required_role || null,
        data.handler_type,
        JSON.stringify(data.handler_config || {})
      ]
    );
    const result = await this.db.query<IMCPTool>(
      'SELECT * FROM mcp_tools WHERE id = ?',
      [id]
    );
    return this.parseTool(result[0]);
  }

  async update(id: string, data: Partial<ICreateToolDto>): Promise<IMCPTool> {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.input_schema !== undefined) {
      updates.push('input_schema = ?');
      values.push(JSON.stringify(data.input_schema));
    }
    if (data.annotations !== undefined) {
      updates.push('annotations = ?');
      values.push(JSON.stringify(data.annotations));
    }
    if (data.required_permission !== undefined) {
      updates.push('required_permission = ?');
      values.push(data.required_permission);
    }
    if (data.required_role !== undefined) {
      updates.push('required_role = ?');
      values.push(data.required_role);
    }
    if (data.handler_type !== undefined) {
      updates.push('handler_type = ?');
      values.push(data.handler_type);
    }
    if (data.handler_config !== undefined) {
      updates.push('handler_config = ?');
      values.push(JSON.stringify(data.handler_config));
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await this.db.execute(
      `UPDATE mcp_tools SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const result = await this.db.query<IMCPTool>(
      'SELECT * FROM mcp_tools WHERE id = ?',
      [id]
    );
    return this.parseTool(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM mcp_tools WHERE id = ?', [id]);
  }

  async findByContextId(contextId: string): Promise<IMCPTool[]> {
    const result = await this.db.query<IMCPTool>(
      'SELECT * FROM mcp_tools WHERE context_id = ? AND is_active = 1 ORDER BY name',
      [contextId]
    );
    return result.map(r => this.parseTool(r));
  }

  async findById(id: string): Promise<IMCPTool | null> {
    const result = await this.db.query<IMCPTool>(
      'SELECT * FROM mcp_tools WHERE id = ?',
      [id]
    );
    return result[0] ? this.parseTool(result[0]) : null;
  }

  private parseTool(row: any): IMCPTool {
    return {
      ...row,
      input_schema: typeof row.input_schema === 'string' ? JSON.parse(row.input_schema) : row.input_schema,
      annotations: row.annotations ? (typeof row.annotations === 'string' ? JSON.parse(row.annotations) : row.annotations) : undefined,
      handler_config: typeof row.handler_config === 'string' ? JSON.parse(row.handler_config) : row.handler_config,
      is_active: Boolean(row.is_active),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}

/**
 * Repository for MCP Resources
 */
export class MCPResourceRepository {
  constructor(private db: IDatabaseService) {}

  async create(data: ICreateResourceDto & { context_id: string }): Promise<IMCPResource> {
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await this.db.execute(
      `INSERT INTO mcp_resources (
        id, context_id, uri, name, description, mime_type, annotations,
        content_type, content, required_permission, required_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.context_id,
        data.uri,
        data.name,
        data.description || null,
        data.mime_type || 'text/plain',
        data.annotations ? JSON.stringify(data.annotations) : null,
        data.content_type,
        JSON.stringify(data.content),
        data.required_permission || null,
        data.required_role || null
      ]
    );
    const result = await this.db.query<IMCPResource>(
      'SELECT * FROM mcp_resources WHERE id = ?',
      [id]
    );
    return this.parseResource(result[0]);
  }

  async update(id: string, data: Partial<ICreateResourceDto>): Promise<IMCPResource> {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.uri !== undefined) {
      updates.push('uri = ?');
      values.push(data.uri);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.mime_type !== undefined) {
      updates.push('mime_type = ?');
      values.push(data.mime_type);
    }
    if (data.annotations !== undefined) {
      updates.push('annotations = ?');
      values.push(JSON.stringify(data.annotations));
    }
    if (data.content_type !== undefined) {
      updates.push('content_type = ?');
      values.push(data.content_type);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(JSON.stringify(data.content));
    }
    if (data.required_permission !== undefined) {
      updates.push('required_permission = ?');
      values.push(data.required_permission);
    }
    if (data.required_role !== undefined) {
      updates.push('required_role = ?');
      values.push(data.required_role);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await this.db.execute(
      `UPDATE mcp_resources SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const result = await this.db.query<IMCPResource>(
      'SELECT * FROM mcp_resources WHERE id = ?',
      [id]
    );
    return this.parseResource(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM mcp_resources WHERE id = ?', [id]);
  }

  async findByContextId(contextId: string): Promise<IMCPResource[]> {
    const result = await this.db.query<IMCPResource>(
      'SELECT * FROM mcp_resources WHERE context_id = ? AND is_active = 1 ORDER BY uri',
      [contextId]
    );
    return result.map(r => this.parseResource(r));
  }

  async findById(id: string): Promise<IMCPResource | null> {
    const result = await this.db.query<IMCPResource>(
      'SELECT * FROM mcp_resources WHERE id = ?',
      [id]
    );
    return result[0] ? this.parseResource(result[0]) : null;
  }

  async getByUri(contextId: string, uri: string): Promise<IMCPResource | null> {
    const result = await this.db.query<IMCPResource>(
      'SELECT * FROM mcp_resources WHERE context_id = ? AND uri = ?',
      [contextId, uri]
    );
    return result[0] ? this.parseResource(result[0]) : null;
  }

  private parseResource(row: any): IMCPResource {
    return {
      ...row,
      annotations: row.annotations ? (typeof row.annotations === 'string' ? JSON.parse(row.annotations) : row.annotations) : undefined,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      is_active: Boolean(row.is_active),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}

/**
 * Repository for MCP Prompts
 */
export class MCPPromptRepository {
  constructor(private db: IDatabaseService) {}

  async create(data: ICreatePromptDto & { context_id: string }): Promise<IMCPPrompt> {
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await this.db.execute(
      `INSERT INTO mcp_prompts (
        id, context_id, name, description, arguments, annotations,
        template, required_permission, required_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.context_id,
        data.name,
        data.description || null,
        data.arguments ? JSON.stringify(data.arguments) : null,
        data.annotations ? JSON.stringify(data.annotations) : null,
        data.template,
        data.required_permission || null,
        data.required_role || null
      ]
    );
    const result = await this.db.query<IMCPPrompt>(
      'SELECT * FROM mcp_prompts WHERE id = ?',
      [id]
    );
    return this.parsePrompt(result[0]);
  }

  async update(id: string, data: Partial<ICreatePromptDto>): Promise<IMCPPrompt> {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.arguments !== undefined) {
      updates.push('arguments = ?');
      values.push(JSON.stringify(data.arguments));
    }
    if (data.annotations !== undefined) {
      updates.push('annotations = ?');
      values.push(JSON.stringify(data.annotations));
    }
    if (data.template !== undefined) {
      updates.push('template = ?');
      values.push(data.template);
    }
    if (data.required_permission !== undefined) {
      updates.push('required_permission = ?');
      values.push(data.required_permission);
    }
    if (data.required_role !== undefined) {
      updates.push('required_role = ?');
      values.push(data.required_role);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await this.db.execute(
      `UPDATE mcp_prompts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const result = await this.db.query<IMCPPrompt>(
      'SELECT * FROM mcp_prompts WHERE id = ?',
      [id]
    );
    return this.parsePrompt(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM mcp_prompts WHERE id = ?', [id]);
  }

  async findByContextId(contextId: string): Promise<IMCPPrompt[]> {
    const result = await this.db.query<IMCPPrompt>(
      'SELECT * FROM mcp_prompts WHERE context_id = ? AND is_active = 1 ORDER BY name',
      [contextId]
    );
    return result.map(r => this.parsePrompt(r));
  }

  async findById(id: string): Promise<IMCPPrompt | null> {
    const result = await this.db.query<IMCPPrompt>(
      'SELECT * FROM mcp_prompts WHERE id = ?',
      [id]
    );
    return result[0] ? this.parsePrompt(result[0]) : null;
  }

  async getByName(contextId: string, name: string): Promise<IMCPPrompt | null> {
    const result = await this.db.query<IMCPPrompt>(
      'SELECT * FROM mcp_prompts WHERE context_id = ? AND name = ?',
      [contextId, name]
    );
    return result[0] ? this.parsePrompt(result[0]) : null;
  }

  private parsePrompt(row: any): IMCPPrompt {
    return {
      ...row,
      arguments: row.arguments ? (typeof row.arguments === 'string' ? JSON.parse(row.arguments) : row.arguments) : undefined,
      annotations: row.annotations ? (typeof row.annotations === 'string' ? JSON.parse(row.annotations) : row.annotations) : undefined,
      is_active: Boolean(row.is_active),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}

/**
 * Repository for MCP Context Permissions
 */
export class MCPPermissionRepository {
  constructor(private db: IDatabaseService) {}

  async create(data: any): Promise<IMCPContextPermission> {
    const id = Math.random().toString(36).substring(2, 15);
    await this.db.execute(
      `INSERT INTO mcp_context_permissions (id, context_id, principal_type, principal_id, permission)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.context_id, 'user', data.principal_id, data.permission]
    );
    return {
      id,
      context_id: data.context_id,
      principal_type: 'user',
      principal_id: data.principal_id,
      permission: data.permission,
      created_at: data.granted_at || new Date()
    };
  }

  async grant(
    contextId: string,
    principalType: 'user' | 'role',
    principalId: string,
    permission: 'read' | 'write' | 'execute' | 'manage'
  ): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO mcp_context_permissions (context_id, principal_type, principal_id, permission)
       VALUES (?, ?, ?, ?)`,
      [contextId, principalType, principalId, permission]
    );
  }

  async revoke(
    contextId: string,
    principalId: string,
    permission: string
  ): Promise<void> {
    await this.db.execute(
      `DELETE FROM mcp_context_permissions 
       WHERE context_id = ? AND principal_id = ? AND permission = ?`,
      [contextId, principalId, permission]
    );
  }

  async hasPermission(
    contextId: string,
    principalId: string,
    permission: string
  ): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM mcp_context_permissions
       WHERE context_id = ? AND principal_id = ? AND permission = ?`,
      [contextId, principalId, permission]
    );
    return result[0].count > 0;
  }

  async check(
    contextId: string,
    userId?: string,
    roleIds?: string[],
    permission?: 'read' | 'write' | 'execute' | 'manage'
  ): Promise<boolean> {
    const conditions: string[] = ['context_id = ?'];
    const values: any[] = [contextId];
    
    if (permission) {
      conditions.push('permission = ?');
      values.push(permission);
    }
    
    const principalConditions: string[] = [];
    
    if (userId) {
      principalConditions.push('(principal_type = ? AND principal_id = ?)');
      values.push('user', userId);
    }
    
    if (roleIds && roleIds.length > 0) {
      principalConditions.push(`(principal_type = ? AND principal_id IN (${roleIds.map(() => '?').join(',')}))`);
      values.push('role', ...roleIds);
    }
    
    if (principalConditions.length > 0) {
      conditions.push(`(${principalConditions.join(' OR ')})`);
    }
    
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM mcp_context_permissions WHERE ${conditions.join(' AND ')}`,
      values
    );
    
    return result[0].count > 0;
  }

  async findByContextId(contextId: string): Promise<IMCPContextPermission[]> {
    const result = await this.db.query<IMCPContextPermission>(
      'SELECT * FROM mcp_context_permissions WHERE context_id = ? ORDER BY created_at DESC',
      [contextId]
    );
    return result.map(r => ({
      ...r,
      created_at: new Date(r.created_at)
    }));
  }
}