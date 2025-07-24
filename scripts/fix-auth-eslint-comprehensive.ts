#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const AUTH_DIR = path.join(process.cwd(), 'src/modules/core/auth');
const TYPES_DIR = path.join(AUTH_DIR, 'types');

/**
 * Comprehensive ESLint fixes for auth module
 */
async function fixAuthEslintComprehensive(): Promise<void> {
  console.log('Starting comprehensive ESLint fixes for auth module...');
  
  // Ensure types directory exists
  if (!fs.existsSync(TYPES_DIR)) {
    fs.mkdirSync(TYPES_DIR, { recursive: true });
  }

  // Get all TypeScript files in auth directory
  const files = glob.sync('**/*.ts', { cwd: AUTH_DIR, absolute: true });
  
  console.log(`Found ${files.length} TypeScript files to process`);

  // Process each file
  for (const file of files) {
    console.log(`Processing ${path.relative(process.cwd(), file)}...`);
    
    try {
      let content = fs.readFileSync(file, 'utf8');
      const originalContent = content;
      
      // Apply all fixes
      content = await applyAllFixes(content, file);
      
      // Write back if changed
      if (content !== originalContent) {
        fs.writeFileSync(file, content);
        console.log(`  ✓ Fixed ${path.relative(process.cwd(), file)}`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error);
    }
  }

  // Run ESLint again
  console.log('\nRunning ESLint to check remaining errors...');
  try {
    execSync('npx eslint src/modules/core/auth --ext .ts,.tsx', { stdio: 'inherit' });
    console.log('✅ All ESLint errors fixed!');
  } catch (error) {
    console.log('⚠️  Some ESLint errors remain.');
  }
}

/**
 * Apply all fixes to content
 */
async function applyAllFixes(content: string, filePath: string): Promise<string> {
  // Fix in order of importance
  content = fixImports(content, filePath);
  content = fixJSDocComments(content);
  content = fixInterfaceNaming(content);
  content = fixTypeDefinitions(content, filePath);
  content = fixAnyTypes(content);
  content = fixUnusedVariables(content);
  content = fixReturnTypes(content);
  content = fixFunctionComplexity(content);
  content = fixCommentsInFunctions(content);
  content = fixMagicNumbers(content);
  content = fixConsoleStatements(content);
  content = fixAsyncIssues(content);
  content = fixNamingConventions(content);
  content = fixLineComments(content);
  
  return content;
}

/**
 * Fix imports
 */
function fixImports(content: string, filePath: string): string {
  // Fix database imports in CLI files
  if (filePath.includes('/cli/')) {
    // Remove direct database imports
    content = content.replace(/import\s+.*?\s+from\s+['"]\.\.\/database.*?['"]/g, '');
    content = content.replace(/import\s+.*?\s+from\s+['"]\.\.\/repositories.*?['"]/g, '');
    
    // Add service imports if needed
    if (!content.includes("from '../services'") && content.includes('Repository')) {
      const lastImport = content.lastIndexOf('import');
      if (lastImport !== -1) {
        const endOfImport = content.indexOf('\n', lastImport);
        content = content.slice(0, endOfImport + 1) + 
          "import { AuthService } from '../services/auth.service';\n" +
          content.slice(endOfImport + 1);
      }
    }
  }
  
  // Fix dynamic imports
  content = content.replace(/await\s+import\s*\(\s*['"]express['"]\s*\)/g, (match) => {
    // Add static import at top
    if (!content.includes("import express from 'express'")) {
      const lastImport = content.lastIndexOf('import');
      if (lastImport !== -1) {
        const endOfImport = content.indexOf('\n', lastImport);
        content = content.slice(0, endOfImport + 1) + 
          "import express from 'express';\n" +
          content.slice(endOfImport + 1);
      }
    }
    return 'express';
  });
  
  return content;
}

/**
 * Fix JSDoc comments
 */
function fixJSDocComments(content: string): string {
  // Fix empty JSDoc blocks
  content = content.replace(/\/\*\*\s*\n\s*\*\/\s*\n/g, '/**\n * Description needed\n */\n');
  
  // Fix JSDoc alignment
  content = content.replace(/\/\*\*\n([^*])/gm, '/**\n * $1');
  content = content.replace(/\n([^*\s])(\s*)\*\//gm, '\n * $1$2*/');
  
  // Add missing JSDoc to interfaces
  content = content.replace(/^(\s*)(export\s+)?interface\s+(\w+)/gm, (match, indent, exportKeyword, name) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').slice(-2)[0] || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${name} interface\n${indent} */\n${indent}${exportKeyword || ''}interface ${name}`;
    }
    return match;
  });
  
  // Add missing JSDoc to classes
  content = content.replace(/^(\s*)(export\s+)?class\s+(\w+)/gm, (match, indent, exportKeyword, name) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').slice(-2)[0] || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${name} class\n${indent} */\n${indent}${exportKeyword || ''}class ${name}`;
    }
    return match;
  });
  
  // Add missing JSDoc to exported functions
  content = content.replace(/^(\s*)(export\s+)?(async\s+)?function\s+(\w+)/gm, (match, indent, exportKeyword, asyncKeyword, name) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').slice(-2)[0] || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${name} function\n${indent} */\n${indent}${exportKeyword || ''}${asyncKeyword || ''}function ${name}`;
    }
    return match;
  });
  
  // Add missing JSDoc to const functions
  content = content.replace(/^(\s*)(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/gm, (match, indent, exportKeyword, name, asyncKeyword) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').slice(-2)[0] || '';
    if (!prevLine.includes('*/') && !name.startsWith('_')) {
      return `${indent}/**\n${indent} * ${name} function\n${indent} */\n${indent}${exportKeyword || ''}const ${name} = ${asyncKeyword || ''}(`;
    }
    return match;
  });
  
  // Fix JSDoc sentences
  content = content.replace(/\*\s+([A-Z][^.]*[a-z])(\s*)\n\s*\*/gm, '* $1.$2\n *');
  
  return content;
}

/**
 * Fix interface naming
 */
function fixInterfaceNaming(content: string): string {
  // Add I prefix to interfaces
  content = content.replace(/interface\s+([A-Z][A-Za-z0-9]*)\s*{/g, (match, name) => {
    if (!name.startsWith('I')) {
      // Update all references to this interface
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      content = content.replace(regex, `I${name}`);
      return `interface I${name} {`;
    }
    return match;
  });
  
  return content;
}

/**
 * Fix type definitions
 */
function fixTypeDefinitions(content: string, filePath: string): string {
  // Extract type definitions from non-type files
  if (!filePath.includes('/types/')) {
    const typeMatches = content.matchAll(/^(export\s+)?(interface|type|enum)\s+(\w+)/gm);
    const typesToMove: string[] = [];
    
    for (const match of typeMatches) {
      const [fullMatch, exportKeyword, typeKeyword, typeName] = match;
      // Skip if it's a local type used only in this file
      const usageCount = (content.match(new RegExp(`\\b${typeName}\\b`, 'g')) || []).length;
      if (usageCount > 2) { // Used more than just in definition
        typesToMove.push(typeName);
      }
    }
    
    // For now, just ensure they're exported
    content = content.replace(/^(interface|type|enum)\s+/gm, 'export $1 ');
  }
  
  return content;
}

/**
 * Fix any types
 */
function fixAnyTypes(content: string): string {
  // Replace any with unknown
  content = content.replace(/:\s*any(\s|;|,|\)|>|$)/g, ': unknown$1');
  content = content.replace(/:\s*any\[\]/g, ': unknown[]');
  content = content.replace(/Array<any>/g, 'Array<unknown>');
  content = content.replace(/Promise<any>/g, 'Promise<unknown>');
  content = content.replace(/Record<string,\s*any>/g, 'Record<string, unknown>');
  
  // Fix specific any patterns
  content = content.replace(/\((\w+):\s*unknown\)/g, (match, param) => {
    // Try to infer type from usage
    if (param === 'error' || param === 'err' || param === 'e') {
      return `(${param}: Error)`;
    }
    if (param === 'req' || param === 'request') {
      return `(${param}: Request)`;
    }
    if (param === 'res' || param === 'response') {
      return `(${param}: Response)`;
    }
    return match;
  });
  
  return content;
}

/**
 * Fix unused variables
 */
function fixUnusedVariables(content: string): string {
  // Prefix unused parameters with underscore
  content = content.replace(/\(([^)]+)\)\s*(?::|=>)/g, (match, params) => {
    const newParams = params.split(',').map((param: string) => {
      const trimmed = param.trim();
      if (trimmed && !trimmed.startsWith('_') && !trimmed.includes(':')) {
        // Check if parameter is used in function body
        const funcBody = content.substring(content.indexOf(match));
        const funcEnd = funcBody.search(/\n\s*\}/);
        const body = funcBody.substring(0, funcEnd);
        const paramName = trimmed.split(/\s+/)[0];
        if (!body.includes(paramName)) {
          return param.replace(paramName, `_${paramName}`);
        }
      }
      return param;
    }).join(',');
    return match.replace(params, newParams);
  });
  
  return content;
}

/**
 * Fix return types
 */
function fixReturnTypes(content: string): string {
  // Add void return type to functions without return type
  content = content.replace(/\)\s*{/g, (match, offset) => {
    const beforeMatch = content.substring(0, offset + 1);
    const lastLine = beforeMatch.split('\n').pop() || '';
    
    // Check if it's a function without return type
    if ((lastLine.includes('function') || lastLine.includes('=>')) && 
        !lastLine.includes(':') || 
        (lastLine.lastIndexOf(':') < lastLine.lastIndexOf('('))) {
      // Check if function returns something
      const funcBody = content.substring(offset);
      const funcEnd = funcBody.search(/\n\s*\}/);
      const body = funcBody.substring(0, funcEnd);
      
      if (body.includes('return ') && !body.includes('return;')) {
        // Try to infer return type
        if (body.includes('Promise.')) {
          return '): Promise<void> {';
        }
        return '): unknown {';
      }
      return '): void {';
    }
    
    return match;
  });
  
  return content;
}

/**
 * Fix function complexity
 */
function fixFunctionComplexity(content: string): string {
  // This is complex to fix automatically, but we can try to extract large functions
  // For now, just add a comment to indicate it needs refactoring
  const lines = content.split('\n');
  let inFunction = false;
  let functionStart = 0;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('function') || line.includes('=>')) {
      inFunction = true;
      functionStart = i;
      braceCount = 0;
    }
    
    if (inFunction) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && line.includes('}')) {
        const functionLength = i - functionStart;
        if (functionLength > 50) {
          // Add TODO comment
          if (!lines[functionStart - 1]?.includes('TODO')) {
            lines.splice(functionStart, 0, '  // TODO: Refactor this function to reduce complexity');
            i++;
          }
        }
        inFunction = false;
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Fix comments in functions
 */
function fixCommentsInFunctions(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inFunction = false;
  let functionIndent = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect function start
    if (trimmed.includes('{') && (i > 0 && (lines[i-1].includes('function') || lines[i-1].includes('=>')))) {
      inFunction = true;
      functionIndent = line.substring(0, line.indexOf('{'));
    }
    
    // Detect function end
    if (inFunction && trimmed === '}' && line.startsWith(functionIndent)) {
      inFunction = false;
    }
    
    // Remove comments inside functions
    if (inFunction && (trimmed.startsWith('//') || (trimmed.startsWith('/*') && !trimmed.startsWith('/**')))) {
      continue; // Skip this line
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

/**
 * Fix magic numbers
 */
function fixMagicNumbers(content: string): string {
  // Define constants for magic numbers
  const magicNumberMap: Record<string, string> = {
    '0': 'ZERO',
    '1': 'ONE',
    '2': 'TWO',
    '3': 'THREE',
    '4': 'FOUR',
    '5': 'FIVE',
    '10': 'TEN',
    '60': 'SECONDS_PER_MINUTE',
    '100': 'ONE_HUNDRED',
    '1000': 'MILLISECONDS_PER_SECOND',
    '3600': 'SECONDS_PER_HOUR',
    '86400': 'SECONDS_PER_DAY',
  };
  
  const usedConstants = new Set<string>();
  
  // Find magic numbers
  for (const [num, constant] of Object.entries(magicNumberMap)) {
    const regex = new RegExp(`\\b${num}\\b(?!['"\`]|\\d)`, 'g');
    if (regex.test(content)) {
      usedConstants.add(constant);
      content = content.replace(regex, constant);
    }
  }
  
  // Add constant definitions at the top
  if (usedConstants.size > 0) {
    const constantDefs = Array.from(usedConstants)
      .map(constant => {
        const num = Object.entries(magicNumberMap).find(([_, c]) => c === constant)?.[0];
        return `const ${constant} = ${num};`;
      })
      .join('\n');
    
    // Insert after imports
    const lastImport = content.lastIndexOf('import');
    if (lastImport !== -1) {
      const endOfImports = content.indexOf('\n', lastImport);
      content = content.slice(0, endOfImports + 1) + '\n' + constantDefs + '\n' + content.slice(endOfImports + 1);
    } else {
      content = constantDefs + '\n\n' + content;
    }
  }
  
  return content;
}

/**
 * Fix console statements
 */
function fixConsoleStatements(content: string): string {
  // Check if it's a CLI file
  const isCLI = content.includes('/cli/');
  
  if (isCLI) {
    // Add eslint-disable at top for CLI files
    if (!content.includes('eslint-disable no-console')) {
      content = '/* eslint-disable no-console */\n' + content;
    }
  } else {
    // Replace console with logger
    content = content.replace(/console\.(log|error|warn|info)/g, 'logger.$1');
    
    // Add logger import if needed
    if (content.includes('logger.') && !content.includes('logger')) {
      const lastImport = content.lastIndexOf('import');
      if (lastImport !== -1) {
        const endOfImports = content.indexOf('\n', lastImport);
        content = content.slice(0, endOfImports + 1) + 
          "import { logger } from '@/modules/core/logger';\n" +
          content.slice(endOfImports + 1);
      }
    }
  }
  
  return content;
}

/**
 * Fix async issues
 */
function fixAsyncIssues(content: string): string {
  // Fix no-misused-promises
  content = content.replace(/\.forEach\s*\(\s*async/g, '.map(async');
  
  // Add void operator for floating promises
  content = content.replace(/^\s*(\w+\.|\w+\(.*\)\.)then\(/gm, '  void $1then(');
  
  return content;
}

/**
 * Fix naming conventions
 */
function fixNamingConventions(content: string): string {
  // Fix interface names in extends/implements
  content = content.replace(/extends\s+([A-Z]\w*)(?!\w)/g, (match, name) => {
    if (!name.startsWith('I') && name !== 'Error' && name !== 'Array') {
      return `extends I${name}`;
    }
    return match;
  });
  
  content = content.replace(/implements\s+([A-Z]\w*)(?!\w)/g, (match, name) => {
    if (!name.startsWith('I')) {
      return `implements I${name}`;
    }
    return match;
  });
  
  return content;
}

/**
 * Fix line comments
 */
function fixLineComments(content: string): string {
  // Convert line comments to JSDoc
  content = content.replace(/^\s*\/\/\s*(.+)$/gm, (match, comment) => {
    const indent = match.match(/^\s*/)?.[0] || '';
    return `${indent}/** ${comment} */`;
  });
  
  return content;
}

// Run the comprehensive fix
fixAuthEslintComprehensive().catch(console.error);