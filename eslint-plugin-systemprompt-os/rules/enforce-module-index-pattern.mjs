/**
 * ESLint rule to enforce typed export pattern for module index files.
 * @file ESLint rule for module index pattern.
 */

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce typed export pattern for module index files',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingTypedExport: 'Module index files must export a typed get function that uses the module loader with proper type guards',
      missingTypeGuard: 'Module getter must validate exports with appropriate type guards',
      missingModuleLoader: 'Module getter must use getModuleLoader() to retrieve the module',
    },
  },

  create(context) {
    return {
      Program(node) {
        const filename = context.getFilename();
        
        // Only check index.ts files in server directories that use modules
        if (!filename.endsWith('/index.ts') || !filename.includes('/server/')) {
          return;
        }

        // Skip files that don't need module access
        if (filename.includes('/types/') || 
            filename.includes('/constants/') ||
            filename.includes('/utils/')) {
          return;
        }

        const sourceCode = context.getSourceCode();
        const text = sourceCode.getText();

        // Check if file imports from modules (indicating it needs module access)
        const importsFromModules = /@\/modules\//.test(text);
        if (!importsFromModules) {
          return;
        }

        // Check for typed export function pattern
        const hasTypedExport = /export\s+function\s+get\w+Module\s*\(\s*\)\s*:\s*\w+/.test(text);
        
        if (!hasTypedExport) {
          context.report({
            node,
            messageId: 'missingTypedExport',
          });
          return;
        }

        // Check for module loader usage
        const hasModuleLoader = /getModuleLoader\s*\(\s*\)/.test(text);
        
        if (!hasModuleLoader) {
          context.report({
            node,
            messageId: 'missingModuleLoader',
          });
          return;
        }

        // Check for type guard usage (at least one of the common patterns)
        const hasTypeGuard = /has\w+Exports\s*\(/.test(text) || 
                            /instanceof/.test(text) ||
                            /as\s+\w+ModuleExports/.test(text);
        
        if (!hasTypeGuard) {
          context.report({
            node,
            messageId: 'missingTypeGuard',
          });
        }
      },
    };
  },
};