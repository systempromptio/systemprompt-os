/**
 * Enforce LogSource enum usage instead of string literals.
 * Logger calls must use LogSource.VALUE instead of 'VALUE' as LogSource.
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce LogSource enum usage instead of string literals in logger calls',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      useEnum: 'Use LogSource.{{enumValue}} instead of \'{{stringValue}}\' as LogSource. Logger calls must use the enum directly for type safety.'
    }
  },

  create(context) {
    let logSourceImported = false;
    let logSourceEnumValues = new Set();

    // Known LogSource enum values based on the types file
    const knownLogSourceValues = [
      'BOOTSTRAP', 'CLI', 'DATABASE', 'LOGGER', 'AUTH', 'MCP', 'SERVER', 
      'MODULES', 'API', 'ACCESS', 'SCHEDULER', 'SYSTEM', 'WEBHOOK', 
      'WORKFLOW', 'DEV', 'EXECUTORS', 'MONITOR', 'PERMISSIONS', 'USERS'
    ];

    return {
      // Track LogSource imports
      ImportDeclaration(node) {
        if (node.source.value && node.source.value.includes('logger/types')) {
          node.specifiers.forEach(spec => {
            if (spec.type === 'ImportSpecifier' && spec.imported.name === 'LogSource') {
              logSourceImported = true;
            }
          });
        }
      },

      // Check for string literals being cast to LogSource
      TSAsExpression(node) {
        if (!logSourceImported) return;

        // Check if this is casting to LogSource type
        if (node.typeAnnotation &&
            node.typeAnnotation.type === 'TSTypeReference' &&
            node.typeAnnotation.typeName &&
            node.typeAnnotation.typeName.name === 'LogSource') {
          
          // Check if the expression being cast is a string literal
          if (node.expression.type === 'Literal' && typeof node.expression.value === 'string') {
            const stringValue = node.expression.value.toLowerCase();
            const enumValue = knownLogSourceValues.find(val => val.toLowerCase() === stringValue);
            
            if (enumValue) {
              context.report({
                node,
                messageId: 'useEnum',
                data: {
                  stringValue: node.expression.value,
                  enumValue: enumValue
                },
                fix(fixer) {
                  return fixer.replaceText(node, `LogSource.${enumValue}`);
                }
              });
            }
          }
        }
      }
    };
  }
};