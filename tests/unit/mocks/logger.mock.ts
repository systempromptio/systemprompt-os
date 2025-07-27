/**
 * Mock implementation of LoggerService for unit tests
 */
import { vi } from 'vitest';
import type { ILogger } from '@/modules/core/logger/types';

export const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
  access: vi.fn(),
  clearLogs: vi.fn().mockResolvedValue(undefined),
  getLogs: vi.fn().mockResolvedValue([]),
  setDatabaseService: vi.fn()
});

// Define LogSource enum here to avoid circular dependencies
export const LogSource = {
  AGENT: 'agent',
  BOOTSTRAP: 'bootstrap',
  CLI: 'cli',
  DATABASE: 'database',
  LOGGER: 'logger',
  AUTH: 'auth',
  MCP: 'mcp',
  SERVER: 'server',
  MODULES: 'modules',
  API: 'api',
  ACCESS: 'access',
  SCHEDULER: 'scheduler',
  SYSTEM: 'system',
  WEBHOOK: 'webhook',
  WORKFLOW: 'workflow',
  DEV: 'dev',
  EXECUTORS: 'executors',
  MONITOR: 'monitor',
  PERMISSIONS: 'permissions',
  USERS: 'users',
  TASKS: 'tasks'
};

export const setupLoggerMocks = () => {
  const mockLogger = createMockLogger();
  
  // Mock the LoggerService module
  vi.mock('@/modules/core/logger/services/logger.service', () => ({
    LoggerService: {
      getInstance: vi.fn(() => mockLogger),
      resetInstance: vi.fn()
    }
  }));

  // Mock the logger index module
  vi.mock('@/modules/core/logger/index', () => {
    const mockLoggerInstance = mockLogger;
    return {
      LoggerService: {
        getInstance: vi.fn(() => mockLoggerInstance),
        resetInstance: vi.fn()
      },
      getLoggerService: vi.fn(() => mockLoggerInstance),
      LogSource,
      isLoggerModule: vi.fn(),
      LoggerModule: vi.fn(),
      createModule: vi.fn(),
      initialize: vi.fn(),
      getLoggerModule: vi.fn(),
      handleError: vi.fn(),
      handleErrorAsync: vi.fn(),
      configureErrorHandling: vi.fn(),
      ErrorHandlingService: vi.fn(),
      ApplicationError: class ApplicationError extends Error {},
      ValidationError: class ValidationError extends Error {},
      AuthenticationError: class AuthenticationError extends Error {},
      AuthorizationError: class AuthorizationError extends Error {},
      DatabaseError: class DatabaseError extends Error {},
      ExternalServiceError: class ExternalServiceError extends Error {},
      BusinessLogicError: class BusinessLogicError extends Error {},
      ConfigurationError: class ConfigurationError extends Error {}
    };
  });

  // Mock the logger types
  vi.mock('@/modules/core/logger/types', () => ({
    LogSource,
    LogOutput: {
      CONSOLE: 'console',
      FILE: 'file',
      DATABASE: 'database'
    },
    LoggerMode: {
      CONSOLE: 'console',
      CLI: 'cli',
      SERVER: 'server'
    },
    LogCategory: {
      INITIALIZATION: 'init',
      AUTHENTICATION: 'auth',
      DATABASE: 'db'
    }
  }));

  // Mock the legacy logger utils if it exists
  vi.mock('@/utils/logger', () => {
    const mockLoggerInstance = mockLogger;
    return {
      logger: mockLoggerInstance,
      getLogger: vi.fn(() => mockLoggerInstance)
    };
  });

  // Mock logger errors
  vi.mock('@/modules/core/logger/utils/errors', () => ({
    LoggerInitializationError: class LoggerInitializationError extends Error {},
    LoggerError: class LoggerError extends Error {},
    InvalidLogLevelError: class InvalidLogLevelError extends Error {},
    LoggerDirectoryError: class LoggerDirectoryError extends Error {},
    LoggerFileReadError: class LoggerFileReadError extends Error {},
    LoggerFileWriteError: class LoggerFileWriteError extends Error {}
  }));

  return mockLogger;
};