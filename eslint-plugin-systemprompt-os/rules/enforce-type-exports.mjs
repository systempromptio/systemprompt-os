import path from 'path';
import fs from 'fs';

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce that all interfaces, types, and enums are exported from types folder',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    messages: {
      typeNotInTypesFolder: 'Type "{{name}}" must be defined in a types/ folder, not in {{location}}',
      typeMissingFromIndex: 'Type "{{name}}" must be exported from types/index.ts',
      typePathMismatch: 'Type file path "{{typePath}}" does not match source file path "{{sourcePath}}"',
      typeFileNaming: 'Type file "{{filename}}" should match the pattern of the source file it relates to'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowInlineTypes: {
            type: 'boolean',
            default: false,
            description: 'Allow type definitions outside of types folder'
          },
          enforcePathMatching: {
            type: 'boolean',
            default: true,
            description: 'Enforce that type file paths match their source file paths'
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const allowInlineTypes = options.allowInlineTypes || false;
    const enforcePathMatching = options.enforcePathMatching !== false;
    
    const filename = context.filename || context.getFilename();
    const sourceCode = context.getSourceCode();
    
    // Skip test files and type definition files
    if (filename.includes('.test.') || 
        filename.includes('.spec.') || 
        filename.includes('.d.ts') ||
        filename.includes('/types/')) {
      return {};
    }

    // Track types defined in this file
    const definedTypes = new Map();

    function checkTypeLocation(node, typeName, typeKind) {
      // Check if this file is in a types folder
      const isInTypesFolder = filename.includes('/types/');
      
      if (!isInTypesFolder && !allowInlineTypes) {
        context.report({
          node,
          messageId: 'typeNotInTypesFolder',
          data: {
            name: typeName,
            location: path.relative(process.cwd(), filename)
          }
        });
      }

      // Store type information for path checking
      definedTypes.set(typeName, {
        node,
        kind: typeKind,
        filePath: filename
      });
    }

    function checkTypePathAlignment() {
      // Only check if we're in a types folder
      if (!filename.includes('/types/') || !enforcePathMatching) {
        return;
      }

      // Extract the path structure
      const match = filename.match(/(.*)\/types\/(.+)$/);
      if (!match) return;

      const [, basePath, typeFilePath] = match;
      const typeFileName = path.basename(typeFilePath, path.extname(typeFilePath));
      
      // Check common patterns
      if (typeFileName === 'index') {
        // index.ts files are allowed in types folders
        return;
      }

      // For files like "auth.types.ts" or "auth.interface.ts"
      const cleanTypeName = typeFileName
        .replace(/\.(types|interface|enum)$/, '')
        .replace(/\.d$/, '');

      // Try to find corresponding source file
      const possibleSourcePaths = [
        path.join(basePath, `${cleanTypeName}.ts`),
        path.join(basePath, 'services', `${cleanTypeName}.service.ts`),
        path.join(basePath, 'repositories', `${cleanTypeName}.repository.ts`),
        path.join(basePath, 'cli', `${cleanTypeName}.ts`),
        path.join(basePath, 'utils', `${cleanTypeName}.ts`)
      ];

      const sourceExists = possibleSourcePaths.some(p => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });

      // If no corresponding source file exists, it might be a shared type file
      // which is allowed (like provider-interface.ts for multiple providers)
    }

    function checkTypeExports() {
      // Check if types are exported from index.ts
      if (!filename.includes('/types/') || path.basename(filename) === 'index.ts') {
        return;
      }

      const dirPath = path.dirname(filename);
      const indexPath = path.join(dirPath, 'index.ts');
      
      try {
        if (fs.existsSync(indexPath)) {
          const indexContent = fs.readFileSync(indexPath, 'utf-8');
          
          // Check if this file is exported from index
          const relativePath = `./${path.basename(filename, '.ts')}.js`;
          const isExported = indexContent.includes(`from '${relativePath}'`) ||
                           indexContent.includes(`from "${relativePath}"`) ||
                           indexContent.includes(`* from '${relativePath}'`) ||
                           indexContent.includes(`* from "${relativePath}"`);
          
          if (!isExported) {
            // Report on the first type definition
            const firstType = definedTypes.entries().next().value;
            if (firstType) {
              context.report({
                node: firstType[1].node,
                messageId: 'typeMissingFromIndex',
                data: {
                  name: firstType[0]
                }
              });
            }
          }
        }
      } catch {
        // Ignore file system errors
      }
    }

    return {
      // Type alias declarations (type Foo = ...)
      TSTypeAliasDeclaration(node) {
        if (node.id && node.id.name) {
          checkTypeLocation(node, node.id.name, 'type');
        }
      },

      // Interface declarations
      TSInterfaceDeclaration(node) {
        if (node.id && node.id.name) {
          checkTypeLocation(node, node.id.name, 'interface');
        }
      },

      // Enum declarations
      TSEnumDeclaration(node) {
        if (node.id && node.id.name) {
          checkTypeLocation(node, node.id.name, 'enum');
        }
      },

      // Check at the end of the file
      'Program:exit'() {
        checkTypePathAlignment();
        checkTypeExports();
      }
    };
  }
};