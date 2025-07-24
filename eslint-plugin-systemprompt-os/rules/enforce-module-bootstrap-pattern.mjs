/**
 * ESLint rule to enforce the distinction between fundamental and dynamic modules
 * Fundamental modules (logger, database, cli) should use singleton pattern
 * Dynamic modules should use TypeDI dependency injection
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce correct patterns for fundamental vs dynamic core modules',
      category: 'Architecture',
      recommended: true
    },
    messages: {
      fundamentalNoTypeDI: 'Fundamental module "{{module}}" should not use TypeDI decorators. Use simple singleton pattern instead.',
      fundamentalMustHaveSingleton: 'Fundamental module "{{module}}" must implement a singleton pattern with getInstance() method.',
      dynamicMustUseTypeDI: 'Dynamic module "{{module}}" must use TypeDI @Service decorator.',
      fundamentalNoInject: 'Fundamental module "{{module}}" should not use @Inject decorator. Access other fundamental services directly.',
      fundamentalWrongExport: 'Fundamental module "{{module}}" should export a getInstance() function, not a TypeDI factory.',
      dynamicWrongPattern: 'Dynamic module "{{module}}" should not implement singleton pattern. Use TypeDI instead.',
      moduleYamlRequired: 'Module must have a module.yaml file with "bootstrap: true" for fundamental modules.',
      incorrectDependency: 'Fundamental module "{{module}}" cannot depend on dynamic module "{{dependency}}".'
    },
    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        fundamentalModules: {
          type: 'array',
          items: { type: 'string' },
          default: ['logger', 'database', 'cli']
        }
      },
      additionalProperties: false
    }]
  },
  create(context) {
    const options = context.options[0] || {};
    const fundamentalModules = new Set(options.fundamentalModules || ['logger', 'database', 'cli']);
    const sourceCode = context.getSourceCode();
    const filename = context.filename || context.getFilename();
    
    // Check if this is a core module
    // Check if this is a core or extension module
    const coreMatch = filename.match(/\/src\/modules\/core\/([^/]+)\//);
    const extensionMatch = filename.match(/\/src\/modules\/extension\/([^/]+)\//);
    
    if (!coreMatch && !extensionMatch) return {};
    
    const isCore = !!coreMatch;
    const moduleName = coreMatch ? coreMatch[1] : extensionMatch[1];
    // Consider ALL modules in /core/ directory as fundamental modules
    // This way executors and other core modules are treated as core regardless of bootstrap config
    const isFundamental = isCore;
    
    // Only check main index.ts and service files
    const isMainIndex = filename.endsWith(`/modules/core/${moduleName}/index.ts`);
    const isServiceFile = filename.includes('/services/') && filename.endsWith('.service.ts');
    
    if (!isMainIndex && !isServiceFile) return {};
    
    let hasServiceDecorator = false;
    let hasInjectDecorator = false;
    let hasSingletonPattern = false;
    let hasGetInstance = false;
    let hasTypeDIImport = false;
    let importedDynamicModules = new Set();
    
    return {
      // Check imports
      ImportDeclaration(node) {
        const source = node.source.value;
        
        // Check for TypeDI imports
        if (source === 'typedi') {
          hasTypeDIImport = true;
          node.specifiers.forEach(spec => {
            if (spec.imported && (spec.imported.name === 'Service' || spec.imported.name === 'Inject')) {
              if (isFundamental) {
                context.report({
                  node: spec,
                  messageId: 'fundamentalNoTypeDI',
                  data: { module: moduleName }
                });
              }
            }
          });
        }
        
        // Check for imports from other modules
        const moduleImportMatch = source.match(/^@\/modules\/core\/([^/]+)/);
        if (moduleImportMatch && isFundamental) {
          const importedModule = moduleImportMatch[1];
          if (!fundamentalModules.has(importedModule) && importedModule !== moduleName) {
            importedDynamicModules.add(importedModule);
          }
        }
      },
      
      // Check for @Service decorator
      Decorator(node) {
        if (node.expression.type === 'CallExpression' && 
            node.expression.callee.name === 'Service') {
          hasServiceDecorator = true;
          if (isFundamental && isMainIndex) {
            context.report({
              node,
              messageId: 'fundamentalNoTypeDI',
              data: { module: moduleName },
              fix(fixer) {
                // Remove the decorator
                const decoratorLine = sourceCode.lines[node.loc.start.line - 1];
                if (decoratorLine.trim() === `@Service('${moduleName}Module')` || 
                    decoratorLine.trim().startsWith('@Service(')) {
                  return fixer.removeRange([
                    sourceCode.getIndexFromLoc({ line: node.loc.start.line, column: 0 }),
                    sourceCode.getIndexFromLoc({ line: node.loc.end.line + 1, column: 0 })
                  ]);
                }
              }
            });
          }
        }
        
        // Check for @Inject decorator
        if (node.expression.type === 'CallExpression' && 
            node.expression.callee.name === 'Inject') {
          hasInjectDecorator = true;
          if (isFundamental) {
            context.report({
              node,
              messageId: 'fundamentalNoInject',
              data: { module: moduleName }
            });
          }
        }
      },
      
      // Check for singleton pattern
      PropertyDefinition(node) {
        if (node.static && node.key.name === 'instance' && node.accessibility === 'private') {
          hasSingletonPattern = true;
          if (!isFundamental && isServiceFile) {
            context.report({
              node,
              messageId: 'dynamicWrongPattern',
              data: { module: moduleName }
            });
          }
        }
      },
      
      // Check for getInstance method
      MethodDefinition(node) {
        if (node.static && node.key.name === 'getInstance') {
          hasGetInstance = true;
          if (!isFundamental && isServiceFile) {
            context.report({
              node,
              messageId: 'dynamicWrongPattern',
              data: { module: moduleName }
            });
          }
        }
      },
      
      // Check export patterns
      ExportNamedDeclaration(node) {
        if (node.declaration && node.declaration.type === 'FunctionDeclaration') {
          const funcName = node.declaration.id.name;
          
          // Check for createModule export
          if (funcName === 'createModule' && isMainIndex) {
            const isTypeDIFactory = sourceCode.getText(node).includes('Container.get');
            
            if (isFundamental && isTypeDIFactory) {
              context.report({
                node,
                messageId: 'fundamentalWrongExport',
                data: { module: moduleName }
              });
            }
          }
        }
      },
      
      // Final checks at program end
      'Program:exit'() {
        // Check fundamental module requirements
        if (isFundamental && isServiceFile) {
          if (!hasSingletonPattern || !hasGetInstance) {
            context.report({
              node: sourceCode.ast,
              messageId: 'fundamentalMustHaveSingleton',
              data: { module: moduleName }
            });
          }
        }
        
        // Check dynamic module requirements
        if (!isFundamental && isMainIndex) {
          if (!hasServiceDecorator) {
            context.report({
              node: sourceCode.ast,
              messageId: 'dynamicMustUseTypeDI',
              data: { module: moduleName }
            });
          }
        }
        
        // Check for incorrect dependencies
        if (isFundamental && importedDynamicModules.size > 0) {
          importedDynamicModules.forEach(dep => {
            context.report({
              node: sourceCode.ast,
              messageId: 'incorrectDependency',
              data: { module: moduleName, dependency: dep }
            });
          });
        }
      }
    };
  }
};