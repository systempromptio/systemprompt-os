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

// Fix audit.service.ts
function fixAuditService(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/services/audit.service.ts';
  let content = readFile(filePath);
  
  // Fix the malformed arrow function - missing opening parenthesis
  content = content.replace(
    'return rows.map((row) =>  {',
    'return rows.map((row) => ({'
  );
  
  // Remove extra closing parenthesis
  content = content.replace('}));', '}))');
  
  // Add missing imports
  if (!content.includes('import { DatabaseService }')) {
    content = content.replace(
      'import type { DatabaseService } from \'@/modules/core/database/services/database.service.js\';',
      `import { DatabaseService } from '@/modules/core/database/services/database.service.js';`
    );
  }
  
  writeFile(filePath, content);
  console.log('Fixed:', filePath);
}

// Fix auth-code-service.ts
function fixAuthCodeService(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/services/auth-code-service.ts';
  let content = readFile(filePath);
  
  // Add missing service initialization
  const classMatch = content.match(/export class AuthCodeService \{[\s\S]*?\n}/);
  if (classMatch) {
    let classContent = classMatch[0];
    
    // Add missing properties
    if (!classContent.includes('private logger:') && !classContent.includes('private db:')) {
      classContent = classContent.replace(
        'private constructor() {\n    // Initialize\n  }',
        `private logger!: ILogger;
  private db!: DatabaseService;

  private constructor() {
    // Initialize lazily when first used
  }`
      );
    }
    
    content = content.replace(classMatch[0], classContent);
  }
  
  // Add missing imports
  if (!content.includes('import { LoggerService }')) {
    content = `import { LoggerService } from '@/modules/core/logger/services/logger.service.js';
import { DatabaseService } from '@/modules/core/database/services/database.service.js';\n` + content;
  }
  
  // Add getters for lazy initialization
  const methodsStart = content.indexOf('async createAuthorizationCode');
  if (methodsStart > -1) {
    const beforeMethods = content.substring(0, methodsStart);
    const afterMethods = content.substring(methodsStart);
    
    const lazyGetters = `
  private getLogger(): ILogger {
    if (!this.logger) {
      this.logger = LoggerService.getInstance();
    }
    return this.logger;
  }

  private getDb(): DatabaseService {
    if (!this.db) {
      this.db = DatabaseService.getInstance();
    }
    return this.db;
  }

  `;
    
    content = beforeMethods + lazyGetters + afterMethods;
    
    // Replace all this.logger with this.getLogger()
    content = content.replace(/this\.logger\./g, 'this.getLogger().');
    
    // Replace all this.db with this.getDb()
    content = content.replace(/this\.db\./g, 'this.getDb().');
    content = content.replace(/this\.db\(/g, 'this.getDb()(');
  }
  
  writeFile(filePath, content);
  console.log('Fixed:', filePath);
}

// Fix token.service.ts
function fixTokenService(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/services/token.service.ts';
  let content = readFile(filePath);
  
  // Add missing service initialization
  const classMatch = content.match(/export class TokenService \{[\s\S]*?\n  private readonly db:/);
  if (classMatch) {
    let classContent = classMatch[0];
    
    // Replace with proper initialization
    classContent = classContent.replace(
      'private readonly db: DatabaseService;',
      `private logger!: ILogger;
  private db!: DatabaseService;
  private config!: any;`
    );
    
    content = content.replace(classMatch[0], classContent);
  }
  
  // Add constructor
  const constructorMatch = content.match(/private constructor\(\) \{[\s\S]*?\}/);
  if (constructorMatch) {
    content = content.replace(
      constructorMatch[0],
      `private constructor() {
    // Initialize lazily when first used
  }`
    );
  }
  
  // Add missing imports
  if (!content.includes('import { LoggerService }')) {
    content = `import { LoggerService } from '@/modules/core/logger/services/logger.service.js';\n` + content;
  }
  
  // Add getters for lazy initialization after constructor
  const afterConstructor = content.indexOf('private constructor()');
  if (afterConstructor > -1) {
    const endOfConstructor = content.indexOf('}', afterConstructor) + 1;
    const beforeGetters = content.substring(0, endOfConstructor);
    const afterGetters = content.substring(endOfConstructor);
    
    const lazyGetters = `

  private getLogger(): ILogger {
    if (!this.logger) {
      this.logger = LoggerService.getInstance();
    }
    return this.logger;
  }

  private getDb(): DatabaseService {
    if (!this.db) {
      this.db = DatabaseService.getInstance();
    }
    return this.db;
  }

  private getConfig(): any {
    if (!this.config) {
      // Default config - should be injected properly
      this.config = {
        jwt: {
          accessTokenTTL: 900,
          refreshTokenTTL: 2592000,
          algorithm: 'RS256',
          issuer: 'systemprompt-os',
          audience: 'systemprompt-os',
          privateKey: '',
          publicKey: ''
        }
      };
    }
    return this.config;
  }
`;
    
    content = beforeGetters + lazyGetters + afterGetters;
    
    // Replace all usages
    content = content.replace(/this\.logger\./g, 'this.getLogger().');
    content = content.replace(/this\.db\./g, 'this.getDb().');
    content = content.replace(/this\.config\./g, 'this.getConfig().');
  }
  
  // Fix constants import
  if (!content.includes('SECONDS_PER_MINUTE')) {
    content = content.replace(
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from \'../constants\';',
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED, SECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from \'../constants\';'
    );
  }
  
  writeFile(filePath, content);
  console.log('Fixed:', filePath);
}

// Fix index.ts syntax errors
function fixIndexFile(): void {
  const filePath = '/var/www/html/systemprompt-os/src/modules/core/auth/index.ts';
  let content = readFile(filePath);
  
  // Fix arrow function syntax errors
  content = content.replace(
    'setInterval(\n        () : void => {',
    'setInterval(\n        () => {'
  );
  
  // Add missing constants import
  if (!content.includes('SECONDS_PER_MINUTE')) {
    content = content.replace(
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED } from \'./constants\';',
      'import { ZERO, ONE, TWO, THREE, FOUR, FIVE, TEN, TWENTY, THIRTY, FORTY, FIFTY, SIXTY, EIGHTY, ONE_HUNDRED, SECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND, SECONDS_PER_HOUR, SECONDS_PER_DAY } from \'./constants\';'
    );
  }
  
  // Fix arrow function return statements
  content = content.replace(/service: \(\) => this\.authService \}/g, 'service: () => this.authService,');
  content = content.replace(/tokenService: \(\) => this\.tokenService \}/g, 'tokenService: () => this.tokenService,');
  content = content.replace(/userService: \(\) => this\.userService \}/g, 'userService: () => this.userService,');
  content = content.replace(/authCodeService: \(\) => this\.authCodeService \}/g, 'authCodeService: () => this.authCodeService,');
  content = content.replace(/mfaService: \(\) => this\.mfaService \}/g, 'mfaService: () => this.mfaService,');
  content = content.replace(/auditService: \(\) => this\.auditService \}/g, 'auditService: () => this.auditService,');
  content = content.replace(/getAllProviders: \(\) => this\.getAllProviders\(\) \}/g, 'getAllProviders: () => this.getAllProviders(),');
  content = content.replace(/getProviderRegistry: \(\) => this\.getProviderRegistry\(\) \}/g, 'getProviderRegistry: () => this.getProviderRegistry(),');
  
  writeFile(filePath, content);
  console.log('Fixed:', filePath);
}

// Main execution
console.log('Fixing syntax errors in auth module...\n');

fixAuditService();
fixAuthCodeService();
fixTokenService();
fixIndexFile();

console.log('\nSyntax fixes complete!');