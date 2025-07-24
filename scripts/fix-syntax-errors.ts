#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { join, dirname, relative } from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = join(dirname(new URL(import.meta.url).pathname), '..');

interface SyntaxError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

/**
 * Parse TypeScript syntax errors from compiler output
 */
function parseSyntaxErrors(): SyntaxError[] {
  const errors: SyntaxError[] = [];
  
  try {
    execSync('npx tsc --noEmit', { cwd: PROJECT_ROOT, encoding: 'utf-8' });
  } catch (error: any) {
    const output = error.stdout || error.message;
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match error pattern for syntax errors (TS1005)
      const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS1005): (.+)$/);
      if (match) {
        errors.push({
          file: join(PROJECT_ROOT, match[1]),
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5]
        });
      }
    }
  }
  
  return errors;
}

/**
 * Fix optional chaining with bracket notation syntax errors
 */
function fixOptionalChainingBrackets(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Fix pattern: ?.['prop'] should be ?.[prop]
  const pattern1 = /\?\['([^']+)'\]/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, '?.[$1]');
    modified = true;
  }
  
  // Fix pattern: ?['prop'] should be ?.['prop']
  const pattern2 = /([a-zA-Z_$][\w$]*)\?\['/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, '$1?.[\'');
    modified = true;
  }
  
  if (modified) {
    writeFileSync(filePath, content);
  }
  
  return modified;
}

/**
 * Fix parseInt multiplication errors
 */
function fixParseIntErrors(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Fix pattern: parseInt(x) || 0 * y should be (parseInt(x) || 0) * y
  const pattern = /parseInt\(([^)]+)\)\s*\|\|\s*0\s*\*\s*(\d+)/g;
  if (pattern.test(content)) {
    content = content.replace(pattern, '(parseInt($1) || 0) * $2');
    modified = true;
  }
  
  if (modified) {
    writeFileSync(filePath, content);
  }
  
  return modified;
}

/**
 * Main function to fix syntax errors
 */
async function main() {
  console.log('🔧 Fixing TypeScript syntax errors...\n');
  
  // Get all TypeScript files
  const files = await glob('src/**/*.ts', {
    cwd: PROJECT_ROOT,
    absolute: true,
    ignore: ['**/node_modules/**', '**/build/**', '**/dist/**']
  });
  
  // Fix common patterns in all files
  let fixedFiles = 0;
  
  for (const file of files) {
    let fixed = false;
    
    if (fixOptionalChainingBrackets(file)) {
      fixed = true;
    }
    
    if (fixParseIntErrors(file)) {
      fixed = true;
    }
    
    if (fixed) {
      console.log(`Fixed: ${relative(PROJECT_ROOT, file)}`);
      fixedFiles++;
    }
  }
  
  console.log(`\n✨ Fixed ${fixedFiles} files`);
  
  // Run final type check
  console.log('\n🔍 Running final type check...');
  try {
    execSync('npx tsc --noEmit', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    console.log('✅ All TypeScript errors fixed!');
  } catch {
    console.log('⚠️  Some errors remain.');
  }
}

// Run the script
main().catch(console.error);