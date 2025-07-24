import path from 'path';

const NAMING_CONVENTIONS = {
  cli: {
    pattern: /^[a-z][a-z0-9-]*(\.(command|ts))?$/,
    description: 'CLI files should use kebab-case'
  },
  services: {
    pattern: /^[a-z][a-z0-9-]*\.service\.ts$/,
    description: 'Service files should use kebab-case and end with .service.ts'
  },
  repositories: {
    pattern: /^[a-z][a-z0-9-]*\.repository\.ts$/,
    description: 'Repository files should use kebab-case and end with .repository.ts'
  },
  types: {
    pattern: /^(index\.ts|[a-z][a-z0-9-]*\.(types|interface|d)\.ts)$/,
    description: 'Type files should use kebab-case and end with .types.ts, .interface.ts, or .d.ts'
  },
  utils: {
    pattern: /^[a-z][a-z0-9-]*\.ts$/,
    description: 'Utility files should use kebab-case'
  },
  database: {
    pattern: /^[a-z][a-z0-9-_]*\.(sql|ts)$/,
    description: 'Database files should use lowercase with underscores'
  },
  prompts: {
    pattern: /^[a-z][a-z0-9-]*\.(md|json)$/,
    description: 'Prompt files should use kebab-case'
  },
  resources: {
    pattern: /^[a-z][a-z0-9-]*(\.[a-z]+)?$/,
    description: 'Resource files should use kebab-case'
  },
  tools: {
    pattern: /^[a-z][a-z0-9-]*(\.(tool\.(ts|json)|ts))$/,
    description: 'Tool files should use kebab-case and follow .tool.ts or .tool.json convention'
  },
  executors: {
    pattern: /^[a-z][a-z0-9-]*\.executor\.ts$/,
    description: 'Executor files should use kebab-case and end with .executor.ts'
  },
  providers: {
    pattern: /^[a-z][a-z0-9-]*\.(ts|yaml|yml)$/,
    description: 'Provider files should use kebab-case'
  },
  schemas: {
    pattern: /^[a-z][a-z0-9-]*\.(json|ts)$/,
    description: 'Schema files should use kebab-case'
  },
  models: {
    pattern: /^(index\.ts|[a-z][a-z0-9-]*\.ts)$/,
    description: 'Model files should use kebab-case'
  },
  interfaces: {
    pattern: /^[a-z][a-z0-9-]*\.interface\.ts$/,
    description: 'Interface files should use kebab-case and end with .interface.ts'
  },
  adapters: {
    pattern: /^[a-z][a-z0-9-]*\.adapter\.ts$/,
    description: 'Adapter files should use kebab-case and end with .adapter.ts'
  },
  migrations: {
    pattern: /^[0-9]{3}_[a-z][a-z0-9_]*\.(sql|ts)$/,
    description: 'Migration files should start with a 3-digit number followed by underscore and snake_case name'
  }
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce file naming conventions for module structure',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          customConventions: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                pattern: { type: 'string' },
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
    const customConventions = options.customConventions || {};
    const conventions = { ...NAMING_CONVENTIONS, ...customConventions };

    function checkFileName(node) {
      const filename = context.filename || context.getFilename();
      
      // Skip test files and non-module files
      if (filename.includes('.test.') || 
          filename.includes('.spec.') || 
          filename.includes('__tests__') ||
          filename.includes('__mocks__') ||
          !filename.includes('/src/modules/')) {
        return;
      }

      const moduleMatch = filename.match(/\/src\/modules\/[^/]+\/([^/]+)\/([^/]+)$/);
      if (!moduleMatch) {
        return;
      }

      const [, folderName, fileName] = moduleMatch;
      
      if (conventions[folderName]) {
        const convention = conventions[folderName];
        const regex = new RegExp(convention.pattern);
        
        if (!regex.test(fileName)) {
          context.report({
            node,
            message: `${convention.description}. Found: ${fileName}`
          });
        }
      }
    }

    return {
      Program: checkFileName
    };
  }
};