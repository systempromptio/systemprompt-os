/**
 * ESLint rule to enforce required module exports
 * All modules must export a createModule function that returns a module instance
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce that all modules export a createModule function',
      category: 'Architecture',
      recommended: true
    },
    messages: {
      missingCreateModule: 'Module index.ts must export a createModule function that returns a module instance',
      missingModuleClass: 'Module index.ts must export a module class (e.g., {{moduleName}}Module)',
      wrongCreateModuleType: 'createModule must be a function that returns a module instance',
      createModuleMustReturnClass: 'createModule must return an instance of the module class',
      missingExportsProperty: 'Module class {{moduleClass}} must implement "exports" property as a getter that returns all public functionality (see AuthModule for example)',
      exportsNotGetter: 'Module class {{moduleClass}} must implement "exports" as a getter, not a regular property'
    },
    fixable: null,
    schema: []
  },
  
  create(context) {
    const filename = context.filename || context.getFilename();
    
    // Only check module index.ts files
    const moduleMatch = filename.match(/\/src\/modules\/(core|extension)\/([^/]+)\/index\.ts$/);
    if (!moduleMatch) return {};
    
    const moduleType = moduleMatch[1];
    const moduleName = moduleMatch[2];
    const capitalizedModuleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
    const expectedClassName = `${capitalizedModuleName}Module`;
    
    let hasCreateModuleExport = false;
    let hasModuleClassExport = false;
    let createModuleReturnsClass = false;
    let moduleClassName = null;
    let hasExportsProperty = false;
    let exportsIsGetter = false;
    let moduleClassNode = null;
    
    return {
      // Check for module class declaration
      ClassDeclaration(node) {
        if (node.id && node.id.name.endsWith('Module')) {
          moduleClassName = node.id.name;
          moduleClassNode = node;
          
          // Check if the class has exports property
          const exportsProperty = node.body.body.find(member => 
            member.type === 'MethodDefinition' &&
            member.key.name === 'exports' &&
            member.kind === 'get'
          );
          
          if (exportsProperty) {
            hasExportsProperty = true;
            exportsIsGetter = true;
          } else {
            // Check for regular property (which is wrong)
            const regularExportsProperty = node.body.body.find(member => 
              (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') &&
              member.key.name === 'exports'
            );
            
            if (regularExportsProperty) {
              hasExportsProperty = true;
              exportsIsGetter = false;
            }
          }
        }
      },
      
      // Check for export class
      ExportNamedDeclaration(node) {
        // Check for export class ModuleNameModule
        if (node.declaration && 
            node.declaration.type === 'ClassDeclaration' && 
            node.declaration.id && 
            node.declaration.id.name.endsWith('Module')) {
          hasModuleClassExport = true;
          moduleClassName = node.declaration.id.name;
          moduleClassNode = node.declaration;
          
          // Check if the exported class has exports property
          const exportsProperty = node.declaration.body.body.find(member => 
            member.type === 'MethodDefinition' &&
            member.key.name === 'exports' &&
            member.kind === 'get'
          );
          
          if (exportsProperty) {
            hasExportsProperty = true;
            exportsIsGetter = true;
          } else {
            // Check for regular property (which is wrong)
            const regularExportsProperty = node.declaration.body.body.find(member => 
              (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') &&
              member.key.name === 'exports'
            );
            
            if (regularExportsProperty) {
              hasExportsProperty = true;
              exportsIsGetter = false;
            }
          }
        }
        
        // Check for export const createModule = () => {}
        if (node.declaration && 
            node.declaration.type === 'VariableDeclaration') {
          const createModuleDecl = node.declaration.declarations.find(decl => 
            decl.id.name === 'createModule' && 
            (decl.init?.type === 'ArrowFunctionExpression' || 
             decl.init?.type === 'FunctionExpression')
          );
          
          if (createModuleDecl) {
            hasCreateModuleExport = true;
            
            // Check if it returns a new instance of the module class
            const functionBody = createModuleDecl.init.body;
            if (functionBody.type === 'BlockStatement') {
              const returnStatement = functionBody.body.find(stmt => stmt.type === 'ReturnStatement');
              if (returnStatement && 
                  returnStatement.argument && 
                  returnStatement.argument.type === 'NewExpression' &&
                  returnStatement.argument.callee.type === 'Identifier' &&
                  returnStatement.argument.callee.name === moduleClassName) {
                createModuleReturnsClass = true;
              }
            } else if (functionBody.type === 'NewExpression' &&
                       functionBody.callee.type === 'Identifier' &&
                       functionBody.callee.name === moduleClassName) {
              createModuleReturnsClass = true;
            }
          }
        }
        
        // Check for export function createModule()
        if (node.declaration && 
            node.declaration.type === 'FunctionDeclaration' && 
            node.declaration.id.name === 'createModule') {
          hasCreateModuleExport = true;
          
          // Check if it returns a new instance of the module class
          const functionBody = node.declaration.body;
          const returnStatement = functionBody.body.find(stmt => stmt.type === 'ReturnStatement');
          if (returnStatement && 
              returnStatement.argument && 
              returnStatement.argument.type === 'NewExpression' &&
              returnStatement.argument.callee.type === 'Identifier' &&
              returnStatement.argument.callee.name === moduleClassName) {
            createModuleReturnsClass = true;
          }
        }
        
        // Check for export { ... }
        if (node.specifiers) {
          node.specifiers.forEach(spec => {
            if (spec.exported.name === 'createModule') {
              hasCreateModuleExport = true;
            }
            if (spec.exported.name === moduleClassName || spec.exported.name.endsWith('Module')) {
              hasModuleClassExport = true;
            }
          });
        }
      },
      
      // Check export default class
      ExportDefaultDeclaration(node) {
        if (node.declaration.type === 'ClassDeclaration' && 
            node.declaration.id && 
            node.declaration.id.name.endsWith('Module')) {
          hasModuleClassExport = true;
          moduleClassName = node.declaration.id.name;
        }
      },
      
      // Final validation
      'Program:exit'() {
        // Check for module class export
        if (!hasModuleClassExport) {
          context.report({
            node: context.getSourceCode().ast,
            messageId: 'missingModuleClass',
            data: { moduleName: capitalizedModuleName }
          });
        }
        
        // Check for createModule export
        if (!hasCreateModuleExport) {
          context.report({
            node: context.getSourceCode().ast,
            messageId: 'missingCreateModule'
          });
        }
        
        // Check that createModule returns the module class
        if (hasCreateModuleExport && hasModuleClassExport && !createModuleReturnsClass) {
          context.report({
            node: context.getSourceCode().ast,
            messageId: 'createModuleMustReturnClass'
          });
        }
        
        // Check for exports property
        if (hasModuleClassExport && !hasExportsProperty) {
          context.report({
            node: moduleClassNode || context.getSourceCode().ast,
            messageId: 'missingExportsProperty',
            data: { moduleClass: moduleClassName }
          });
        }
        
        // Check that exports is a getter, not a regular property
        if (hasModuleClassExport && hasExportsProperty && !exportsIsGetter) {
          context.report({
            node: moduleClassNode || context.getSourceCode().ast,
            messageId: 'exportsNotGetter',
            data: { moduleClass: moduleClassName }
          });
        }
      }
    };
  }
};