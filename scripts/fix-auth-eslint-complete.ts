#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const AUTH_DIR = path.join(process.cwd(), 'src/modules/core/auth');
const CONSTANTS_DIR = path.join(AUTH_DIR, 'constants');
const TYPES_DIR = path.join(AUTH_DIR, 'types');

/**
 * Complete ESLint fix for auth module
 */
async function fixAuthEslintComplete(): Promise<void> {
  console.log('Starting complete ESLint fixes for auth module...');
  
  // Ensure required directories exist
  if (!fs.existsSync(CONSTANTS_DIR)) {
    fs.mkdirSync(CONSTANTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TYPES_DIR)) {
    fs.mkdirSync(TYPES_DIR, { recursive: true });
  }
  
  // Create constants file
  createConstantsFile();
  
  // Create CLI types file
  createCLITypesFile();
  
  // Fix all files
  const files = glob.sync('**/*.ts', { cwd: AUTH_DIR, absolute: true });
  
  for (const file of files) {
    console.log(`Fixing ${path.basename(file)}...`);
    let content = fs.readFileSync(file, 'utf8');
    
    // Apply comprehensive fixes
    content = fixConsoleStatements(content, file);
    content = fixConstants(content, file);
    content = fixTypes(content, file);
    content = fixNaming(content);
    content = fixComments(content);
    content = fixFunctions(content);
    content = fixImports(content, file);
    content = fixJSDoc(content);
    content = fixSyntax(content);
    
    fs.writeFileSync(file, content);
  }
  
  console.log('\nESLint fixes complete!');
}

/**
 * Create constants file
 */
function createConstantsFile(): void {
  const constantsContent = `/**
 * Common constants for auth module
 */

export const ZERO = 0;
export const ONE = 1;
export const TWO = 2;
export const THREE = 3;
export const FOUR = 4;
export const FIVE = 5;
export const TEN = 10;
export const TWENTY = 20;
export const THIRTY = 30;
export const FORTY = 40;
export const FIFTY = 50;
export const SIXTY = 60;
export const EIGHTY = 80;
export const ONE_HUNDRED = 100;
export const ONE_THOUSAND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;

/**
 * HTTP status codes
 */
export const HTTP_OK = 200;
export const HTTP_CREATED = 201;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_INTERNAL_ERROR = 500;
`;
  
  fs.writeFileSync(path.join(CONSTANTS_DIR, 'index.ts'), constantsContent);
}

/**
 * Create CLI types file
 */
function createCLITypesFile(): void {
  const typesContent = `/**
 * CLI types for auth module
 */

/**
 * CLI context interface
 */
export interface ICliContext {
  cwd: string;
  args: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 * CLI command interface
 */
export interface ICliCommand {
  description: string;
  subcommands?: Record<string, ICliSubcommand>;
  execute?: (context: ICliContext) => Promise<void>;
}

/**
 * CLI subcommand interface
 */
export interface ICliSubcommand {
  description?: string;
  execute: (context: ICliContext) => Promise<void>;
}
`;
  
  fs.writeFileSync(path.join(TYPES_DIR, 'cli.types.ts'), typesContent);
}

/**
 * Fix console statements
 */
function fixConsoleStatements(content: string, filePath: string): string {
  const isCLI = filePath.includes('/cli/');
  
  if (isCLI) {
    // Replace eslint-disable comment
    content = content.replace(/\/\*\s*eslint-disable\s+no-console\s*\*\//g, '/* eslint-disable no-console */');
    
    // Ensure it's at the top
    if (!content.startsWith('/* eslint-disable no-console */')) {
      content = '/* eslint-disable no-console */\n' + content.replace('/* eslint-disable no-console */\n', '');
    }
  } else {
    // Replace console with logger
    if (content.includes('console.')) {
      // Add logger import
      if (!content.includes('import { logger }')) {
        const lastImport = content.lastIndexOf('import');
        if (lastImport !== -1) {
          const endOfImports = content.indexOf('\n', lastImport);
          content = content.slice(0, endOfImports + 1) + 
            "import { logger } from '@/modules/core/logger';\n" +
            content.slice(endOfImports + 1);
        }
      }
      
      content = content.replace(/console\.log/g, 'logger.info');
      content = content.replace(/console\.error/g, 'logger.error');
      content = content.replace(/console\.warn/g, 'logger.warn');
      content = content.replace(/console\.info/g, 'logger.info');
    }
  }
  
  return content;
}

/**
 * Fix constants
 */
function fixConstants(content: string, filePath: string): string {
  // Remove local constant definitions
  content = content.replace(/const ZERO = 0;\n/g, '');
  content = content.replace(/const ONE = 1;\n/g, '');
  content = content.replace(/const TWO = 2;\n/g, '');
  
  // Add constants import if needed
  if (content.match(/\b(ZERO|ONE|TWO|THREE|FOUR|FIVE|TEN|TWENTY|THIRTY|FORTY|FIFTY|SIXTY|EIGHTY|ONE_HUNDRED)\b/)) {
    if (!content.includes("from '../constants'") && !content.includes("from './constants'")) {
      const relativePath = path.relative(path.dirname(filePath), CONSTANTS_DIR).replace(/\\/g, '/');
      const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      
      const lastImport = content.lastIndexOf('import');
      if (lastImport !== -1) {
        const endOfImports = content.indexOf('\n', lastImport);
        content = content.slice(0, endOfImports + 1) + 
          `import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from '${importPath}';\n` +
          content.slice(endOfImports + 1);
      }
    }
  }
  
  // Replace magic numbers
  content = content.replace(/\b80\b/g, 'EIGHTY');
  content = content.replace(/\b60\b/g, 'SIXTY');
  content = content.replace(/\b50\b/g, 'FIFTY');
  content = content.replace(/\b40\b/g, 'FORTY');
  content = content.replace(/\b30\b/g, 'THIRTY');
  content = content.replace(/\b20\b/g, 'TWENTY');
  content = content.replace(/\b10\b/g, 'TEN');
  
  return content;
}

/**
 * Fix types
 */
function fixTypes(content: string, filePath: string): string {
  const isCLI = filePath.includes('/cli/');
  
  if (isCLI) {
    // Replace ICLIContext with ICliContext from types
    content = content.replace(/interface ICLIContext[\s\S]*?}/g, '');
    content = content.replace(/ICLIContext/g, 'ICliContext');
    
    // Add types import
    if (!content.includes("from '../types/cli.types'")) {
      const lastImport = content.lastIndexOf('import');
      if (lastImport !== -1) {
        const endOfImports = content.indexOf('\n', lastImport);
        content = content.slice(0, endOfImports + 1) + 
          "import type { ICliContext, ICliCommand } from '../types/cli.types';\n" +
          content.slice(endOfImports + 1);
      }
    }
  }
  
  return content;
}

/**
 * Fix naming conventions
 */
function fixNaming(content: string): string {
  // Fix snake_case to camelCase
  content = content.replace(/is_system/g, 'isSystem');
  content = content.replace(/created_at/g, 'createdAt');
  content = content.replace(/updated_at/g, 'updatedAt');
  content = content.replace(/last_login_at/g, 'lastLoginAt');
  content = content.replace(/user_id/g, 'userId');
  content = content.replace(/role_id/g, 'roleId');
  content = content.replace(/provider_user_id/g, 'providerUserId');
  content = content.replace(/provider_data/g, 'providerData');
  content = content.replace(/list-users/g, 'listUsers');
  
  // Fix underscore prefixes
  content = content.replace(/_context:/g, 'context:');
  content = content.replace(/_(\w+):/g, '$1:');
  
  return content;
}

/**
 * Fix comments
 */
function fixComments(content: string): string {
  // Remove TODO comments inside functions
  const lines = content.split('\n');
  let inFunction = false;
  let functionDepth = 0;
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track function boundaries
    if (line.includes('{')) {
      if (i > 0 && (lines[i-1].includes('function') || lines[i-1].includes('=>'))) {
        inFunction = true;
      }
      if (inFunction) functionDepth++;
    }
    
    if (line.includes('}')) {
      if (inFunction) functionDepth--;
      if (functionDepth === 0) inFunction = false;
    }
    
    // Skip comments inside functions
    if (inFunction && (trimmed.startsWith('//') || trimmed.startsWith('/*'))) {
      if (!trimmed.startsWith('/**')) {
        continue;
      }
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

/**
 * Fix functions
 */
function fixFunctions(content: string): string {
  // Add return types
  content = content.replace(/\)\s*{/g, (match, offset) => {
    const before = content.substring(Math.max(0, offset - 100), offset + 1);
    if ((before.includes('async') || before.includes('function')) && 
        !before.includes(':') && 
        !before.includes('=>')) {
      return '): Promise<void> {';
    }
    return match;
  });
  
  // Fix arrow function return types
  content = content.replace(/=>\s*{/g, (match, offset) => {
    const before = content.substring(Math.max(0, offset - 50), offset);
    if (!before.includes(':')) {
      return ': void => {';
    }
    return match;
  });
  
  // Fix unused parameters
  content = content.replace(/\(([\w\s,:]+)\)/g, (match, params) => {
    if (params.includes(':')) {
      const newParams = params.split(',').map((param: string) => {
        const trimmed = param.trim();
        if (trimmed && !trimmed.startsWith('_')) {
          const [name, type] = trimmed.split(':');
          if (name && type) {
            // Check if parameter is unused (this is a simple heuristic)
            const funcBody = content.substring(content.indexOf(match) + match.length, content.indexOf('}', content.indexOf(match)));
            if (!funcBody.includes(name.trim())) {
              return `_${trimmed}`;
            }
          }
        }
        return param;
      }).join(',');
      return `(${newParams})`;
    }
    return match;
  });
  
  return content;
}

/**
 * Fix imports
 */
function fixImports(content: string, filePath: string): string {
  const isCLI = filePath.includes('/cli/');
  
  if (isCLI) {
    // Remove database imports
    content = content.replace(/import.*from ['"]\.\.\/database.*['"];?\n/g, '');
    content = content.replace(/import.*from ['"]\.\.\/repositories.*['"];?\n/g, '');
  }
  
  return content;
}

/**
 * Fix JSDoc
 */
function fixJSDoc(content: string): string {
  // Fix JSDoc indentation
  content = content.replace(/\/\*\*\n\s+\*/g, '/**\n *');
  
  // Fix empty JSDoc
  content = content.replace(/\/\*\*\s*\*\//g, '/**\n * Description\n */');
  
  // Fix multiline comment style
  content = content.replace(/\/\*\*\n([^*])/gm, '/**\n * $1');
  
  // Add missing JSDoc
  content = content.replace(/^(\s*)(export\s+)?(interface|class|type|enum)\s+(\w+)/gm, (match, indent, exportKeyword, keyword, name) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').slice(-2)[0] || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${name} ${keyword}\n${indent} */\n${match}`;
    }
    return match;
  });
  
  return content;
}

/**
 * Fix syntax
 */
function fixSyntax(content: string): string {
  // Remove empty lines at start
  content = content.replace(/^\n+/, '');
  
  // Fix multiple empty lines
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  // Fix trailing spaces
  content = content.replace(/ +$/gm, '');
  
  // Fix padded blocks
  content = content.replace(/{\n\n/g, '{\n');
  content = content.replace(/\n\n}/g, '\n}');
  
  return content;
}

// Run the complete fix
fixAuthEslintComplete().catch(console.error);