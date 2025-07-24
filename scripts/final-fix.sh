#!/bin/bash

echo "🚀 Final fix for all TypeScript and ESLint errors"
echo "================================================"

# Fix common ESLint issues
echo -e "\n📝 Fixing ESLint issues..."

# Fix unused variables by prefixing with underscore
find src -name "*.ts" -type f -exec sed -i 's/catch (error)/catch (error)/g' {} \;
find src -name "*.ts" -type f -exec sed -i 's/catch (e)/catch (_e)/g' {} \;

# Fix no-prototype-builtins
find src -name "*.ts" -type f -exec sed -i 's/\.hasOwnProperty(/Object.prototype.hasOwnProperty.call(/g' {} \;

# Fix require imports
find src -name "*.ts" -type f -exec sed -i 's/require(/import(/g' {} \;

# Fix case declarations
find src -name "*.ts" -type f -exec sed -i '/case.*:$/,/break;/ { /const\|let/ { i\
        {
a\
        }
} }' {} \;

# Fix Function type
find src -name "*.ts" -type f -exec sed -i 's/: Function/: (...args: any[]) => any/g' {} \;

# Fix empty interfaces
find src -name "*.ts" -type f -exec sed -i 's/interface \([A-Za-z]*\) {}/type \1 = Record<string, never>/g' {} \;

# Run ESLint fix
echo -e "\n🔧 Running ESLint auto-fix..."
npm run lint

# Fix TypeScript issues
echo -e "\n📝 Fixing TypeScript issues..."

# Fix workflow executor
sed -i 's/step\.inputs\?\.\[(step\.inputs\?\.workflow_id as string)\]/step.inputs?.workflow_id as string/g' src/modules/core/events/executors/workflow.executor.ts

# Fix optional chaining on this
find src -name "*.ts" -type f -exec sed -i 's/this?\./this./g' {} \;

# Fix middleware auth
sed -i 's/req\.cookies\?\.\["auth_token"\]/req.cookies?.auth_token/g' src/server/external/middleware/auth.ts

# Fix modules CLI
sed -i 's/\["commands"\]/commands/g' src/modules/core/modules/cli/info.ts

# Final checks
echo -e "\n📊 Final Status:"
echo "==============="

echo -e "\nTypeScript errors:"
npm run typecheck 2>&1 | grep "error TS" | wc -l

echo -e "\nESLint errors:"
npm run lint:check 2>&1 | grep "problems" | head -1

echo -e "\n✅ Done!"