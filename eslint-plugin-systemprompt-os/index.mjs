import enforceModuleStructure from './rules/enforce-module-structure.mjs';
import enforceFileNaming from './rules/enforce-file-naming.mjs';
import enforceImportRestrictions from './rules/enforce-import-restrictions.mjs';
import enforceRequiredFiles from './rules/enforce-required-files.mjs';
import enforceTypeExports from './rules/enforce-type-exports.mjs';
import enforceTestFiles from './rules/enforce-test-files.mjs';
import enforceConstantsImports from './rules/enforce-constants-imports.mjs';
import noLineComments from './rules/no-line-comments.mjs';
import enforcePathAlias from './rules/enforce-path-alias.mjs';
import jsdocCompact from './rules/jsdoc-compact.mjs';
import noCommentsInFunctions from './rules/no-comments-in-functions.mjs';
import noBlockComments from './rules/no-block-comments.mjs';
import noTypeReexports from './rules/no-type-reexports.mjs';
import noRedundantJsdoc from './rules/no-redundant-jsdoc.mjs';
import noBlankLinesBetweenProperties from './rules/no-blank-lines-between-properties.mjs';
import noJsdocInInterfaces from './rules/no-jsdoc-in-interfaces.mjs';
import enforceModuleBootstrapPattern from './rules/enforce-module-bootstrap-pattern.mjs';
import enforceModuleYamlBootstrap from './rules/enforce-module-yaml-bootstrap.mjs';
import enforceCoreModulePattern from './rules/enforce-core-module-pattern.mjs';
import enforceExtensionModulePattern from './rules/enforce-extension-module-pattern.mjs';
import enforceModuleExports from './rules/enforce-module-exports.mjs';
import noOrphanedJsdoc from './rules/no-orphaned-jsdoc.mjs';
import enforceCoreServiceInitialization from './rules/enforce-core-service-initialization.mjs';
import { noAwaitInLoopWithHelp, noConsoleWithHelp, preferConstWithHelp, noUnusedVarsWithHelp } from './rules/helpful-error-messages.mjs';
import { noContinueWithHelp, noRestrictedSyntaxWithHelp, noUnsafeCallWithHelp } from './rules/more-helpful-messages.mjs';
import { noUnsafeAssignmentWithHelp, noRestrictedSyntaxTypescriptWithHelp } from './rules/typescript-helpful-messages.mjs';
import warnInlineEslintComments from './rules/warn-inline-eslint-comments.mjs';
import noJsExtensionsInImports from './rules/no-js-extensions-in-imports.mjs';
import enforceLogsourceEnum from './rules/enforce-logsource-enum.mjs';
import enforceModuleIndexPattern from './rules/enforce-module-index-pattern.mjs';

const plugin = {
  meta: {
    name: 'systemprompt-os',
    version: '1.0.0'
  },
  rules: {
    'enforce-module-structure': enforceModuleStructure,
    'enforce-file-naming': enforceFileNaming,
    'enforce-import-restrictions': enforceImportRestrictions,
    'enforce-required-files': enforceRequiredFiles,
    'enforce-type-exports': enforceTypeExports,
    'enforce-test-files': enforceTestFiles,
    'enforce-constants-imports': enforceConstantsImports,
    'no-line-comments': noLineComments,
    'enforce-path-alias': enforcePathAlias,
    'jsdoc-compact': jsdocCompact,
    'no-comments-in-functions': noCommentsInFunctions,
    'no-block-comments': noBlockComments,
    'no-type-reexports': noTypeReexports,
    'no-redundant-jsdoc': noRedundantJsdoc,
    'no-blank-lines-between-properties': noBlankLinesBetweenProperties,
    'no-jsdoc-in-interfaces': noJsdocInInterfaces,
    'enforce-module-bootstrap-pattern': enforceModuleBootstrapPattern,
    'enforce-module-yaml-bootstrap': enforceModuleYamlBootstrap,
    'enforce-core-module-pattern': enforceCoreModulePattern,
    'enforce-extension-module-pattern': enforceExtensionModulePattern,
    'enforce-module-exports': enforceModuleExports,
    'no-orphaned-jsdoc': noOrphanedJsdoc,
    'enforce-core-service-initialization': enforceCoreServiceInitialization,
    'no-await-in-loop-with-help': noAwaitInLoopWithHelp,
    'no-console-with-help': noConsoleWithHelp,
    'prefer-const-with-help': preferConstWithHelp,
    'no-unused-vars-with-help': noUnusedVarsWithHelp,
    'no-continue-with-help': noContinueWithHelp,
    'no-restricted-syntax-with-help': noRestrictedSyntaxWithHelp,
    'no-unsafe-call-with-help': noUnsafeCallWithHelp,
    'no-unsafe-assignment-with-help': noUnsafeAssignmentWithHelp,
    'no-restricted-syntax-typescript-with-help': noRestrictedSyntaxTypescriptWithHelp,
    'warn-inline-eslint-comments': warnInlineEslintComments,
    'no-js-extensions-in-imports': noJsExtensionsInImports,
    'enforce-logsource-enum': enforceLogsourceEnum,
    'enforce-module-index-pattern': enforceModuleIndexPattern
  }
};

export default plugin;