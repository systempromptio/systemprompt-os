#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { join, dirname, relative } from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = join(dirname(new URL(import.meta.url).pathname), '..');

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

/**
 * Parse TypeScript errors from compiler output
 */
function parseTypeScriptErrors(): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  
  try {
    execSync('npx tsc --noEmit', { cwd: PROJECT_ROOT, encoding: 'utf-8' });
  } catch (error: any) {
    const output = error.stdout || error.message;
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match error pattern: src/file.ts(10,23): error TS4111: Property 'prop' comes from an index signature
      const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
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
 * Fix property access from index signature errors (TS4111)
 */
function fixIndexSignatureAccess(filePath: string, errors: TypeScriptError[]): boolean {
  const fileErrors = errors.filter(e => e.file === filePath && e.code === 'TS4111');
  if (fileErrors.length === 0) return false;
  
  let content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;
  
  // Sort errors by line and column in reverse order to avoid offset issues
  fileErrors.sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });
  
  for (const error of fileErrors) {
    // Extract property name from error message
    const propMatch = error.message.match(/Property '(\w+)' comes from an index signature/);
    if (!propMatch) continue;
    
    const propName = propMatch[1];
    const lineIndex = error.line - 1;
    const line = lines[lineIndex];
    
    if (!line) continue;
    
    // Find the property access pattern
    const dotAccessRegex = new RegExp(`\\.${propName}\\b`);
    const match = line.match(dotAccessRegex);
    
    if (match && match.index !== undefined) {
      // Replace .prop with ['prop']
      const before = line.substring(0, match.index);
      const after = line.substring(match.index + match[0].length);
      lines[lineIndex] = `${before}['${propName}']${after}`;
      modified = true;
      console.log(`  Fixed: .${propName} → ['${propName}']`);
    }
  }
  
  if (modified) {
    content = lines.join('\n');
    writeFileSync(filePath, content);
  }
  
  return modified;
}

/**
 * Fix undefined/null assignment errors for strict optional properties
 */
function fixOptionalPropertyTypes(filePath: string, errors: TypeScriptError[]): boolean {
  const fileErrors = errors.filter(e => 
    e.file === filePath && 
    (e.code === 'TS2322' || e.code === 'TS2345') &&
    e.message.includes('undefined')
  );
  
  if (fileErrors.length === 0) return false;
  
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Common patterns that need fixing
  const patterns = [
    // Fix parseInt calls that might return NaN
    {
      regex: /parseInt\(([^)]+)\)/g,
      replacement: 'parseInt($1) || 0'
    },
    // Fix optional chaining that returns undefined
    {
      regex: /(\w+)\?\.(\w+) \|\| (\w+)/g,
      replacement: '($1?.$2 ?? $3)'
    }
  ];
  
  for (const pattern of patterns) {
    const newContent = content.replace(pattern.regex, pattern.replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
      console.log(`  Applied pattern fix: ${pattern.regex}`);
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content);
  }
  
  return modified;
}

/**
 * Main function to fix all strict type errors
 */
async function main() {
  console.log('🔧 Fixing strict TypeScript errors...\n');
  
  // Step 1: Parse TypeScript errors
  console.log('📋 Analyzing TypeScript errors...');
  const errors = parseTypeScriptErrors();
  console.log(`Found ${errors.length} errors\n`);
  
  // Group errors by file
  const errorsByFile = new Map<string, TypeScriptError[]>();
  for (const error of errors) {
    if (!errorsByFile.has(error.file)) {
      errorsByFile.set(error.file, []);
    }
    errorsByFile.get(error.file)!.push(error);
  }
  
  // Step 2: Fix errors file by file
  let fixedFiles = 0;
  
  for (const [filePath, fileErrors] of errorsByFile) {
    console.log(`\n📄 ${relative(PROJECT_ROOT, filePath)}`);
    
    let fixed = false;
    
    // Fix index signature access errors
    if (fixIndexSignatureAccess(filePath, fileErrors)) {
      fixed = true;
    }
    
    // Fix optional property type errors
    if (fixOptionalPropertyTypes(filePath, fileErrors)) {
      fixed = true;
    }
    
    if (fixed) {
      fixedFiles++;
    }
  }
  
  console.log(`\n✨ Fixed ${fixedFiles} files`);
  
  // Step 3: Run final type check
  console.log('\n🔍 Running final type check...');
  try {
    execSync('npx tsc --noEmit', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    console.log('✅ All TypeScript errors fixed!');
  } catch {
    console.log('⚠️  Some errors remain. Running script again may help.');
  }
}

// Run the script
main().catch(console.error);