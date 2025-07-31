#!/usr/bin/env tsx
/**
 * Standalone Type Generator Script
 * Can be run directly with tsx without bootstrapping the entire project
 */

import { TypeGenerationService } from '../services/type-generation';
import { LogSource } from '@/modules/core/logger/types';

// Simple console logger implementation for standalone use
class StandaloneLogger {
  info(source: LogSource, message: string): void {
    console.log(`[INFO] [${source}] ${message}`);
  }

  warn(source: LogSource, message: string): void {
    console.warn(`[WARN] [${source}] ${message}`);
  }

  error(source: LogSource, message: string): void {
    console.error(`[ERROR] [${source}] ${message}`);
  }

  debug(source: LogSource, message: string): void {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] [${source}] ${message}`);
    }
  }
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const moduleIndex = args.findIndex(arg => arg === '--module' || arg === '-m');
  const patternIndex = args.findIndex(arg => arg === '--pattern' || arg === '-p');
  const typesIndex = args.findIndex(arg => arg === '--types' || arg === '-t');
  
  const module = moduleIndex >= 0 ? args[moduleIndex + 1] : undefined;
  const pattern = patternIndex >= 0 ? args[patternIndex + 1] : undefined;
  const typesArg = typesIndex >= 0 ? args[typesIndex + 1] : undefined;
  
  if (!module && !pattern) {
    console.error('Error: Either --module or --pattern is required');
    console.log('');
    console.log('Usage:');
    console.log('  tsx src/modules/core/dev/cli/generate-types-standalone.ts --module <module-name>');
    console.log('  tsx src/modules/core/dev/cli/generate-types-standalone.ts --pattern <glob-pattern>');
    console.log('  tsx src/modules/core/dev/cli/generate-types-standalone.ts --module users --types database,interfaces');
    console.log('');
    console.log('Options:');
    console.log('  -m, --module <name>    Module name to generate types for');
    console.log('  -p, --pattern <glob>   Glob pattern to match files');
    console.log('  -t, --types <types>    Comma-separated list of types (database,interfaces,schemas,service-schemas,type-guards,all)');
    console.log('');
    console.log('Examples:');
    console.log('  tsx src/modules/core/dev/cli/generate-types-standalone.ts --module users');
    console.log('  tsx src/modules/core/dev/cli/generate-types-standalone.ts --pattern "src/modules/core/*/*.ts"');
    process.exit(1);
  }

  const validTypes = ['database', 'interfaces', 'schemas', 'service-schemas', 'type-guards', 'all'] as const;
  type ValidType = typeof validTypes[number];
  
  const types: ValidType[] = typesArg 
    ? typesArg.split(',').filter((t): t is ValidType => validTypes.includes(t as ValidType))
    : ['all'];

  try {
    // Create standalone logger
    const logger = new StandaloneLogger() as any;
    
    // Initialize type generator
    const typeGenerator = TypeGenerationService.getInstance(logger);
    
    if (module) {
      console.log(`🔄 Generating types for '${module}' module...`);
    } else {
      console.log(`🔄 Generating types for pattern '${pattern}'...`);
    }
    
    // Generate types
    await typeGenerator.generateTypes({
      module,
      pattern,
      types
    });
    
    if (module) {
      console.log(`✅ Successfully generated types for '${module}' module`);
      console.log('Generated files:');
      if (types.includes('all') || types.includes('database')) {
        console.log(`  • src/modules/core/${module}/types/database.generated.ts`);
      }
      if (types.includes('all') || types.includes('schemas')) {
        console.log(`  • src/modules/core/${module}/types/${module}.module.generated.ts`);
      }
      if (types.includes('all') || types.includes('service-schemas')) {
        console.log(`  • src/modules/core/${module}/types/${module}.service.generated.ts`);
      }
    } else {
      console.log(`✅ Successfully generated types for pattern`);
    }
    
  } catch (error) {
    console.error('❌ Failed to generate types:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});