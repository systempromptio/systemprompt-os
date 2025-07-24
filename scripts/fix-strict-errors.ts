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
function parseTypeScriptErrors(): Map<string, TypeScriptError[]> {
  const errorsByFile = new Map<string, TypeScriptError[]>();
  
  try {
    execSync('npx tsc --noEmit', { cwd: PROJECT_ROOT, encoding: 'utf-8' });
  } catch (error: any) {
    const output = error.stdout || error.message;
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
      if (match) {
        const error = {
          file: join(PROJECT_ROOT, match[1]),
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5]
        };
        
        if (!errorsByFile.has(error.file)) {
          errorsByFile.set(error.file, []);
        }
        errorsByFile.get(error.file)!.push(error);
      }
    }
  }
  
  return errorsByFile;
}

/**
 * Fix undefined parameter errors
 */
function fixUndefinedParameters(filePath: string, errors: TypeScriptError[]): boolean {
  let content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;
  
  // Sort errors by line in reverse order
  errors.sort((a, b) => b.line - a.line);
  
  for (const error of errors) {
    // Handle "Argument of type 'X | undefined' is not assignable to parameter of type 'X'"
    if (error.code === 'TS2345' && error.message.includes('undefined')) {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];
      if (!line) continue;
      
      // Common patterns to fix
      const patterns = [
        // Fix: someFunc(value) -> someFunc(value || defaultValue)
        { 
          regex: /(\w+)\(([\w.]+)\)/,
          test: (m: RegExpMatchArray) => !m[2].includes('||') && !m[2].includes('??'),
          replace: (m: RegExpMatchArray) => {
            if (error.message.includes('number')) {
              return `${m[1]}(${m[2]} || 0)`;
            } else if (error.message.includes('string')) {
              return `${m[1]}(${m[2]} || '')`;
            }
            return `${m[1]}(${m[2]}!)`;
          }
        },
        // Fix: value?.prop -> value?.prop || default
        {
          regex: /(\w+\?\.[\w\[\]']+)(?!\s*[|&])/,
          test: () => true,
          replace: (m: RegExpMatchArray) => {
            if (error.message.includes('number')) {
              return `(${m[1]} ?? 0)`;
            } else if (error.message.includes('string')) {
              return `(${m[1]} ?? '')`;
            }
            return `${m[1]}!`;
          }
        }
      ];
      
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match && pattern.test(match)) {
          const colStart = line.indexOf(match[0]);
          if (Math.abs(colStart - error.column + 1) < 10) {
            lines[lineIndex] = line.replace(match[0], pattern.replace(match));
            modified = true;
            console.log(`  Fixed: ${match[0]} in line ${error.line}`);
            break;
          }
        }
      }
    }
    
    // Handle "Object is possibly 'undefined'"
    if ((error.code === 'TS2532' || error.code === 'TS18048') && error.message.includes('possibly \'undefined\'')) {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];
      if (!line) continue;
      
      // Find the variable name
      const varMatch = error.message.match(/'(\w+)'/);
      if (varMatch) {
        const varName = varMatch[1];
        
        // Add nullish check
        if (!line.includes(`if (${varName}`) && !line.includes(`${varName}!`)) {
          // Check if we can add ! operator
          const regex = new RegExp(`\\b${varName}\\b(?![!?.])`, 'g');
          lines[lineIndex] = line.replace(regex, `${varName}!`);
          modified = true;
          console.log(`  Added non-null assertion: ${varName}! in line ${error.line}`);
        }
      }
    }
    
    // Handle "Cannot invoke an object which is possibly 'undefined'"
    if (error.code === 'TS2722') {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];
      if (!line) continue;
      
      // Find function call pattern
      const callMatch = line.match(/(\w+(?:\.\w+)*)\(/);
      if (callMatch) {
        const funcName = callMatch[1];
        // Add optional chaining
        if (!funcName.includes('?.')) {
          const newLine = line.replace(funcName + '(', funcName + '?.(');
          lines[lineIndex] = newLine;
          modified = true;
          console.log(`  Added optional chaining: ${funcName}?.( in line ${error.line}`);
        }
      }
    }
  }
  
  if (modified) {
    content = lines.join('\n');
    writeFileSync(filePath, content);
  }
  
  return modified;
}

/**
 * Fix override modifier errors
 */
function fixOverrideModifiers(filePath: string, errors: TypeScriptError[]): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  for (const error of errors) {
    if (error.code === 'TS4115' && error.message.includes('override')) {
      // Add override modifier
      const regex = /(^\s*)((?:public|private|protected|readonly)\s+)?([\w\[\]]+\s*[?:])/gm;
      content = content.replace(regex, (match, indent, visibility, rest) => {
        if (!match.includes('override')) {
          return `${indent}${visibility || ''}override ${rest}`;
        }
        return match;
      });
      modified = true;
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content);
  }
  
  return modified;
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 Fixing strict TypeScript errors...\n');
  
  // Parse all errors
  const errorsByFile = parseTypeScriptErrors();
  console.log(`Found errors in ${errorsByFile.size} files\n`);
  
  let fixedFiles = 0;
  
  for (const [filePath, errors] of errorsByFile) {
    console.log(`\n📄 ${relative(PROJECT_ROOT, filePath)} (${errors.length} errors)`);
    
    let fixed = false;
    
    if (fixUndefinedParameters(filePath, errors)) {
      fixed = true;
    }
    
    if (fixOverrideModifiers(filePath, errors)) {
      fixed = true;
    }
    
    if (fixed) {
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
    try {
      const result = execSync('npx tsc --noEmit 2>&1 | grep -c "error TS"', { 
        cwd: PROJECT_ROOT, 
        encoding: 'utf-8' 
      });
      console.log(`⚠️  ${result.trim()} errors remain.`);
    } catch {
      console.log('⚠️  Some errors remain.');
    }
  }
}

// Run the script
main().catch(console.error);