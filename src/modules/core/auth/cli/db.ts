/**
 * Database management CLI commands.
 * @module modules/core/auth/cli/db
 */

import type { IUserListRow } from '@/modules/core/auth/types/index.js';
import readline from 'readline';
import {
 ONE, ZERO
} from '@/const/numbers.js';

const EIGHTY = 80;
import type { ICliContext } from '@/modules/core/auth/types/cli.types.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import { getAuthModule } from '@/modules/core/auth/singleton.js';
import type { AuthModule } from '@/modules/core/auth/index.js';

interface AuthDatabase {
  execute: (sql: string, params?: unknown[]) => Promise<void>;
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
}

/**
 * Get logger instance.
 * @returns Logger instance.
 */
const getLogger = (): ILogger => {
  return LoggerService.getInstance();
};

/**
 * Ask user for confirmation.
 * @param question - Question to ask.
 * @returns Promise that resolves with the answer.
 */
const askConfirmation = async (question: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return await new Promise<string>((resolve): void => {
    rl.question(question, (ans): void => {
      rl.close();
      resolve(ans);
    });
  });
};

/**
 * Display user information.
 * @param user - User data to display.
 * @param index - User index in the list.
 * @param logger - Logger instance.
 */
const displayUserInfo = (user: IUserListRow, index: number, logger: ILogger): void => {
  const userNumber = index + ONE;
  logger.info(`${String(userNumber)}. ${user.email}`);
  logger.info(`   ID: ${user.id}`);
  if (user.name !== null && user.name !== undefined) {
    logger.info(`   Name: ${user.name}`);
  }
  logger.info(`   Roles: ${user.roles ?? 'none'}`);
  logger.info(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
  if (user.lastLoginAt !== null && user.lastLoginAt !== undefined) {
    logger.info(`   Last login: ${new Date(user.lastLoginAt).toLocaleString()}`);
  }
  const separator = '─'.repeat(EIGHTY);
  logger.info(separator);
};

/**
 * Delete all auth tables.
 * @param authModule - Auth module instance.
 * @param logger - Logger instance.
 * @returns Promise that resolves when done.
 */
const deleteAuthTables = async (authModule: AuthModule, logger: ILogger): Promise<void> => {
  const db = (authModule as any).getDatabase() as AuthDatabase;

  await db.execute('DELETE FROM auth_sessions');
  await db.execute('DELETE FROM auth_role_permissions');
  await db.execute('DELETE FROM auth_user_roles');
  await db.execute('DELETE FROM auth_oauth_identities');
  await db.execute('DELETE FROM auth_users');
  await db.execute('DELETE FROM auth_permissions');
  await db.execute('DELETE FROM auth_roles');

  logger.info('✅ Database reset complete');
  logger.info('All users, roles, and sessions have been removed');
};

/**
 * Create default roles using Promise.all for parallel execution.
 * @param authModule - Auth module instance.
 * @param logger - Logger instance.
 * @returns Promise that resolves when done.
 */
const createDefaultRoles = async (authModule: AuthModule, logger: ILogger): Promise<void> => {
  const db = (authModule as any).getDatabase() as AuthDatabase;

  const defaultRoles = [
    {
      id: 'role_admin',
      name: 'admin',
      description: 'Full system administrator access',
      isSystem: ONE,
    },
    {
      id: 'role_user',
      name: 'user',
      description: 'Standard user access',
      isSystem: ONE,
    },
  ];

  await Promise.all(
    defaultRoles.map(async (role) =>
      { await db.execute(
        `INSERT INTO auth_roles (id, name, description, isSystem)
         VALUES (?, ?, ?, ?)`,
        [role.id, role.name, role.description, role.isSystem],
      ); })
  );

  logger.info('✅ Default roles re-created');
};

/**
 * Reset database command handler.
 * @param context - CLI context.
 * @param _context
 * @returns Promise that resolves when reset is complete.
 */
const resetDatabase = async (_context: ICliContext): Promise<void> => {
  const logger = getLogger();
  const answer = await askConfirmation(
    '\n⚠️  This will delete ALL users, roles, and sessions. Are you sure? (yes/no): '
  );

  if (answer.toLowerCase() !== 'yes') {
    logger.info('Database reset cancelled');
    return;
  }

  try {
    const authModule = getAuthModule() as any;
    await deleteAuthTables(authModule, logger);
    await createDefaultRoles(authModule, logger);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ Error resetting database:', errorMessage);
    process.exit(ONE);
  }
};

/**
 * Display all users.
 * @param users - List of users to display.
 * @param logger - Logger instance.
 */
const displayAllUsers = (users: IUserListRow[], logger: ILogger): void => {
  logger.info('\n📋 Users in database:\n');
  const separator = '─'.repeat(EIGHTY);
  logger.info(separator);

  users.forEach((user: IUserListRow, index: number): void => {
    displayUserInfo(user, index, logger);
  });

  const totalMessage = `\nTotal users: ${String(users.length)}`;
  logger.info(totalMessage);
};

/**
 * List users command handler.
 * @param context - CLI context.
 * @param _context
 * @returns Promise that resolves when listing is complete.
 */
const listUsers = async (_context: ICliContext): Promise<void> => {
  const logger = getLogger();
  try {
    const authModule = getAuthModule();
    const db = (authModule as any).getDatabase() as AuthDatabase;

    const users = await db.query<IUserListRow>(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.createdAt,
        u.lastLoginAt,
        GROUP_CONCAT(r.name) as roles
      FROM auth_users u
      LEFT JOIN auth_user_roles ur ON u.id = ur.userId
      LEFT JOIN auth_roles r ON ur.roleId = r.id
      GROUP BY u.id
      ORDER BY u.createdAt DESC
    `);

    if (users.length === ZERO) {
      logger.info('No users found in the database');
      return;
    }

    displayAllUsers(users, logger);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ Error listing users:', errorMessage);
    process.exit(ONE);
  }
};

export const command = {
  description: 'Database management commands',
  subcommands: {
    reset: {
      execute: resetDatabase,
    },
    listUsers: {
      execute: listUsers,
    },
  },
};
