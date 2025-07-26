#!/usr/bin/env python3
import json
import sys

# Read the ESLint JSON output
with open('/tmp/github_lint.json', 'w') as f:
    f.write('''[{"filePath":"/var/www/html/systemprompt-os/src/server/external/auth/providers/github.ts","messages":[{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Object Literal Property name `client_id` must match one of the following formats: strictCamelCase","line":45,"column":7,"nodeType":"Identifier","messageId":"doesNotMatchFormat","endLine":45,"endColumn":16},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Object Literal Property name `redirect_uri` must match one of the following formats: strictCamelCase","line":46,"column":7,"nodeType":"Identifier","messageId":"doesNotMatchFormat","endLine":46,"endColumn":19},{"ruleId":"prefer-destructuring","severity":2,"message":"Use object destructuring.","line":60,"column":11,"nodeType":"VariableDeclarator","messageId":"preferDestructuring","endLine":64,"endColumn":20},{"ruleId":"@typescript-eslint/strict-boolean-expressions","severity":2,"message":"Unexpected string value in conditional. An explicit empty string check is required.","line":65,"column":25,"nodeType":"Identifier","messageId":"conditionErrorString","endLine":65,"endColumn":37,"suggestions":[{"messageId":"conditionFixCompareStringLength","fix":{"range":[1974,1986],"text":"(clientSecret.length > 0)"},"desc":"Change condition to check string's length (`value.length !== 0`)"},{"messageId":"conditionFixCompareEmptyString","fix":{"range":[1974,1986],"text":"(clientSecret !== \"\")"},"desc":"Change condition to check for empty string (`value !== \"\"`)"},{"messageId":"conditionFixCastBoolean","fix":{"range":[1974,1986],"text":"(Boolean(clientSecret))"},"desc":"Explicitly convert value to a boolean (`Boolean(value)`)"}]},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Object Literal Property name `client_id` must match one of the following formats: strictCamelCase","line":67,"column":7,"nodeType":"Identifier","messageId":"doesNotMatchFormat","endLine":67,"endColumn":16},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Object Literal Property name `client_secret` must match one of the following formats: strictCamelCase","line":68,"column":7,"nodeType":"Identifier","messageId":"doesNotMatchFormat","endLine":68,"endColumn":20},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Object Literal Property name `redirect_uri` must match one of the following formats: strictCamelCase","line":70,"column":7,"nodeType":"Identifier","messageId":"doesNotMatchFormat","endLine":70,"endColumn":19},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Object Literal Property name `Accept` must match one of the following formats: strictCamelCase","line":76,"column":9,"nodeType":"Literal","messageId":"doesNotMatchFormat","endLine":76,"endColumn":17},{"ruleId":"@typescript-eslint/naming-convention","severity":2,"message":"Object Literal Property name `Content-Type` must match one of the following formats: strictCamelCase","line":77,"column":9,"nodeType":"Literal","messageId":"doesNotMatchFormat","endLine":77,"endColumn":23},{"ruleId":"@typescript-eslint/consistent-type-assertions","severity":2,"message":"Do not use any type assertions.","line":87,"column":38,"nodeType":"TSAsExpression","messageId":"never","endLine":87,"endColumn":72},{"ruleId":"@typescript-eslint/consistent-type-assertions","severity":2,"message":"Do not use any type assertions.","line":118,"column":43,"nodeType":"TSAsExpression","messageId":"never","endLine":118,"endColumn":91},{"ruleId":"@typescript-eslint/consistent-type-assertions","severity":2,"message":"Do not use any type assertions.","line":131,"column":12,"nodeType":"TSAsExpression","messageId":"never","endLine":131,"endColumn":58},{"ruleId":"@typescript-eslint/consistent-type-assertions","severity":2,"message":"Do not use any type assertions.","line":131,"column":12,"nodeType":"TSAsExpression","messageId":"never","endLine":131,"endColumn":31},{"ruleId":"@typescript-eslint/consistent-type-assertions","severity":2,"message":"Do not use any type assertions.","line":157,"column":44,"nodeType":"TSAsExpression","messageId":"never","endLine":157,"endColumn":92}],"suppressedMessages":[],"errorCount":14,"fatalErrorCount":0,"warningCount":0,"fixableErrorCount":0,"fixableWarningCount":0}]''')

with open('/tmp/github_lint.json', 'r') as f:
    data = json.load(f)

# Analyze the errors
errors = data[0]['messages']
print(f"Total ESLint errors: {len(errors)}")
print("\nESLint Issues by Type:")

# Group by rule
by_rule = {}
for error in errors:
    rule = error['ruleId']
    if rule not in by_rule:
        by_rule[rule] = []
    by_rule[rule].append(error)

for rule, issues in by_rule.items():
    print(f"\n{rule}: {len(issues)} issues")
    for issue in issues[:3]:  # Show first 3 of each type
        print(f"  Line {issue['line']}: {issue['message']}")