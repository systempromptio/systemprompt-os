1. Run the tracking script at `/var/www/html/systemprompt-os/scripts/track-lint.sh` to identify and report files with linting errors
2. Get the list of files with errors from npm run lint output
3. Process files in batches of 5:
   - Spawn 5 lint-standards-enforcer agents simultaneously (one per file)
   - Each agent should fix ALL lint errors in their assigned file
   - Each agent must verify their file has 0 lint errors before completing
4. After each batch of 5 files is complete, check for TypeScript errors
5. Repeat the process with the next batch of 5 files until every file in the project conforms to linting standards