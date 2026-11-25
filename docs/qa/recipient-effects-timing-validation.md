# Effects Timing validation

The authored JSON defaults schedule one clip at a time across the battlefield, with a 30 ms gap, zero overlap and 80% opacity. The planner preserves clip durations. Scope, cap, gap, overlap and opacity can be edited in Score Studio or the standalone preview. [User acceptance criteria](acceptance.recipient-effects-timing.json)

- **Sandbox.** The native source sandbox passed 24 of 24 checks at 1280×800 and 390×844 against `origin/dev` at `7dff4b03a1783054a4ed807f4d45db028b104343`, with the verified v30 art cache.
- **Editor.** Real Chromium checked both surfaces at both viewport sizes. Changing the gap, scope, cap, overlap and opacity updated the active plan and compositor immediately. Reach preview kept its caster circle and delivery ahead of impact. Sweep had one group clip. The fire texture stayed inside the slash clip.
- **Score Studio.** The Effects tab loaded the editor when selected, preserved a dirty 47 ms draft across Cards, Items, Weights and Sandbox, and paused playback when hidden. The same iframe was reused on return.
- **Save and reload.** Both surfaces saved the authoritative JSON and its generated UI projection together on an isolated write-enabled source server. The values survived reload. A second save restored approved defaults. The stale editor received HTTP 409 without modifying saved bytes. Invalid input disabled save. A read-only server offered a JSON download. The production checkout's configuration bytes remained stable.
- **Real Core2 combat.** After the teardown fix at `e1a23a6cba`, all ten viewport/action checks passed. Charm and the multi-recipient Gravity Well played without visual overlap. Measured DOM gaps were 32.3–41.0 ms for both cards in these runs. The planner test verifies an exact 30 ms gap independently of browser timer resolution. Sweep mounted once. A battlefield skip canceled pending clips. Effects Off preserved the recipient art.
- **Production entry.** Local Score Studio was opened using a write-enabled production source server. The default authoring route served pinned v30 assets, and submitting the already saved defaults returned the same revision and left both files byte-identical. [Desktop and phone capture record](../preview/features/recipient-effect-sequences/timing-capture.md)

## Spell damage follow-up

Independent review of `12fcba8a97f` confirmed the fix removes the second live Intelligence damage increment. Arcane still reads INT, Divine reads WIS, and shared spells read the greater of the two. The separate flat Intelligence status modifiers still apply. The card face, target quote and landed HP damage agree. All 33 card-face checks passed, including historical profile fixtures. [Casting rules](../ARCANE-DIVINE-RULES.md)

Both focused regressions failed with the preceding runtime source, then passed with the repair. The combined card-face, spell tradition and historical save run passed 85 of 86 test entries. The Divine Poise-break Smite receipt test fails with the same missing receipt on the preceding runtime source. Historical profile validation, enemy roster pins and save migrations passed.

Feature-specific checks passed. Mandatory discovered CI still includes inherited combat and stat contract failures. Dev and Test deployment require a green integration gate.

```powershell
npm run qa:sandbox -- docs/qa/acceptance.recipient-effects-timing.json --base origin/dev --out scratch/recipient-effect-sequences/timing-sandbox
```
