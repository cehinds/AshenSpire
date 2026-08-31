# Zoom scanner first-ticket rehearsal

The completed candidate at commit `6f7ce55862d0dc4d853433811ee3e2a3135350e4`
and tree `a49775e409d2d64da94578c371cc51768dc59566` was consumed read-only.
The candidate worktree remained clean. Its focused self-test passed known-bad
recall 3/3 and known-good clearance 4/4.

The task node pins the candidate only after the simulated READY-to-EXECUTING
transition and holds two exact path locks. Its clean-session wake packet points
to the exact commit, tree, file hashes, and test rather than copying source or
history. Review capacity is modeled independently: a full review slot queues
this node without blocking unrelated executing work.

## Migration gap found and repaired

The pilot task-node schema had `affected_paths` but no `resource_locks` field.
That made the generic saturation scheduler more expressive than a real task
node. `resource_locks` is now required, validated, and included in wake packets;
READY nodes use an empty array and acquire locks only on entry.

This rehearsal is not product work, a gate verdict, live adoption, integration,
delivery, publication, deployment, or release.
