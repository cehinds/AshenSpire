# AgentOps reconstruction drill

Proves the core promise: a disposable agent, after a **complete context wipe**
(no chat, memory, device state, task history, or provider continuity), resumes
exact work from a clean clone with **zero evidence loss** and **zero duplicate
authority** — and does so **identically on any provider or agent** (Claude,
Codex, a human, CI).

This drill is provider-neutral by construction: every step is a deterministic
command over committed Git state. The same commands produce byte-identical
output for every runner, so "run it with Claude" and "run it with Codex" are the
same drill, not two.

## Machine-checked core

```sh
node .agentops/tools/opsctl.mjs drill
```

`drill` copies **only** the committed `.agentops/` tree into an isolated temp
directory — a stand-in for a fresh clone stripped of all non-Git context — then
proves, for every work capsule:

1. the clone re-validates from committed files alone (`verify` green there);
2. `wake --frozen` in the clone is **byte-identical** to in-place output; and
3. that output matches the committed golden under
   `generated/reconstruction/<ticket>.wake.txt` (no evidence loss vs the record).

`--frozen` drops the only non-deterministic input (a live-HEAD lookup), so the
reconstructed capsule is stable across clones, providers, devices, and agents.
Live freshness is verified separately, out of band, and never gates reconstruction.

## Full clean-clone drill (any agent or human)

Run from a scratch location with no relation to your working checkout:

```sh
# 1. Clean clone — the only durable input is Git.
git clone https://github.com/cehinds/AshenSpire.git /tmp/ashenspire-drill
cd /tmp/ashenspire-drill && git checkout dev

# 2. Cold-start reads only (bounded): BOOTSTRAP, project.json, the one contract
#    the action touches. Do NOT load chat, history, ledgers, or the bundle.

# 3. Reconstruct and verify — deterministic, provider-neutral.
node .agentops/tools/opsctl.mjs verify
node .agentops/tools/opsctl.mjs drill
node .agentops/tools/opsctl.mjs wake --actor maker --work AS-1001   # live freshness

# 4. Resume the exact next action the capsule names — nothing more is needed.
```

Acceptance: steps 3 pass, and the `wake` capsule names the same IDENTITY, WORK,
DONE-WHEN, AUTHORITY, FORBIDDEN, BASE, NEXT ACTION, EVIDENCE, and INVALIDATION as
every other runner's. A second agent (e.g. Codex) running the identical commands
against the same commit must produce the identical `wake --frozen` bytes; compare
with `diff`.

## Cross-provider / cross-device equivalence

Because `wake --frozen` is a pure function of committed files, two runners agree
iff they are on the same commit. To compare Claude and Codex (or two machines):

```sh
node .agentops/tools/opsctl.mjs wake --work AS-1001 --frozen > /tmp/a.txt   # runner A
# runner B, same commit:
node .agentops/tools/opsctl.mjs wake --work AS-1001 --frozen > /tmp/b.txt
diff /tmp/a.txt /tmp/b.txt && echo "IDENTICAL — reconstruction is provider-neutral"
```

Any difference means the runners are on different commits (re-fetch) or a file
was tampered locally (the drill and `verify` catch tamper as an error, never a
silent loss).

## Negative controls (evidence loss must fail closed)

The drill and `verify` fail — they never silently lose state — when:

- a work capsule is deleted or truncated (missing evidence);
- a capsule is edited without re-sealing (`current_hash` / CAS mismatch);
- a committed reconstruction golden drifts from its sources;
- a lease, event chain, or evidence pointer is broken.

`node .agentops/tools/opsctl.mjs --selftest` exercises the tamper plants;
`opsctl.test.mjs` additionally deletes a capsule in a clean-room clone and asserts
the loss is rejected. A failing negative control blocks only its own transition;
unrelated reconstruction continues.
