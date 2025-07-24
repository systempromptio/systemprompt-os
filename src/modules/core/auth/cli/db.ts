/**
 * Database management CLI commands.
 * @module modules/core/auth/cli/db
 */

import type { UserListRow } from '@/modules/core/auth/types/index.js';
import readline from 'readline';
import {
 EIGHTY, ONE, ZERO
} from '@/modules/core/auth/constants';
import type { ICliContext } from '@/modules/core/auth/types/cli.types';
import { DatabaseService } from '@/modules/core/database';

export const command = {
  description: 'Database management commands',
  subcommands: {
    reset: {
      execute: async (context: ICliContext): Promise<void> => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        await new Promise<void>((resolve) => {
          rl.question(
            '\n⚠️  This will delete ALL users, roles, and sessions. Are you sure? (yes/no): ',
            async (answer) => {
              rl.close();

              if (answer.toLowerCase() !== 'yes') {
                console.log('Database reset cancelled');
                resolve();
                return;
              }

              try {
                const db = DatabaseService.getInstance();

                await db.execute('DELETE FROM auth_sessions');
                await db.execute('DELETE FROM auth_role_permissions');
                await db.execute('DELETE FROM auth_user_roles');
                await db.execute('DELETE FROM auth_oauth_identities');
                await db.execute('DELETE FROM auth_users');
                await db.execute('DELETE FROM auth_permissions');
                await db.execute('DELETE FROM auth_roles');

                console.log('✅ Database reset complete');
                console.log('All users, roles, and sessions have been removed');

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

                // Process roles sequentially

                for (const role of defaultRoles) {
                  await db.execute(
                    `INSERT INTO auth_roles (id, name, description, isSystem)
                   VALUES (?, ?, ?, ?)`,
                    [role.id, role.name, role.description, role.isSystem],
                  );
                }

                console.log('✅ Default roles re-created');
              } catch (error) {
                console.error('❌ Error resetting database:', error);
                process.exit(ONE);
              }

              resolve();
            },
          );
        });
      },
    },

    listUsers: {
      execute: async (context: ICliContext): Promise<void> => {
        try {
          const db = DatabaseService.getInstance();

          const users = await db.query<UserListRow>(`
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
            console.log('No users found in the database');
            return;
          }

          console.log('\n📋 Users in database:\n');
          console.log('─'.repeat(EIGHTY));

          users.forEach((user: UserListRow, index: number) => {
            console.log(`${index + ONE}. ${user.email}`);
            console.log(`   ID: ${user.id}`);
            if (user.name) {
              console.log(`   Name: ${user.name}`);
            }
            console.log(`   Roles: ${user.roles || 'none'}`);
            console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
            if (user.lastLoginAt) {
              console.log(`   Last login: ${new Date(user.lastLoginAt).toLocaleString()}`);
            }
            console.log('─'.repeat(EIGHTY));
          });

          console.log(`\nTotal users: ${users.length}`);
        } catch (error) {
          console.error('❌ Error listing users:', error);
          process.exit(ONE);
        }
      },
    },
  },
};
