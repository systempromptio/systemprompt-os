/**
 * ESLint rule to disallow redundant JSDoc comments for simple properties
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow redundant JSDoc comments for simple, self-explanatory properties',
      category: 'Stylistic Issues',
      recommended: true
    },
    messages: {
      redundantJSDoc: 'Redundant JSDoc comment. The property name "{{propertyName}}" is self-explanatory and does not need documentation.',
      redundantSimpleJSDoc: 'Redundant JSDoc comment "{{comment}}". This just repeats the property name without adding value.',
      redundantTypeOnlyJSDoc: 'Redundant JSDoc comment. TypeScript already provides type information for "{{propertyName}}".'
    },
    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        allowedProperties: {
          type: 'array',
          items: { type: 'string' },
          default: []
        },
        checkPrivate: {
          type: 'boolean',
          default: true
        }
      },
      additionalProperties: false
    }]
  },
  create(context) {
    const options = context.options[0] || {};
    const allowedProperties = new Set(options.allowedProperties || []);
    const checkPrivate = options.checkPrivate !== false;
    const sourceCode = context.getSourceCode();
    
    // Common self-explanatory property names
    const selfExplanatoryNames = new Set([
      'name', 'type', 'version', 'description', 'status', 'id', 'key', 'value',
      'title', 'label', 'message', 'error', 'result', 'data', 'config',
      'initialized', 'started', 'stopped', 'enabled', 'disabled', 'visible',
      'loading', 'loaded', 'ready', 'active', 'inactive', 'selected'
    ]);
    
    function isSelfExplanatory(name) {
      // Check if it's in the self-explanatory set
      if (selfExplanatoryNames.has(name)) return true;
      
      // Check common patterns
      if (name.startsWith('is') && name.length > 2) return true; // isActive, isEnabled, etc.
      if (name.startsWith('has') && name.length > 3) return true; // hasError, hasData, etc.
      if (name.endsWith('Count') || name.endsWith('Total')) return true;
      if (name.endsWith('Service') || name.endsWith('Repository')) return true;
      if (name.endsWith('Config') || name.endsWith('Configuration')) return true;
      
      return false;
    }
    
    function isRedundantComment(comment, propertyName) {
      if (!comment || !comment.value) return false;
      
      const commentText = comment.value.trim().toLowerCase();
      const propNameLower = propertyName.toLowerCase();
      
      // Remove common JSDoc markers
      const cleanedComment = commentText
        .replace(/^\*+\s*/, '') // Remove leading asterisks
        .replace(/\*\/$/, '') // Remove closing */
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Check if comment just repeats the property name
      if (cleanedComment === propNameLower) return true;
      
      // Check if comment is just "The [property name]" or "[Property name]."
      const patterns = [
        new RegExp(`^the ${propNameLower}\\.?$`),
        new RegExp(`^${propNameLower}\\.?$`),
        new RegExp(`^${propNameLower.replace(/([A-Z])/g, ' $1').trim()}\\.?$`), // camelCase to words
        new RegExp(`^the ${propNameLower.replace(/([A-Z])/g, ' $1').trim()}\\.?$`)
      ];
      
      return patterns.some(pattern => pattern.test(cleanedComment));
    }
    
    function checkProperty(node, propertyName) {
      // Skip if in allowed list
      if (allowedProperties.has(propertyName)) return;
      
      // Skip private properties if configured
      if (!checkPrivate && propertyName.startsWith('_')) return;
      
      // Get the comment before this node
      const comments = sourceCode.getCommentsBefore(node);
      const jsdocComment = comments.find(comment => 
        comment.type === 'Block' && comment.value.startsWith('*')
      );
      
      if (!jsdocComment) return;
      
      // Check if it's a simple type-only JSDoc (just @type or @param without description)
      const hasOnlyType = /^\*\s*@(?:type|param)\s*\{[^}]+\}\s*(?:\w+)?\s*$/m.test(jsdocComment.value);
      if (hasOnlyType) {
        context.report({
          node: jsdocComment,
          messageId: 'redundantTypeOnlyJSDoc',
          data: { propertyName },
          fix(fixer) {
            return fixer.remove(jsdocComment);
          }
        });
        return;
      }
      
      // Check if property name is self-explanatory
      if (isSelfExplanatory(propertyName)) {
        // Check if the comment is redundant
        if (isRedundantComment(jsdocComment, propertyName)) {
          context.report({
            node: jsdocComment,
            messageId: 'redundantSimpleJSDoc',
            data: { 
              propertyName,
              comment: jsdocComment.value.trim().replace(/^\*\s*/, '').replace(/\s*\*\/$/, '')
            },
            fix(fixer) {
              return fixer.remove(jsdocComment);
            }
          });
        } else {
          // Comment exists but property is self-explanatory
          context.report({
            node: jsdocComment,
            messageId: 'redundantJSDoc',
            data: { propertyName },
            fix(fixer) {
              return fixer.remove(jsdocComment);
            }
          });
        }
      }
    }
    
    return {
      // Class properties ONLY - not interfaces or types
      PropertyDefinition(node) {
        if (node.key && node.key.type === 'Identifier') {
          checkProperty(node, node.key.name);
        }
      }
    };
  }
};