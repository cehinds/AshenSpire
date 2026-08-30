# Portable task pipeline package

This directory is a provider-neutral, repository-native package for moving
small task nodes through risk-selected stages. It is intentionally separate
from AshenSpire's current AgentOps runtime so the pilot can be installed,
tested, upgraded, or rolled back without rewriting existing authority or
history.

## Three layers

1. `templates/stable/` contains the small, versioned operating kernel.
2. `templates/state/` contains schemas and examples for changing task state.
3. `templates/startup/` contains disposable clean-session entry points. They
   point to state; they never copy a backlog or event history.

Installations live at `.task-pipeline/` in a target repository. The installer
refuses to overwrite an existing installation. Its state file records every
installed path and SHA-256. Rollback succeeds only while those hashes still
match, so user edits cannot be silently deleted.

```sh
node .agentops/tools/pipeline-pilot-install.mjs plan --target <repo>
node .agentops/tools/pipeline-pilot-install.mjs install --target <repo>
node .agentops/tools/pipeline-pilot-install.mjs rollback --target <repo>
```

`plan` is read-only. `install` and `rollback` are local filesystem operations;
they never run Git or contact a remote. Upgrade is a new package version
installed only after the current version passes hash validation. The initial
package treats same-version upgrade as a verified no-op and rejects version
downgrades. See `MIGRATION_MAP.md` for staged adoption.
