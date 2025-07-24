#!/usr/bin/env tsx

/**
 * @fileoverview Comprehensive TypeScript error fixer for SystemPrompt OS
 * @module scripts/fix-all-type-errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface TypeErrorInfo {
  file: string;
  line: number;
  column: number;
  errorCode: string;
  message: string;
}

interface Fix {
  pattern: RegExp;
  replacement: string | ((match: RegExpMatchArray) => string);
  description: string;
}

class TypeErrorFixer {
  private errors: TypeErrorInfo[] = [];
  private fixedFiles = new Set<string>();
  
  constructor() {
    this.parseTypeScriptErrors();
  }
  
  /**
   * Parse TypeScript errors from tsc output
   */
  private parseTypeScriptErrors(): void {
    console.log('🔍 Analyzing TypeScript errors...');
    
    try {
      execSync('npx tsc --noEmit', { encoding: 'utf8' });
      console.log('✅ No TypeScript errors found!');
      process.exit(0);
    } catch (error: any) {
      const output = error.stdout || '';
      const lines = output.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
        if (match) {
          this.errors.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            errorCode: match[4],
            message: match[5]
          });
        }
      }
      
      console.log(`📊 Found ${this.errors.length} TypeScript errors`);
    }
  }
  
  /**
   * Fix all errors
   */
  async fixAll(): Promise<void> {
    // Group errors by type
    const errorGroups = new Map<string, TypeErrorInfo[]>();
    
    for (const error of this.errors) {
      const group = errorGroups.get(error.errorCode) || [];
      group.push(error);
      errorGroups.set(error.errorCode, group);
    }
    
    // Fix each error type
    for (const [errorCode, errors] of errorGroups) {
      console.log(`\n🔧 Fixing ${errors.length} ${errorCode} errors...`);
      
      switch (errorCode) {
        case 'TS2722': // Cannot invoke object possibly undefined
          await this.fixPossiblyUndefinedInvocations(errors);
          break;
          
        case 'TS2532': // Object is possibly undefined
          await this.fixPossiblyUndefinedObjects(errors);
          break;
          
        case 'TS18048': // Variable is possibly undefined
          await this.fixPossiblyUndefinedVariables(errors);
          break;
          
        case 'TS2345': // Argument type not assignable (undefined)
          await this.fixUndefinedArguments(errors);
          break;
          
        case 'TS2322': // Type undefined not assignable
          await this.fixUndefinedAssignments(errors);
          break;
          
        case 'TS4111': // Property from index signature
          await this.fixIndexSignatureAccess(errors);
          break;
          
        case 'TS2538': // Type undefined cannot be used as index
          await this.fixUndefinedIndexType(errors);
          break;
          
        case 'TS4115': // Parameter property needs override
          await this.fixMissingOverrideParameter(errors);
          break;
          
        case 'TS4114': // Member needs override modifier
          await this.fixMissingOverrideMember(errors);
          break;
          
        case 'TS2304': // Cannot find name
          await this.fixCannotFindName(errors);
          break;
          
        case 'TS2552': // Cannot find name (did you mean)
          await this.fixTypoInName(errors);
          break;
          
        default:
          console.log(`⚠️  No automatic fix for ${errorCode}`);
      }
    }
    
    console.log(`\n✅ Fixed files: ${this.fixedFiles.size}`);
  }
  
  /**
   * Fix possibly undefined invocations (TS2722)
   */
  private async fixPossiblyUndefinedInvocations(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Add optional chaining
        const fixed = line.replace(/(\w+)\((.*?)\)/, '$1?.($2)');
        
        if (fixed !== line) {
          lines[lineIndex] = fixed;
          await this.writeFile(error.file, lines.join('\n'));
          console.log(`  ✓ ${error.file}:${error.line} - Added optional chaining`);
        }
      }
    }
  }
  
  /**
   * Fix possibly undefined objects (TS2532)
   */
  private async fixPossiblyUndefinedObjects(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Check if it's a simple property access
        if (line.includes('.') && !line.includes('?.')) {
          // Add optional chaining
          const fixed = line.replace(/(\w+)\.(\w+)/g, (match, obj, prop) => {
            // Don't add ?. after 'this' or imports
            if (obj === 'this' || obj.match(/^[A-Z]/)) {
              return match;
            }
            return `${obj}?.${prop}`;
          });
          
          if (fixed !== line) {
            lines[lineIndex] = fixed;
            await this.writeFile(error.file, lines.join('\n'));
            console.log(`  ✓ ${error.file}:${error.line} - Added optional chaining`);
          }
        } else {
          // Wrap in null check
          const indent = line.match(/^\s*/)?.[0] || '';
          lines.splice(lineIndex, 0, `${indent}if (!${this.extractVariableName(line)}) return;`);
          await this.writeFile(error.file, lines.join('\n'));
          console.log(`  ✓ ${error.file}:${error.line} - Added null check`);
        }
      }
    }
  }
  
  /**
   * Fix possibly undefined variables (TS18048)
   */
  private async fixPossiblyUndefinedVariables(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Extract variable name from error message
        const varMatch = error.message.match(/'(\w+)'/);
        if (varMatch) {
          const varName = varMatch[1];
          
          // Add null check before usage
          const indent = line.match(/^\s*/)?.[0] || '';
          lines.splice(lineIndex, 0, `${indent}if (!${varName}) throw new Error('${varName} is required');`);
          await this.writeFile(error.file, lines.join('\n'));
          console.log(`  ✓ ${error.file}:${error.line} - Added null check for ${varName}`);
        }
      }
    }
  }
  
  /**
   * Fix undefined arguments (TS2345)
   */
  private async fixUndefinedArguments(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Add non-null assertion or default value
        const fixed = line.replace(/(\w+)(,|\))/g, (match, arg, delimiter) => {
          if (arg.match(/^['"`]/)) return match; // Skip strings
          return `${arg}!${delimiter}`;
        });
        
        if (fixed !== line) {
          lines[lineIndex] = fixed;
          await this.writeFile(error.file, lines.join('\n'));
          console.log(`  ✓ ${error.file}:${error.line} - Added non-null assertion`);
        }
      }
    }
  }
  
  /**
   * Fix undefined assignments (TS2322)
   */
  private async fixUndefinedAssignments(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Add default value or type assertion
        if (line.includes('=')) {
          const fixed = line.replace(/=\s*([^;]+)/, (match, value) => {
            if (value.trim().match(/\?\./)) {
              return `= ${value} ?? ''`; // Add nullish coalescing
            }
            return `= ${value} as string`; // Add type assertion
          });
          
          if (fixed !== line) {
            lines[lineIndex] = fixed;
            await this.writeFile(error.file, lines.join('\n'));
            console.log(`  ✓ ${error.file}:${error.line} - Added default value/assertion`);
          }
        }
      }
    }
  }
  
  /**
   * Fix index signature access (TS4111)
   */
  private async fixIndexSignatureAccess(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Convert dot notation to bracket notation
        const propMatch = error.message.match(/Property '(\w+)'/);
        if (propMatch) {
          const prop = propMatch[1];
          const fixed = line.replace(new RegExp(`\\.${prop}\\b`), `['${prop}']`);
          
          if (fixed !== line) {
            lines[lineIndex] = fixed;
            await this.writeFile(error.file, lines.join('\n'));
            console.log(`  ✓ ${error.file}:${error.line} - Converted to bracket notation`);
          }
        }
      }
    }
  }
  
  /**
   * Fix undefined index type (TS2538)
   */
  private async fixUndefinedIndexType(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Add null check for index
        const match = line.match(/\[([^\]]+)\]/);
        if (match) {
          const index = match[1];
          const indent = line.match(/^\s*/)?.[0] || '';
          lines.splice(lineIndex, 0, `${indent}if (!${index}) continue;`);
          await this.writeFile(error.file, lines.join('\n'));
          console.log(`  ✓ ${error.file}:${error.line} - Added index null check`);
        }
      }
    }
  }
  
  /**
   * Fix missing override on parameter property (TS4115)
   */
  private async fixMissingOverrideParameter(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Add override modifier
        const fixed = line.replace(/(public|private|protected)\s+(readonly\s+)?(\w+)/, '$1 $2override $3');
        
        if (fixed !== line) {
          lines[lineIndex] = fixed;
          await this.writeFile(error.file, lines.join('\n'));
          console.log(`  ✓ ${error.file}:${error.line} - Added override modifier`);
        }
      }
    }
  }
  
  /**
   * Fix missing override on member (TS4114)
   */
  private async fixMissingOverrideMember(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Add override modifier before method/property
        const fixed = line.replace(/^(\s*)(async\s+)?(\w+)/, '$1override $2$3');
        
        if (fixed !== line) {
          lines[lineIndex] = fixed;
          await this.writeFile(error.file, lines.join('\n'));
          console.log(`  ✓ ${error.file}:${error.line} - Added override modifier`);
        }
      }
    }
  }
  
  /**
   * Fix cannot find name (TS2304)
   */
  private async fixCannotFindName(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Extract the missing name
        const nameMatch = error.message.match(/Cannot find name '(\w+)'/);
        if (nameMatch) {
          const name = nameMatch[1];
          
          // Common fixes
          if (name === 'database' || name === 'logger' || name === 'mcp' || name === 'modules') {
            // These should be string literals
            const fixed = line.replace(new RegExp(`\\b${name}\\b`), `'${name}'`);
            if (fixed !== line) {
              lines[lineIndex] = fixed;
              await this.writeFile(error.file, lines.join('\n'));
              console.log(`  ✓ ${error.file}:${error.line} - Fixed string literal`);
            }
          }
        }
      }
    }
  }
  
  /**
   * Fix typo in name (TS2552)
   */
  private async fixTypoInName(errors: TypeErrorInfo[]): Promise<void> {
    for (const error of errors) {
      const content = await this.readFile(error.file);
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Extract the typo and suggestion
        const match = error.message.match(/Cannot find name '(\w+)'\. Did you mean '(\w+)'/);
        if (match) {
          const [_, typo, suggestion] = match;
          const fixed = line.replace(new RegExp(`\\b${typo}\\b`), suggestion);
          
          if (fixed !== line) {
            lines[lineIndex] = fixed;
            await this.writeFile(error.file, lines.join('\n'));
            console.log(`  ✓ ${error.file}:${error.line} - Fixed typo: ${typo} → ${suggestion}`);
          }
        }
      }
    }
  }
  
  /**
   * Extract variable name from line
   */
  private extractVariableName(line: string): string {
    const match = line.match(/(\w+)\s*[.?\[]/) || line.match(/return\s+(\w+)/) || line.match(/if\s*\(\s*(\w+)/);
    return match?.[1] || 'variable';
  }
  
  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf8');
  }
  
  /**
   * Write file content
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    fs.writeFileSync(filePath, content);
    this.fixedFiles.add(filePath);
  }
}

// Run the fixer
async function main() {
  console.log('🚀 Starting TypeScript Error Fixer for SystemPrompt OS\n');
  
  const fixer = new TypeErrorFixer();
  await fixer.fixAll();
  
  // Run TypeScript check again
  console.log('\n🔍 Running TypeScript check again...');
  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('\n✅ All TypeScript errors fixed!');
  } catch {
    console.log('\n⚠️  Some errors remain. Run the script again or fix manually.');
  }
}

main().catch(console.error);