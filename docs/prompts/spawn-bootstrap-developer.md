# Bootstrap Developer Spawning Prompt

## Initial Spawn

```
Spawn a bootstrap-developer agent to continue the bootstrap refactor. 

The refactor is currently `/var/www/html/systemprompt-os/rules/src/bootstrap/bootstrap-refactor.md`. 

Your task: Review the refactor status document, run the integration tests, and complete the next phase of work. Focus on making tests pass first, then implementing remaining features.

Start by:
1. Reading the bootstrap-refactor.md status document
2. Running: npm test -- src/__tests__/bootstrap.integration.test.ts
3. Fixing any failing tests
4. Updating the refactor document with your progress
```

## Respawn Template (After Agent Completes)

```
The bootstrap-developer agent has completed its work. Check the refactor status:

1. Read `/var/www/html/systemprompt-os/rules/src/bootstrap/bootstrap-refactor.md`
2. If status < 100%, spawn another bootstrap-developer with this prompt:

"Spawn a bootstrap-developer agent to continue the bootstrap refactor from [CURRENT_PERCENTAGE]% complete. 

Previous agent completed: [LIST_COMPLETED_ITEMS]

Next priorities according to the refactor document: [LIST_NEXT_ITEMS]

Continue the work and update the refactor document with progress."

3. If status = 100%, the refactor is complete!
```

## State Maintenance

The bootstrap-refactor.md document serves as the persistent state between agent spawns. Each agent should:

1. **START**: Read current status from the document
2. **WORK**: Implement the next phase of tasks
3. **UPDATE**: Update the document with completed work
4. **REPORT**: Summarize what was done and what's next

## Success Criteria

The refactor is complete when:
- All integration tests pass
- Dynamic discovery is enabled and working
- CORE_MODULES constant is removed
- All success criteria in bootstrap-refactor.md show 

## Example Respawn After Progress

```
The bootstrap-developer completed enabling dynamic discovery. Current status: 75% complete.

Spawn a bootstrap-developer agent to continue from 75% complete.

Previous agent completed:
- Enabled dynamic discovery feature flag
- Fixed 5 integration test failures
- Updated module scanner for better error handling

Next priorities:
- Remove CORE_MODULES constant and update imports
- Implement lifecycle manager
- Add event system

Continue the refactor and update the status document.
```

## Important Notes

- Each agent should make incremental progress
- Always run tests before and after changes
- Update the refactor document to maintain state
- If blocked, document the blocker in the refactor doc
- Focus on test-driven development

The refactor document at `/var/www/html/systemprompt-os/rules/src/bootstrap/bootstrap-refactor.md` is the source of truth for progress tracking.