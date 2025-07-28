import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";
import systempromptOsPlugin from "./eslint-plugin-systemprompt-os/index.mjs";
import jsdocPlugin from "eslint-plugin-jsdoc";

export default [
  eslint.configs.recommended,
  {
    ignores: [
      "build/**/*",
      "build.backup/**/*",
      "node_modules/**/*",
      "coverage/**/*",
      "jest.setup.ts",
      "eslint-plugin-systemprompt-os/**/*",
      "*.backup",
      "*.bak",
      "dist/**/*",
      "scripts/**/*",
      "**/*.d.ts",
      "**/*.generated.*",
      "**/*.auto-generated.*"
    ],
  },
  {
    files: ["src/**/*.js", "src/**/*.mjs", "src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: "."
      },
      globals: {
        ...globals.node,
        ...globals.es2024,
        process: true,
        console: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        fetch: true,
        Headers: true,
        Request: true,
        Response: true,
        URL: true,
        URLSearchParams: true,
        TextEncoder: true,
        TextDecoder: true,
        AbortController: true,
        AbortSignal: true
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "systemprompt-os": systempromptOsPlugin,
      "jsdoc": jsdocPlugin
    },
    rules: {
      // SystemPrompt OS custom rules
      "systemprompt-os/enforce-module-structure": "error",
      // File naming conventions removed - too restrictive for OAuth and flexible naming
      "systemprompt-os/enforce-file-naming": "off",
      "systemprompt-os/enforce-import-restrictions": "error",
      "systemprompt-os/enforce-required-files": "error",
      "systemprompt-os/enforce-module-exports": "error",
      "systemprompt-os/enforce-core-service-initialization": "error",
      "systemprompt-os/enforce-type-exports": ["error", {
        "allowInlineTypes": false,
        "enforcePathMatching": true
      }],
      "systemprompt-os/enforce-test-files": ["error", {
        "testDir": "tests/unit",
        "testSuffixes": [".spec.ts", ".test.ts"],
        "enforceStrictPath": true,
        "excludePatterns": [
          "index.ts",
          "types/**",
          "**/*.d.ts",
          "module.yaml",
          "**/*.types.ts"
        ]
      }],
      "systemprompt-os/enforce-constants-imports": ["error", {
        "constantsFolders": ["constants", "const"],
        "allowedPatterns": []
      }],
      "systemprompt-os/no-line-comments": ["error", {
        "exceptions": ["eslint-disable", "eslint-enable", "eslint-disable-next-line", "eslint-disable-line"]
      }],
      "systemprompt-os/no-block-comments": "error",
      "systemprompt-os/enforce-path-alias": "error",
      "systemprompt-os/jsdoc-compact": "error",
      "systemprompt-os/no-comments-in-functions": "error",
      "systemprompt-os/no-type-reexports": "error",
      "systemprompt-os/no-redundant-jsdoc": "error",
      "systemprompt-os/no-blank-lines-between-properties": "error",
      "systemprompt-os/no-jsdoc-in-interfaces": "error",
      "systemprompt-os/enforce-module-bootstrap-pattern": ["error", {
        "fundamentalModules": ["auth", "cli", "config", "database", "dev", "logger", "mcp", "modules", "permissions", "system", "tasks", "users", "webhooks"]
      }],
      "systemprompt-os/enforce-module-yaml-bootstrap": ["error", {
        "fundamentalModules": ["auth", "cli", "config", "database", "dev", "logger", "mcp", "modules", "permissions", "system", "tasks", "users", "webhooks"]
      }],
      "systemprompt-os/enforce-core-module-pattern": "error",
      "systemprompt-os/enforce-extension-module-pattern": "error",
      "systemprompt-os/no-orphaned-jsdoc": "error",
      "systemprompt-os/warn-inline-eslint-comments": "warn",
      "systemprompt-os/no-js-extensions-in-imports": "error",
      "systemprompt-os/enforce-logsource-enum": "error",
      "systemprompt-os/enforce-module-index-pattern": "error",
      "systemprompt-os/enforce-database-schema-types": "error",

      // TypeScript strict rules - using recommended-type-checked and strict
      // These provide type-aware linting for maximum safety
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs["recommended-type-checked"].rules,
      ...tseslint.configs.strict.rules,
      ...tseslint.configs["strict-type-checked"].rules,
      
      // Override specific TypeScript rules for maximum strictness
      // Never use 'any' - use 'unknown' and narrow the type, or define proper types
      "@typescript-eslint/no-explicit-any": "error",
      // Prevent use of deprecated APIs - they will be removed in future versions
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowExpressions: false,
        allowTypedFunctionExpressions: false,
        allowHigherOrderFunctions: false,
        allowDirectConstAssertionInArrowFunctions: false,
        allowConciseArrowFunctionExpressionsStartingWithVoid: false
      }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      // Turn off built-in rules and use our helpful versions
      "@typescript-eslint/no-unsafe-assignment": "off",
      "systemprompt-os/no-unsafe-assignment-with-help": "error",
      "@typescript-eslint/no-unsafe-call": "off",
      "systemprompt-os/no-unsafe-call-with-help": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/strict-boolean-expressions": ["error", {
        allowString: false,
        allowNumber: false,
        allowNullableObject: false,
        allowNullableBoolean: false,
        allowNullableString: false,
        allowNullableNumber: false,
        allowNullableEnum: false,
        allowAny: false,
        allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false
      }],
      "@typescript-eslint/no-unnecessary-condition": ["error", {
        allowConstantLoopConditions: false,
        allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false
      }],
      "@typescript-eslint/consistent-type-assertions": ["error", {
        assertionStyle: "never"
      }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-confusing-void-expression": ["error", {
        ignoreArrowShorthand: false,
        ignoreVoidOperator: false
      }],
      // Naming convention rules removed - AI agents kept breaking OAuth property names
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/member-ordering": ["error", {
        default: [
          // Index signature
          "signature",
          "call-signature",

          // Fields
          "public-static-readonly-field",
          "public-static-field",
          "protected-static-readonly-field",
          "protected-static-field",
          "private-static-readonly-field",
          "private-static-field",
          "#private-static-readonly-field",
          "#private-static-field",
          
          "public-decorated-readonly-field",
          "public-decorated-field",
          "protected-decorated-readonly-field",
          "protected-decorated-field",
          "private-decorated-readonly-field",
          "private-decorated-field",
          
          "public-instance-readonly-field",
          "public-instance-field",
          "protected-instance-readonly-field",
          "protected-instance-field",
          "private-instance-readonly-field",
          "private-instance-field",
          "#private-instance-readonly-field",
          "#private-instance-field",
          
          "public-abstract-readonly-field",
          "public-abstract-field",
          "protected-abstract-readonly-field",
          "protected-abstract-field",

          // Static initialization
          "static-initialization",

          // Constructors
          "public-constructor",
          "protected-constructor",
          "private-constructor",

          // Getters/Setters
          ["public-static-get", "public-static-set"],
          ["protected-static-get", "protected-static-set"],
          ["private-static-get", "private-static-set"],
          ["#private-static-get", "#private-static-set"],
          
          ["public-decorated-get", "public-decorated-set"],
          ["protected-decorated-get", "protected-decorated-set"],
          ["private-decorated-get", "private-decorated-set"],
          
          ["public-instance-get", "public-instance-set"],
          ["protected-instance-get", "protected-instance-set"],
          ["private-instance-get", "private-instance-set"],
          ["#private-instance-get", "#private-instance-set"],
          
          ["public-abstract-get", "public-abstract-set"],
          ["protected-abstract-get", "protected-abstract-set"],

          // Methods
          "public-static-method",
          "protected-static-method",
          "private-static-method",
          "#private-static-method",
          
          "public-decorated-method",
          "protected-decorated-method",
          "private-decorated-method",
          
          "public-instance-method",
          "protected-instance-method",
          "private-instance-method",
          "#private-instance-method",
          
          "public-abstract-method",
          "protected-abstract-method"
        ]
      }],
      
      // Async/Promise handling - strictest
      "@typescript-eslint/no-floating-promises": ["error", {
        ignoreVoid: false,
        ignoreIIFE: false
      }],
      "@typescript-eslint/no-misused-promises": ["error", {
        checksConditionals: true,
        checksVoidReturn: true,
        checksSpreads: true
      }],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/promise-function-async": ["error", {
        allowedPromiseNames: [],
        checkArrowFunctions: true,
        checkFunctionDeclarations: true,
        checkFunctionExpressions: true,
        checkMethodDeclarations: true
      }],
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "always"],
      "@typescript-eslint/no-return-await": "off",
      
      // Code quality - maximum strictness
      "@typescript-eslint/no-unused-vars": ["error", { 
        vars: "all",
        varsIgnorePattern: "^_",
        args: "all",
        argsIgnorePattern: "^_",
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: false
      }],
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "separate-type-imports",
        disallowTypeAnnotations: true
      }],
      "@typescript-eslint/consistent-type-exports": ["error", {
        fixMixedExportsWithInlineTypeSpecifier: true
      }],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": ["error", {
        ignoreConditionalTests: false,
        ignoreTernaryTests: false,
        ignoreMixedLogicalExpressions: false,
        ignorePrimitives: {
          bigint: false,
          boolean: false,
          number: false,
          string: false
        }
      }],
      "@typescript-eslint/prefer-optional-chain": ["error", {
        checkAny: true,
        checkUnknown: true,
        checkString: true,
        checkNumber: true,
        checkBoolean: true,
        checkBigInt: true,
        requireNullish: true,
        allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing: false
      }],
      "@typescript-eslint/switch-exhaustiveness-check": ["error", {
        allowDefaultCaseForExhaustiveSwitch: false,
        requireDefaultForNonUnion: true
      }],
      "@typescript-eslint/prefer-readonly": ["error", {
        onlyInlineLambdas: false
      }],
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/prefer-reduce-type-parameter": "error",
      "@typescript-eslint/prefer-return-this-type": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/prefer-includes": "error",
      "@typescript-eslint/prefer-find": "error",
      
      // Error handling - strictest
      "@typescript-eslint/only-throw-error": ["error", {
        allowThrowingAny: false,
        allowThrowingUnknown: false
      }],
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      
      // General code style - maximum strictness
      "complexity": ["error", 10],
      "max-depth": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      "max-lines": ["error", 500],
      "max-lines-per-function": ["error", 50],
      "max-statements": ["error", 15],
      "max-params": ["error", 3],
      "max-classes-per-file": ["error", 1],
      // Use our custom rule with helpful error messages
      "no-console": "off",
      "systemprompt-os/no-console-with-help": "error",
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-with": "error",
      "no-alert": "error",
      "no-nested-ternary": "error",
      "no-unneeded-ternary": ["error", { defaultAssignment: false }],
      "no-mixed-operators": "error",
      "no-bitwise": "error",
      "no-plusplus": "error",
      // Use our custom rule with helpful error messages
      "no-continue": "off",
      "systemprompt-os/no-continue-with-help": "error",
      "no-labels": "error",
      "no-lone-blocks": "error",
      "no-lonely-if": "error",
      "no-negated-condition": "error",
      "curly": ["error", "all"],
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": ["error", {
        destructuring: "all",
        ignoreReadBeforeAssign: false
      }],
      "prefer-arrow-callback": ["error", {
        allowNamedFunctions: false,
        allowUnboundThis: false
      }],
      "arrow-body-style": ["error", "always"],
      "prefer-template": "error",
      "no-param-reassign": ["error", {
        props: true,
        ignorePropertyModificationsFor: []
      }],
      "prefer-destructuring": ["error", {
        VariableDeclarator: {
          array: true,
          object: true
        },
        AssignmentExpression: {
          array: true,
          object: true
        }
      }, {
        enforceForRenamedProperties: true
      }],
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "prefer-object-spread": "error",
      "prefer-numeric-literals": "error",
      "prefer-exponentiation-operator": "error",
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      "no-useless-rename": "error",
      "object-shorthand": ["error", "always", {
        avoidQuotes: true,
        ignoreConstructors: false,
        avoidExplicitReturnArrows: false
      }],
      "quote-props": ["error", "consistent-as-needed"],
      "quotes": ["error", "single", { avoidEscape: false, allowTemplateLiterals: false }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "comma-spacing": ["error", { before: false, after: true }],
      "comma-style": ["error", "last"],
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0, maxBOF: 0 }],
      "padded-blocks": ["error", "never"],
      "no-whitespace-before-property": "error",
      "space-before-blocks": ["error", "always"],
      "space-before-function-paren": ["error", {
        anonymous: "never",
        named: "never",
        asyncArrow: "always"
      }],
      "space-in-parens": ["error", "never"],
      "space-infix-ops": "error",
      "space-unary-ops": ["error", {
        words: true,
        nonwords: false
      }],
      "keyword-spacing": ["error", {
        before: true,
        after: true
      }],
      "indent": ["error", 2, {
        SwitchCase: 1,
        VariableDeclarator: 1,
        outerIIFEBody: 1,
        MemberExpression: 1,
        FunctionDeclaration: { parameters: 1, body: 1 },
        FunctionExpression: { parameters: 1, body: 1 },
        StaticBlock: { body: 1 },
        CallExpression: { arguments: 1 },
        ArrayExpression: 1,
        ObjectExpression: 1,
        ImportDeclaration: 1,
        flatTernaryExpressions: false,
        offsetTernaryExpressions: false,
        ignoreComments: false
      }],
      "brace-style": ["error", "1tbs", { allowSingleLine: false }],
      "linebreak-style": ["error", "unix"],
      "eol-last": ["error", "always"],
      "unicode-bom": ["error", "never"],
      
      // Comments - strict
      "no-inline-comments": "error",
      "line-comment-position": ["error", { position: "above" }],
      "multiline-comment-style": ["error", "starred-block"],
      "capitalized-comments": ["error", "always", {
        ignorePattern: "pragma|ignored",
        ignoreInlineComments: false,
        ignoreConsecutiveComments: false
      }],
      "spaced-comment": ["error", "always", {
        line: {
          markers: ["/"],
          exceptions: []
        },
        block: {
          markers: ["!"],
          exceptions: [],
          balanced: true
        }
      }],
      
      // JSDoc requirements - mandatory documentation
      "jsdoc/require-jsdoc": ["error", {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false, // Disabled to prevent issues with object literals
          FunctionExpression: false // Disabled to prevent issues with object literals
        },
        contexts: [
          "TSInterfaceDeclaration",
          "TSTypeAliasDeclaration",
          "TSEnumDeclaration",
          // Only require JSDoc for arrow/function expressions that are NOT in object literals
          "VariableDeclarator > ArrowFunctionExpression",
          "VariableDeclarator > FunctionExpression",
          "AssignmentExpression > ArrowFunctionExpression",
          "AssignmentExpression > FunctionExpression",
          "ExportDefaultDeclaration > ArrowFunctionExpression",
          "ExportDefaultDeclaration > FunctionExpression"
        ],
        checkConstructors: true,
        checkGetters: true,
        checkSetters: true,
        enableFixer: false
      }],
      "jsdoc/require-description": ["error", {
        contexts: ["any"]
      }],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-param-name": "error",
      "jsdoc/require-param-type": "off", // TypeScript handles this
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-returns-type": "off", // TypeScript handles this
      "jsdoc/require-throws": "error",
      "jsdoc/require-yields": "error",
      "jsdoc/check-alignment": "error",
      "jsdoc/check-indentation": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-syntax": "error",
      "jsdoc/check-tag-names": "error",
      "jsdoc/check-types": "off", // TypeScript handles this
      "jsdoc/check-values": "error",
      "jsdoc/empty-tags": "error",
      "jsdoc/implements-on-classes": "error",
      "jsdoc/multiline-blocks": ["error", {
        noSingleLineBlocks: true,
        minimumLengthForMultiline: 0,
        multilineTags: ["*"]
      }],
      "jsdoc/no-bad-blocks": "error",
      "jsdoc/no-blank-blocks": "error",
      "jsdoc/no-defaults": "error",
      "jsdoc/require-asterisk-prefix": "error",
      "jsdoc/require-hyphen-before-param-description": ["error", "always"],
      "jsdoc/require-description-complete-sentence": "error",
      "jsdoc/tag-lines": ["error", "never", {
        count: 0,
        applyToEndTag: false,
        tags: {}
      }],
      "jsdoc/valid-types": "off", // TypeScript handles this
      
      // Import organization
      "no-duplicate-imports": ["error", { includeExports: true }],
      "sort-imports": ["error", {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
        allowSeparatedGroups: false
      }],
      
      // Additional strictness - use our helpful version
      "no-restricted-syntax": "off",
      "systemprompt-os/no-restricted-syntax-typescript-with-help": [
        "error",
        [
          { selector: "ForInStatement" },
          { selector: "LabeledStatement" },
          { selector: "WithStatement" },
          { selector: "TSEnumDeclaration[const=false]" },
          { selector: "ImportExpression" }
        ]
      ],
      "no-restricted-globals": ["error", "event", "length", "name", "parent", "self", "top", "window"],
      "no-void": ["error", { allowAsStatement: false }],
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-empty-function": ["error", { allow: [] }],
      "guard-for-in": "error",
      "no-caller": "error",
      "no-extend-native": "error",
      "no-extra-bind": "error",
      "no-invalid-this": "error",
      "no-iterator": "error",
      "no-proto": "error",
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": ["error", { allowEmptyReject: false }],
      "radix": ["error", "always"],
      "no-useless-call": "error",
      "no-useless-return": "error",
      "no-sequences": "error",
      "no-unused-expressions": ["error", {
        allowShortCircuit: false,
        allowTernary: false,
        allowTaggedTemplates: false,
        enforceForJSX: true
      }],
      "no-useless-concat": "error",
      "no-useless-escape": "error",
      "no-unreachable": "error",
      "consistent-return": "error",
      "no-else-return": ["error", { allowElseIf: false }],
      "no-useless-constructor": "error",
      "no-new-wrappers": "error",
      "no-new-object": "error",
      "no-new-symbol": "error",
      "no-array-constructor": "error",
      "array-callback-return": ["error", { 
        allowImplicit: false,
        checkForEach: true,
        allowVoid: false
      }],
      // Use our custom rule with helpful error messages instead of the built-in one
      "no-await-in-loop": "off",
      "systemprompt-os/no-await-in-loop-with-help": "error",
      "no-constant-binary-expression": "error",
      // Don't return values from constructors - they should only initialize the instance
      "no-constructor-return": "error",
      // Promise executors shouldn't return values - use resolve/reject instead
      "no-promise-executor-return": ["error", { allowVoid: false }],
      // Comparing a variable to itself is always true/false - likely a typo
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-unmodified-loop-condition": "error",
      "no-unreachable-loop": ["error", { ignore: [] }],
      "no-unused-private-class-members": "error",
      "no-use-before-define": ["error", {
        functions: true,
        classes: true,
        variables: true,
        allowNamedExports: false
      }],
      "require-atomic-updates": ["error", { allowProperties: false }],
      "accessor-pairs": ["error", {
        setWithoutGet: true,
        getWithoutSet: false,
        enforceForClassMembers: true
      }],
      "arrow-spacing": ["error", { before: true, after: true }],
      "block-spacing": ["error", "always"],
      "camelcase": "off",
      "consistent-this": ["error", "that"],
      "default-case": ["error", { commentPattern: "" }],
      "default-case-last": "error",
      "default-param-last": "error",
      "dot-location": ["error", "property"],
      "dot-notation": ["error", { allowKeywords: true }],
      "func-name-matching": ["error", "always", {
        considerPropertyDescriptor: true,
        includeCommonJSModuleExports: true
      }],
      "func-names": ["error", "always", { generators: "always" }],
      "func-style": ["error", "expression", { allowArrowFunctions: true }],
      "function-call-argument-newline": ["error", "consistent"],
      "function-paren-newline": ["error", "multiline-arguments"],
      "grouped-accessor-pairs": ["error", "setBeforeGet"],
      // id-denylist removed - too restrictive for OAuth and general use
      "id-denylist": "off",
      "id-length": ["error", {
        min: 2,
        max: 30,
        properties: "always",
        exceptions: ["i", "j", "k", "x", "y", "z", "_"]
      }],
      // id-match removed - conflicts with OAuth snake_case properties
      "id-match": "off",
      "implicit-arrow-linebreak": ["error", "beside"],
      "jsx-quotes": ["error", "prefer-double"],
      "key-spacing": ["error", {
        beforeColon: false,
        afterColon: true,
        mode: "strict"
      }],
      "lines-between-class-members": ["error", "always", {
        exceptAfterSingleLine: false,
        exceptAfterOverload: true
      }],
      "logical-assignment-operators": ["error", "always", {
        enforceForIfStatements: true
      }],
      "max-len": ["error", {
        code: 100,
        tabWidth: 2,
        ignoreUrls: false,
        ignoreComments: false,
        ignoreRegExpLiterals: false,
        ignoreStrings: false,
        ignoreTemplateLiterals: false
      }],
      "new-cap": ["error", {
        newIsCap: true,
        capIsNew: false,
        capIsNewExceptions: ["Service", "Injectable", "Controller", "Module", "Entity", "Repository"],
        properties: true
      }],
      "new-parens": ["error", "always"],
      "newline-per-chained-call": ["error", { ignoreChainWithDepth: 2 }],
      "no-confusing-arrow": ["error", { allowParens: false }],
      "no-extra-boolean-cast": ["error", { enforceForLogicalOperands: true }],
      "no-extra-label": "error",
      "no-extra-parens": ["error", "all", {
        conditionalAssign: true,
        returnAssign: true,
        nestedBinaryExpressions: true,
        ignoreJSX: "none",
        enforceForArrowConditionals: true,
        enforceForSequenceExpressions: true,
        enforceForNewInMemberExpressions: true,
        enforceForFunctionPrototypeMethods: true
      }],
      "no-implicit-coercion": ["error", {
        boolean: true,
        number: true,
        string: true,
        disallowTemplateShorthand: true,
        allow: []
      }],
      "no-implicit-globals": ["error", { lexicalBindings: true }],
      "no-mixed-spaces-and-tabs": "error",
      "no-multi-assign": ["error", { ignoreNonDeclaration: false }],
      "no-multi-spaces": ["error", {
        ignoreEOLComments: false,
        exceptions: {}
      }],
      "no-multi-str": "error",
      "no-new": "error",
      "no-new-native-nonconstructor": "error",
      "no-object-constructor": "error",
      "no-octal-escape": "error",
      "no-return-assign": ["error", "always"],
      "no-tabs": ["error", { allowIndentationTabs: false }],
      "no-underscore-dangle": ["error", {
        allow: [],
        allowAfterThis: false,
        allowAfterSuper: false,
        allowAfterThisConstructor: false,
        enforceInMethodNames: true,
        enforceInClassFields: true,
        allowInArrayDestructuring: false,
        allowInObjectDestructuring: false,
        allowFunctionParams: false
      }],
      "no-unneeded-ternary": ["error", { defaultAssignment: false }],
      "no-useless-assignment": "error",
      "no-useless-backreference": "error",
      "no-useless-catch": "error",
      "nonblock-statement-body-position": ["error", "beside"],
      "object-curly-newline": ["error", {
        ObjectExpression: { multiline: true, minProperties: 3, consistent: true },
        ObjectPattern: { multiline: true, minProperties: 3, consistent: true },
        ImportDeclaration: { multiline: true, minProperties: 3, consistent: true },
        ExportDeclaration: { multiline: true, minProperties: 3, consistent: true }
      }],
      "object-curly-spacing": ["error", "always"],
      "object-property-newline": ["error", { allowAllPropertiesOnSameLine: false }],
      "one-var": ["error", "never"],
      "one-var-declaration-per-line": ["error", "always"],
      "operator-assignment": ["error", "always"],
      "operator-linebreak": ["error", "before", {
        overrides: {}
      }],
      "prefer-arrow-callback": ["error", {
        allowNamedFunctions: false,
        allowUnboundThis: false
      }],
      "prefer-named-capture-group": "error",
      "prefer-object-has-own": "error",
      "prefer-regex-literals": ["error", {
        disallowRedundantWrapping: true
      }],
      "require-await": "error",
      "require-unicode-regexp": "error",
      "require-yield": "error",
      "rest-spread-spacing": ["error", "never"],
      "semi-spacing": ["error", { before: false, after: true }],
      "semi-style": ["error", "last"],
      "sort-vars": ["error", { ignoreCase: false }],
      "switch-colon-spacing": ["error", { after: true, before: false }],
      "symbol-description": "error",
      "template-curly-spacing": ["error", "never"],
      "template-tag-spacing": ["error", "never"],
      "vars-on-top": "error",
      "wrap-iife": ["error", "inside", { functionPrototypeMethods: true }],
      "wrap-regex": "error",
      "yield-star-spacing": ["error", { before: false, after: true }],
      "yoda": ["error", "never", {
        exceptRange: false,
        onlyEquality: false
      }],
      
      // Disable base rules that TypeScript handles
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "no-shadow": "off",
      "no-use-before-define": "off",
      "require-await": "off",
      "no-return-await": "off",
      "no-unused-expressions": "off",
      "no-empty-function": "off",
      "default-param-last": "off",
      "no-dupe-class-members": "off",
      "no-array-constructor": "off",
      "dot-notation": "off",
      "no-implied-eval": "off",
      "no-new-func": "off",
      "no-throw-literal": "off",
      "prefer-promise-reject-errors": "off",
      "consistent-return": "off",
      "lines-between-class-members": "off",
      "no-invalid-this": "off",
      "no-loop-func": "off",
      "no-loss-of-precision": "off",
      "no-useless-constructor": "off",
      "indent": "off",
      "brace-style": "off",
      "comma-dangle": "off",
      "comma-spacing": "off",
      "func-call-spacing": "off",
      "keyword-spacing": "off",
      "object-curly-spacing": "off",
      "quotes": "off",
      "semi": "off",
      "space-before-blocks": "off",
      "space-before-function-paren": "off",
      "space-infix-ops": "off",
      
      // Use TypeScript versions instead
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/no-shadow": ["error", {
        ignoreFunctionTypeParameterNameValueShadow: false,
        ignoreTypeValueShadow: false,
        builtinGlobals: true,
        hoist: "all",
        allow: []
      }],
      "@typescript-eslint/no-use-before-define": ["error", {
        functions: true,
        classes: true,
        variables: true,
        enums: true,
        typedefs: true,
        ignoreTypeReferences: false
      }],
      "@typescript-eslint/no-unused-expressions": ["error", {
        allowShortCircuit: false,
        allowTernary: false,
        allowTaggedTemplates: false,
        enforceForJSX: true
      }],
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-empty-function": ["error", { allow: [] }],
      "@typescript-eslint/default-param-last": "error",
      "@typescript-eslint/no-dupe-class-members": "error",
      "@typescript-eslint/no-array-constructor": "error",
      "@typescript-eslint/dot-notation": ["error", {
        allowKeywords: true,
        allowPrivateClassPropertyAccess: false,
        allowProtectedClassPropertyAccess: false,
        allowIndexSignaturePropertyAccess: false
      }],
      "@typescript-eslint/no-implied-eval": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-promise-reject-errors": ["error", { allowEmptyReject: false }],
      "@typescript-eslint/no-invalid-this": "error",
      "@typescript-eslint/no-loop-func": "error",
      "@typescript-eslint/no-loss-of-precision": "error",
      "@typescript-eslint/no-useless-constructor": "error"
    },
  },
  {
    // Reference code files - relaxed rules for external reference implementations
    files: ["referencecode/**/*.js", "referencecode/**/*.mjs", "referencecode/**/*.ts", "referencecode/**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: "module",
        project: null, // Don't require project for reference code
        tsconfigRootDir: "."
      },
      globals: {
        ...globals.node,
        ...globals.es2024,
        process: true,
        console: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        fetch: true,
        Headers: true,
        Request: true,
        Response: true,
        URL: true,
        URLSearchParams: true,
        TextEncoder: true,
        TextDecoder: true,
        AbortController: true,
        AbortSignal: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        setImmediate: true,
        clearImmediate: true,
        logger: true
      },
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      // Basic TypeScript rules only
      ...tseslint.configs.recommended.rules,
      
      // Relaxed rules for reference code
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", {
        "args": "none",
        "varsIgnorePattern": "^_",
        "argsIgnorePattern": "^_"
      }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      
      // Disable strict rules
      "no-console": "off",
      "no-debugger": "warn",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-params": "off",
      "max-depth": "off",
      "complexity": "off",
      "no-magic-numbers": "off",
      
      // Disable all SystemPrompt OS custom rules
      "systemprompt-os/enforce-module-structure": "off",
      "systemprompt-os/enforce-file-naming": "off",
      "systemprompt-os/enforce-import-restrictions": "off",
      "systemprompt-os/enforce-required-files": "off",
      "systemprompt-os/enforce-type-exports": "off",
      "systemprompt-os/enforce-test-files": "off",
      "systemprompt-os/enforce-constants-imports": "off",
      "systemprompt-os/no-line-comments": "off",
      "systemprompt-os/no-block-comments": "off",
      "systemprompt-os/enforce-path-alias": "off",
      "systemprompt-os/jsdoc-compact": "off",
      "systemprompt-os/no-comments-in-functions": "off",
      "systemprompt-os/no-type-reexports": "off",
      "systemprompt-os/no-redundant-jsdoc": "off",
      "systemprompt-os/no-blank-lines-between-properties": "off",
      "systemprompt-os/no-jsdoc-in-interfaces": "off",
      "systemprompt-os/enforce-module-bootstrap-pattern": "off",
      "systemprompt-os/enforce-module-yaml-bootstrap": "off",
      "systemprompt-os/enforce-core-module-pattern": "off",
      "systemprompt-os/enforce-extension-module-pattern": "off",
      "systemprompt-os/no-orphaned-jsdoc": "off",
      "systemprompt-os/warn-inline-eslint-comments": "off",
      "systemprompt-os/no-unsafe-assignment-with-help": "off",
      "systemprompt-os/no-unsafe-call-with-help": "off",
      "systemprompt-os/no-console-with-help": "off",
      "systemprompt-os/no-continue-with-help": "off",
      "systemprompt-os/no-restricted-syntax-typescript-with-help": "off",
      "systemprompt-os/no-await-in-loop-with-help": "off",
      
      // Disable JSDoc requirements
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      
      // Standard JS/TS rules
      "no-undef": "off",
      "no-unused-vars": "off",
      "prefer-const": "warn",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "semi": ["error", "always"],
      "quotes": ["error", "single", { avoidEscape: true }],
      "indent": ["error", 2],
      "comma-dangle": ["error", "always-multiline"],
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": ["error", { max: 1 }]
    }
  },
  {
    // Test files - completely relaxed
    files: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/**/*.ts",
      "**/__tests__/**/*",
      "**/__mocks__/**/*"
    ],
    rules: {
      // Disable ALL strict rules for test files
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/prefer-readonly-parameter-types": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-nested-callbacks": "off",
      "max-depth": "off",
      "complexity": "off",
      "max-params": "off",
      "id-length": "off",
      "no-console": "off",
      "no-magic-numbers": "off",
      "prefer-arrow-callback": "off",
      "arrow-body-style": "off",
      "no-param-reassign": "off",
      "systemprompt-os/enforce-module-structure": "off",
      "systemprompt-os/enforce-file-naming": "off",
      "systemprompt-os/enforce-import-restrictions": "off",
      "systemprompt-os/enforce-test-files": "off",
      "systemprompt-os/enforce-type-exports": "off",
      "systemprompt-os/enforce-required-files": "off",
      "systemprompt-os/no-line-comments": "off",
      "systemprompt-os/enforce-path-alias": "off",
      "systemprompt-os/jsdoc-compact": "off",
      "systemprompt-os/no-comments-in-functions": "off",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off"
    }
  },
  {
    // Auth modules - allow snake_case for OAuth2/OIDC standard properties
    files: [
      "src/server/external/auth/**/*.ts",
      "src/modules/core/auth/**/*.ts"
    ],
    rules: {
      // Naming convention rules removed for auth modules - OAuth2/OIDC use snake_case
      "@typescript-eslint/naming-convention": "off"
    }
  },
  {
    // CLI command files - allow console output
    files: [
      "src/modules/core/cli/cli/*.ts",
      "src/modules/core/cli/cli/**/*.ts"
    ],
    rules: {
      "systemprompt-os/no-console-with-help": "off",
      "no-console": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "max-lines-per-function": ["error", { "max": 100 }],
      "max-statements": ["error", 30],
      "complexity": ["error", 20]
    }
  },
  {
    // CLI module - allow self-contained design
    files: [
      "src/modules/core/cli/**/*.ts"
    ],
    rules: {
      "systemprompt-os/enforce-import-restrictions": "off",
      "systemprompt-os/enforce-type-exports": "off",
      "systemprompt-os/enforce-module-bootstrap-pattern": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "max-lines-per-function": ["error", { "max": 100 }],
      "jsdoc/require-description": "off",
      "jsdoc/require-jsdoc": "off",
      "systemprompt-os/no-comments-in-functions": "off",
      "systemprompt-os/no-line-comments": ["error", {
        "exceptions": ["eslint-disable", "eslint-enable", "eslint-disable-next-line", "eslint-disable-line", "Dynamic import needed"]
      }],
      "@typescript-eslint/member-ordering": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "max-classes-per-file": "off",
      "no-negated-condition": "off",
      "prefer-destructuring": "off",
      "no-trailing-spaces": "off",
      "id-length": "off",
      "max-len": ["error", { "code": 120 }],
      "arrow-body-style": "off",
      "func-style": "off",
      "implicit-arrow-linebreak": "off",
      "function-paren-newline": "off",
      "operator-linebreak": "off",
      "object-curly-newline": "off",
      "no-extra-parens": "off",
      // Naming convention rules removed for CLI modules
      "@typescript-eslint/naming-convention": "off"
    }
  }
];