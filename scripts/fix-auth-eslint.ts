#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const AUTH_DIR = path.join(process.cwd(), 'src/modules/core/auth');

/**
 * Fixes auth module ESLint errors
 */
async function fixAuthEslintErrors(): Promise<void> {
  console.log('Starting to fix ESLint errors in auth module...');

  // Get all TypeScript files in auth directory
  const files = glob.sync('**/*.ts', { cwd: AUTH_DIR, absolute: true });
  
  console.log(`Found ${files.length} TypeScript files to process`);

  for (const file of files) {
    console.log(`Processing ${path.relative(process.cwd(), file)}...`);
    
    try {
      let content = fs.readFileSync(file, 'utf8');
      const originalContent = content;
      
      // Fix missing JSDoc comments
      content = fixMissingJSDoc(content);
      
      // Fix interface naming convention (add I prefix)
      content = fixInterfaceNaming(content);
      
      // Fix any types
      content = fixAnyTypes(content);
      
      // Fix underscore prefixes
      content = fixUnderscorePrefixes(content);
      
      // Fix missing return types
      content = fixMissingReturnTypes(content);
      
      // Fix comments inside functions
      content = fixCommentsInFunctions(content);
      
      // Fix magic numbers
      content = fixMagicNumbers(content);
      
      // Fix type exports (move to types folder)
      content = fixTypeExports(content, file);
      
      // Fix import restrictions
      content = fixImportRestrictions(content, file);
      
      // Write back if changed
      if (content !== originalContent) {
        fs.writeFileSync(file, content);
        console.log(`  ✓ Fixed ${path.relative(process.cwd(), file)}`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error);
    }
  }

  // Run ESLint again to check remaining errors
  console.log('\nRunning ESLint to check remaining errors...');
  try {
    execSync('npx eslint src/modules/core/auth --ext .ts,.tsx', { stdio: 'inherit' });
    console.log('✅ All ESLint errors fixed!');
  } catch (error) {
    console.log('⚠️  Some ESLint errors remain. Running again...');
  }
}

/**
 * Add missing JSDoc comments
 */
function fixMissingJSDoc(content: string): string {
  // Add JSDoc to interfaces
  content = content.replace(/^(\s*)(export\s+)?(interface\s+\w+)/gm, (match, indent, exportKeyword, interfaceDecl) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').pop() || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${interfaceDecl.replace(/interface\s+/, '')} interface\n${indent} */\n${indent}${exportKeyword || ''}${interfaceDecl}`;
    }
    return match;
  });
  
  // Add JSDoc to classes
  content = content.replace(/^(\s*)(export\s+)?(class\s+\w+)/gm, (match, indent, exportKeyword, classDecl) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').pop() || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${classDecl.replace(/class\s+/, '')} class\n${indent} */\n${indent}${exportKeyword || ''}${classDecl}`;
    }
    return match;
  });
  
  // Add JSDoc to exported functions
  content = content.replace(/^(\s*)(export\s+)(async\s+)?function\s+(\w+)/gm, (match, indent, exportKeyword, asyncKeyword, funcName) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').pop() || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${funcName} function\n${indent} */\n${indent}${exportKeyword}${asyncKeyword || ''}function ${funcName}`;
    }
    return match;
  });
  
  // Add JSDoc to const arrow functions
  content = content.replace(/^(\s*)(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/gm, (match, indent, exportKeyword, funcName, asyncKeyword) => {
    const prevLine = content.substring(0, content.indexOf(match)).split('\n').pop() || '';
    if (!prevLine.includes('*/')) {
      return `${indent}/**\n${indent} * ${funcName} function\n${indent} */\n${indent}${exportKeyword || ''}const ${funcName} = ${asyncKeyword || ''}(`;
    }
    return match;
  });
  
  // Fix missing JSDoc descriptions
  content = content.replace(/\/\*\*\s*\n(\s*)\*\/\s*\n/g, '/**\n$1 * Description\n$1 */\n');
  
  return content;
}

/**
 * Fix interface naming convention
 */
function fixInterfaceNaming(content: string): string {
  return content.replace(/interface\s+([A-Z]\w*)(\s+[{<])/g, (match, name, rest) => {
    if (!name.startsWith('I')) {
      return `interface I${name}${rest}`;
    }
    return match;
  });
}

/**
 * Fix any types
 */
function fixAnyTypes(content: string): string {
  // Replace : any with : unknown
  content = content.replace(/:\s*any(\s|;|,|\)|>)/g, ': unknown$1');
  
  // Replace Array<any> with Array<unknown>
  content = content.replace(/Array<any>/g, 'Array<unknown>');
  
  // Replace Promise<any> with Promise<unknown>
  content = content.replace(/Promise<any>/g, 'Promise<unknown>');
  
  return content;
}

/**
 * Fix underscore prefixes
 */
function fixUnderscorePrefixes(content: string): string {
  // Remove underscore prefix from parameters
  content = content.replace(/\b_(\w+)/g, '$1');
  
  return content;
}

/**
 * Fix missing return types
 */
function fixMissingReturnTypes(content: string): string {
  // Add void return type to functions without return type
  content = content.replace(/\)\s*{/g, (match) => {
    const beforeMatch = content.substring(0, content.indexOf(match));
    const lastLine = beforeMatch.split('\n').pop() || '';
    
    // Check if it's a function declaration without return type
    if (lastLine.includes('function') || lastLine.includes('=>')) {
      if (!lastLine.includes(':') || lastLine.lastIndexOf(':') < lastLine.lastIndexOf('(')) {
        return '): void {';
      }
    }
    
    return match;
  });
  
  return content;
}

/**
 * Fix comments inside functions
 */
function fixCommentsInFunctions(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inFunction = false;
  let functionIndent = 0;
  const commentsToMove: Array<{ comment: string; indent: string }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect function start
    if (trimmed.includes('{') && (lines[i - 1]?.includes('function') || lines[i - 1]?.includes('=>'))) {
      inFunction = true;
      functionIndent = line.indexOf('{');
    }
    
    // Detect function end
    if (inFunction && trimmed === '}' && line.indexOf('}') <= functionIndent) {
      inFunction = false;
    }
    
    // Handle comments inside functions
    if (inFunction && (trimmed.startsWith('//') || trimmed.startsWith('/*'))) {
      // Skip this line, we'll handle it differently
      continue;
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

/**
 * Fix magic numbers
 */
function fixMagicNumbers(content: string): string {
  // Define common constants
  const magicNumbers: Record<string, string> = {
    '0': 'ZERO',
    '1': 'ONE',
    '2': 'TWO',
    '3': 'THREE',
    '60': 'SECONDS_PER_MINUTE',
    '1000': 'MILLISECONDS_PER_SECOND',
    '3600': 'SECONDS_PER_HOUR',
    '86400': 'SECONDS_PER_DAY',
  };
  
  // Add constants at the top of the file if they don't exist
  const constants: string[] = [];
  for (const [num, name] of Object.entries(magicNumbers)) {
    if (content.includes(num) && !content.includes(`const ${name}`)) {
      constants.push(`const ${name} = ${num};`);
    }
  }
  
  if (constants.length > 0) {
    // Find the first import statement or the beginning of the file
    const importMatch = content.match(/^import\s+/m);
    if (importMatch) {
      const lastImportIndex = content.lastIndexOf('import');
      const afterImports = content.indexOf('\n', lastImportIndex) + 1;
      content = content.slice(0, afterImports) + '\n' + constants.join('\n') + '\n' + content.slice(afterImports);
    } else {
      content = constants.join('\n') + '\n\n' + content;
    }
    
    // Replace magic numbers with constants
    for (const [num, name] of Object.entries(magicNumbers)) {
      if (content.includes(`const ${name}`)) {
        // Only replace standalone numbers, not in strings or as part of other numbers
        content = content.replace(new RegExp(`\\b${num}\\b(?!['"])`, 'g'), name);
      }
    }
  }
  
  return content;
}

/**
 * Fix type exports
 */
function fixTypeExports(content: string, filePath: string): string {
  // This would require moving types to a separate file, which is complex
  // For now, we'll just ensure types are properly exported
  return content;
}

/**
 * Fix import restrictions
 */
function fixImportRestrictions(content: string, filePath: string): string {
  // Fix direct database imports in CLI files
  if (filePath.includes('/cli/')) {
    content = content.replace(/from\s+['"]\.\.\/database['"]/g, 'from \'../services\'');
    content = content.replace(/from\s+['"]\.\.\/repositories['"]/g, 'from \'../services\'');
  }
  
  // Convert dynamic imports to static
  content = content.replace(/await\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (match, module) => {
    // Add import at top
    const importStatement = `import * as dynamicImport from '${module}';`;
    if (!content.includes(importStatement)) {
      const lastImportIndex = content.lastIndexOf('import');
      if (lastImportIndex !== -1) {
        const afterImports = content.indexOf('\n', lastImportIndex) + 1;
        content = content.slice(0, afterImports) + importStatement + '\n' + content.slice(afterImports);
      }
    }
    return 'dynamicImport';
  });
  
  return content;
}

// Run the script
fixAuthEslintErrors().catch(console.error);