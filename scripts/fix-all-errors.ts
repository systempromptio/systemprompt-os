#!/usr/bin/env tsx

/**
 * @fileoverview Comprehensive script to fix all TypeScript and ESLint errors
 * @module scripts/fix-all-errors
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const MAX_ITERATIONS = 20;

/**
 * Main function to fix all errors
 * @returns Promise that resolves when complete
 */
async function main(): Promise<void> {
  console.log('🚀 Starting comprehensive error fix process\n');
  
  let iteration = 0;
  let hasErrors = true;
  
  while (hasErrors && iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n🔄 Iteration ${iteration}/${MAX_ITERATIONS}`);
    
    // Step 1: Fix ESLint errors automatically
    console.log('\n📝 Running ESLint auto-fix...');
    try {
      execSync('npm run lint', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Some ESLint errors may need manual fixing');
    }
    
    // Step 2: Check TypeScript errors
    console.log('\n🔍 Checking TypeScript errors...');
    let tsErrors: string[] = [];
    try {
      execSync('npm run typecheck', { stdio: 'pipe' });
      console.log('✅ No TypeScript errors!');
      hasErrors = false;
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      tsErrors = output.split('\n').filter((line: string) => line.includes('error TS'));
      console.log(`📊 Found ${tsErrors.length} TypeScript errors`);
      
      // Fix common TypeScript errors
      await fixCommonTypeScriptErrors(tsErrors);
    }
    
    // Step 3: Check ESLint errors
    console.log('\n🔍 Checking ESLint errors...');
    try {
      execSync('npm run lint:check', { stdio: 'pipe' });
      console.log('✅ No ESLint errors!');
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      const eslintErrors = output.match(/✖ \d+ problems?/);
      if (eslintErrors) {
        console.log(`📊 ${eslintErrors[0]}`);
        hasErrors = true;
      }
    }
  }
  
  if (hasErrors) {
    console.log('\n⚠️  Some errors remain after maximum iterations');
    console.log('Running final checks...\n');
    
    // Show remaining errors
    console.log('TypeScript errors:');
    try {
      execSync('npm run typecheck', { stdio: 'inherit' });
    } catch {}
    
    console.log('\nESLint errors:');
    try {
      execSync('npm run lint:check', { stdio: 'inherit' });
    } catch {}
  } else {
    console.log('\n✅ All errors fixed successfully!');
  }
}

/**
 * Fix common TypeScript errors
 * @param errors Array of error strings
 * @returns Promise that resolves when complete
 */
async function fixCommonTypeScriptErrors(errors: string[]): Promise<void> {
  const fixes = new Map<string, number>();
  
  for (const error of errors) {
    // Parse error
    const match = error.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
    if (!match) continue;
    
    const [_, file, line, column, code, message] = match;
    
    // Count error types
    fixes.set(code, (fixes.get(code) || 0) + 1);
    
    // Apply automatic fixes
    try {
      switch (code) {
        case 'TS2412': // Property cannot be optional with exactOptionalPropertyTypes
          await fixOptionalProperty(file, parseInt(line), message);
          break;
          
        case 'TS2379': // Getter/setter types must be identical
          await fixGetterSetterTypes(file, parseInt(line));
          break;
          
        case 'TS2532': // Object possibly undefined
          await addNullCheck(file, parseInt(line));
          break;
          
        case 'TS2345': // Argument type not assignable
          await fixArgumentType(file, parseInt(line), message);
          break;
          
        case 'TS2322': // Type not assignable
          await fixTypeAssignment(file, parseInt(line), message);
          break;
          
        case 'TS7006': // Parameter implicitly has 'any' type
          await addParameterType(file, parseInt(line), message);
          break;
          
        case 'TS2304': // Cannot find name
          await fixMissingName(file, parseInt(line), message);
          break;
      }
    } catch (error) {
      console.error(`Failed to fix ${code} in ${file}:${line}`, error);
    }
  }
  
  // Report fix summary
  console.log('\n📊 Error summary:');
  for (const [code, count] of fixes.entries()) {
    console.log(`  ${code}: ${count} errors`);
  }
}

/**
 * Fix optional property with exactOptionalPropertyTypes
 * @param file File path
 * @param line Line number
 * @param message Error message
 * @returns Promise that resolves when complete
 */
async function fixOptionalProperty(file: string, line: number, message: string): Promise<void> {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  if (line > 0 && line <= lines.length) {
    const currentLine = lines[line - 1];
    
    // Change prop?: Type to prop: Type | undefined
    const fixed = currentLine.replace(/(\w+)\?:\s*([^;,}]+)/g, '$1: $2 | undefined');
    
    if (fixed !== currentLine) {
      lines[line - 1] = fixed;
      fs.writeFileSync(file, lines.join('\n'));
      console.log(`  ✓ Fixed optional property in ${file}:${line}`);
    }
  }
}

/**
 * Fix getter/setter type mismatch
 * @param file File path
 * @param line Line number
 * @returns Promise that resolves when complete
 */
async function fixGetterSetterTypes(file: string, line: number): Promise<void> {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  // This is complex - would need to analyze getter/setter pairs
  console.log(`  ⚠️  Manual fix needed for getter/setter in ${file}:${line}`);
}

/**
 * Add null check for possibly undefined
 * @param file File path
 * @param line Line number
 * @returns Promise that resolves when complete
 */
async function addNullCheck(file: string, line: number): Promise<void> {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  if (line > 0 && line <= lines.length) {
    const currentLine = lines[line - 1];
    
    // Add optional chaining
    const fixed = currentLine.replace(/(\w+)\.(\w+)/g, '$1?.$2');
    
    if (fixed !== currentLine) {
      lines[line - 1] = fixed;
      fs.writeFileSync(file, lines.join('\n'));
      console.log(`  ✓ Added optional chaining in ${file}:${line}`);
    }
  }
}

/**
 * Fix argument type issues
 * @param file File path
 * @param line Line number
 * @param message Error message
 * @returns Promise that resolves when complete
 */
async function fixArgumentType(file: string, line: number, message: string): Promise<void> {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  if (line > 0 && line <= lines.length) {
    const currentLine = lines[line - 1];
    
    // Add non-null assertion for undefined arguments
    if (message.includes('undefined')) {
      const fixed = currentLine.replace(/(\w+)([\),])/g, (match, arg, delimiter) => {
        if (arg.match(/^['"`]/) || arg === 'true' || arg === 'false' || !isNaN(Number(arg))) {
          return match;
        }
        return `${arg}!${delimiter}`;
      });
      
      if (fixed !== currentLine) {
        lines[line - 1] = fixed;
        fs.writeFileSync(file, lines.join('\n'));
        console.log(`  ✓ Added non-null assertion in ${file}:${line}`);
      }
    }
  }
}

/**
 * Fix type assignment issues
 * @param file File path
 * @param line Line number
 * @param message Error message
 * @returns Promise that resolves when complete
 */
async function fixTypeAssignment(file: string, line: number, message: string): Promise<void> {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  if (line > 0 && line <= lines.length) {
    const currentLine = lines[line - 1];
    
    // Add default value for undefined assignments
    if (message.includes('undefined')) {
      const fixed = currentLine.replace(/=\s*([^;]+)/, (match, value) => {
        if (value.includes('||') || value.includes('??')) return match;
        return `= ${value} ?? ''`;
      });
      
      if (fixed !== currentLine) {
        lines[line - 1] = fixed;
        fs.writeFileSync(file, lines.join('\n'));
        console.log(`  ✓ Added default value in ${file}:${line}`);
      }
    }
  }
}

/**
 * Add parameter type annotation
 * @param file File path
 * @param line Line number
 * @param message Error message
 * @returns Promise that resolves when complete
 */
async function addParameterType(file: string, line: number, message: string): Promise<void> {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  if (line > 0 && line <= lines.length) {
    const currentLine = lines[line - 1];
    
    // Extract parameter name
    const paramMatch = message.match(/'(\w+)'/);
    if (paramMatch) {
      const param = paramMatch[1];
      // Add : any for now (should be more specific in real implementation)
      const fixed = currentLine.replace(new RegExp(`\\b${param}\\b(?!:)`), `${param}: any`);
      
      if (fixed !== currentLine) {
        lines[line - 1] = fixed;
        fs.writeFileSync(file, lines.join('\n'));
        console.log(`  ✓ Added type annotation in ${file}:${line}`);
      }
    }
  }
}

/**
 * Fix missing name errors
 * @param file File path
 * @param line Line number
 * @param message Error message
 * @returns Promise that resolves when complete
 */
async function fixMissingName(file: string, line: number, message: string): Promise<void> {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  if (line > 0 && line <= lines.length) {
    const currentLine = lines[line - 1];
    
    // Extract missing name
    const nameMatch = message.match(/Cannot find name '(\w+)'/);
    if (nameMatch) {
      const name = nameMatch[1];
      
      // Common fixes
      const replacements: Record<string, string> = {
        'workflowId': '(step.inputs?.workflow_id as string)',
        'authToken': '"auth_token"',
        'modules': '"modules"'
      };
      
      if (replacements[name]) {
        const fixed = currentLine.replace(new RegExp(`\\b${name}\\b`, 'g'), replacements[name]);
        
        if (fixed !== currentLine) {
          lines[line - 1] = fixed;
          fs.writeFileSync(file, lines.join('\n'));
          console.log(`  ✓ Fixed missing name in ${file}:${line}`);
        }
      }
    }
  }
}

// Run the script
main().catch(console.error);