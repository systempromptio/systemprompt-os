export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce that constants are imported from constants folders',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowedPatterns: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: [],
          },
          constantsFolders: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: ['constants', 'const'],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      constantMustBeImported: 'Constant "{{ name }}" must be imported from a constants/ folder, not defined in {{ file }}',
      useConstantsFolder: 'Constants should be defined in a constants/ folder and imported',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const allowedPatterns = options.allowedPatterns || [];
    const constantsFolders = options.constantsFolders || ['constants', 'const'];
    const filename = context.getFilename();
    
    // Check if current file is in a constants folder
    const isInConstantsFolder = constantsFolders.some(folder => 
      filename.includes(`/${folder}/`) || filename.includes(`\\${folder}\\`)
    );
    
    // Check if variable matches allowed patterns
    const matchesAllowedPattern = (name) => {
      return allowedPatterns.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(name);
      });
    };
    
    return {
      VariableDeclaration(node) {
        // Only check top-level const declarations
        if (
          node.kind !== 'const' ||
          node.parent.type !== 'Program' ||
          isInConstantsFolder
        ) {
          return;
        }
        
        node.declarations.forEach(declaration => {
          if (!declaration.id || declaration.id.type !== 'Identifier') {
            return;
          }
          
          const name = declaration.id.name;
          
          // Check if it's an UPPER_CASE constant
          if (/^[A-Z][A-Z0-9_]*$/.test(name) && !matchesAllowedPattern(name)) {
            // Check if it's a simple literal or a constant expression
            const init = declaration.init;
            if (
              init && (
                init.type === 'Literal' ||
                (init.type === 'UnaryExpression' && init.argument.type === 'Literal') ||
                (init.type === 'BinaryExpression' && 
                  init.left.type === 'Literal' && 
                  init.right.type === 'Literal') ||
                (init.type === 'NewExpression' && 
                  init.callee.name === 'Map' && 
                  init.arguments.length === 0) ||
                (init.type === 'CallExpression' && 
                  init.callee.type === 'Identifier' &&
                  ['Number', 'String', 'Boolean'].includes(init.callee.name))
              )
            ) {
              context.report({
                node: declaration,
                messageId: 'constantMustBeImported',
                data: {
                  name,
                  file: filename.replace(process.cwd(), '').replace(/^[/\\]/, ''),
                },
              });
            }
          }
        });
      },
    };
  },
};