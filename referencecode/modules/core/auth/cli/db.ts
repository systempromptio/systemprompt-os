/**
 * @fileoverview Database management CLI commands
 * @module modules/core/auth/cli/db
 */

import { getDatabase } from '@/modules/core/database/index.js';
import type { UserListRow } from '../types/index.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Database management commands',
  subcommands: {
    reset: {
      execute: async (_context: CLIContext): Promise<void> => {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        return new Promise<void>((resolve) => {
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
                const db = getDatabase();

                // Delete all data in reverse dependency order
                await db.query('DELETE FROM auth_sessions');
                await db.query('DELETE FROM auth_role_permissions');
                await db.query('DELETE FROM auth_user_roles');
                await db.query('DELETE FROM auth_oauth_identities');
                await db.query('DELETE FROM auth_users');
                await db.query('DELETE FROM auth_permissions');
                await db.query('DELETE FROM auth_roles');

                console.log('✅ Database reset complete');
                console.log('All users, roles, and sessions have been removed');

                // Re-initialize default roles
                const defaultRoles = [
                  {
                    id: 'role_admin',
                    name: 'admin',
                    description: 'Full system administrator access',
                    is_system: 1,
                  },
                  {
                    id: 'role_user',
                    name: 'user',
                    description: 'Standard user access',
                    is_system: 1,
                  },
                ];

                for (const role of defaultRoles) {
                  await db.query(
                    `INSERT INTO auth_roles (id, name, description, is_system) 
                   VALUES (?, ?, ?, ?)`,
                    [role.id, role.name, role.description, role.is_system],
                  );
                }

                console.log('✅ Default roles re-created');
              } catch (error) {
                console.error('❌ Error resetting database:', error);
                process.exit(1);
              }

              resolve();
            },
          );
        });
      },
    },

    'list-users': {
      execute: async (_context: CLIContext): Promise<void> => {
        try {
          const db = getDatabase();

          const users = await db.query<{
            id: string;
            email: string;
            name: string | null;
            created_at: string;
            last_login_at: string | null;
            roles: string | null;
          }>(`
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

          if (users.length === 0) {
            console.log('No users found in the database');
            return;
          }

          console.log('\n📋 Users in database:\n');
          console.log('─'.repeat(80));

          users.forEach((user: UserListRow, index: number) => {
            console.log(`${index + 1}. ${user.email}`);
            console.log(`   ID: ${user.id}`);
            if (user.name) {console.log(`   Name: ${user.name}`);}
            console.log(`   Roles: ${user.roles || 'none'}`);
            console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
            if (user.last_login_at) {
              console.log(`   Last login: ${new Date(user.last_login_at).toLocaleString()}`);
            }
            console.log('─'.repeat(80));
          });

          console.log(`\nTotal users: ${users.length}`);
        } catch (error) {
          console.error('❌ Error listing users:', error);
          process.exit(1);
        }
      },
    },
  },
};
