import path from 'path';

const IMPORT_RULES = {
  // CLI can import from services, types, utils, but not repositories or database
  cli: {
    canImport: ['services', 'types', 'utils'],
    cannotImport: ['repositories', 'database'],
    description: 'CLI commands should only use services, not direct repository or database access'
  },
  // Services can import from repositories, types, utils, but not CLI or database
  services: {
    canImport: ['repositories', 'types', 'utils'],
    cannotImport: ['cli', 'database'],
    description: 'Services should use repositories for data access, not direct database access'
  },
  // Repositories can import from database, types, utils, but not services or CLI
  repositories: {
    canImport: ['database', 'types', 'utils'],
    cannotImport: ['cli', 'services'],
    description: 'Repositories should not depend on services or CLI'
  },
  // Types can only import from other types
  types: {
    canImport: ['types'],
    cannotImport: ['cli', 'services', 'repositories', 'database', 'utils'],
    description: 'Type definitions should be independent and not import implementations'
  },
  // Utils can import from types only
  utils: {
    canImport: ['types'],
    cannotImport: ['cli', 'services', 'repositories', 'database'],
    description: 'Utilities should be independent helpers'
  },
  // Database files should be isolated
  database: {
    canImport: ['types'],
    cannotImport: ['cli', 'services', 'repositories', 'utils'],
    description: 'Database schemas should be independent'
  },
  // Tools can import from services and types
  tools: {
    canImport: ['services', 'types', 'utils'],
    cannotImport: ['cli', 'repositories', 'database'],
    description: 'Tools should use services for business logic'
  },
  // Prompts and resources are data files, shouldn't import code
  prompts: {
    canImport: [],
    cannotImport: ['cli', 'services', 'repositories', 'database', 'types', 'utils', 'tools'],
    description: 'Prompt files should not import code'
  },
  resources: {
    canImport: [],
    cannotImport: ['cli', 'services', 'repositories', 'database', 'types', 'utils', 'tools'],
    description: 'Resource files should not import code'
  },
  // Executors can use services and types
  executors: {
    canImport: ['services', 'types', 'utils'],
    cannotImport: ['cli', 'repositories', 'database'],
    description: 'Executors should use services for business logic'
  },
  // Providers can use types and utils
  providers: {
    canImport: ['types', 'utils'],
    cannotImport: ['cli', 'services', 'repositories', 'database'],
    description: 'Providers should be configuration-based'
  },
  // Schemas are pure data
  schemas: {
    canImport: [],
    cannotImport: ['cli', 'services', 'repositories', 'database', 'types', 'utils'],
    description: 'Schema files should be pure JSON or type definitions'
  },
  // Models can import types
  models: {
    canImport: ['types'],
    cannotImport: ['cli', 'services', 'repositories', 'database', 'utils'],
    description: 'Models should only define data structures'
  },
  // Interfaces define contracts
  interfaces: {
    canImport: ['types'],
    cannotImport: ['cli', 'services', 'repositories', 'database', 'utils'],
    description: 'Interfaces should only define contracts'
  },
  // Adapters can use types and utils
  adapters: {
    canImport: ['types', 'utils', 'interfaces'],
    cannotImport: ['cli', 'services', 'repositories'],
    description: 'Adapters should implement interfaces'
  },
  // Migrations are database-specific
  migrations: {
    canImport: [],
    cannotImport: ['cli', 'services', 'repositories', 'types', 'utils'],
    description: 'Migration files should be pure SQL or database operations'
  }
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce import restrictions between module folders',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          customRules: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                canImport: {
                  type: 'array',
                  items: { type: 'string' }
                },
                cannotImport: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: { type: 'string' }
              }
            }
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const customRules = options.customRules || {};
    const rules = { ...IMPORT_RULES, ...customRules };

    function checkImport(node) {
      const filename = context.filename || context.getFilename();
      
      // Skip non-module files
      if (!filename.includes('/src/modules/')) {
        return;
      }

      // Determine if this is a core module based on file path
      const isInCoreModule = filename.includes('/src/modules/core/');

      // Get the folder type of the current file
      const currentFileMatch = filename.match(/\/src\/modules\/(?:core|extension)\/[^/]+\/([^/]+)\//);
      if (!currentFileMatch) {
        return;
      }
      
      const currentFolder = currentFileMatch[1];
      const rule = rules[currentFolder];
      
      if (!rule) {
        return;
      }

      // Get the imported module path
      let importPath = '';
      if (node.source) {
        importPath = node.source.value;
      } else if (node.parent && node.parent.source) {
        importPath = node.parent.source.value;
      }

      if (!importPath) {
        return;
      }

      // Resolve relative imports
      let resolvedPath = importPath;
      if (importPath.startsWith('.')) {
        const fileDir = path.dirname(filename);
        resolvedPath = path.resolve(fileDir, importPath);
      }

      // Check if it's importing from another module folder
      const importMatch = resolvedPath.match(/\/modules\/[^/]+\/([^/]+)\//);
      if (!importMatch) {
        return;
      }

      const importedFolder = importMatch[1];

      // Check if this import is allowed
      if (rule.cannotImport.includes(importedFolder)) {
        context.report({
          node,
          message: `${rule.description}. Cannot import from '${importedFolder}' folder.`
        });
      }
    }

    return {
      ImportDeclaration: checkImport,
      ImportExpression: checkImport,
      CallExpression(node) {
        // Check dynamic imports and require()
        if (
          (node.callee.type === 'Identifier' && node.callee.name === 'require') ||
          (node.callee.type === 'Import')
        ) {
          if (node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
            checkImport({
              source: { value: node.arguments[0].value },
              parent: node
            });
          }
        }
      }
    };
  }
};