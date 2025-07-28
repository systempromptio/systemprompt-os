/**
 * ESLint rule to ensure database schema consistency
 * Enforces that:
 * 1. Generated database types exist for each schema.sql
 * 2. Repositories use generated types instead of manual row interfaces
 * 3. Manual row interface definitions are not allowed
 */

import fs from 'fs';
import path from 'path';

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce database schema and type consistency',
      category: 'Best Practices',
    },
    fixable: null,
    schema: [],
    messages: {
      missingGeneratedTypes: 'Database schema exists but generated types are missing. Run `npm run generate-types`.',
      manualRowInterface: 'Manual database row interfaces are not allowed. Use generated types from database.generated.ts',
      useGeneratedTypes: 'Import database row types from database.generated.ts instead of defining manually',
    },
  },

  create(context) {
    const filename = context.getFilename();

    // Only run on TypeScript files in modules
    if (!filename.includes('src/modules/core/') || !filename.endsWith('.ts')) {
      return {};
    }

    return {
      // Check for manual row interface definitions
      TSInterfaceDeclaration(node) {
        const interfaceName = node.id.name;
        
        // Flag manual database row interfaces
        if (interfaceName.endsWith('Row') && 
            (interfaceName.includes('Task') || 
             interfaceName.includes('Agent') || 
             interfaceName.includes('User') || 
             interfaceName.includes('Auth') ||
             interfaceName.includes('Config') ||
             interfaceName.includes('Log') ||
             interfaceName.includes('Session') ||
             interfaceName.includes('Mcp') ||
             interfaceName.includes('System') ||
             interfaceName.includes('Permission') ||
             interfaceName.includes('Role') ||
             interfaceName.includes('Module') ||
             interfaceName.includes('Dev') ||
             interfaceName.includes('Cli'))) {
          
          // Allow interfaces in database.generated.ts files
          if (filename.endsWith('database.generated.ts')) {
            return;
          }

          context.report({
            node,
            messageId: 'manualRowInterface',
            data: { interfaceName },
          });
        }
      },

      // Check repository files for proper imports
      ImportDeclaration(node) {
        if (filename.includes('/repositories/') && 
            node.source.value.includes('/types/') &&
            !node.source.value.includes('database.generated')) {
          
          // Check if any imported names look like row types
          const specifiers = node.specifiers.filter(spec => 
            spec.type === 'ImportSpecifier' && 
            spec.imported.name.endsWith('Row')
          );
          
          if (specifiers.length > 0) {
            context.report({
              node,
              messageId: 'useGeneratedTypes',
            });
          }
        }
      },

      // Check that generated types exist for schemas at the end of linting
      'Program:exit'() {
        // Only check files in module directories
        const moduleMatch = filename.match(/src\/modules\/core\/([^\/]+)\//);
        if (!moduleMatch) return;
        
        const moduleName = moduleMatch[1];
        const moduleDir = path.dirname(filename).split(moduleName)[0] + moduleName;
        
        const schemaPath = path.join(moduleDir, 'database', 'schema.sql');
        const generatedTypesPath = path.join(moduleDir, 'types', 'database.generated.ts');
        
        // If schema exists but generated types don't, report error
        if (fs.existsSync(schemaPath) && !fs.existsSync(generatedTypesPath)) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'missingGeneratedTypes',
          });
        }
      },
    };
  },
};