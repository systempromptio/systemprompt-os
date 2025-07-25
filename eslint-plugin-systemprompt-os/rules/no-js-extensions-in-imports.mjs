/**
 * ESLint rule to enforce no .js extensions in imports
 * According to project standards, imports should NOT have file extensions
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow .js extensions in import statements',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      noJsExtension: 'Import statements should not include .js extensions. Remove the .js extension from "{{importPath}}".',
    },
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        
        // Check if import path ends with .js
        if (importPath.endsWith('.js')) {
          context.report({
            node: node.source,
            messageId: 'noJsExtension',
            data: {
              importPath,
            },
            fix(fixer) {
              // Remove the .js extension
              const fixedPath = importPath.slice(0, -3);
              return fixer.replaceText(node.source, `'${fixedPath}'`);
            },
          });
        }
      },

      // Also check dynamic imports
      CallExpression(node) {
        if (
          node.callee.type === 'Import' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          const importPath = node.arguments[0].value;
          
          if (importPath.endsWith('.js')) {
            context.report({
              node: node.arguments[0],
              messageId: 'noJsExtension',
              data: {
                importPath,
              },
              fix(fixer) {
                const fixedPath = importPath.slice(0, -3);
                return fixer.replaceText(node.arguments[0], `'${fixedPath}'`);
              },
            });
          }
        }
      },

      // Check export from statements
      ExportNamedDeclaration(node) {
        if (node.source && node.source.value.endsWith('.js')) {
          const importPath = node.source.value;
          
          context.report({
            node: node.source,
            messageId: 'noJsExtension',
            data: {
              importPath,
            },
            fix(fixer) {
              const fixedPath = importPath.slice(0, -3);
              return fixer.replaceText(node.source, `'${fixedPath}'`);
            },
          });
        }
      },

      ExportAllDeclaration(node) {
        if (node.source && node.source.value.endsWith('.js')) {
          const importPath = node.source.value;
          
          context.report({
            node: node.source,
            messageId: 'noJsExtension',
            data: {
              importPath,
            },
            fix(fixer) {
              const fixedPath = importPath.slice(0, -3);
              return fixer.replaceText(node.source, `'${fixedPath}'`);
            },
          });
        }
      },
    };
  },
};