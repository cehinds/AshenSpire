---
name: polish
description: Production-polish pass for a game at its current state. Trigger on "/polish", "POLISH", "polish the game", or a request to production-polish, make ship-ready, or productionize the game — not on a bare "polish" about text, docs or PRs. Audits feel, performance, flow, feedback, art direction, code structure, data-driven content, CI/CD, mobile, and produces a prioritized roadmap plus first fixes.
---

# POLISH — production pass for a game at its current state

Role: senior game director + tech lead + mobile perf engineer. Goal: make the
game feel great, run fast on low-end mobile, and be cheap to extend and ship.
Ground every claim in this repo's code, data, and docs; project rules
(SPEC/CONTRIBUTING/DEVELOPER or equivalents) override this prompt.

## 0. Recon (read before judging)
- Engine/stack, entry points, scene/state flow, content/data dirs, build + test
  commands, CI workflows, target platforms, current roadmap/spec.
- Run the game + tests. Record baseline: FPS/frame time, load time, bundle/APK
  size, memory, test pass rate, CI duration.

## 1. Audit — per pillar: score 1–5, top issues with `file:line`, fix, effort (S/M/L), impact (H/M/L)
1. **Feel / juice** — input latency (<100ms, act on press not release), buffering/coyote
   windows, anticipation→action→follow-through, hit-stop, screen shake (capped,
   toggleable), easing (no linear UI), particles, SFX per action with pitch variance,
   haptics on mobile.
2. **Feedback loop** — every input acknowledged within 1 frame; cause→effect legible;
   numbers/states readable at a glance; reward cadence (micro <10s, meso per
   session, macro across sessions); failure explains itself and restarts fast.
3. **Game flow** — time-to-fun <30s, onboarding by doing (no text walls), difficulty
   curve per spec targets, pacing tension/release, no dead ends, session length fits
   mobile (3–10 min loops, safe pause/resume anywhere, state persisted).
4. **Art direction** — one coherent style guide: palette tokens, type scale, icon
   set, animation timing tokens, silhouette/value readability, color-blind safe,
   UI hierarchy; flag off-style assets.
5. **Performance** — 60fps target on low-end device (budget: 16.6ms, draw calls,
   texture memory, GC/alloc per frame ≈0 in hot loops); pooling, atlasing,
   lazy/streamed loading, asset compression, startup <3s, battery/thermal.
6. **Code structure** — clear layers (core sim ↔ presentation ↔ platform); sim
   deterministic and headless-testable; no god objects; systems talk via events/
   interfaces; single source of truth for state; dead code removed; consistent naming.
7. **Data-driven content** — units/cards/levels/items/balance/strings in schema-
   validated data files (per repo convention), not code; schemas + validator in CI; IDs stable;
   adding content = add a data file + asset, zero code; hot-reload in dev;
   localization-ready strings; balance tables diffable.
8. **Dev maintainability** — one-command setup/run/test; README/DEVELOPER docs
   current; content-authoring guide; lint+format+typecheck enforced; tests on sim
   rules, data validation, save migration; contributor can add a content item in <15 min.
9. **CI/CD (lean: ≤3 workflows)** — (a) PR: lint/typecheck/unit/data-validate/build,
   cached, <10 min; (b) main/release: build all targets, smoke test, size/perf budget
   check, artifact upload; (c) deploy: tagged release → store/web channel with
   changelog (owner-only; propose, don't execute). ≤3 is a guideline: recommend
   consolidating redundant workflows; never delete or merge workflows without owner
   approval. Required checks only on (a).
10. **Mobile** — touch targets ≥44pt iOS / 48dp Android, thumb-zone layout, safe areas/notches,
    portrait/landscape decision, variable aspect ratios, offline play, interruption
    handling (calls, backgrounding), low-power mode, text scaling, haptics, store
    size limits, crash/analytics hooks (privacy-respecting).
11. **Delivery / live ops** — semantic versioning, save-data versioning + migrations,
    remote config / feature flags for balance, staged rollout, crash monitoring,
    changelog, rollback plan. Tags, releases, store publishing and rollouts are
    owner-only: propose, don't execute.

## 2. Output
1. **Scorecard** table: pillar | score | top issue | fix | effort | impact.
2. **Top 10 fixes** ranked by impact÷effort; quick wins (S+H) first.
3. **Roadmap**:
   - **Now (1–2 wks) — Ship-blockers**: crashes, perf budget, input feel, save safety, CI (a).
   - **Next (2–6 wks) — Polish**: juice/feedback, onboarding, art-style pass, data
     migration of hardcoded content, CI (b).
   - **Later (6–12 wks) — Scale**: content pipeline/tools, live-ops (remote config,
     flags), CI (c), analytics-driven balance.
   - **Update cadence**: small patch every 1–2 wks, content drop every 4–6 wks, each
     with changelog, migration check, staged rollout.
   Each item: goal, acceptance criterion (measurable), owner area, risk.
4. **Execute** (only if the user asked for fixes or confirms after seeing 1–3):
   implement top quick wins, one concern per branch/PR, following the repo's rules
   (e.g. branch from and PR into the integration branch, open ready for review, get
   another agent/session to review, keep it green and mergeable, never merge to
   release/main or tag). Verify with tests + a run of the game; report before/after
   metrics.

## Rules
- Measure before and after; no perf claims without numbers.
- Smallest change that moves the metric; don't rewrite working systems.
- Never change spec-contractual rules in a polish PR (spec change goes first, in its
  own PR); balance-number changes cite reasoning per the repo's rules.
- Mark anything unverified as unverified.
- Terse output; tables over prose.
