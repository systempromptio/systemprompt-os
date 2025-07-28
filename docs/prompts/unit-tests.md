1. Run the reporting script at `/var/www/html/systemprompt-os/scripts/unit-test-report.sh` to identify failing unit tests
2. Get the list of failing test files from the report output in `scripts/output/unit-test-report.txt`
5. Process files in batches of 5:
   - Spawn 5 unit-test-coverage-enforcer agents simultaneously (one per file)
   - Each agent should fix ALL failing tests in their assigned file
   - Each agent must verify their file has 0 failing tests before completing
4. After each batch of 5 files is complete, run `npm run test:unit` to verify fixes
5. Repeat the process with the next batch of 5 files until every unit test in the project passes