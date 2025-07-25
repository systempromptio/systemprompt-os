#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

/**
 * Fix interface import naming convention issues
 * Changes imports like "LocalMCPServer" to "ILocalMCPServer"
 */
async function fixInterfaceImports() {
  console.log('🔍 Scanning for interface import issues...');
  
  const files = await glob('src/**/*.ts');
  let totalFixed = 0;
  
  // Common patterns where non-I prefixed names should be I prefixed
  const interfacePatterns = [
    // MCP types
    { from: 'LocalMCPServer', to: 'ILocalMCPServer' },
    { from: 'RemoteMCPServer', to: 'IRemoteMCPServer' },
    { from: 'RemoteMCPConfig', to: 'IRemoteMCPConfig' },
    { from: 'MCPServerModule', to: 'IMCPServerModule' },
    { from: 'MCPServerStatus', to: 'IMCPServerStatus' },
    { from: 'MCPLoaderOptions', to: 'IMCPLoaderOptions' },
    { from: 'MCPToolContext', to: 'IMCPToolContext' },
    { from: 'UserPermissionContext', to: 'IUserPermissionContext' },
    { from: 'ToolHandlerContext', to: 'IToolHandlerContext' },
  ];
  
  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let modified = false;
    
    for (const pattern of interfacePatterns) {
      // Fix in import statements
      const importRegex = new RegExp(
        `(import\\s+.*?\\{[^}]*?)\\b${pattern.from}\\b([^}]*?\\})`,
        'g'
      );
      
      if (importRegex.test(content)) {
        content = content.replace(importRegex, `$1${pattern.to}$2`);
        modified = true;
      }
      
      // Fix in type annotations (but not in actual code)
      const typeRegex = new RegExp(
        `:\\s*${pattern.from}\\b(?![a-zA-Z0-9_])`,
        'g'
      );
      
      if (typeRegex.test(content)) {
        content = content.replace(typeRegex, `: ${pattern.to}`);
        modified = true;
      }
    }
    
    if (modified) {
      writeFileSync(file, content);
      console.log(`✅ Fixed interface imports in ${file}`);
      totalFixed++;
    }
  }
  
  console.log(`\n🎉 Fixed ${totalFixed} files`);
}

fixInterfaceImports().catch(console.error);