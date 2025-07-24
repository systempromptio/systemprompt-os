/**
 * ESLint rule to enforce use of path aliases instead of relative imports
 * Simplified version
 */
import path from 'path';

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce use of path aliases (@/) instead of relative imports',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      useAlias: 'Use path alias "{{suggestion}}" instead of relative import "{{source}}"',
      noParentTraversal: 'Avoid parent directory traversal. Use path alias "{{suggestion}}" instead'
    },
    fixable: 'code',
    schema: []
  },
  create(context) {
    function getSuggestion(importPath, currentFile) {
      // Get the directory of the current file relative to src
      const currentDir = path.dirname(currentFile);
      
      // Find where 'src' appears in the path
      let srcIndex = currentDir.indexOf('/src/');
      if (srcIndex === -1) {
        srcIndex = currentDir.indexOf('\\src\\');
      }
      
      if (srcIndex === -1) {
        return null;
      }
      
      // Get the path relative to src
      const relativeToSrc = currentDir.substring(srcIndex + 5); // +5 for '/src/'
      
      // Resolve the import path relative to the current directory
      const resolvedPath = path.join(relativeToSrc, importPath);
      
      // Normalize the path and remove any .js extensions
      const normalized = resolvedPath
        .split(path.sep)
        .join('/')
        .replace(/\.(ts|tsx|js|jsx|mjs)$/, '');
      
      return `@/${normalized}`;
    }
    
    function checkImport(node) {
      const importPath = node.source.value;
      
      // Only check relative imports
      if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
        return;
      }
      
      const filename = context.getFilename();
      const suggestion = getSuggestion(importPath, filename);
      
      if (suggestion) {
        const hasParentTraversal = importPath.includes('../');
        
        context.report({
          node: node.source,
          messageId: hasParentTraversal ? 'noParentTraversal' : 'useAlias',
          data: {
            suggestion,
            source: importPath
          },
          fix(fixer) {
            return fixer.replaceText(node.source, `'${suggestion}'`);
          }
        });
      }
    }
    
    return {
      ImportDeclaration: checkImport,
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkImport(node);
        }
      },
      ExportAllDeclaration: checkImport,
      CallExpression(node) {
        // Check for dynamic imports
        if (
          node.callee.type === 'Import' ||
          (node.callee.type === 'Identifier' && node.callee.name === 'require')
        ) {
          if (
            node.arguments.length > 0 &&
            node.arguments[0].type === 'Literal' &&
            typeof node.arguments[0].value === 'string'
          ) {
            const importPath = node.arguments[0].value;
            
            // Only check relative imports
            if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
              return;
            }
            
            const filename = context.getFilename();
            const suggestion = getSuggestion(importPath, filename);
            
            if (suggestion) {
              const hasParentTraversal = importPath.includes('../');
              
              context.report({
                node: node.arguments[0],
                messageId: hasParentTraversal ? 'noParentTraversal' : 'useAlias',
                data: {
                  suggestion,
                  source: importPath
                },
                fix(fixer) {
                  return fixer.replaceText(node.arguments[0], `'${suggestion}'`);
                }
              });
            }
          }
        }
      }
    };
  }
};