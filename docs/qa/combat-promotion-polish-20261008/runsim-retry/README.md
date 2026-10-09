# Unchanged 1151 source simulator retry

The single `node tools/runsim.mjs 5` fleet passed in **84.403 seconds** under the existing **120,000 ms** clean-fleet timeout. Exit status was 0, with no signal or subprocess error. The imported `completedFleet` policy passed, and the independent exact-fleet check found four class rows and exactly one RESULT: 20 runs over four classes, five fixed seeds each, zero crashes and zero soft-locks. All recorded simulator, bot, run-loop, engine and formula source hashes remained unchanged during execution.

This was a quieter retry, **not a fully quiet benchmark**. The before snapshot had no watched builders or simulator/discovered-test workers. Eight seconds after the fleet began, another worktree launched `tools/launch.mjs --build-only` in `card-solid-bb`, with light and then single-file bundle children. `during-load.json` preserves their process identities, creation times and CPU use; the CPU sample was 96%. The after snapshot also preserves the remaining builder. These foreign processes were not stopped or modified.

The earlier timed-out core receipt remains separate and failed. This retry verifies deterministic fleet completion without increasing a timeout or changing simulator/gameplay semantics; it does not rewrite the prior result or make the entire core suite green.

- `receipt.json`: command, unchanged policy budget, elapsed time, status/error, exact RESULT/class checks, source hashes, and before/after load snapshots.
- `stdout.log` / `stderr.log`: unmodified child output.
- `before.json` / `after.json` / `during-load.json`: precise process/load evidence.
- `quiet-runner.mjs`: the off-tree wrapper, importing the existing completion policy and using its existing fleet timeout.

No runtime source, simulator, test, budget or browser was changed for this retry. The owned wrapper and fleet exited normally; foreign builders remain owned elsewhere.
