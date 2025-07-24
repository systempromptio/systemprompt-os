/**
 * ESLint rule to enforce module.yaml structure for fundamental vs dynamic modules
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce module.yaml bootstrap property for fundamental modules',
      category: 'Architecture',
      recommended: true
    },
    messages: {
      missingBootstrapProperty: 'Fundamental module "{{module}}" must have "bootstrap: true" in module.yaml',
      incorrectBootstrapProperty: 'Dynamic module "{{module}}" should not have "bootstrap: true" in module.yaml',
      invalidYamlStructure: 'module.yaml must be a valid YAML file with proper structure'
    },
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
    const filename = context.filename || context.getFilename();
    
    // Only check module.yaml files
    if (!filename.endsWith('module.yaml')) return {};
    
    // Extract module name from path
    const coreMatch = filename.match(/\/src\/modules\/core\/([^/]+)\/module\.yaml$/);
    const extensionMatch = filename.match(/\/src\/modules\/extension\/([^/]+)\/module\.yaml$/);
    
    if (!coreMatch && !extensionMatch) return {};
    
    const isCore = !!coreMatch;
    const moduleName = coreMatch ? coreMatch[1] : extensionMatch[1];
    // Consider ALL modules in /core/ directory as fundamental modules
    const isFundamental = isCore;
    const sourceCode = context.getSourceCode();
    
    return {
      Program(node) {
        try {
          const text = sourceCode.getText();
          
          // Basic YAML parsing - look for bootstrap property
          const bootstrapMatch = text.match(/^bootstrap:\s*(true|false)/m);
          
          if (isFundamental) {
            if (!bootstrapMatch || bootstrapMatch[1] !== 'true') {
              context.report({
                node,
                messageId: 'missingBootstrapProperty',
                data: { module: moduleName },
                fix(fixer) {
                  // Add bootstrap: true after the name property
                  const nameMatch = text.match(/^name:\s*['"]?([^'"\n]+)['"]?/m);
                  if (nameMatch) {
                    const nameLineEnd = text.indexOf('\n', nameMatch.index) + 1;
                    return fixer.insertTextAfterRange([nameLineEnd - 1, nameLineEnd], '\nbootstrap: true');
                  }
                }
              });
            }
          } else {
            if (bootstrapMatch && bootstrapMatch[1] === 'true') {
              context.report({
                node,
                messageId: 'incorrectBootstrapProperty',
                data: { module: moduleName },
                fix(fixer) {
                  // Remove the bootstrap line
                  const lineStart = text.lastIndexOf('\n', bootstrapMatch.index) + 1;
                  const lineEnd = text.indexOf('\n', bootstrapMatch.index) + 1;
                  return fixer.removeRange([lineStart, lineEnd]);
                }
              });
            }
          }
        } catch (error) {
          context.report({
            node,
            messageId: 'invalidYamlStructure'
          });
        }
      }
    };
  }
};