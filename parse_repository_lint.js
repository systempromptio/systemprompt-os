import fs from 'fs';

// Read the raw JSON output from the previous command
const input = `[{"filePath":"/var/www/html/systemprompt-os/src/modules/core/auth/database/repository.ts","messages":[{"ruleId":"systemprompt-os/enforce-type-exports","severity":2,"message":"Type \\"ISessionMetadata\\" must be defined in a types/ folder, not in src/modules/core/auth/database/repository.ts","line":17,"column":8,"nodeType":"TSInterfaceDeclaration","messageId":"typeNotInTypesFolder","endLine":20,"endColumn":2},{"ruleId":"jsdoc/require-jsdoc","severity":2,"message":"Missing JSDoc comment.","line":17,"column":8,"nodeType":"TSInterfaceDeclaration","messageId":"missingJsDoc","endLine":18,"endColumn":1},{"ruleId":"systemprompt-os/enforce-type-exports","severity":2,"message":"Type \\"IOAuthProfile\\" must be defined in a types/ folder, not in src/modules/core/auth/database/repository.ts","line":28,"column":8,"nodeType":"TSInterfaceDeclaration","messageId":"typeNotInTypesFolder","endLine":32,"endColumn":2},{"ruleId":"jsdoc/require-jsdoc","severity":2,"message":"Missing JSDoc comment.","line":28,"column":8,"nodeType":"TSInterfaceDeclaration","messageId":"missingJsDoc","endLine":29,"endColumn":1},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Interface name \`IOAuthProfile\` trimmed as \`OAuthProfile\` must match one of the following formats: StrictPascalCase","line":28,"column":18,"nodeType":"Identifier","messageId":"doesNotMatchFormatTrimmed","endLine":28,"endColumn":31},{"ruleId":"jsdoc/require-jsdoc","severity":2,"message":"Missing JSDoc comment.","line":40,"column":8,"nodeType":"ClassDeclaration","messageId":"missingJsDoc","endLine":41,"endColumn":1},{"ruleId":"@typescript-eslint/no-explicit-any","severity":2,"message":"Unexpected any. Specify a different type.","line":42,"column":33,"nodeType":"TSAnyKeyword","messageId":"unexpectedAny","endLine":42,"endColumn":36,"suggestions":[{"messageId":"suggestUnknown","fix":{"range":[731,734],"text":"unknown"},"desc":"Use \`unknown\` instead, this will force you to explicitly, and safely assert the type is correct."},{"messageId":"suggestNever","fix":{"range":[731,734],"text":"never"},"desc":"Use \`never\` instead, this is useful when instantiating generic type parameters that you don't need to know the type of."}]},{"ruleId":"jsdoc/check-indentation","severity":2,"message":"There must be no indentation.","line":45,"column":1,"nodeType":"Block","endLine":45,"endColumn":1},{"ruleId":"jsdoc/check-indentation","severity":2,"message":"There must be no indentation.","line":54,"column":1,"nodeType":"Block","endLine":54,"endColumn":1},{"ruleId":"@typescript-eslint/no-unnecessary-condition","severity":2,"message":"Unnecessary conditional, value is always truthy.","line":58,"column":5,"nodeType":"MemberExpression","messageId":"alwaysTruthy","endLine":58,"endColumn":18},{"ruleId":"jsdoc/check-indentation","severity":2,"message":"There must be no indentation.","line":63,"column":1,"nodeType":"Block","endLine":63,"endColumn":1},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Class Method name \`upsertIUserFromOAuth\` must match one of the following formats: strictCamelCase","line":72,"column":9,"nodeType":"Identifier","messageId":"doesNotMatchFormat","endLine":72,"endColumn":29},{"ruleId":"@typescript-eslint/no-unsafe-member-access","severity":2,"message":"Unsafe member access .createOrUpdateIUserFromOAuth on an \`any\` value.","line":77,"column":41,"nodeType":"Identifier","messageId":"unsafeMemberExpression","endLine":77,"endColumn":69},{"ruleId":"@typescript-eslint/no-unsafe-argument","severity":2,"message":"Unsafe argument of type \`any\` assigned to a parameter of type \`string\`.","line":85,"column":45,"nodeType":"MemberExpression","messageId":"unsafeArgument","endLine":85,"endColumn":52},{"ruleId":"@typescript-eslint/no-unsafe-member-access","severity":2,"message":"Unsafe member access .id on an \`any\` value.","line":85,"column":50,"nodeType":"Identifier","messageId":"unsafeMemberExpression","endLine":85,"endColumn":52}]}]`;

try {
  const data = JSON.parse(input);
  const file = data[0];
  
  console.log('=== ESLint Analysis for repository.ts ===');
  console.log(`File: ${file.filePath}`);
  console.log(`Total Issues: ${file.messages.length}`);
  console.log('');
  
  // Group by rule
  const ruleGroups = {};
  file.messages.forEach(msg => {
    const rule = msg.ruleId || 'no-rule';
    if (!ruleGroups[rule]) {
      ruleGroups[rule] = [];
    }
    ruleGroups[rule].push(msg);
  });
  
  console.log('=== Issues by Rule ===');
  Object.keys(ruleGroups).sort().forEach(rule => {
    console.log(`\n${rule} (${ruleGroups[rule].length} issues):`);
    ruleGroups[rule].forEach(msg => {
      console.log(`  Line ${msg.line}:${msg.column} - ${msg.message}`);
    });
  });
  
} catch (error) {
  console.error('Error parsing JSON:', error.message);
}