/**
 * @fileoverview State persistence service for managing application state storage
 * @module services/state-persistence
 * @since 1.0.0
 * 
 * @remarks
 * This service handles all state persistence operations including saving and loading
 * tasks, sessions, logs, and reports. It implements filesystem-based storage with
 * automatic backups and cleanup mechanisms.
 * 
 * @example
 * ```typescript
 * import { StatePersistence } from './services/state-persistence';
 * 
 * const persistence = StatePersistence.getInstance();
 * 
 * // Save a task
 * await persistence.saveTask({
 *   id: 'task-123',
 *   description: 'Build feature',
 *   status: 'in_progress',
 *   // ... other fields
 * });
 * 
 * // Load all tasks
 * const tasks = await persistence.loadTasks();
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { Task } from '../types/task.js';
import { validateTaskId } from '../utils/id-validation.js';
import { ServiceError } from '../types/shared.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration options for state persistence
 * 
 * @interface PersistenceConfig
 * @since 1.0.0
 */
export interface PersistenceConfig {
  /**
   * Storage type (currently only filesystem is supported)
   */
  type: 'filesystem';
  
  /**
   * Base directory path for storing state files
   */
  basePath?: string;
}

/**
 * Structure of persisted application state
 * 
 * @interface PersistedState
 * @since 1.0.0
 */
export interface PersistedState {
  /**
   * Array of all tasks
   */
  tasks: Task[];
  
  /**
   * Array of active sessions
   */
  sessions: Array<{
    id: string;
    type: string;
    status: string;
    created_at: string;
    task_id?: string;
  }>;
  
  /**
   * Aggregated metrics
   */
  metrics: {
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    average_completion_time: number;
  };
  
  /**
   * ISO timestamp of last save
   */
  last_saved: string;
}

/**
 * Node.js error with code property
 * @internal
 */
interface NodeError extends Error {
  code?: string;
}

/**
 * Report structure for persistence
 * 
 * @interface Report
 * @since 1.0.0
 */
export interface Report {
  /**
   * Unique report identifier
   */
  id: string;
  
  /**
   * Report type/category
   */
  type: string;
  
  /**
   * ISO timestamp of report creation
   */
  timestamp: string;
  
  /**
   * Report data payload
   */
  data: Record<string, unknown>;
}

/**
 * Manages state persistence for the application
 * 
 * @class StatePersistence
 * @extends EventEmitter
 * @since 1.0.0
 * 
 * @remarks
 * This class implements a singleton pattern and provides methods for:
 * - Saving and loading application state
 * - Managing task persistence
 * - Storing session logs
 * - Creating backups with automatic cleanup
 * - Generating reports
 * 
 * Events emitted:
 * - 'state:saved' - When state is successfully saved
 * - 'state:loaded' - When state is successfully loaded
 * - 'state:save-error' - When state save fails
 * - 'autosave:triggered' - When auto-save runs
 * - 'shutdown:save' - When service is shutting down
 */
export class StatePersistence extends EventEmitter {
  private static instance: StatePersistence;
  private config: PersistenceConfig;
  private saveInterval: NodeJS.Timeout | null = null;
  private statePath: string;
  
  private constructor(config?: PersistenceConfig) {
    super();
    this.config = config || {
      type: 'filesystem',
      basePath: process.env.STATE_PATH || './coding-agent-state'
    };
    
    this.statePath = this.config.basePath || process.env.STATE_PATH || './coding-agent-state';
    this.initializeStorage();
  }
  
  /**
   * Gets singleton instance of StatePersistence
   * 
   * @param config - Optional configuration for persistence
   * @returns The singleton StatePersistence instance
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * const persistence = StatePersistence.getInstance({
   *   type: 'filesystem',
   *   basePath: './my-state-dir'
   * });
   * ```
   */
  static getInstance(config?: PersistenceConfig): StatePersistence {
    if (!StatePersistence.instance) {
      StatePersistence.instance = new StatePersistence(config);
    }
    return StatePersistence.instance;
  }
  
  /**
   * Initializes storage directories and auto-save
   * 
   * @private
   * @since 1.0.0
   */
  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.statePath, { recursive: true });
      
      await Promise.all([
        fs.mkdir(path.join(this.statePath, 'tasks'), { recursive: true }),
        fs.mkdir(path.join(this.statePath, 'sessions'), { recursive: true }),
        fs.mkdir(path.join(this.statePath, 'logs'), { recursive: true }),
        fs.mkdir(path.join(this.statePath, 'reports'), { recursive: true })
      ]);
      
      logger.info(`State persistence initialized at: ${this.statePath}`);
    } catch (error) {
      logger.error('Failed to initialize state storage:', error);
    }
    
    this.saveInterval = setInterval(() => {
      this.autoSave().catch((error) => 
        logger.error('Auto-save failed:', error)
      );
    }, 30000);
  }
  
  /**
   * Saves application state to storage
   * 
   * @param state - The application state to save
   * @since 1.0.0
   * 
   * @remarks
   * Creates a backup of existing state before saving.
   * Maintains up to 10 backups with automatic cleanup.
   * 
   * @example
   * ```typescript
   * await persistence.saveState({
   *   tasks: allTasks,
   *   sessions: activeSessions,
   *   metrics: calculatedMetrics,
   *   last_saved: new Date().toISOString()
   * });
   * ```
   */
  async saveState(state: PersistedState): Promise<void> {
    const stateFile = path.join(this.statePath, 'state.json');
    const backupFile = path.join(this.statePath, `state.backup.${Date.now()}.json`);
    
    try {
      try {
        const existing = await fs.readFile(stateFile, 'utf-8');
        await fs.writeFile(backupFile, existing);
        await this.cleanupBackups();
      } catch (error) {
        // No existing state file, continue
      }
      
      await fs.writeFile(
        stateFile,
        JSON.stringify(state, null, 2),
        'utf-8'
      );
      
      this.emit('state:saved', { timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to save state:', error);
      this.emit('state:save-error', error);
    }
  }
  
  /**
   * Loads application state from storage
   * 
   * @returns The loaded state or null if no state exists
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * const state = await persistence.loadState();
   * if (state) {
   *   console.log(`Loaded ${state.tasks.length} tasks`);
   * }
   * ```
   */
  async loadState(): Promise<PersistedState | null> {
    const stateFile = path.join(this.statePath, 'state.json');
    
    try {
      const data = await fs.readFile(stateFile, 'utf-8');
      const state = JSON.parse(data) as PersistedState;
      
      this.emit('state:loaded', { timestamp: new Date().toISOString() });
      return state;
    } catch (error) {
      const nodeError = error as NodeError;
      if (nodeError.code !== 'ENOENT') {
        logger.error('Failed to load state:', error);
      }
      return null;
    }
  }
  
  /**
   * Saves a single task to storage
   * 
   * @param task - The task to save
   * @throws {ServiceError} If task save fails
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * await persistence.saveTask({
   *   id: 'task-123',
   *   description: 'Implement login',
   *   status: 'in_progress',
   *   // ... other fields
   * });
   * ```
   */
  async saveTask(task: Task): Promise<void> {
    const safeId = validateTaskId(task.id);
    const taskFile = path.join(this.statePath, 'tasks', `${safeId}.json`);
    
    try {
      await fs.writeFile(
        taskFile,
        JSON.stringify(task, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error(`Failed to save task ${task.id}:`, error);
      throw new ServiceError(
        `Failed to save task ${task.id}`,
        'TASK_SAVE_ERROR',
        500,
        error
      );
    }
  }
  
  /**
   * Loads all tasks from storage
   * 
   * @returns Array of loaded tasks
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * const tasks = await persistence.loadTasks();
   * console.log(`Loaded ${tasks.length} tasks from disk`);
   * ```
   */
  async loadTasks(): Promise<Task[]> {
    const tasksDir = path.join(this.statePath, 'tasks');
    
    try {
      const files = await fs.readdir(tasksDir);
      const tasks: Task[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(
              path.join(tasksDir, file),
              'utf-8'
            );
            tasks.push(JSON.parse(data));
          } catch (error) {
            logger.error(`Failed to load task ${file}:`, error);
          }
        }
      }
      
      return tasks;
    } catch (error) {
      logger.error('Failed to load tasks:', error);
      return [];
    }
  }
  
  /**
   * Saves session log to storage
   * 
   * @param sessionId - The session ID
   * @param log - The log content to append
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * await persistence.saveSessionLog('session-123', 'Task started at 10:00 AM');
   * ```
   */
  async saveSessionLog(sessionId: string, log: string): Promise<void> {
    const logFile = path.join(
      this.statePath,
      'logs',
      `session_${sessionId}_${Date.now()}.log`
    );
    
    try {
      await fs.appendFile(logFile, log + '\n', 'utf-8');
    } catch (error) {
      logger.error(`Failed to save session log:`, error);
    }
  }
  
  /**
   * Saves report to storage
   * 
   * @param reportId - Unique identifier for the report
   * @param report - The report data to save
   * @returns The path to the saved report file
   * @throws {ServiceError} If report save fails
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * const reportPath = await persistence.saveReport('report-123', {
   *   id: 'report-123',
   *   type: 'task-summary',
   *   timestamp: new Date().toISOString(),
   *   data: { taskCount: 10, completionRate: 0.8 }
   * });
   * ```
   */
  async saveReport(reportId: string, report: Report): Promise<string> {
    const reportFile = path.join(
      this.statePath,
      'reports',
      `report_${reportId}_${Date.now()}.json`
    );
    
    try {
      await fs.writeFile(
        reportFile,
        JSON.stringify(report, null, 2),
        'utf-8'
      );
      return reportFile;
    } catch (error) {
      logger.error(`Failed to save report:`, error);
      throw new ServiceError(
        'Failed to save report',
        'REPORT_SAVE_ERROR',
        500,
        error
      );
    }
  }
  
  /**
   * Cleans up old backup files, keeping only the last 10
   * 
   * @private
   * @since 1.0.0
   */
  private async cleanupBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.statePath);
      const backups = files
        .filter(f => f.startsWith('state.backup.'))
        .sort()
        .reverse();
      
      for (let i = 10; i < backups.length; i++) {
        await fs.unlink(path.join(this.statePath, backups[i]));
      }
    } catch (error) {
      logger.error('Failed to cleanup backups:', error);
    }
  }
  
  /**
   * Triggers auto-save event
   * 
   * @private
   * @since 1.0.0
   */
  private async autoSave(): Promise<void> {
    this.emit('autosave:triggered');
  }
  
  /**
   * Deletes a task from storage
   * 
   * @param taskId - The ID of the task to delete
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * await persistence.deleteTask('task-123');
   * ```
   */
  async deleteTask(taskId: string): Promise<void> {
    const safeId = validateTaskId(taskId);
    const taskFile = path.join(this.statePath, 'tasks', `${safeId}.json`);
    
    logger.debug(`[StatePersistence] Deleting task file: ${taskFile}`);
    
    try {
      await fs.unlink(taskFile);
      logger.debug(`[StatePersistence] Successfully deleted task file: ${taskId}.json`);
    } catch (error) {
      const nodeError = error as NodeError;
      if (nodeError.code === 'ENOENT') {
        logger.debug(`[StatePersistence] Task file not found: ${taskFile}`);
      } else {
        logger.error(`[StatePersistence] Failed to delete task ${taskId}:`, error);
      }
    }
  }
  
  /**
   * Shuts down the persistence service
   * 
   * @since 1.0.0
   * 
   * @remarks
   * Clears the auto-save interval and emits a shutdown event.
   * Should be called during application shutdown.
   * 
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await persistence.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  async shutdown(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    
    this.emit('shutdown:save');
  }
}