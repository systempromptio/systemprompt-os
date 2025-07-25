/**
 * @fileoverview Temporary compatibility layer for type imports
 * @deprecated Use module-specific type imports instead
 */

// Re-export from appropriate modules
export type { IModule } from '@/modules/core/modules/types/index.js';
export { ModuleStatus } from '@/modules/core/modules/types/index.js';
export type { ILogger } from '@/modules/core/logger/types/index.js';
export type { IDatabaseService as DatabaseConnection } from '@/modules/core/database/types/index.js';

// Re-export event types
export * from '@/modules/core/events/types/index.js';

// Import the tokens
import { LOGGER_TOKEN } from '@/modules/core/logger/types/index.js';
import { DATABASE_TOKEN } from '@/modules/core/database/types/index.js';
import { CONFIG_TOKEN } from '@/modules/core/config/types/index.js';
import { Token } from 'typedi';
import type { IEventBus } from '@/modules/core/events/types/event-bus.types.js';
import type { IAuthService } from '@/modules/core/auth/types/index.js';
import { CLI_TOKEN } from '@/modules/core/cli/types/index.js';
import { MCP_TOKEN } from '@/modules/core/mcp/types/index.js';
import { WEBHOOK_TOKEN } from '@/modules/core/webhooks/types/webhook.types.js';

/**
 * @deprecated Use module-specific tokens instead
 */
export const TYPES = {
  Logger: LOGGER_TOKEN,
  Database: DATABASE_TOKEN,
  Config: CONFIG_TOKEN,
  EventBus: new Token<IEventBus>('EventBus'),
  Auth: new Token<IAuthService>('Auth'),
  CLI: CLI_TOKEN,
  MCP: MCP_TOKEN,
  Webhook: WEBHOOK_TOKEN,
} as const;