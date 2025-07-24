/**
 * @file Validate data integrity command.
 * @module modules/core/database/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { ILogger } from '@/modules/core/logger/types/index.js';
import type { DatabaseService } from '@/modules/core/database/services/database.service.js';

export function createValidateCommand(db: DatabaseService, logger: ILogger): Command {
  return new Command('validate')
    .description('Validate data integrity')
    .option('-t, --tables <tables>', 'Comma-separated list of tables to validate (default: all)')
    .option('--fix', 'Attempt to fix issues found', false)
    .option('--check-orphans', 'Check for orphaned records', true)
    .option('--check-constraints', 'Check foreign key constraints', true)
    .option('--check-indexes', 'Verify index integrity', true)
    .action(async (options) => {
      try {
        logger.info('Starting data validation', options);

        const issues: ValidationIssue[] = [];

        // Get tables to validate
        const tables = options.tables
          ? options.tables.split(',').map((t: string) => { return t.trim() })
          : await getTableList(db);

        // Run integrity check
        const integrityCheck = await db.query<{ integrity_check: string }>(
          'PRAGMA integrity_check',
        );
        if (integrityCheck[0]?.integrity_check !== 'ok') {
          issues.push({
            type: 'integrity',
            severity: 'critical',
            message: 'Database integrity check failed',
            details: integrityCheck,
          });
        }

        // Check foreign keys if enabled
        if (options.checkConstraints) {
          const fkCheck = await db.query<any>('PRAGMA foreign_key_check');
          if (fkCheck.length > 0) {
            fkCheck.forEach((violation: any) => {
              issues.push({
                type: 'foreign_key',
                severity: 'error',
                table: violation.table,
                message: `Foreign key violation in table ${violation.table}`,
                details: violation,
              });
            });
          }
        }

        // Check for orphaned records
        if (options.checkOrphans) {
          for (const table of tables) {
            const orphans = await checkOrphans(db, table);
            orphans.forEach((orphan) => { return issues.push(orphan) });
          }
        }

        // Check indexes
        if (options.checkIndexes) {
          const indexIssues = await checkIndexes(db);
          indexIssues.forEach((issue) => { return issues.push(issue) });
        }

        // Check for common data issues
        for (const table of tables) {
          const dataIssues = await checkDataIntegrity(db, table);
          dataIssues.forEach((issue) => { return issues.push(issue) });
        }

        // Report results
        if (issues.length === 0) {
          logger.info('✓ All validation checks passed');
          process.exit(0);
        }

        // Display issues
        logger.warn(`Found ${issues.length} validation issues:`);

        const criticalIssues = issues.filter((i) => { return i.severity === 'critical' });
        const errorIssues = issues.filter((i) => { return i.severity === 'error' });
        const warningIssues = issues.filter((i) => { return i.severity === 'warning' });

        if (criticalIssues.length > 0) {
          logger.error(`Critical issues: ${criticalIssues.length}`);
          criticalIssues.forEach((issue) => {
            logger.error(`  - ${issue.message}`);
          });
        }

        if (errorIssues.length > 0) {
          logger.error(`Errors: ${errorIssues.length}`);
          errorIssues.forEach((issue) => {
            logger.error(`  - [${issue.table || 'global'}] ${issue.message}`);
          });
        }

        if (warningIssues.length > 0) {
          logger.warn(`Warnings: ${warningIssues.length}`);
          warningIssues.forEach((issue) => {
            logger.warn(`  - [${issue.table || 'global'}] ${issue.message}`);
          });
        }

        // Fix issues if requested
        if (options.fix) {
          logger.info('Attempting to fix issues...');
          const fixedCount = await fixIssues(db, issues, logger);
          logger.info(`Fixed ${fixedCount} issues`);
        }

        process.exit(
          issues.some((i) => { return i.severity === 'critical' || i.severity === 'error' }) ? 1 : 0,
        );
      } catch (error) {
        logger.error('Validation failed', error);
        process.exit(1);
      }
    });
}

interface ValidationIssue {
  type: 'integrity' | 'foreign_key' | 'orphan' | 'index' | 'data';
  severity: 'critical' | 'error' | 'warning';
  table?: string;
  column?: string;
  message: string;
  details?: any;
  fixable?: boolean;
  fixQuery?: string;
}

async function getTableList(db: DatabaseService): Promise<string[]> {
  const result = await db.query<{ name: string }>(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  return result.map((r) => { return r.name });
}

async function checkOrphans(db: DatabaseService, table: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Check common orphan patterns
  const orphanChecks: { [key: string]: { parent: string; fk: string; pk: string } } = {
    auth_user_roles: {
 parent: 'auth_users',
fk: 'user_id',
pk: 'id'
},
    auth_tokens: {
 parent: 'auth_users',
fk: 'user_id',
pk: 'id'
},
    auth_sessions: {
 parent: 'auth_users',
fk: 'user_id',
pk: 'id'
},
    permissions_user_permissions: {
 parent: 'auth_users',
fk: 'user_id',
pk: 'id'
},
    permissions_role_permissions: {
 parent: 'permissions_roles',
fk: 'role_id',
pk: 'id'
},
  };

  if (orphanChecks[table]) {
    const check = orphanChecks[table];
    const orphans = await db.query<{ count: number }>(`
      SELECT COUNT(*) as count FROM ${table} t
      LEFT JOIN ${check.parent} p ON t.${check.fk} = p.${check.pk}
      WHERE p.${check.pk} IS NULL
    `);

    if (!orphans || orphans.length === 0) { return []; }
    if (orphans[0] && orphans[0].count > 0) {
      issues.push({
        type: 'orphan',
        severity: 'error',
        table,
        message: `Found ${orphans[0].count} orphaned records with invalid ${check?.fk}`,
        fixable: true,
        fixQuery: `DELETE FROM ${table} WHERE ${check.fk} NOT IN (SELECT ${check.pk} FROM ${check.parent})`,
      });
    }
  }

  return issues;
}

async function checkIndexes(db: DatabaseService): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Get all indexes
  const indexes = await db.query<{ name: string; tbl_name: string }>(`
    SELECT name, tbl_name FROM sqlite_master 
    WHERE type='index' 
    AND name NOT LIKE 'sqlite_%'
  `);

  // Check for missing recommended indexes
  const recommendedIndexes = [
    {
 table: 'auth_users',
column: 'email'
},
    {
 table: 'auth_tokens',
column: 'token_hash'
},
    {
 table: 'auth_sessions',
column: 'session_id'
},
    {
 table: 'mcp_stats',
column: 'created_at'
},
  ];

  for (const rec of recommendedIndexes) {
    const hasIndex = indexes.some(
      (idx) => { return idx.tbl_name === rec.table && idx.name.toLowerCase().includes(rec.column) },
    );

    if (!hasIndex) {
      // Check if table exists first
      const tableExists = await db.query<{ count: number }>(
        `
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name=?
      `,
        [rec.table],
      );

      if (tableExists?.[0] && tableExists[0].count > 0) {
        issues.push({
          type: 'index',
          severity: 'warning',
          table: rec.table,
          column: rec.column,
          message: `Missing recommended index on ${rec.table}.${rec.column}`,
          fixable: true,
          fixQuery: `CREATE INDEX idx_${rec.table}_${rec.column} ON ${rec.table}(${rec.column})`,
        });
      }
    }
  }

  return issues;
}

async function checkDataIntegrity(db: DatabaseService, table: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Check for common data integrity issues
  try {
    // Check for duplicate emails in auth_users
    if (table === 'auth_users') {
      const duplicates = await db.query<{ email: string; count: number }>(`
        SELECT email, COUNT(*) as count 
        FROM auth_users 
        GROUP BY email 
        HAVING COUNT(*) > 1
      `);

      duplicates.forEach((dup) => {
        issues.push({
          type: 'data',
          severity: 'error',
          table,
          column: 'email',
          message: `Duplicate email found: ${dup.email} (${dup.count} occurrences)`,
          fixable: false,
        });
      });
    }

    // Check for null values in NOT NULL columns
    const columns = await db.query<{ name: string; notnull: number }>(`
      PRAGMA table_info(${table})
    `);

    for (const col of columns.filter((c) => { return c.notnull === 1 })) {
      const nullCount = await db.query<{ count: number }>(`
        SELECT COUNT(*) as count FROM ${table} WHERE ${col.name} IS NULL
      `);

      if (nullCount?.[0] && nullCount[0].count > 0) {
        issues.push({
          type: 'data',
          severity: 'error',
          table,
          column: col.name,
          message: `Found ${nullCount[0].count} NULL values in NOT NULL column ${col.name}`,
          fixable: false,
        });
      }
    }
  } catch {
    // Table might not exist, skip
  }

  return issues;
}

async function fixIssues(
  db: DatabaseService,
  issues: ValidationIssue[],
  logger: ILogger,
): Promise<number> {
  let fixedCount = 0;

  await db.execute('BEGIN TRANSACTION');

  try {
    for (const issue of issues.filter((i) => { return i.fixable && i.fixQuery })) {
      try {
        await db.execute(issue.fixQuery!);
        logger.info(`Fixed: ${issue.message}`);
        fixedCount++;
      } catch (error) {
        logger.error(`Failed to fix: ${issue.message}`, error);
      }
    }

    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }

  return fixedCount;
}
