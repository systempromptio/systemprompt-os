Fix all TypeScript and linting issues for the auth module:

## CRITICAL REQUIREMENTS - READ FIRST

**MANDATORY:** Before starting, read the module structure requirements at:
`/var/www/html/systemprompt-os/rules/src/modules/core/{module}/rules.md`

The module MUST have the exact same structure, Zod validation, and type generation as the `users` module.

`npm run typecheck` MUST HAVE NO errors related to the code that will be worked on.

## Step-by-Step Process

1. **Initial Validation Check**
   Run ./bin/systemprompt dev validate --module auth to check current status. If it shows "Generated type files are missing", this means the generate-types command is not working for this module.

2. **Fix Module Structure (CRITICAL)**
   If generate-types is not working, you must fix the underlying service/module structure FIRST before the generate-types command will work. The service must be compatible with the module generation system.

   **REFERENCE IMPLEMENTATION:** Use the `users` module as your reference example - it has a working implementation that successfully generates types. Compare your broken module structure with the users module to identify what's missing or incorrect.

   **REQUIRED MODULE STRUCTURE:**
   - `index.ts` - Must extend BaseModule with full Zod validation
   - `module.yaml` - Module configuration 
   - `services/auth.service.ts` - Service implementation with proper method signatures
   - `repositories/auth.repository.ts` - Repository pattern implementation
   - `database/schema.sql` - Database schema for type generation
   - `types/` folder with generated files only

3. **Zod Validation Requirements**
   The module MUST implement the same Zod validation pattern as the users module:
   - Generated schemas from service methods
   - Database types from schema.sql
   - Proper validation in index.ts using generated Zod schemas
   - NO manual types unless absolutely necessary (use .manual.ts suffix with justification)

4. **Type Generation**
   Once the service structure matches the users module, run ./bin/systemprompt dev generate-types --module auth to autogenerate types. This should now work without errors.

5. **Final Validation (MANDATORY)**
   Run ./bin/systemprompt dev validate --module auth again to verify TypeScript compilation. You MUST get a SUCCESS response with ALL checks passing (✅) before proceeding. Any errors or warnings mean you cannot proceed to the next step.

6. **Agent Spawning (ONLY AFTER SUCCESS)**
   CRITICAL: Only proceed to this step when you have achieved 100% SUCCESS from the validate typecheck command - all type safety checks must show ✅ with no errors. Then spawn the Module-developer agent with: Fix all test failures and linting errors in the auth module. Follow your iterative development cycle focusing on Phase 3 Code Quality Enhancement to achieve zero linting errors.