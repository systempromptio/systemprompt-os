/**
 * ESLint rule to enforce core module patterns
 * Core modules must have zero dependencies and follow singleton pattern
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce core module patterns: zero dependencies, singleton pattern, and initialization export',
      category: 'Architecture',
      recommended: true
    },
    messages: {
      noDependencies: 'Core modules cannot depend on extension modules. Only other core modules are allowed.',
      noTypeDI: 'Core modules must not use TypeDI. Remove {{decorator}}. Core modules should use singleton pattern with getInstance() instead of dependency injection.',
      mustHaveSingleton: 'Core module service must implement singleton pattern with private constructor and getInstance()',
      mustExportInitialize: 'Core module index.ts must export an initialize() function',
      noConstructorParams: 'Core module classes must not have constructor parameters (no dependency injection)',
      wrongLocation: 'Core module "{{module}}" must be in /src/modules/core/ directory',
      mustHaveBootstrap: 'Core module must have "bootstrap: true" in module.yaml'
    },
    fixable: 'code',
    schema: []
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    const filename = context.filename || context.getFilename();
    
    // Only check files in core modules
    const coreMatch = filename.match(/\/src\/modules\/core\/([^/]+)\//);
    if (!coreMatch) return {};
    
    const moduleName = coreMatch[1];
    const isMainIndex = filename.endsWith(`/core/${moduleName}/index.ts`);
    const isServiceFile = filename.includes('/services/') && filename.endsWith('.service.ts');
    
    // All modules in /src/modules/core/ are considered core modules
    const isCoreModule = true;
    
    let hasInitializeExport = false;
    let hasSingletonPattern = false;
    let hasPrivateConstructor = false;
    let hasGetInstance = false;
    
    return {
      // Check imports - core modules can only depend on other core modules
      ImportDeclaration(node) {
        const source = node.source.value;
        
        // Allow imports from within the same module
        if (source.startsWith('.') || source.startsWith('@/modules/core/' + moduleName)) {
          return;
        }
        
        // Allow imports from other core modules
        if (source.startsWith('@/modules/core/')) {
          return; // Core modules can depend on other core modules
        }
        
        // Disallow imports from extension modules
        if (source.startsWith('@/modules/extension/')) {
          context.report({
            node,
            messageId: 'noDependencies',
            fix(fixer) {
              // Remove the entire import statement
              return fixer.remove(node);
            }
          });
        }
        
        // Disallow TypeDI imports
        if (source === 'typedi') {
          // Check what's being imported to provide specific error messages
          const importedNames = node.specifiers.map(spec => {
            if (spec.type === 'ImportSpecifier') {
              return spec.imported.name;
            }
            return null;
          }).filter(Boolean);
          
          const importDetails = importedNames.join(', ');
          
          context.report({
            node,
            messageId: 'noTypeDI',
            data: { decorator: importDetails || 'TypeDI' },
            fix(fixer) {
              return fixer.remove(node);
            }
          });
        }
      },
      
      // Check for TypeDI decorators
      Decorator(node) {
        const decoratorName = node.expression.type === 'Identifier' 
          ? node.expression.name 
          : node.expression.callee?.name;
          
        if (['Service', 'Inject', 'Injectable'].includes(decoratorName)) {
          context.report({
            node,
            messageId: 'noTypeDI',
            data: { decorator: decoratorName },
            fix(fixer) {
              // Remove the decorator and its line
              const decoratorLine = sourceCode.lines[node.loc.start.line - 1];
              if (decoratorLine.trim().startsWith('@')) {
                return fixer.removeRange([
                  sourceCode.getIndexFromLoc({ line: node.loc.start.line, column: 0 }),
                  sourceCode.getIndexFromLoc({ line: node.loc.end.line + 1, column: 0 })
                ]);
              }
            }
          });
        }
      },
      
      // Check for Container usage (e.g., Container.get())
      MemberExpression(node) {
        if (node.object.type === 'Identifier' && node.object.name === 'Container') {
          context.report({
            node,
            messageId: 'noTypeDI',
            data: { decorator: `Container.${node.property.name}` }
          });
        }
      },
      
      // Check class patterns
      ClassDeclaration(node) {
        if (!isServiceFile) return;
        
        // Check constructor
        const constructor = node.body.body.find(member => 
          member.type === 'MethodDefinition' && member.kind === 'constructor'
        );
        
        if (constructor) {
          // Must be private
          if (constructor.accessibility !== 'private') {
            hasPrivateConstructor = false;
          } else {
            hasPrivateConstructor = true;
          }
          
          // Must have no parameters
          if (constructor.value.params.length > 0) {
            context.report({
              node: constructor,
              messageId: 'noConstructorParams'
            });
          }
        }
        
        // Check for static instance property
        const instanceProp = node.body.body.find(member =>
          member.type === 'PropertyDefinition' && 
          member.static && 
          member.key.name === 'instance'
        );
        
        if (instanceProp && instanceProp.accessibility === 'private') {
          hasSingletonPattern = true;
        }
        
        // Check for getInstance method
        const getInstanceMethod = node.body.body.find(member =>
          member.type === 'MethodDefinition' && 
          member.static && 
          member.key.name === 'getInstance'
        );
        
        if (getInstanceMethod) {
          hasGetInstance = true;
        }
      },
      
      // Check exports in index.ts
      ExportNamedDeclaration(node) {
        if (!isMainIndex) return;
        
        // Check for export function initialize()
        if (node.declaration && 
            node.declaration.type === 'FunctionDeclaration' && 
            node.declaration.id.name === 'initialize') {
          hasInitializeExport = true;
        }
        
        // Check for export const initialize = () => {}
        if (node.declaration && 
            node.declaration.type === 'VariableDeclaration') {
          const declaration = node.declaration.declarations.find(decl => 
            decl.id.name === 'initialize' && 
            (decl.init?.type === 'ArrowFunctionExpression' || 
             decl.init?.type === 'FunctionExpression')
          );
          if (declaration) {
            hasInitializeExport = true;
          }
        }
        
        // Also check for export { initialize }
        if (node.specifiers) {
          node.specifiers.forEach(spec => {
            if (spec.exported.name === 'initialize') {
              hasInitializeExport = true;
            }
          });
        }
      },
      
      // Final checks
      'Program:exit'() {
        // Check singleton pattern in service files
        if (isServiceFile && (!hasSingletonPattern || !hasGetInstance || !hasPrivateConstructor)) {
          context.report({
            node: sourceCode.ast,
            messageId: 'mustHaveSingleton'
          });
        }
        
        // Check initialize export in index.ts
        if (isMainIndex && !hasInitializeExport) {
          context.report({
            node: sourceCode.ast,
            messageId: 'mustExportInitialize'
          });
        }
      }
    };
  }
};