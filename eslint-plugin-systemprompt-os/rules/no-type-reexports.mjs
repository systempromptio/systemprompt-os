/**
 * ESLint rule to prevent re-exporting types from index files
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow re-exporting types from index files. Import types directly from their types/ folder.',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      noTypeReexport: 'Do not re-export type "{{typeName}}" from index files. Consumers should import directly from {{sourcePath}}',
      noTypeReexportBarrel: 'Do not create barrel exports for types. Types should be imported directly from their types/ folder.'
    },
    schema: [{
      type: 'object',
      properties: {
        allowedFiles: {
          type: 'array',
          items: { type: 'string' },
          default: []
        }
      },
      additionalProperties: false
    }]
  },
  create(context) {
    const options = context.options[0] || {};
    const allowedFiles = options.allowedFiles || [];
    const filename = context.getFilename();
    
    // Skip if not an index file
    if (!filename.endsWith('/index.ts') && !filename.endsWith('/index.js')) {
      return {};
    }
    
    // Skip allowed files
    if (allowedFiles.some(allowed => filename.includes(allowed))) {
      return {};
    }
    
    return {
      // Handle: export type { Foo } from './types';
      ExportNamedDeclaration(node) {
        if (!node.source || !node.specifiers) {
          return;
        }
        
        const sourcePath = node.source.value;
        
        // Check if exporting from a types folder
        if (sourcePath.includes('/types/') || sourcePath.includes('/types')) {
          for (const specifier of node.specifiers) {
            if (specifier.exportKind === 'type' || node.exportKind === 'type') {
              context.report({
                node: specifier,
                messageId: 'noTypeReexport',
                data: {
                  typeName: specifier.exported.name,
                  sourcePath: sourcePath
                }
              });
            }
          }
        }
      },
      
      // Handle: export * from './types';
      ExportAllDeclaration(node) {
        if (!node.source) {
          return;
        }
        
        const sourcePath = node.source.value;
        
        // Check if exporting from a types folder
        if (sourcePath.includes('/types/') || sourcePath.includes('/types')) {
          context.report({
            node,
            messageId: 'noTypeReexportBarrel',
          });
        }
      },
      
      // Handle: export { type Foo } from './types';
      'ExportSpecifier[exportKind="type"]'(node) {
        const parent = node.parent;
        if (parent.type === 'ExportNamedDeclaration' && parent.source) {
          const sourcePath = parent.source.value;
          
          if (sourcePath.includes('/types/') || sourcePath.includes('/types')) {
            context.report({
              node,
              messageId: 'noTypeReexport',
              data: {
                typeName: node.exported.name,
                sourcePath: sourcePath
              }
            });
          }
        }
      }
    };
  }
};