# Approved wireframes: implementation

Reference: documentation commit `dcb3d1cd`, draft PR #1005. Implementation
starts from clean `dev` commit `3c70be90`; owner-local changes are not copied.

The adjacent `wireframe-coverage.json` lists all 152 approved entries. Its
status records production implementation progress, not reference validation.
No entry is complete yet. Wireframe references that are absent on this base
are recorded explicitly: the documentation includes proposed adapters and
owner-local source that cannot be assumed to exist on released branches.

## Order of integration

1. Shared card faces, costs, inspection, selection and touch interactions.
2. Combatant ground anchors, formation, resource/intent overlays and HUD.
3. Screen shells, progression, equipment, rewards and remaining overlays.
4. Browser verification at wide, compact, iPhone SE and Galaxy S24 sizes.

The first production slice places all projected card costs under the header,
inside the art's left edge. Existing `framework.costProfile` and combat
preview values remain authoritative. No fixture costs, illustrative enemies,
or demo actions enter the game. Full WC0 geometry and inspector integration
remain pending, as do card fan/reorder changes.

## Validation

`node tests/wireframe-card.test.mjs` exercises the real renderer with production
registries for live costs, X costs, zero omission and static fallback. It
checks markup, not pixels. Run `node tests/run-node.mjs` for game regression
coverage; rebuild generated artifacts with `node tools/launch.mjs --build-only`
and run the repository's shipped/version checks before the PR is ready.

Mechanics remain governed by SPEC.md. Presentation consumes existing models
and dispatches existing actions; no mechanics changes are part of this work.
