import path from 'path';

const MODULE_STRUCTURE = {
  cli: {
    pattern: /^.*\/cli\/[^/]+\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'CLI commands must be in the cli/ folder'
  },
  repositories: {
    pattern: /^.*\/repositories\/[^/]+\.repository\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'Repository files must be in repositories/ folder and end with .repository.ts'
  },
  services: {
    pattern: /^.*\/services\/[^/]+\.service\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'Service files must be in services/ folder and end with .service.ts'
  },
  types: {
    pattern: /^.*\/types\/(index\.ts|[^/]+\.types\.ts|[^/]+\.interface\.ts|[^/]+\.d\.ts)$/,
    allowedExtensions: ['.ts', '.d.ts'],
    description: 'Type definitions must be in types/ folder'
  },
  database: {
    pattern: /^.*\/database\/(schema\.sql|init\.sql|.*\.sql|models\/.*\.ts|.*\.ts)$/,
    allowedExtensions: ['.sql', '.ts'],
    description: 'Database files must be in database/ folder'
  },
  utils: {
    pattern: /^.*\/utils\/[^/]+\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'Utility files must be in utils/ folder'
  },
  prompts: {
    pattern: /^.*\/prompts\/.*\.(md|json)$/,
    allowedExtensions: ['.md', '.json'],
    description: 'Prompt files must be in prompts/ folder'
  },
  resources: {
    pattern: /^.*\/resources\/.*$/,
    allowedExtensions: ['.md', '.json', '.txt', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.xml', '.yaml', '.yml'],
    description: 'Resource files must be in resources/ folder'
  },
  tools: {
    pattern: /^.*\/tools\/([^/]+\.tool\.(ts|json)|[^/]+\.ts)$/,
    allowedExtensions: ['.ts', '.json'],
    description: 'Tool files must be in tools/ folder and follow naming convention'
  },
  executors: {
    pattern: /^.*\/executors\/[^/]+\.executor\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'Executor files must be in executors/ folder and end with .executor.ts'
  },
  providers: {
    pattern: /^.*\/providers\/(.*\.(yaml|yml|ts)|[^/]+\/.*\.ts)$/,
    allowedExtensions: ['.ts', '.yaml', '.yml'],
    description: 'Provider files must be in providers/ folder'
  },
  schemas: {
    pattern: /^.*\/schemas\/[^/]+\.(json|ts)$/,
    allowedExtensions: ['.json', '.ts'],
    description: 'Schema files must be in schemas/ folder'
  },
  models: {
    pattern: /^.*\/models\/[^/]+\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'Model files must be in models/ folder'
  },
  interfaces: {
    pattern: /^.*\/interfaces\/[^/]+\.interface\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'Interface files must be in interfaces/ folder and end with .interface.ts'
  },
  adapters: {
    pattern: /^.*\/adapters\/[^/]+\.adapter\.ts$/,
    allowedExtensions: ['.ts'],
    description: 'Adapter files must be in adapters/ folder and end with .adapter.ts'
  },
  migrations: {
    pattern: /^.*\/migrations\/.*\.(sql|ts)$/,
    allowedExtensions: ['.sql', '.ts'],
    description: 'Migration files must be in migrations/ folder'
  }
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce module folder structure conventions',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          enforceModuleRoot: {
            type: 'boolean',
            default: true
          },
          customPatterns: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                pattern: { type: 'string' },
                allowedExtensions: {
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
    const enforceModuleRoot = options.enforceModuleRoot !== false;
    const customPatterns = options.customPatterns || {};
    const patterns = { ...MODULE_STRUCTURE, ...customPatterns };

    function checkFile(node) {
      const filename = context.filename || context.getFilename();
      
      // Skip test files and non-module files
      if (filename.includes('.test.') || 
          filename.includes('.spec.') || 
          filename.includes('__tests__') ||
          filename.includes('__mocks__') ||
          !filename.includes('/src/modules/')) {
        return;
      }

      // Check if file is in a module - handle both core and extension modules
      const coreModuleMatch = filename.match(/\/src\/modules\/core\/[^/]+\/([^/]+)\//);
      const extensionModuleMatch = filename.match(/\/src\/modules\/extension\/[^/]+\/([^/]+)\//);
      const moduleMatch = coreModuleMatch || extensionModuleMatch;
      
      if (!moduleMatch) {
        // Check for module root files (index.ts, module.yaml)
        const rootFileMatch = filename.match(/\/src\/modules\/(?:core|extension)\/[^/]+\/([^/]+\.(ts|yaml))$/);
        if (rootFileMatch && enforceModuleRoot) {
          const fileName = rootFileMatch[1];
          if (fileName !== 'index.ts' && fileName !== 'module.yaml' && fileName !== 'README.md') {
            context.report({
              node,
              message: `Module root should only contain index.ts, module.yaml, or README.md files. Found: ${fileName}`
            });
          }
        }
        return;
      }

      const folderName = moduleMatch[1];
      
      // Check if this is a known folder type
      const folderType = Object.keys(patterns).find(key => folderName === key);
      
      if (folderType) {
        const rule = patterns[folderType];
        const regex = new RegExp(rule.pattern);
        
        if (!regex.test(filename)) {
          context.report({
            node,
            message: rule.description + `. File: ${path.basename(filename)}`
          });
          return;
        }

        // Check file extension
        const ext = path.extname(filename);
        if (!rule.allowedExtensions.includes(ext)) {
          context.report({
            node,
            message: `Invalid file extension '${ext}' in ${folderName}/ folder. Allowed: ${rule.allowedExtensions.join(', ')}`
          });
        }
      }
    }

    return {
      Program: checkFile
    };
  }
};