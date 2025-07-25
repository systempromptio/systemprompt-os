/**
 * @fileoverview ESLint rule to enforce proper core service initialization in modules
 * @description Ensures that all modules follow the standard pattern for core service initialization:
 * 1. Import the service class (e.g., LoggerService, DatabaseService) from the appropriate module
 * 2. Declare service property with correct type (e.g., 'private logger!: ILogger;')
 * 3. Initialize service in the initialize() method using ServiceClass.getInstance()
 */

// Map of common core services and their expected patterns
const CORE_SERVICES = {
  logger: {
    propertyType: 'ILogger',
    serviceClass: 'LoggerService',
    importPath: '@/modules/core/logger/services/logger.service.js',
  },
  database: {
    propertyType: 'DatabaseService',
    serviceClass: 'DatabaseService',
    importPath: '@/modules/core/database/services/database.service.js',
  },
  auth: {
    propertyType: 'AuthService',
    serviceClass: 'AuthService',
    importPath: '@/modules/core/auth/services/auth.service.js',
  },
  eventBus: {
    propertyType: 'EventBusService',
    serviceClass: 'EventBusService',
    importPath: '@/modules/core/events/services/event-bus.service.js',
  },
  // Add more core services as needed
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce proper core service initialization pattern in modules',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingServiceImport: 'Module with {{service}} property must import {{serviceClass}}',
      incorrectServiceDeclaration: '{{service}} should be declared as "private {{service}}!: {{propertyType}};"',
      missingServiceInitialization: '{{service}} must be initialized in initialize() method using {{serviceClass}}.getInstance()',
      serviceNotUsedAfterDeclaration: '{{service}} is declared but never used',
      missingInitializeMethod: 'Module class must have an initialize() method to initialize services',
    },
  },

  create(context) {
    const serviceProperties = new Map(); // Map of service name to property node
    const serviceImports = new Set(); // Set of imported service classes
    const serviceInitializations = new Set(); // Set of initialized services
    const serviceUsageCounts = new Map(); // Map of service name to usage count
    let initializeMethodNode = null;
    let isModuleClass = false;
    let className = '';

    return {
      // Check if this is a module class
      ClassDeclaration(node) {
        if (node.id && node.id.name.endsWith('Module')) {
          isModuleClass = true;
          className = node.id.name;
        }
      },

      // Check for service imports
      ImportDeclaration(node) {
        for (const [serviceName, config] of Object.entries(CORE_SERVICES)) {
          if (node.source.value === config.importPath) {
            const hasServiceSpecifier = node.specifiers.some(
              specifier => specifier.imported && specifier.imported.name === config.serviceClass
            );
            if (hasServiceSpecifier) {
              serviceImports.add(config.serviceClass);
            }
          }
        }
      },

      // Check for service property declarations
      PropertyDefinition(node) {
        if (!isModuleClass) return;
        
        const propertyName = node.key && node.key.name;
        if (propertyName && CORE_SERVICES[propertyName]) {
          serviceProperties.set(propertyName, node);
          serviceUsageCounts.set(propertyName, 0);
          
          const config = CORE_SERVICES[propertyName];
          
          // Check if it matches the expected pattern
          const isPrivate = node.accessibility === 'private';
          const hasDefiniteAssignment = node.definite === true;
          const hasCorrectType = node.typeAnnotation && 
            node.typeAnnotation.typeAnnotation &&
            node.typeAnnotation.typeAnnotation.typeName &&
            node.typeAnnotation.typeAnnotation.typeName.name === config.propertyType;
          
          if (!isPrivate || !hasDefiniteAssignment || !hasCorrectType) {
            context.report({
              node: node,
              messageId: 'incorrectServiceDeclaration',
              data: { 
                service: propertyName,
                propertyType: config.propertyType 
              },
              fix(fixer) {
                return fixer.replaceText(node, `private ${propertyName}!: ${config.propertyType};`);
              }
            });
          }
        }
      },

      // Check for service initialization in initialize method
      MethodDefinition(node) {
        if (!isModuleClass) return;
        
        if (node.key && node.key.name === 'initialize') {
          initializeMethodNode = node;
          
          // Look for service initializations
          const bodyStatements = node.value.body.body;
          for (const statement of bodyStatements) {
            if (
              statement.type === 'ExpressionStatement' &&
              statement.expression.type === 'AssignmentExpression' &&
              statement.expression.left.type === 'MemberExpression' &&
              statement.expression.left.object.type === 'ThisExpression'
            ) {
              const serviceName = statement.expression.left.property.name;
              
              if (CORE_SERVICES[serviceName]) {
                const config = CORE_SERVICES[serviceName];
                
                // Check if it's properly initialized with getInstance()
                if (
                  statement.expression.right.type === 'CallExpression' &&
                  statement.expression.right.callee.type === 'MemberExpression' &&
                  statement.expression.right.callee.object.name === config.serviceClass &&
                  statement.expression.right.callee.property.name === 'getInstance'
                ) {
                  serviceInitializations.add(serviceName);
                }
              }
            }
          }
        }
      },

      // Count service usage
      MemberExpression(node) {
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.type === 'ThisExpression'
        ) {
          const serviceName = node.object.property.name;
          if (serviceUsageCounts.has(serviceName)) {
            serviceUsageCounts.set(serviceName, serviceUsageCounts.get(serviceName) + 1);
          }
        }
      },

      // Final checks
      'Program:exit'() {
        if (!isModuleClass) return;

        // Check each declared service
        for (const [serviceName, propertyNode] of serviceProperties) {
          const config = CORE_SERVICES[serviceName];

          // Check for service import
          if (!serviceImports.has(config.serviceClass)) {
            context.report({
              node: propertyNode,
              messageId: 'missingServiceImport',
              data: { 
                service: serviceName,
                serviceClass: config.serviceClass 
              },
              fix(fixer) {
                // Find the last import statement
                const sourceCode = context.getSourceCode();
                const imports = sourceCode.ast.body.filter(node => node.type === 'ImportDeclaration');
                const lastImport = imports[imports.length - 1];
                
                if (lastImport) {
                  return fixer.insertTextAfter(
                    lastImport,
                    `\nimport { ${config.serviceClass} } from '${config.importPath}';`
                  );
                }
              }
            });
          }

          // Check for service initialization
          if (!serviceInitializations.has(serviceName)) {
            if (initializeMethodNode) {
              context.report({
                node: initializeMethodNode,
                messageId: 'missingServiceInitialization',
                data: { 
                  service: serviceName,
                  serviceClass: config.serviceClass 
                },
                fix(fixer) {
                  const bodyStart = initializeMethodNode.value.body.range[0] + 1;
                  return fixer.insertTextAfterRange(
                    [bodyStart, bodyStart],
                    `\n    this.${serviceName} = ${config.serviceClass}.getInstance();`
                  );
                }
              });
            } else {
              // No initialize method found
              context.report({
                node: propertyNode,
                messageId: 'missingInitializeMethod'
              });
            }
          }

          // Check if service is used
          if (serviceUsageCounts.get(serviceName) === 0) {
            context.report({
              node: propertyNode,
              messageId: 'serviceNotUsedAfterDeclaration',
              data: { service: serviceName }
            });
          }
        }
      }
    };
  },
};