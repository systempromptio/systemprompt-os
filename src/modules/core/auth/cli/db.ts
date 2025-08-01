/**
 * Database management CLI commands.
 * @module modules/core/auth/cli/db
 */

import type {
  AuthDatabase,
  ICliContext
} from '@/modules/core/auth/types/manual';
import type { IUsersRow } from '@/modules/core/users/types/database.generated';
import { ONE, ZERO } from '@/constants/numbers';
import { EIGHTY } from '@/modules/core/auth/constants/session.constants';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';

/**
 * User query result with roles information.
 */
interface IUserWithRoles extends IUsersRow {
  roles?: string | null;
}
import { getAuthModule } from '@/modules/core/auth/index';
import type { AuthModule } from '@/modules/core/auth/index';
import readline from 'readline';

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
const displayUserInfo = (
  user: IUserWithRoles,
  index: number,
  logger: ILogger
): void => {
  const userNumber = index + ONE;
  logger.info(LogSource.AUTH, `${String(userNumber)}. ${user.email}`);
  logger.info(LogSource.AUTH, `   ID: ${user.id}`);
  if (user.display_name !== null && user.display_name !== undefined) {
    logger.info(LogSource.AUTH, `   Name: ${user.display_name}`);
  }
  logger.info(LogSource.AUTH, `   Roles: ${user.roles ?? 'none'}`);
  const createdAt = user.created_at ?? new Date().toISOString();
  const createdDate = new Date(createdAt).toLocaleString();
  logger.info(LogSource.AUTH, `   Created: ${createdDate}`);
  const separator = '─'.repeat(EIGHTY);
  logger.info(LogSource.AUTH, separator);
};

/**
 * Delete all auth tables.
 * @param authModule - Auth module instance.
 * @param logger - Logger instance.
 * @returns Promise that resolves when done.
 */
const deleteAuthTables = async (
  authModule: AuthModule,
  logger: ILogger
): Promise<void> => {
  const db = (authModule as AuthModule & { getDatabase: () => AuthDatabase })
    .getDatabase();

  await db.execute('DELETE FROM auth_sessions');
  await db.execute('DELETE FROM auth_role_permissions');
  await db.execute('DELETE FROM auth_user_roles');
  await db.execute('DELETE FROM auth_oauth_identities');
  await db.execute('DELETE FROM auth_users');
  await db.execute('DELETE FROM auth_permissions');
  await db.execute('DELETE FROM auth_roles');

  logger.info(LogSource.AUTH, '✅ Database reset complete');
  logger.info(LogSource.AUTH, 'All users, roles, and sessions have been removed');
};

/**
 * Create default roles using Promise.all for parallel execution.
 * @param authModule - Auth module instance.
 * @param logger - Logger instance.
 * @returns Promise that resolves when done.
 */
const createDefaultRoles = async (
  authModule: AuthModule,
  logger: ILogger
): Promise<void> => {
  const db = (authModule as AuthModule & { getDatabase: () => AuthDatabase })
    .getDatabase();

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
    defaultRoles.map(async (role) => {
      await db.execute(
        `INSERT INTO auth_roles (id, name, description, is_system)
         VALUES (?, ?, ?, ?)`,
        [role.id, role.name, role.description, role.isSystem]
      );
    })
  );

  logger.info(LogSource.AUTH, '✅ Default roles re-created');
};

/**
 * Reset database command handler.
 * @param context - CLI context (unused).
 * @param _context
 * @returns Promise that resolves when reset is complete.
 */
const resetDatabase = async (_context: ICliContext): Promise<void> => {
  const logger = getLogger();
  const question = '\n⚠️  This will delete ALL users, roles, and sessions. '
    + 'Are you sure? (yes/no): ';
  const answer = await askConfirmation(question);

  if (answer.toLowerCase() !== 'yes') {
    logger.info(LogSource.AUTH, 'Database reset cancelled');
    return;
  }

  try {
    const authModule = getAuthModule();
    await deleteAuthTables(authModule, logger);
    await createDefaultRoles(authModule, logger);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(LogSource.AUTH, '❌ Error resetting database:', {
      error: errorMessage
    });
    process.exit(ONE);
  }
};

/**
 * Display all users.
 * @param users - List of users to display.
 * @param logger - Logger instance.
 */
const displayAllUsers = (
  users: IUserWithRoles[],
  logger: ILogger
): void => {
  logger.info(LogSource.AUTH, '\n📋 Users in database:\n');
  const separator = '─'.repeat(EIGHTY);
  logger.info(LogSource.AUTH, separator);

  users.forEach((user: IUserWithRoles, index: number): void => {
    displayUserInfo(user, index, logger);
  });

  const totalMessage = `\nTotal users: ${String(users.length)}`;
  logger.info(LogSource.AUTH, totalMessage);
};

/**
 * List users command handler.
 * @param context - CLI context (unused).
 * @param _context
 * @returns Promise that resolves when listing is complete.
 */
const listUsers = async (_context: ICliContext): Promise<void> => {
  const logger = getLogger();
  try {
    const authModule = getAuthModule();
    const db = (authModule as AuthModule & { getDatabase: () => AuthDatabase })
      .getDatabase();

    const users = await db.query<IUserWithRoles>(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.created_at,
        u.last_login_at,
        GROUP_CONCAT(r.name) as roles
      FROM auth_users u
      LEFT JOIN auth_user_roles ur ON u.id = ur.user_id
      LEFT JOIN auth_roles r ON ur.role_id = r.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    if (users.length === ZERO) {
      logger.info(LogSource.AUTH, 'No users found in the database');
      return;
    }

    displayAllUsers(users, logger);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(LogSource.AUTH, '❌ Error listing users:', {
      error: errorMessage
    });
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
