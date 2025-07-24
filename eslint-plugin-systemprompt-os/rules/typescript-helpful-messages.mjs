/**
 * TypeScript ESLint rules with helpful error messages
 */

export const noUnsafeAssignmentWithHelp = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow assigning any to variables with helpful fix suggestions',
      category: 'Type Safety',
      recommended: true
    },
    messages: {
      unsafeAssignment: 'Unsafe assignment of type `any` to a variable. ' +
        'Fix options: 1) Add explicit type annotation: `const myVar: ExpectedType = ...`, ' +
        '2) Use type assertion if you know the type: `expression as ExpectedType`, ' +
        '3) For dynamic imports, type the result: `const mod = await import("...") as { default: ExpressApp }`. ' +
        'If absolutely necessary, disable with: `// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment`'
    },
    schema: []
  },
  create(context) {
    // Would integrate with TypeScript type checker
    return {};
  }
};

export const noRestrictedSyntaxTypescriptWithHelp = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow specific syntax patterns with TypeScript-aware helpful messages',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      forInLoop: 'for..in loops iterate over the entire prototype chain. ' +
        'Fix: Use `Object.keys(obj).forEach(key => ...)`, `Object.values(obj)`, or `Object.entries(obj)`. ' +
        'For arrays, use `for (const item of array)` or `array.forEach()`.',
      labeledStatement: 'Labels are a form of GOTO and make code hard to maintain. ' +
        'Fix: Refactor using functions with early returns, or use boolean flags for complex control flow.',
      withStatement: '`with` is disallowed in strict mode. ' +
        'Fix: Use explicit property access: `const { prop1, prop2 } = object;` or access with `object.property`.',
      nonConstEnum: 'Non-const enums generate extra JavaScript code. ' +
        'Fix: Add `const` keyword: `const enum MyEnum { ... }`. ' +
        'If runtime enum object is needed, document why and disable the rule.',
      dynamicImport: 'Dynamic imports are restricted in this codebase. ' +
        'Fix: Use static imports at file top: `import express from "express"`. ' +
        'For lazy loading (e.g., optional features, conditional modules), add comment explaining why: ' +
        '`// Dynamic import needed for lazy loading MCP servers\n// eslint-disable-next-line no-restricted-syntax`'
    },
    schema: [{
      type: 'array',
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              message: { type: 'string' }
            },
            required: ['selector'],
            additionalProperties: false
          }
        ]
      },
      uniqueItems: true
    }]
  },
  create(context) {
    const options = context.options[0] || [];
    const restrictedNodes = new Map();

    // Default helpful messages for common patterns
    const defaultMessages = {
      'ForInStatement': 'forInLoop',
      'LabeledStatement': 'labeledStatement',
      'WithStatement': 'withStatement',
      'TSEnumDeclaration[const=false]': 'nonConstEnum',
      'ImportExpression': 'dynamicImport'
    };

    // Process options
    options.forEach(option => {
      if (typeof option === 'string') {
        restrictedNodes.set(option, defaultMessages[option] || 'restrictedSyntax');
      } else if (option.selector) {
        restrictedNodes.set(option.selector, option.message || defaultMessages[option.selector] || 'restrictedSyntax');
      }
    });

    return {
      '*'(node) {
        restrictedNodes.forEach((messageId, selector) => {
          // Simple selector matching (in real implementation would use esquery)
          if (node.type === selector || matchesSelector(node, selector)) {
            context.report({
              node,
              messageId: typeof messageId === 'string' && noRestrictedSyntaxTypescriptWithHelp.meta.messages[messageId] ? messageId : 'restrictedSyntax',
              data: typeof messageId === 'string' && !noRestrictedSyntaxTypescriptWithHelp.meta.messages[messageId] ? { message: messageId } : {}
            });
          }
        });
      }
    };

    function matchesSelector(node, selector) {
      // Simplified selector matching for demonstration
      if (selector.includes('[')) {
        const [type, attrPart] = selector.split('[');
        if (node.type !== type) return false;
        
        const attrMatch = attrPart.match(/(\w+)=(\w+)\]/);
        if (attrMatch) {
          const [, attr, value] = attrMatch;
          return node[attr] === (value === 'false' ? false : value === 'true' ? true : value);
        }
      }
      return false;
    }
  }
};