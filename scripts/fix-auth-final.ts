#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

// Helper functions
function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

function processDirectory(dirPath: string, processor: (filePath: string) => void): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath, processor);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      processor(fullPath);
    }
  }
}

// Fix specific files
function fixDbTs(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/cli/db.ts';
  const content = `/* eslint-disable no-console */
/**
 * Database management CLI commands.
 * @module modules/core/auth/cli/db
 */

import type { UserListRow } from '@/modules/core/auth/types/index.js';
import readline from 'readline';
import { EIGHTY, ONE, ZERO } from '@/modules/core/auth/constants';
import type { ICliContext } from '@/modules/core/auth/types/cli.types';
import { DatabaseService } from '@/modules/core/database';

/**
 * Reset database command handler
 * @param _context - CLI context
 */
async function resetDatabase(_context: ICliContext): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(
      '\\n⚠️  This will delete ALL users, roles, and sessions. Are you sure? (yes/no): ',
      (ans) => {
        rl.close();
        resolve(ans);
      }
    );
  });

  if (answer.toLowerCase() !== 'yes') {
    console.log('Database reset cancelled');
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

    for (const role of defaultRoles) {
      await db.execute(
        \`INSERT INTO auth_roles (id, name, description, isSystem)
         VALUES (?, ?, ?, ?)\`,
        [role.id, role.name, role.description, role.isSystem],
      );
    }

    console.log('✅ Default roles re-created');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(ONE);
  }
}

/**
 * List users command handler
 * @param _context - CLI context
 */
async function listUsers(_context: ICliContext): Promise<void> {
  try {
    const db = DatabaseService.getInstance();

    const users = await db.query<UserListRow>(\`
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
    \`);

    if (users.length === ZERO) {
      console.log('No users found in the database');
      return;
    }

    console.log('\\n📋 Users in database:\\n');
    console.log('─'.repeat(EIGHTY));

    users.forEach((user: UserListRow, index: number) => {
      console.log(\`\${index + ONE}. \${user.email}\`);
      console.log(\`   ID: \${user.id}\`);
      if (user.name) {
        console.log(\`   Name: \${user.name}\`);
      }
      console.log(\`   Roles: \${user.roles || 'none'}\`);
      console.log(\`   Created: \${new Date(user.createdAt).toLocaleString()}\`);
      if (user.lastLoginAt) {
        console.log(\`   Last login: \${new Date(user.lastLoginAt).toLocaleString()}\`);
      }
      console.log('─'.repeat(EIGHTY));
    });

    console.log(\`\\nTotal users: \${users.length}\`);
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(ONE);
  }
}

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
`;
  writeFile(filePath, content);
  console.log('Fixed:', filePath);
}

function fixIndexTs(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/index.ts';
  let content = readFile(filePath);
  
  // Remove duplicate constant declarations
  content = content.replace(/const ZERO = ZERO;/g, '');
  content = content.replace(/const ONE = ONE;/g, '');
  content = content.replace(/const TWO = TWO;/g, '');
  content = content.replace(/const THREE = THREE;/g, '');
  content = content.replace(/const FIVE = 5;/g, '');
  content = content.replace(/const TEN = TEN;/g, '');
  content = content.replace(/const SECONDS_PER_MINUTE = SECONDS_PER_MINUTE;/g, '');
  content = content.replace(/const MILLISECONDS_PER_SECOND = MILLISECONDS_PER_SECOND;/g, '');
  content = content.replace(/const SECONDS_PER_HOUR = SECONDS_PER_HOUR;/g, '');
  content = content.replace(/const SECONDS_PER_DAY = SECONDS_PER_DAY;/g, '');
  
  // Import missing constants
  if (!content.includes('SECONDS_PER_MINUTE')) {
    content = content.replace(
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from \'./constants\';',
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED, SECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND, SECONDS_PER_HOUR, SECONDS_PER_DAY } from \'./constants\';'
    );
  }
  
  // Fix syntax errors with .filter
  content = content.replace(/\.filter\(\(s\) : void => { return s\.trim\(\) }\)/g, '.filter((s) => s.trim())');
  
  // Fix syntax errors with .catch
  content = content.replace(/\.catch\(\(err\) : void => { this\.logger\.error\('Token cleanup failed', err\); }\)/g, '.catch((err) => { this.logger.error(\'Token cleanup failed\', err); })');
  
  // Fix dynamic import reference
  content = content.replace(/const { generateJWTKeyPair } = dynamicImport;/g, `
        const { generateJWTKeyPair } = await import('@/modules/core/auth/cli/generatekey.js');`);
  
  // Fix syntax error with comma
  content = content.replace(/24 \* SECONDS_PER_MINUTE \* SECONDS_PER_MINUTE \* MILLISECONDS_PER_SECOND,\./g, '24 * SECONDS_PER_MINUTE * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND');
  
  // Fix arrow function returns
  content = content.replace(/\(\) => { return/g, '() =>');
  
  // Fix version string
  content = content.replace('public readonly version = \'TWO.ZERO.0\';', 'public readonly version = \'2.0.0\';');
  
  writeFile(filePath, content);
  console.log('Fixed:', filePath);
}

function fixServiceFiles(): void {
  const services = [
    'audit.service.ts',
    'auth-code-service.ts',
    'auth.service.ts',
    'mfa.service.ts',
    'token.service.ts',
    'user-service.ts'
  ];
  
  const servicesPath = '/var/www/html/systemprompt-os/src/modules/core/auth/services';
  
  services.forEach(fileName => {
    const filePath = path.join(servicesPath, fileName);
    if (!fs.existsSync(filePath)) return;
    
    let content = readFile(filePath);
    
    // Remove duplicate constant declarations
    content = content.replace(/const ZERO = ZERO;/g, '');
    content = content.replace(/const ONE = ONE;/g, '');
    content = content.replace(/const TWO = TWO;/g, '');
    content = content.replace(/const THREE = THREE;/g, '');
    content = content.replace(/const ONE_HUNDRED = 100;/g, '');
    content = content.replace(/const SECONDS_PER_MINUTE = SECONDS_PER_MINUTE;/g, '');
    content = content.replace(/const MILLISECONDS_PER_SECOND = MILLISECONDS_PER_SECOND;/g, '');
    
    // Fix malformed return statements
    content = content.replace(/\) : void => { return/g, ') => ');
    content = content.replace(/\): void => {/g, ') => {');
    
    // Fix unsafe member access
    content = content.replace(/this\.\(logger as any\)\.error/g, 'this.logger.error');
    content = content.replace(/this\.\(logger as any\)\.info/g, 'this.logger.info');
    content = content.replace(/this\.\(logger as any\)\.debug/g, 'this.logger.debug');
    content = content.replace(/this\.\(logger as any\)\.warn/g, 'this.logger.warn');
    
    // Add missing properties in singleton services
    if (fileName === 'audit.service.ts') {
      const classMatch = content.match(/export class AuditService \{[\s\S]*?\n\}/);
      if (classMatch) {
        let classContent = classMatch[0];
        
        // Add missing properties after singleton declaration
        if (!classContent.includes('private logger:')) {
          classContent = classContent.replace(
            'private constructor() {\n    // Initialize\n  }',
            `private logger!: ILogger;
  private db!: DatabaseService;

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.db = DatabaseService.getInstance();
  }`
          );
        }
        
        content = content.replace(classMatch[0], classContent);
        
        // Add imports
        if (!content.includes('import { LoggerService }')) {
          content = `import { LoggerService } from '@/modules/core/logger/services/logger.service.js';\n` + content;
        }
      }
    }
    
    // Fix type names
    content = content.replace(/export interface AuditEvent/g, 'export interface IAuditEvent');
    content = content.replace(/export interface AuthorizationCodeData/g, 'export interface IAuthorizationCodeData');
    content = content.replace(/export interface AuthCodeRow/g, 'export interface IAuthCodeRow');
    
    // Fix usage of renamed interfaces
    content = content.replace(/logEvent\(event: AuditEvent\)/g, 'logEvent(event: IAuditEvent)');
    content = content.replace(/getEvents\([\s\S]*?\): Promise<AuditEvent\[\]>/g, 'getEvents(userId?: string, limit = ONE_HUNDRED): Promise<IAuditEvent[]>');
    content = content.replace(/createAuthorizationCode\(data: AuthorizationCodeData\)/g, 'createAuthorizationCode(data: IAuthorizationCodeData)');
    content = content.replace(/Promise<AuthorizationCodeData \| null>/g, 'Promise<IAuthorizationCodeData | null>');
    content = content.replace(/await this.db.query<AuthCodeRow>/g, 'await this.db.query<IAuthCodeRow>');
    
    // Fix arrow function with wrong types
    content = content.replace(/rows\.map\(\(row\): AuthToken => { return {/g, 'rows.map((row): AuthToken => ({');
    content = content.replace(/return rows\.map\(\(row\) : void => { return {/g, 'return rows.map((row) => ({');
    
    // Fix multi-line object returns
    content = content.replace(/} }\);/g, '}));');
    
    writeFile(filePath, content);
    console.log('Fixed:', filePath);
  });
}

function fixConstantsFile(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/constants/index.ts';
  const content = `/**
 * Constants for auth module
 * @module modules/core/auth/constants
 */

// Numeric constants
export const ZERO = 0;
export const ONE = 1;
export const TWO = 2;
export const THREE = 3;
export const FOUR = 4;
export const FIVE = 5;
export const SIX = 6;
export const SEVEN = 7;
export const EIGHT = 8;
export const NINE = 9;
export const TEN = 10;
export const FIFTEEN = 15;
export const SIXTEEN = 16;
export const TWENTY = 20;
export const THIRTY = 30;
export const THIRTY_TWO = 32;
export const FORTY = 40;
export const FIFTY = 50;
export const SIXTY = 60;
export const SIXTY_FOUR = 64;
export const EIGHTY = 80;
export const NINETY = 90;
export const ONE_HUNDRED = 100;
export const TWO_HUNDRED = 200;
export const TWO_HUNDRED_FIFTY_SIX = 256;
export const THREE_HUNDRED_SIXTY_FIVE = 365;
export const FIVE_HUNDRED = 500;
export const ONE_THOUSAND = 1000;
export const NINE_HUNDRED = 900;
export const TWO_THOUSAND_FIVE_HUNDRED_NINETY_TWO_THOUSAND = 2592000;

// Time constants
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY;

// HTTP status codes
export const HTTP_OK = 200;
export const HTTP_CREATED = 201;
export const HTTP_NO_CONTENT = 204;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_INTERNAL_SERVER_ERROR = 500;

// Default values
export const DEFAULT_PORT = 3000;
export const DEFAULT_TTL = 3600;
export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_LOCKOUT_DURATION = 900;
export const DEFAULT_PASSWORD_MIN_LENGTH = 8;
`;
  
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  
  writeFile(filePath, content);
  console.log('Created/Updated:', filePath);
}

function fixAllCliFiles(): void {
  const cliPath = '/var/www/html/systemprompt-os/src/modules/core/auth/cli';
  const cliFiles = fs.readdirSync(cliPath).filter(f => f.endsWith('.ts'));
  
  cliFiles.forEach(fileName => {
    const filePath = path.join(cliPath, fileName);
    let content = readFile(filePath);
    
    // Add eslint-disable for console if not present
    if (!content.startsWith('/* eslint-disable no-console */') && content.includes('console.')) {
      content = '/* eslint-disable no-console */\n' + content;
    }
    
    // Fix unused parameters
    content = content.replace(/\(context: ICliContext\)/g, '(_context: ICliContext)');
    content = content.replace(/\(args: Record<string, unknown>\)/g, '(_args: Record<string, unknown>)');
    
    // Fix unsafe argument types
    content = content.replace(/process\.exit\(error\)/g, 'process.exit(1)');
    
    writeFile(filePath, content);
    console.log('Fixed CLI file:', filePath);
  });
}

// Main execution
console.log('Starting final ESLint fixes for auth module...\n');

// Create/update constants file
fixConstantsFile();

// Fix specific problematic files
fixDbTs();
fixIndexTs();
fixServiceFiles();
fixAllCliFiles();

// Fix all other files
const authPath = '/var/www/html/systemprompt-os/src/modules/core/auth';
processDirectory(authPath, (filePath) => {
  // Skip files we've already handled
  if (filePath.includes('/cli/db.ts') || 
      filePath.includes('/index.ts') || 
      filePath.includes('/services/') ||
      filePath.includes('/constants/')) {
    return;
  }
  
  let content = readFile(filePath);
  let modified = false;
  
  // Generic fixes
  const originalContent = content;
  
  // Fix interface names
  content = content.replace(/export interface ([A-Z][a-zA-Z]+)(?!I[A-Z])/g, 'export interface I$1');
  
  // Fix any types
  content = content.replace(/: any/g, ': unknown');
  content = content.replace(/<any>/g, '<unknown>');
  
  // Fix unused parameters
  content = content.replace(/\((\w+): (\w+)\): void \{/g, (match, param, type) => {
    if (!content.includes(param + '.') && !content.includes(param + '[')) {
      return `(_${param}: ${type}): void {`;
    }
    return match;
  });
  
  if (content !== originalContent) {
    writeFile(filePath, content);
    console.log('Fixed generic issues in:', filePath);
  }
});

console.log('\nFinal fixes complete!');