import { vi } from 'vitest';

// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';
process.env.PORT = '0'; // Use random port for tests

// Suppress console output during tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

// Mock logger globally for all tests
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
  access: vi.fn(),
  clearLogs: vi.fn().mockResolvedValue(undefined),
  getLogs: vi.fn().mockResolvedValue([]),
  setDatabaseService: vi.fn()
};

// Mock LoggerService
vi.mock('@/modules/core/logger/services/logger.service', () => ({
  LoggerService: {
    getInstance: vi.fn(() => mockLogger),
    resetInstance: vi.fn()
  }
}));

// Mock the logger index
vi.mock('@/modules/core/logger/index', () => ({
  LoggerService: {
    getInstance: vi.fn(() => mockLogger),
    resetInstance: vi.fn()
  },
  getLoggerService: vi.fn(() => mockLogger),
  createLoggerModuleForBootstrap: vi.fn(() => ({
    name: 'logger',
    dependencies: [],
    exports: {
      logger: mockLogger,
      LoggerService: {
        getInstance: vi.fn(() => mockLogger),
        resetInstance: vi.fn()
      }
    }
  })),
  LogSource: {
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
  },
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
}));

// Mock logger types
vi.mock('@/modules/core/logger/types', () => ({
  LogSource: {
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
  },
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

// Mock legacy logger if needed
vi.mock('@/utils/logger', () => ({
  logger: mockLogger,
  getLogger: vi.fn(() => mockLogger),
  setModuleRegistry: vi.fn()
}));

// Mock logger errors
vi.mock('@/modules/core/logger/utils/errors', () => ({
  LoggerInitializationError: class LoggerInitializationError extends Error {},
  LoggerError: class LoggerError extends Error {},
  InvalidLogLevelError: class InvalidLogLevelError extends Error {},
  LoggerDirectoryError: class LoggerDirectoryError extends Error {},
  LoggerFileReadError: class LoggerFileReadError extends Error {},
  LoggerFileWriteError: class LoggerFileWriteError extends Error {}
}));