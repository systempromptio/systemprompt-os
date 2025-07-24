/**
 * ESLint rule to enforce extension module patterns
 * Extension modules must use constructor injection and TypeDI decorators
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce extension module patterns: constructor injection, TypeDI decorators, no singleton',
      category: 'Architecture',
      recommended: true
    },
    messages: {
      mustUseTypeDI: 'Extension modules must use TypeDI @Service decorator',
      mustUseConstructorInjection: 'Extension modules must use constructor injection with @Inject decorator',
      noSingletonPattern: 'Extension modules must not implement singleton pattern. Use TypeDI instead',
      noStaticGetInstance: 'Extension modules must not have static getInstance(). Use Container.get() instead',
      noInitializeExport: 'Extension modules must not export initialize(). Use module class instead',
      wrongLocation: 'Extension module "{{module}}" must be in /src/modules/extension/ directory',
      noBootstrap: 'Extension modules must not have "bootstrap: true" in module.yaml',
      mustHaveIModule: 'Extension module class must implement IModule interface',
      propertyInjectionNotAllowed: 'Use constructor injection instead of property injection'
    },
    fixable: 'code',
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    const filename = context.filename || context.getFilename();
    
    // Only check files in extension modules
    const extensionMatch = filename.match(/\/src\/modules\/extension\/([^/]+)\//);
    if (!extensionMatch) return {};
    
    const moduleName = extensionMatch[1];
    const isMainIndex = filename.endsWith(`/extension/${moduleName}/index.ts`);
    const isServiceFile = filename.includes('/services/') && filename.endsWith('.service.ts');
    
    let hasServiceDecorator = false;
    let hasConstructorInjection = false;
    let hasTypeDIImport = false;
    let implementsIModule = false;
    
    return {
      // Check imports
      ImportDeclaration(node) {
        const source = node.source.value;
        
        // Check for TypeDI import
        if (source === 'typedi') {
          hasTypeDIImport = true;
        }
      },
      
      // Check class decorators
      ClassDeclaration(node) {
        const decorators = node.decorators || [];
        
        // Check for @Service decorator
        const serviceDecorator = decorators.find(dec => {
          const expr = dec.expression;
          return (expr.type === 'Identifier' && expr.name === 'Service') ||
                 (expr.type === 'CallExpression' && expr.callee.name === 'Service');
        });
        
        if (serviceDecorator) {
          hasServiceDecorator = true;
        } else if (isMainIndex || isServiceFile) {
          // Report missing @Service decorator
          context.report({
            node,
            messageId: 'mustUseTypeDI',
            fix(fixer) {
              const className = node.id.name;
              const serviceDecoratorText = isMainIndex 
                ? `@Service('${className}')\n`
                : '@Service()\n';
              return fixer.insertTextBefore(node, serviceDecoratorText);
            }
          });
        }
        
        // Check if implements IModule (for main index)
        if (isMainIndex && node.implements) {
          implementsIModule = node.implements.some(impl => 
            impl.expression.name === 'IModule'
          );
        }
        
        // Check constructor
        const constructor = node.body.body.find(member => 
          member.type === 'MethodDefinition' && member.kind === 'constructor'
        );
        
        if (constructor && constructor.value.params.length > 0) {
          // Check if parameters have @Inject decorator
          const hasInjectDecorators = constructor.value.params.every(param => {
            if (param.decorators) {
              return param.decorators.some(dec => 
                dec.expression.callee?.name === 'Inject'
              );
            }
            return false;
          });
          
          if (hasInjectDecorators) {
            hasConstructorInjection = true;
          } else {
            context.report({
              node: constructor,
              messageId: 'mustUseConstructorInjection'
            });
          }
        }
        
        // Check for singleton pattern (not allowed)
        const staticInstance = node.body.body.find(member =>
          member.type === 'PropertyDefinition' && 
          member.static && 
          member.key.name === 'instance'
        );
        
        if (staticInstance) {
          context.report({
            node: staticInstance,
            messageId: 'noSingletonPattern',
            fix(fixer) {
              return fixer.remove(staticInstance);
            }
          });
        }
        
        // Check for getInstance method (not allowed)
        const getInstanceMethod = node.body.body.find(member =>
          member.type === 'MethodDefinition' && 
          member.static && 
          member.key.name === 'getInstance'
        );
        
        if (getInstanceMethod) {
          context.report({
            node: getInstanceMethod,
            messageId: 'noStaticGetInstance',
            fix(fixer) {
              return fixer.remove(getInstanceMethod);
            }
          });
        }
      },
      
      // Check for property injection (not recommended)
      PropertyDefinition(node) {
        if (node.decorators) {
          const injectDecorator = node.decorators.find(dec => 
            dec.expression.callee?.name === 'Inject'
          );
          
          if (injectDecorator) {
            context.report({
              node: injectDecorator,
              messageId: 'propertyInjectionNotAllowed'
            });
          }
        }
      },
      
      // Check exports
      ExportNamedDeclaration(node) {
        if (!isMainIndex) return;
        
        // Check for initialize export (not allowed)
        if (node.declaration && 
            node.declaration.type === 'FunctionDeclaration' && 
            node.declaration.id.name === 'initialize') {
          context.report({
            node,
            messageId: 'noInitializeExport',
            fix(fixer) {
              return fixer.remove(node);
            }
          });
        }
        
        // Check for export { initialize }
        if (node.specifiers) {
          node.specifiers.forEach(spec => {
            if (spec.exported.name === 'initialize') {
              context.report({
                node: spec,
                messageId: 'noInitializeExport'
              });
            }
          });
        }
      },
      
      // Final checks
      'Program:exit'() {
        // Check TypeDI usage
        if ((isMainIndex || isServiceFile) && !hasTypeDIImport) {
          context.report({
            node: sourceCode.ast,
            messageId: 'mustUseTypeDI'
          });
        }
        
        // Check IModule implementation for main index
        if (isMainIndex && !implementsIModule) {
          context.report({
            node: sourceCode.ast,
            messageId: 'mustHaveIModule'
          });
        }
      }
    };
  }
};