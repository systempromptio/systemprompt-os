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

// Fix tunnel.ts duplicate constants
function fixTunnelConstants(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/cli/tunnel.ts';
  if (!fs.existsSync(filePath)) return;
  
  let content = readFile(filePath);
  
  // Remove duplicate constant declarations
  content = content.replace(/\nconst FIVE = 5;/g, '');
  content = content.replace(/\nconst TWO = TWO;/g, '');
  content = content.replace(/\nconst THREE = THREE;/g, '');
  content = content.replace(/\nconst FOUR = FOUR;/g, '');
  
  writeFile(filePath, content);
  console.log('Fixed tunnel.ts duplicate constants');
}

// Fix auth-code-service.ts duplicate import
function fixAuthCodeServiceImport(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/services/auth-code-service.ts';
  let content = readFile(filePath);
  
  // Remove duplicate DatabaseService import
  const lines = content.split('\n');
  const filteredLines: string[] = [];
  let foundDatabaseImport = false;
  
  for (const line of lines) {
    if (line.includes('import type { DatabaseService }') && foundDatabaseImport) {
      continue; // Skip duplicate
    }
    if (line.includes('import { DatabaseService }') || line.includes('import type { DatabaseService }')) {
      foundDatabaseImport = true;
    }
    filteredLines.push(line);
  }
  
  content = filteredLines.join('\n');
  writeFile(filePath, content);
  console.log('Fixed auth-code-service.ts duplicate import');
}

// Fix token.service.ts issues
function fixTokenServiceIssues(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/services/token.service.ts';
  let content = readFile(filePath);
  
  // Remove duplicate property declaration
  content = content.replace(/\n\s*private readonly db: DatabaseService;\n/g, '');
  
  // Add missing property declarations in the class
  const classMatch = content.match(/export class TokenService \{[\s\S]*?private constructor\(\)/);
  if (classMatch) {
    let classContent = classMatch[0];
    
    // Add properties if missing
    if (!classContent.includes('private logger!:')) {
      classContent = classContent.replace(
        'private static instance: TokenService;',
        `private static instance: TokenService;
  private logger!: ILogger;
  private db!: DatabaseService;
  private config!: any;`
      );
    }
    
    content = content.replace(classMatch[0], classContent);
  }
  
  // Add missing constants to import if needed
  if (!content.includes('SECONDS_PER_MINUTE')) {
    content = content.replace(
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from \'../constants\';',
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED, SECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from \'../constants\';'
    );
  }
  
  writeFile(filePath, content);
  console.log('Fixed token.service.ts issues');
}

// Fix all service files for proper initialization
function fixServiceInitialization(): void {
  const services = [
    'auth.service.ts',
    'mfa.service.ts',
    'user-service.ts'
  ];
  
  const servicesPath = '/var/www/html/systemprompt-os/src/modules/core/auth/services';
  
  services.forEach(fileName => {
    const filePath = path.join(servicesPath, fileName);
    if (!fs.existsSync(filePath)) return;
    
    let content = readFile(filePath);
    
    // Ensure database import from module index
    content = content.replace(
      /import { DatabaseService } from ['"]@\/modules\/core\/database\/services\/database\.service\.js['"];?/g,
      'import { DatabaseService } from \'@/modules/core/database\';'
    );
    
    // Add missing imports
    if (!content.includes('import { LoggerService }')) {
      content = 'import { LoggerService } from \'@/modules/core/logger/services/logger.service.js\';\n' + content;
    }
    
    writeFile(filePath, content);
    console.log('Fixed service file:', fileName);
  });
}

// Fix all remaining unsafe member access
function addTypeAssertions(): void {
  const authPath = '/var/www/html/systemprompt-os/src/modules/core/auth';
  
  const processFile = (filePath: string): void => {
    if (!filePath.endsWith('.ts')) return;
    
    let content = readFile(filePath);
    let modified = false;
    
    // Add type assertion for DatabaseService.getInstance() calls
    if (content.includes('DatabaseService.getInstance()') && !content.includes('as DatabaseService')) {
      content = content.replace(
        /DatabaseService\.getInstance\(\)/g,
        '(DatabaseService.getInstance() as DatabaseService)'
      );
      modified = true;
    }
    
    // Fix error handling
    if (content.includes('error.message') && !content.includes('as Error')) {
      content = content.replace(
        /error\.message/g,
        '(error as Error).message'
      );
      modified = true;
    }
    
    if (modified) {
      writeFile(filePath, content);
      console.log('Added type assertions to:', filePath);
    }
  };
  
  // Process all TypeScript files
  const walkDir = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        processFile(fullPath);
      }
    }
  };
  
  walkDir(authPath);
}

// Main execution
console.log('Starting fix for remaining auth module issues...\n');

// Fix specific issues
fixTunnelConstants();
fixAuthCodeServiceImport();
fixTokenServiceIssues();
fixServiceInitialization();
addTypeAssertions();

console.log('\nRemaining issues fixed!');