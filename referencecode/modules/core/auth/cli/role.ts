/**
 * @fileoverview Role management CLI commands
 * @module modules/core/auth/cli/role
 */

import { getDatabase } from '@/modules/core/database/index.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export const command = {
  description: 'Role management commands',
  subcommands: {
    grant: {
      execute: async (context: CLIContext): Promise<void> => {
        const { args } = context;

        if (!args['user']) {
          console.error('❌ Error: User email or ID is required (--user or -u)');
          process.exit(1);
        }

        if (!args['role'] || !['admin', 'user'].includes(args['role'] as string)) {
          console.error('❌ Error: Role must be "admin" or "user" (--role or -r)');
          process.exit(1);
        }

        try {
          const db = getDatabase();

          // Find user by email or ID
          const user = await db
            .query<{
              id: string;
              email: string;
            }>('SELECT id, email FROM auth_users WHERE email = ? OR id = ?', [args['user'], args['user']])
            .then((rows: { id: string; email: string }[]) => rows[0]);

          if (!user) {
            console.error(`❌ User not found: ${args['user']}`);
            process.exit(1);
          }

          // Find role
          const role = await db
            .query<{
              id: string;
              name: string;
            }>('SELECT id, name FROM auth_roles WHERE name = ?', [args['role']])
            .then((rows: { id: string; name: string }[]) => rows[0]);

          if (!role) {
            console.error(`❌ Role not found: ${args['role']}`);
            process.exit(1);
          }

          // Check if user already has the role
          const existing = await db
            .query('SELECT 1 FROM auth_user_roles WHERE user_id = ? AND role_id = ?', [
              user.id,
              role.id,
            ])
            .then((rows: unknown[]) => rows.length > 0);

          if (existing) {
            console.log(`ℹ️  User ${user.email} already has role ${role.name}`);
            return;
          }

          // Grant the role
          await db.query('INSERT INTO auth_user_roles (user_id, role_id) VALUES (?, ?)', [
            user.id,
            role.id,
          ]);

          console.log(`✅ Granted role ${role.name} to user ${user.email}`);

          // Show current roles
          const currentRoles = await db.query<{ name: string }>(
            `SELECT r.name FROM auth_roles r
             JOIN auth_user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = ?`,
            [user.id],
          );

          console.log(
            `Current roles: ${currentRoles.map((r: { name: string }) => r.name).join(', ')}`,
          );
        } catch (error) {
          console.error('❌ Error granting role:', error);
          process.exit(1);
        }
      },
    },

    revoke: {
      execute: async (context: CLIContext): Promise<void> => {
        const { args } = context;

        if (!args['user']) {
          console.error('❌ Error: User email or ID is required (--user or -u)');
          process.exit(1);
        }

        if (!args['role'] || !['admin', 'user'].includes(args['role'] as string)) {
          console.error('❌ Error: Role must be "admin" or "user" (--role or -r)');
          process.exit(1);
        }

        try {
          const db = getDatabase();

          // Find user by email or ID
          const user = await db
            .query<{
              id: string;
              email: string;
            }>('SELECT id, email FROM auth_users WHERE email = ? OR id = ?', [args['user'], args['user']])
            .then((rows: { id: string; email: string }[]) => rows[0]);

          if (!user) {
            console.error(`❌ User not found: ${args['user']}`);
            process.exit(1);
          }

          // Find role
          const role = await db
            .query<{
              id: string;
              name: string;
            }>('SELECT id, name FROM auth_roles WHERE name = ?', [args['role']])
            .then((rows: { id: string; name: string }[]) => rows[0]);

          if (!role) {
            console.error(`❌ Role not found: ${args['role']}`);
            process.exit(1);
          }

          // Check if this is the last admin
          if (args['role'] === 'admin') {
            const adminCount = await db
              .query<{ count: number }>(
                `SELECT COUNT(DISTINCT ur.user_id) as count 
               FROM auth_user_roles ur
               JOIN auth_roles r ON ur.role_id = r.id
               WHERE r.name = 'admin'`,
              )
              .then((rows: { count: number }[]) => rows[0]?.count || 0);

            if (adminCount <= 1) {
              console.error('❌ Cannot revoke admin role: This is the last admin user');
              process.exit(1);
            }
          }

          // Check if user has the role
          const hasRole = await db
            .query('SELECT 1 FROM auth_user_roles WHERE user_id = ? AND role_id = ?', [
              user.id,
              role.id,
            ])
            .then((rows: unknown[]) => rows.length > 0);

          if (!hasRole) {
            console.log(`ℹ️  User ${user.email} does not have role ${role.name}`);
            return;
          }

          // Revoke the role
          await db.query('DELETE FROM auth_user_roles WHERE user_id = ? AND role_id = ?', [
            user.id,
            role.id,
          ]);

          console.log(`✅ Revoked role ${role.name} from user ${user.email}`);

          // Show remaining roles
          const currentRoles = await db.query<{ name: string }>(
            `SELECT r.name FROM auth_roles r
             JOIN auth_user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = ?`,
            [user.id],
          );

          if (currentRoles.length > 0) {
            console.log(
              `Remaining roles: ${currentRoles.map((r: { name: string }) => r.name).join(', ')}`,
            );
          } else {
            console.log('⚠️  User now has no roles');
          }
        } catch (error) {
          console.error('❌ Error revoking role:', error);
          process.exit(1);
        }
      },
    },
  },
};
