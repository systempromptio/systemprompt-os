#!/usr/bin/env tsx

/**
 * @fileoverview Fix remaining TypeScript errors
 * @module scripts/fix-remaining-type-errors
 */

import * as fs from 'fs';
import * as path from 'path';

interface Fix {
  file: string;
  line: number;
  oldText: string;
  newText: string;
}

const fixes: Fix[] = [
  // Fix auth service name assignment
  {
    file: 'src/modules/core/auth/services/auth.service.ts',
    line: 512,
    oldText: "name: (typeof input.providerData?.['name'] === 'string' ? input.providerData['name'] : undefined) ?? input.email.split('@')[0],",
    newText: "name: (typeof input.providerData?.['name'] === 'string' ? input.providerData['name'] : null) ?? input.email.split('@')[0],"
  },
  
  // Fix CLI service version
  {
    file: 'src/modules/core/cli/services/cli.service.ts',
    line: 103,
    oldText: "version: packageJson.version,",
    newText: "version: packageJson.version || '0.0.0',"
  },
  
  // Fix config index
  {
    file: 'src/modules/core/config/index.ts',
    line: 334,
    oldText: "if (!key) continue;",
    newText: "if (!key) continue;"
  },
  
  // Fix config providers
  {
    file: 'src/modules/core/config/providers/index.ts',
    line: 25,
    oldText: "enabledProviders: Object.keys(providers).filter(name => providers[name].enabled),",
    newText: "enabledProviders: Object.keys(providers).filter(name => providers[name]?.enabled),"
  },
  
  // Fix config database service
  {
    file: 'src/modules/core/config/services/config-database.service.ts',
    line: 49,
    oldText: "return this.mapRowToSetting(row);",
    newText: "return row ? this.mapRowToSetting(row) : null;"
  },
  
  {
    file: 'src/modules/core/config/services/config-database.service.ts',
    line: 184,
    oldText: "return this.mapRowToProvider(row);",
    newText: "return row ? this.mapRowToProvider(row) : null;"
  },
  
  // Fix database CLI query
  {
    file: 'src/modules/core/database/cli/query.ts',
    line: 131,
    oldText: "headers.push(column);",
    newText: "if (column) headers.push(column);"
  },
  
  {
    file: 'src/modules/core/database/cli/query.ts',
    line: 288,
    oldText: 'const height = Math.max(5, options.height - 10);',
    newText: 'const height = Math.max(5, (options.height || 20) - 10);'
  },
  
  // Fix database validate
  {
    file: 'src/modules/core/database/cli/validate.ts',
    line: 166,
    oldText: "if (!orphans) return;",
    newText: "if (!orphans) return [];"
  },
  
  // Fix migration service
  {
    file: 'src/modules/core/database/services/migration.service.ts',
    line: 221,
    oldText: "const moduleName = migrationFile.module;",
    newText: "const moduleName = migrationFile.module || 'unknown';"
  },
  
  {
    file: 'src/modules/core/database/services/migration.service.ts',
    line: 233,
    oldText: "const moduleName = migrationFile.module;",
    newText: "const moduleName = migrationFile.module || 'unknown';"
  },
  
  // Fix workflow executor
  {
    file: 'src/modules/core/events/executors/workflow.executor.ts',
    line: 381,
    oldText: "const maxIterations = parameters?.maxIterations || MAX_ITERATIONS;",
    newText: "const maxIterations = (parameters as any)?.['max_iterations'] || MAX_ITERATIONS;"
  },
  
  {
    file: 'src/modules/core/events/executors/workflow.executor.ts',
    line: 429,
    oldText: "workflowId: workflow_id,",
    newText: "workflowId: parameters.workflow_id,"
  },
  
  {
    file: 'src/modules/core/events/executors/workflow.executor.ts',
    line: 440,
    oldText: "const result = await workflowEngine.execute(workflow, data);",
    newText: "const result = await workflowEngine.execute(workflow, parameters.data || {});"
  },
  
  // Fix module manager service
  {
    file: 'src/modules/core/modules/services/module-manager.service.ts',
    line: 119,
    oldText: "const types = options === 'all' ? undefined : Array.isArray(options) ? options : options.types;",
    newText: "const types = options === 'all' ? undefined : Array.isArray(options) ? options : (options as DiscoveryOptions).types;"
  },
  
  {
    file: 'src/modules/core/modules/services/module-manager.service.ts',
    line: 556,
    oldText: "level: entry.level,\n        message: entry.message,",
    newText: "level: entry.level || 'info',\n        message: entry.message || '',"
  },
  
  // Fix modules CLI info
  {
    file: 'src/modules/core/modules/cli/info.ts',
    line: 57,
    oldText: "if (extensionData[commands]) {",
    newText: "if (extensionData['commands']) {"
  }
];

// Apply fixes
for (const fix of fixes) {
  try {
    const filePath = path.resolve(fix.file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    if (lines[fix.line - 1]?.includes(fix.oldText.split('\n')[0])) {
      lines[fix.line - 1] = lines[fix.line - 1].replace(fix.oldText, fix.newText);
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`✓ Fixed ${fix.file}:${fix.line}`);
    } else {
      console.log(`⚠️  Skipped ${fix.file}:${fix.line} - line doesn't match`);
    }
  } catch (error) {
    console.error(`✗ Failed to fix ${fix.file}:${fix.line}:`, error);
  }
}

console.log('\n🔍 Running TypeScript check...');
require('child_process').execSync('npx tsc --noEmit', { stdio: 'inherit' });