/**
 * ESLint rule to enforce no .js extensions in imports
 * According to project standards, imports should NOT have file extensions
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow .js extensions in import statements for internal modules',
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
    // Helper to check if this is an internal import
    function isInternalImport(importPath) {
      return importPath.startsWith('@/') || 
             importPath.startsWith('./') || 
             importPath.startsWith('../');
    }

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        
        // Only check internal imports that end with .js
        if (importPath.endsWith('.js') && isInternalImport(importPath)) {
          context.report({
            node: node.source,
            messageId: 'noJsExtension',
            data: {
              importPath,
            },
            fix(fixer) {
              // Remove the .js extension
              const fixedPath = importPath.slice(0, -3);
              const quote = node.source.raw[0]; // Get the quote character (' or ")
              return fixer.replaceText(node.source, `${quote}${fixedPath}${quote}`);
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
          
          if (importPath.endsWith('.js') && isInternalImport(importPath)) {
            context.report({
              node: node.arguments[0],
              messageId: 'noJsExtension',
              data: {
                importPath,
              },
              fix(fixer) {
                const fixedPath = importPath.slice(0, -3);
                const quote = node.arguments[0].raw[0]; // Get the quote character
                return fixer.replaceText(node.arguments[0], `${quote}${fixedPath}${quote}`);
              },
            });
          }
        }
      },

      // Check export from statements
      ExportNamedDeclaration(node) {
        if (node.source && node.source.value.endsWith('.js')) {
          const importPath = node.source.value;
          
          if (isInternalImport(importPath)) {
            context.report({
              node: node.source,
              messageId: 'noJsExtension',
              data: {
                importPath,
              },
              fix(fixer) {
                const fixedPath = importPath.slice(0, -3);
                const quote = node.source.raw[0]; // Get the quote character
                return fixer.replaceText(node.source, `${quote}${fixedPath}${quote}`);
              },
            });
          }
        }
      },

      ExportAllDeclaration(node) {
        if (node.source && node.source.value.endsWith('.js')) {
          const importPath = node.source.value;
          
          if (isInternalImport(importPath)) {
            context.report({
              node: node.source,
              messageId: 'noJsExtension',
              data: {
                importPath,
              },
              fix(fixer) {
                const fixedPath = importPath.slice(0, -3);
                const quote = node.source.raw[0]; // Get the quote character
                return fixer.replaceText(node.source, `${quote}${fixedPath}${quote}`);
              },
            });
          }
        }
      },
    };
  },
};