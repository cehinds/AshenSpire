# AGENTS.md

AshenSpire runs under a repository-native control plane in
[`.agentops/`](.agentops/). Git history and the validated JSON there are
authoritative; chat, dashboards, and model memory are projections only.

Resume from a clean clone:

```sh
node .agentops/tools/opsctl.mjs verify   # validate contracts + check generated views
```

Then read, in order and no more than needed: `.agentops/BOOTSTRAP.md`,
`.agentops/project.json`, and the single contract your current action touches.
Do not preload the reconstruction bundle, full history, or unrelated trees.

Stable invariants:

- Reversible, collision-free local work proceeds without approval.
- One writer per overlapping path or ref (`git-ownership.json`).
- Protected transitions — push, PR, merge, direct `dev`/`main` update,
  destructive cleanup or history rewrite, publication/Pages/deploy/release,
  credential/privacy crossings, overriding an independent QA verdict — need
  their own exact separate authority; local readiness never implies it.
- `UNKNOWN` never means approval; `LOCAL`/`PUSHED`/`MERGED`/`RELEASED` are
  distinct facts.
- Never hand-edit a `generated/` view.

More specific `AGENTS.md` files and the game's `SPEC.md`/`DEVELOPER.md` still
apply to their areas.
