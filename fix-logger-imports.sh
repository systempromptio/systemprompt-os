#!/bin/bash

# Fix all imports in logger module to include .js extensions

echo "Fixing imports in logger module..."

# Fix errors/index.ts
sed -i "s/from '\\.\/application-error'/from '.\/application-error.js'/g" src/modules/core/logger/errors/index.ts
sed -i "s/from '\\.\/validation-error'/from '.\/validation-error.js'/g" src/modules/core/logger/errors/index.ts
sed -i "s/from '\\.\/authentication-error'/from '.\/authentication-error.js'/g" src/modules/core/logger/errors/index.ts
sed -i "s/from '\\.\/authorization-error'/from '.\/authorization-error.js'/g" src/modules/core/logger/errors/index.ts
sed -i "s/from '\\.\/database-error'/from '.\/database-error.js'/g" src/modules/core/logger/errors/index.ts
sed -i "s/from '\\.\/external-service-error'/from '.\/external-service-error.js'/g" src/modules/core/logger/errors/index.ts
sed -i "s/from '\\.\/business-logic-error'/from '.\/business-logic-error.js'/g" src/modules/core/logger/errors/index.ts
sed -i "s/from '\\.\/configuration-error'/from '.\/configuration-error.js'/g" src/modules/core/logger/errors/index.ts

# Fix all error files that import application-error
find src/modules/core/logger/errors -name "*.ts" -exec sed -i "s/from '\\.\/application-error'/from '.\/application-error.js'/g" {} \;

# Fix services that might have missing .js
find src/modules/core/logger/services -name "*.ts" -exec sed -i "s/from '\\.\\.\\/types'/from '..\/types\/index.js'/g" {} \;
find src/modules/core/logger/services -name "*.ts" -exec sed -i "s/from '\\.\\.\\/errors'/from '..\/errors\/index.js'/g" {} \;
find src/modules/core/logger/services -name "*.ts" -exec sed -i "s/from '\\.\\.\\/utils'/from '..\/utils\/index.js'/g" {} \;

# Fix any remaining relative imports without .js
find src/modules/core/logger -name "*.ts" -exec grep -l "from '\\..*[^j][^s]';" {} \; | while read file; do
  echo "Checking $file for remaining imports..."
done

echo "Done fixing imports!"