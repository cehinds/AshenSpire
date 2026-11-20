# Settings cleanup, Effects modal, performance

Owner request, 2026-11-19. Branch `feature/settings-ui-performance-063de6`.

## What was measured (1280x800, Effects off, dev build)

- Idle on title, map and combat: **0** animation frames, **0** timers, **0** DOM changes in 5 s.
  - So the game is **not** repainting while idle. The slowdown is per action.
- One card play or end turn: one 50–90 ms blocking task, 120–250 DOM changes.
- No listener or observer leak over 3 turns.
- Not yet reproduced: "dramatically slow". Needs a long fight (20+ turns) to confirm growth.

## Checklist

### Done
- [x] Battlefield grid defaults off (`showFormationGrid`, `src/model/advancedConfig.js`)

### Effects modal
- [ ] Combat > Effects becomes a button: "Effects: On · 5 of 6" opens a modal
- [ ] Modal: master Effects switch at the top (existing `effects` key, default off)
- [ ] Modal section "Visual effects", greyed when master is off:
  - [ ] Stance and aura glow (`fxGlow`)
  - [ ] Hit sparks and slashes (`fxSparks`)
  - [ ] Impact flashes (`fxFlash`)
  - [ ] Screen shake (existing `screenShake`, moved here)
  - [ ] Hit pause (`fxHitStop`)
  - [ ] Ambient background (existing `ambient`, moved from Advanced > Interface)
- [ ] Modal section "Fighter motion" (works with Effects off): attack, hit, idle, defeat (existing rows, moved)
- [ ] Each sub-switch actually gates its effect (root `data-fx-*` flags + `fxOff(kind)` helper)
- [ ] Strings in `content/source/uiStrings.csv`, short and plain

### Performance (ranked)
- [ ] **Root cause of "slow late in long fights":** every action deep-copies the whole fight log (`structuredClone` in `candidateState`, `src/engine/combatRules.js:102`). 200-turn Node run: playCard 4 → 45 ms, endTurn 16 → 61 ms as the log grows 1.4k → 10.7k entries. Fix in progress (share old entries, copy only the array), then Opus review.
- [x] `combat.js:1701` copied the whole event log every render; now reads only the new tail
- [x] `tooltip.js:693` body-wide observer rescanned the whole page on every DOM change; now scans only added nodes
- [ ] `combat.js` `render()` re-runs every geometry pass on every action. Blocked: contract C8 (`tools/ui-components.mjs`, `stableCombatStageRendering`) pins those lines; patch ready in `eebf2e95ca`
- [x] CSS that animates forever with Effects off: all 19 infinite loops now stop (one allowlisted: loading spinner); test `tests/effects-off-infinite-animations.test.mjs`
- [ ] Effects off on desktop still keeps every blur and drop-shadow. Blocked: owner set filter stripping to phones only (`styles/perf-lite.css`, `tests/perf-lite-css.test.mjs`); needs owner yes/no
- [ ] Later: `JSON.stringify` render keys in `combat.js` → revision counter

### Settings tidy (follow-up, not this PR)
- [ ] Advanced has 54 rows in 9 groups; Combat has 28. Split or prune.
- [ ] Topic grouping is a long key regex (`settings.js:1462`); make it a row field.
- [ ] `data-performance` and `data-effects` mean the same thing; keep one.
- [ ] Remove the retired `performanceMode` row.

### Verify
- [ ] Sandbox QA (`npm run qa:sandbox`), screenshots at 1280x800 and 390x844
- [ ] Before/after timing of one card play and one end turn
