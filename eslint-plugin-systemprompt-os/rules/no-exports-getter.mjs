/**
 * ESLint rule to prevent using getter methods named 'exports' in modules
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow getter methods named "exports". Use explicit named exports instead.',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      noExportsGetter: 'Do not use a getter named "exports". This pattern is not required by IModule interface and creates unnecessary indirection. Use explicit named exports at the module level instead (e.g., export { LoggerService }).',
      noExportsProperty: 'Do not use an "exports" property on class instances. This is a workaround that misses the point - the pattern itself is problematic. The IModule interface does not require an exports property. Export what is needed directly at the module level.',
      noTypesFunction: 'Do not export a function that returns type names as strings. This provides no type information and serves no purpose. Types should be imported directly from types/ folders. If consumers need types, they should import them directly.',
      noExportsObjectDefineProperty: 'Do not use Object.defineProperty to create an "exports" getter. This is a workaround that violates the spirit of the rule. The exports pattern itself is the problem, not the implementation method.'
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    
    // Allow exports getter in module index.ts files (they implement IModule)
    const isModuleFile = /\/src\/modules\/(core|extension)\/([^/]+)\/index\.ts$/.test(filename);
    
    return {
      // Check for get exports()
      'MethodDefinition[kind="get"][key.name="exports"]'(node) {
        // Skip if this is a module file implementing IModule
        if (isModuleFile) {
          return;
        }
        
        context.report({
          node,
          messageId: 'noExportsGetter'
        });
      },
      
      // Check for exports property with getter
      'Property[key.name="exports"][kind="get"]'(node) {
        // Skip if this is a module file implementing IModule
        if (isModuleFile) {
          return;
        }
        
        context.report({
          node,
          messageId: 'noExportsGetter'
        });
      },
      
      // Check for Object.defineProperty with 'exports'
      'CallExpression[callee.object.name="Object"][callee.property.name="defineProperty"]'(node) {
        if (node.arguments.length >= 2 && 
            node.arguments[1].type === 'Literal' && 
            node.arguments[1].value === 'exports') {
          context.report({
            node,
            messageId: 'noExportsObjectDefineProperty'
          });
        }
      },
      
      // Check for regular property named 'exports' (the workaround pattern)
      'PropertyDefinition[key.name="exports"]'(node) {
        // Skip if this is a module file implementing IModule
        if (isModuleFile) {
          return;
        }
        
        context.report({
          node,
          messageId: 'noExportsProperty'
        });
      },
      
      // Check for assigning to this.exports in constructor or methods
      'AssignmentExpression[left.object.type="ThisExpression"][left.property.name="exports"]'(node) {
        // Skip if this is a module file implementing IModule
        if (isModuleFile) {
          return;
        }
        
        context.report({
          node,
          messageId: 'noExportsProperty'
        });
      },
      
      // Check for types function in object literals
      'Property[key.name="types"][value.type="FunctionExpression"], Property[key.name="types"][value.type="ArrowFunctionExpression"]'(node) {
        // Check if this is returning type names
        const functionBody = node.value.body;
        
        // For arrow functions with implicit return
        if (functionBody && functionBody.type === 'ObjectExpression') {
          const hasTypeNames = functionBody.properties.some(prop => 
            prop.type === 'Property' && 
            prop.value.type === 'Literal' && 
            typeof prop.value.value === 'string'
          );
          
          if (hasTypeNames) {
            context.report({
              node,
              messageId: 'noTypesFunction'
            });
          }
        }
        
        // For functions with explicit return
        if (functionBody && functionBody.type === 'BlockStatement') {
          const returnStatements = functionBody.body.filter(stmt => stmt.type === 'ReturnStatement');
          
          for (const returnStmt of returnStatements) {
            if (returnStmt.argument && returnStmt.argument.type === 'ObjectExpression') {
              const hasTypeNames = returnStmt.argument.properties.some(prop => 
                prop.type === 'Property' && 
                prop.value.type === 'Literal' && 
                typeof prop.value.value === 'string'
              );
              
              if (hasTypeNames) {
                context.report({
                  node,
                  messageId: 'noTypesFunction'
                });
                break;
              }
            }
          }
        }
      }
    };
  }
};