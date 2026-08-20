# Starseer-kit and Herald ceiling decision packet (#205)

## Provenance and boundary

- Exact source ref: `6730e61b67c2dd80ad7685e57d1f78b4e5641017` (`dev` at the start of the run).
- Repository build receipt: `0.4.0.0850`, source identity `133f36b5af` (`buildordinal.json`). The simulator imports source modules at the exact ref; it does not execute the shipped HTML.
- Runtime: Node `v24.16.0`.
- Runs: `n=1000` per class and policy, deterministic seeds `(i*2654435761)>>>0`, `i=1..1000`.
- Boundary: these are naive-bot floor measurements. They do not measure experienced-player win rate and authorize no class, card, encounter, or balance-value change.

## Controls

- `node tools/measure-classes.mjs 30 --check`: live `runsim.mjs` agreement, seed-for-seed, Reaver `11/30`, Starseer `3/30`, Herald `12/30`.
- `node tools/measure-classes.mjs --selftest`: clean baseline plus all 16 plants caught (four copied-bot drift plants, eight counter plants, exact-branch lethal/control receipts, delayed-intent timing, and charged-follow-up priority).
- Removing only charged-follow-up priority reduced the 30-seed registered conversion from `77.6%` to `35.3%` and charged priority changes from `1894` to `0`.
- Real-dispatch plants prove a lethal one-HP Pebble cannot let its unconditional hit impersonate the skipped conditional hit, charged Frost/Vulnerable branches do convert, and Held Blade defense is selected only when the pending hit is due rather than while it is charging.
- Under `starseerkit`, complete Reaver and Herald result rows were byte-identical to greedy for all `1000/1000` seeds per class. The Starseer-only policy did not leak.
- Starseer charge conversion rose from `37.2%` (`28555/76728`) under greedy to `75.9%` (`57001/75068`) under Starseer-kit: `+38.7` percentage points. Rule 1's `+10` point qualification threshold passed.

## Win-rate matrix

| Policy | Reaver | Starseer | Herald |
|---|---:|---:|---:|
| greedy | 29.3% `[26.6, 32.2]` | 9.3% `[7.7, 11.3]` | 56.8% `[53.7, 59.8]` |
| Starseer-kit | 29.3% `[26.6, 32.2]` | 21.4% `[19.0, 24.0]` | 56.8% `[53.7, 59.8]` |
| skill-first | 17.6% `[15.4, 20.1]` | 2.5% `[1.7, 3.7]` | 65.2% `[62.2, 68.1]` |
| random | 28.7% `[26.0, 31.6]` | 9.0% `[7.4, 10.9]` | 58.2% `[55.1, 61.2]` |
| Reaver-kit continuity | 31.1% `[28.3, 34.0]` | 6.5% `[5.1, 8.2]` | 57.3% `[54.2, 60.3]` |

Wilson 95% intervals are shown in brackets. For paired Starseer greedy to kit seeds: `155` improved, `34` regressed, `59` stayed wins, and `752` stayed losses; exact McNemar `p=1.1713e-19`. Greedy Reaver versus Starseer-kit was `293/1000` versus `214/1000`, two-proportion `p=0.0000489`.

## Mutually exclusive decision

The clarified residual-first precedence applies:

1. Rule 1 passed: all required controls passed, `n=1000/class` completed, and exact conditional-effect conversion increased by `38.7` points.
2. Rule 3 takes precedence: Starseer-kit's Wilson upper bound `24.0%` remains below greedy Reaver's lower bound `26.6%`.
3. The policy effect is still real: Starseer-kit's lower bound `19.0%` is above greedy Starseer's upper bound `11.3%`, but that second Rule 2 clause cannot mask the residual gap.

Classification: **Starseer residual gameplay diagnosis required**, with a separately linked follow-on and no tuning on #205.

The mechanism to name in that follow-on is late-run attrition after the policy fixes most of the early combo floor. Greedy to kit reduced Act 1 deaths from `338` to `110` and net attrition from `26.07` to `19.57` per combat, but the kit arm still recorded `490` Act 2 and `186` Act 3 deaths. Bosses led the remaining deaths (`371`), especially Stitched King (`237`) and Rot Valkyrie (`119`), while healing remained `4.86/combat`. This is a diagnosis target, not a balance conclusion.

Herald meets the preregistered **policy-insensitive simulator ceiling** rule. Its lower Wilson bound stayed above 50% under greedy (`53.7`), skill-first (`62.2`), and random (`55.1`), and the point-estimate spread was `8.4` points (`56.8` to `65.2`). Required follow-on: human-play/balance measurement, not a Herald nerf.

## Re-run commands and evidence

```text
node tools/measure-classes.mjs 30 --check
node tools/measure-classes.mjs --selftest
node tools/measure-classes.mjs 1000 --policy=greedy
node tools/measure-classes.mjs 1000 --policy=starseerkit
node tools/measure-classes.mjs 1000 --policy=skillfirst
node tools/measure-classes.mjs 1000 --policy=random
node tools/measure-classes.mjs 1000 --policy=reaverkit
```

- `starseerkit-greedy-1000.txt`
- `starseerkit-policy-1000.txt`
- `starseerkit-skillfirst-1000.txt`
- `starseerkit-random-1000.txt`
- `starseerkit-reaverkit-1000.txt`

## Lifecycle checks

- Screenshots: N/A — #205 is a headless simulation/tools card and changes no rendered UI.
- README: N/A — no user-facing command or playable-build entry changed.
- Repository changelog: N/A — the repository has no per-diagnostic changelog surface.
- In-game changelog: N/A — no shipped gameplay behavior or player-visible content changed; that surface is separately owned by #189.
