/**
 * @fileoverview MCP Statistics service for tracking usage and performance
 * @module modules/core/mcp/services
 */

import type { Logger } from '../../../types.js';
import type { MCPStats } from '../types/index.js';
import { DatabaseService } from '../../database/services/database.service.js';

export class MCPStatsService {
  private db: DatabaseService;
  private startTime: Date;
  private inMemoryStats = {
    tools: {
      executions: new Map<string, { total: number; successful: number; totalTime: number }>()
    },
    prompts: {
      executions: new Map<string, number>()
    },
    resources: {
      accesses: new Map<string, number>()
    }
  };
  
  constructor(private logger: Logger) {
    this.db = DatabaseService.getInstance();
    this.startTime = new Date();
  }
  
  /**
   * Record a tool execution
   */
  async recordToolExecution(
    toolName: string,
    success: boolean,
    durationMs: number
  ): Promise<void> {
    // Update in-memory stats
    const stats = this.inMemoryStats.tools.executions.get(toolName) || {
      total: 0,
      successful: 0,
      totalTime: 0
    };
    
    stats.total++;
    if (success) stats.successful++;
    stats.totalTime += durationMs;
    
    this.inMemoryStats.tools.executions.set(toolName, stats);
    
    // Persist to database
    try {
      await this.db.execute(
        `INSERT INTO mcp_stats (type, name, operation, success, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['tool', toolName, 'execute', success ? 1 : 0, durationMs, new Date().toISOString()]
      );
    } catch (error) {
      this.logger.error('Failed to record tool execution', error);
    }
  }
  
  /**
   * Record a prompt execution
   */
  async recordPromptExecution(promptName: string): Promise<void> {
    // Update in-memory stats
    const count = this.inMemoryStats.prompts.executions.get(promptName) || 0;
    this.inMemoryStats.prompts.executions.set(promptName, count + 1);
    
    // Persist to database
    try {
      await this.db.execute(
        `INSERT INTO mcp_stats (type, name, operation, success, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        ['prompt', promptName, 'execute', 1, new Date().toISOString()]
      );
    } catch (error) {
      this.logger.error('Failed to record prompt execution', error);
    }
  }
  
  /**
   * Record a resource access
   */
  async recordResourceAccess(
    resourceUri: string,
    operation: 'read' | 'write' | 'subscribe' | 'unsubscribe',
    success: boolean
  ): Promise<void> {
    // Update in-memory stats
    if (success) {
      const count = this.inMemoryStats.resources.accesses.get(resourceUri) || 0;
      this.inMemoryStats.resources.accesses.set(resourceUri, count + 1);
    }
    
    // Persist to database
    try {
      await this.db.execute(
        `INSERT INTO mcp_stats (type, name, operation, success, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        ['resource', resourceUri, operation, success ? 1 : 0, new Date().toISOString()]
      );
    } catch (error) {
      this.logger.error('Failed to record resource access', error);
    }
  }
  
  /**
   * Get aggregated statistics
   */
  async getStats(): Promise<MCPStats> {
    try {
      // Get tool stats from database
      const toolStats = await this.db.query<{
        name: string;
        total: number;
        successful: number;
        avg_duration: number;
      }>(`
        SELECT 
          name,
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          AVG(duration_ms) as avg_duration
        FROM mcp_stats
        WHERE type = 'tool'
        GROUP BY name
      `);
      
      // Get prompt stats from database
      const promptStats = await this.db.query<{
        name: string;
        total: number;
      }>(`
        SELECT name, COUNT(*) as total
        FROM mcp_stats
        WHERE type = 'prompt'
        GROUP BY name
      `);
      
      // Get resource stats from database
      const resourceStats = await this.db.query<{
        name: string;
        total: number;
      }>(`
        SELECT name, COUNT(*) as total
        FROM mcp_stats
        WHERE type = 'resource' AND success = 1
        GROUP BY name
      `);
      
      // Calculate aggregate tool statistics
      const totalToolExecutions = toolStats.reduce((sum, stat) => sum + stat.total, 0);
      const successfulToolExecutions = toolStats.reduce((sum, stat) => sum + stat.successful, 0);
      const averageToolTime = toolStats.length > 0
        ? toolStats.reduce((sum, stat) => sum + (stat.avg_duration || 0), 0) / toolStats.length
        : 0;
      
      // Build category statistics
      const toolsByCategory: Record<string, number> = {};
      const promptsByCategory: Record<string, number> = {};
      const resourcesByType: Record<string, number> = {};
      
      // Note: Categories would be derived from metadata, simplified here
      toolsByCategory['default'] = toolStats.length;
      promptsByCategory['default'] = promptStats.length;
      resourcesByType['default'] = resourceStats.length;
      
      return {
        tools: {
          total: toolStats.length,
          byCategory: toolsByCategory,
          executions: {
            total: totalToolExecutions,
            successful: successfulToolExecutions,
            failed: totalToolExecutions - successfulToolExecutions,
            averageTimeMs: Math.round(averageToolTime)
          }
        },
        prompts: {
          total: promptStats.length,
          byCategory: promptsByCategory,
          executions: promptStats.reduce((sum, stat) => sum + stat.total, 0)
        },
        resources: {
          total: resourceStats.length,
          byType: resourcesByType,
          accesses: resourceStats.reduce((sum, stat) => sum + stat.total, 0)
        },
        uptime: Date.now() - this.startTime.getTime(),
        lastScan: new Date() // Would be updated by discovery service
      };
    } catch (error) {
      this.logger.error('Failed to get stats', error);
      
      // Return basic stats from memory
      return this.getInMemoryStats();
    }
  }
  
  /**
   * Get stats from in-memory cache
   */
  private getInMemoryStats(): MCPStats {
    const toolStats = this.inMemoryStats.tools.executions;
    const promptStats = this.inMemoryStats.prompts.executions;
    const resourceStats = this.inMemoryStats.resources.accesses;
    
    let totalToolExecutions = 0;
    let successfulToolExecutions = 0;
    let totalToolTime = 0;
    
    for (const stats of toolStats.values()) {
      totalToolExecutions += stats.total;
      successfulToolExecutions += stats.successful;
      totalToolTime += stats.totalTime;
    }
    
    const averageToolTime = totalToolExecutions > 0 ? totalToolTime / totalToolExecutions : 0;
    
    return {
      tools: {
        total: toolStats.size,
        byCategory: { default: toolStats.size },
        executions: {
          total: totalToolExecutions,
          successful: successfulToolExecutions,
          failed: totalToolExecutions - successfulToolExecutions,
          averageTimeMs: Math.round(averageToolTime)
        }
      },
      prompts: {
        total: promptStats.size,
        byCategory: { default: promptStats.size },
        executions: Array.from(promptStats.values()).reduce((sum, count) => sum + count, 0)
      },
      resources: {
        total: resourceStats.size,
        byType: { default: resourceStats.size },
        accesses: Array.from(resourceStats.values()).reduce((sum, count) => sum + count, 0)
      },
      uptime: Date.now() - this.startTime.getTime(),
      lastScan: new Date()
    };
  }
  
  /**
   * Clear statistics
   */
  async clearStats(): Promise<void> {
    // Clear in-memory stats
    this.inMemoryStats.tools.executions.clear();
    this.inMemoryStats.prompts.executions.clear();
    this.inMemoryStats.resources.accesses.clear();
    
    // Clear database stats
    try {
      await this.db.execute('DELETE FROM mcp_stats');
      this.logger.info('Statistics cleared');
    } catch (error) {
      this.logger.error('Failed to clear statistics', error);
    }
  }
  
  /**
   * Export statistics
   */
  async exportStats(startDate?: Date, endDate?: Date): Promise<any[]> {
    try {
      let query = 'SELECT * FROM mcp_stats';
      const params: any[] = [];
      
      if (startDate || endDate) {
        const conditions: string[] = [];
        if (startDate) {
          conditions.push('created_at >= ?');
          params.push(startDate.toISOString());
        }
        if (endDate) {
          conditions.push('created_at <= ?');
          params.push(endDate.toISOString());
        }
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY created_at DESC';
      
      return await this.db.query(query, params);
    } catch (error) {
      this.logger.error('Failed to export statistics', error);
      throw error;
    }
  }
  
  /**
   * Get statistics for a specific component
   */
  async getComponentStats(
    type: 'tool' | 'prompt' | 'resource',
    name: string
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageDuration?: number;
    lastUsed?: Date;
  }> {
    try {
      const stats = await this.db.query<{
        total: number;
        successful: number;
        avg_duration: number | null;
        last_used: string;
      }>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          AVG(duration_ms) as avg_duration,
          MAX(created_at) as last_used
        FROM mcp_stats
        WHERE type = ? AND name = ?
      `, [type, name]);
      
      if (stats.length === 0) {
        return {
          total: 0,
          successful: 0,
          failed: 0
        };
      }
      
      const stat = stats[0];
      return {
        total: stat.total,
        successful: stat.successful,
        failed: stat.total - stat.successful,
        averageDuration: stat.avg_duration || undefined,
        lastUsed: stat.last_used ? new Date(stat.last_used) : undefined
      };
    } catch (error) {
      this.logger.error('Failed to get component stats', error);
      throw error;
    }
  }
}