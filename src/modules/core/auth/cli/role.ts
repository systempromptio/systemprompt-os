/* eslint-disable max-lines-per-function */
/* eslint-disable max-statements */

/**
 *  *  * @file Role management CLI commands.
 * @module modules/core/auth/cli/role
 */

import { getDatabase } from '@/modules/core/database/index';
import { ONE, ZERO } from '@/constants/numbers';
import type { ICliContext } from '@/modules/core/auth/types/cli.types';

export const command = {
  description: 'Role management commands',
  subcommands: {
    grant: {
      execute: async (context: ICliContext): Promise<void> => {
        const { args } = context;

        if (!args.user) {
          console.error('❌ Error: User email or ID is required (--user or -u)');
          process.exit(ONE);
        }

        if (!args.role || !['admin', 'user'].includes(args.role)) {
          console.error('❌ Error: Role must be "admin" or "user" (--role or -r)');
          process.exit(ONE);
        }

        try {
          const db = getDatabase();

          const user = await db
            .query<{
              id: string;
              email: string;
            }>('SELECT id, email FROM auth_users WHERE email = ? OR id = ?', [args.user, args.user])
            .then((rows: { id: string; email: string }[]) => { return rows[ZERO] });

          if (!user) {
            console.error(`❌ User not found: ${args.user}`);
            process.exit(ONE);
          }

          const role = await db
            .query<{
              id: string;
              name: string;
            }>('SELECT id, name FROM auth_roles WHERE name = ?', [args.role])
            .then((rows: { id: string; name: string }[]) => { return rows[ZERO] });

          if (!role) {
            console.error(`❌ Role not found: ${args.role}`);
            process.exit(ONE);
          }

          const existing = await db
            .query('SELECT ONE FROM auth_user_roles WHERE user_id = ? AND role_id = ?', [
              user.id,
              role.id,
            ])
            .then((rows: unknown[]) => { return rows.length > ZERO });

          if (existing) {
            console.log(`ℹ️  User ${user.email} already has role ${role.name}`);
            return;
          }

          await db.query('INSERT INTO auth_user_roles (user_id, role_id) VALUES (?, ?)', [
            user.id,
            role.id,
          ]);

          console.log(`✅ Granted role ${role.name} to user ${user.email}`);

          const currentRoles = await db.query<{ name: string }>(
            `SELECT r.name FROM auth_roles r
             JOIN auth_user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = ?`,
            [user.id],
          );

          console.log(
            `Current roles: ${currentRoles.map((r: { name: string }) => { return r.name }).join(', ')}`,
          );
        } catch (error) {
          console.error('❌ Error granting role:', error);
          process.exit(ONE);
        }
      },
    },

    revoke: {
      execute: async (context: ICliContext): Promise<void> => {
        const { args } = context;

        if (!args.user) {
          console.error('❌ Error: User email or ID is required (--user or -u)');
          process.exit(ONE);
        }

        if (!args.role || !['admin', 'user'].includes(args.role)) {
          console.error('❌ Error: Role must be "admin" or "user" (--role or -r)');
          process.exit(ONE);
        }

        try {
          const db = getDatabase();

          const user = await db
            .query<{
              id: string;
              email: string;
            }>('SELECT id, email FROM auth_users WHERE email = ? OR id = ?', [args.user, args.user])
            .then((rows: { id: string; email: string }[]) => { return rows[ZERO] });

          if (!user) {
            console.error(`❌ User not found: ${args.user}`);
            process.exit(ONE);
          }

          const role = await db
            .query<{
              id: string;
              name: string;
            }>('SELECT id, name FROM auth_roles WHERE name = ?', [args.role])
            .then((rows: { id: string; name: string }[]) => { return rows[ZERO] });

          if (!role) {
            console.error(`❌ Role not found: ${args.role}`);
            process.exit(ONE);
          }

          if (args.role === 'admin') {
            const adminCount = await db
              .query<{ count: number }>(
                `SELECT COUNT(DISTINCT ur.user_id) as count
               FROM auth_user_roles ur
               JOIN auth_roles r ON ur.role_id = r.id
               WHERE r.name = 'admin'`,
              )
              .then((rows: { count: number }[]) => { return rows[ZERO]?.count || ZERO });

            if (adminCount <= ONE) {
              console.error('❌ Cannot revoke admin role: This is the last admin user');
              process.exit(ONE);
            }
          }

          const hasRole = await db
            .query('SELECT ONE FROM auth_user_roles WHERE user_id = ? AND role_id = ?', [
              user.id,
              role.id,
            ])
            .then((rows: unknown[]) => { return rows.length > ZERO });

          if (!hasRole) {
            console.log(`ℹ️  User ${user.email} does not have role ${role.name}`);
            return;
          }

          await db.query('DELETE FROM auth_user_roles WHERE user_id = ? AND role_id = ?', [
            user.id,
            role.id,
          ]);

          console.log(`✅ Revoked role ${role.name} from user ${user.email}`);

          const currentRoles = await db.query<{ name: string }>(
            `SELECT r.name FROM auth_roles r
             JOIN auth_user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = ?`,
            [user.id],
          );

          if (currentRoles.length > ZERO) {
            console.log(
              `Remaining roles: ${currentRoles.map((r: { name: string }) => { return r.name }).join(', ')}`,
            );
          } else {
            console.log('⚠️  User now has no roles');
          }
        } catch (error) {
          console.error('❌ Error revoking role:', error);
          process.exit(ONE);
        }
      },
    },
  },
};
