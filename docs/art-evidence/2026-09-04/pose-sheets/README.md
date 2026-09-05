# Painted pose sheets — 2026-09-04

The owner's painted pose sheets, one per class, as delivered. Every sprite in
`art/poses` is cut from these; they are kept here so the cut can be redone from
its source rather than from its output.

Each sheet is 1254x1254, RGB with the checkerboard painted in as pixels rather
than as transparency, laid out as a 3x3 grid read left to right, top to bottom:

The nine are cut under different names per class, because the classes do not
idle the same way. The owner's call: **a fighter stands ready and a caster
stands.**

| # | rogue, reaver | starseer, herald |
|---|---------------|------------------|
| 1 | `stand` | `idle` |
| 2 | `guard` | `guard` |
| 3 | `attack1` | `attack1` |
| 4 | `attack2` | `attack2` |
| 5 | `attack3` | `attack3` |
| 6 | `cast` | `cast` |
| 7 | `hit` | `hit` |
| 8 | `idle` | `brace` |
| 9 | `idle2` | `idle2` |

So the Rogue and Reaver hold figure 8, the braced stance, between actions, and
the Starseer and Herald hold figure 1. Combat ships six names — `idle`, `guard`,
the three attacks and `hit`; `stand`, `brace`, `cast` and `idle2` are cut and
kept but not shipped.

Combat has the player facing right. Two Reaver figures are painted facing left —
`attack2` and `idle` — figures 4 and 8, and the Reaver's 8 is its `idle` — and
are cut with `--mirror`; every other figure is used
as painted. The commands are in `art/poses/README.md`.
