/**
 * Additional ESLint rules with helpful error messages
 */

export const noContinueWithHelp = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow continue statements with helpful fix suggestions',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      noContinue: 'Unexpected use of continue statement. ' +
        'Fix options: 1) Refactor to use filter: `items.filter(item => condition).forEach(...)`, ' +
        '2) Use early return in a separate function, ' +
        '3) Invert the condition and wrap code in if block. ' +
        'If continue improves readability, disable with: `// eslint-disable-next-line no-continue`'
    },
    schema: []
  },
  create(context) {
    return {
      ContinueStatement(node) {
        context.report({
          node,
          messageId: 'noContinue'
        });
      }
    };
  }
};

export const noRestrictedSyntaxWithHelp = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow specific syntax with helpful alternatives',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      restrictedSyntax: '{{message}} ' +
        'Fix: {{suggestion}}',
      dynamicImport: 'Dynamic imports are restricted. ' +
        'Fix: Use static imports at the top of the file: `import { name } from \'module\'`. ' +
        'If dynamic import is required (e.g., lazy loading, conditional loading), disable with comment and explain why.'
    },
    schema: []
  },
  create(context) {
    return {
      ImportExpression(node) {
        context.report({
          node,
          messageId: 'dynamicImport'
        });
      }
    };
  }
};

export const noUnsafeCallWithHelp = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow calling any typed values with helpful fix suggestions',
      category: 'Type Safety',
      recommended: true
    },
    messages: {
      unsafeCall: 'Unsafe call of an `any` typed value. ' +
        'Fix: 1) Add proper type annotations to the imported module, ' +
        '2) Use type assertion if you know the type: `(expressModule.default as () => Express)()`, ' +
        '3) Create a typed wrapper function. ' +
        'For third-party modules without types, install @types/[module-name].'
    },
    schema: []
  },
  create(context) {
    // Would integrate with TypeScript type checker
    return {};
  }
};