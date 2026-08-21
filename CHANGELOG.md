# Changelog

What changed, newest first, in the player's words where the change is
player-visible. Every entry is a receipt, not a memory: it names the pull
request that landed it, and the build ordinal is read from `buildordinal.json`
as committed at that merge on `dev` — two merges can share an ordinal when one
of them shipped evidence or docs only, which rebuild nothing.

These are **development builds**, not releases. Release status is governed
separately and remains **RED**. The version stamp in-game is
`0.4.0.<ordinal>`.

*This file starts at `0.4.0.0777` (2026-08-17). Below that point the merge
log's pull-request references turn intermittent — whole runs of direct
landings on 2026-08-14 to -16 name no pull request at all — so entries there
would be reconstruction from memory, not receipts. The history before this
point lives in `git log` and is not restated. (The in-game changelog is its
own card, #189, and stays unbuilt; this file is the "one authoritative
structured owner" that card asks for.)*

## 2026-08-21

- **Rewards wait for a deliberate hold and leave untouched choices alone** ([#290](https://github.com/cehinds/AshenSpire/pull/290), `0.4.0.0927`). Ordinary rows no longer show Skip. Cards, potions, and armaments open before collection; Back preserves the menu. Manual mode leaves untouched rewards behind, while auto mode still takes the rest. Continue requires the shared hold on pointer, touch, keyboard, and gamepad.

## 2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912

- **Character creation is one panel at a time** ([#288](https://github.com/cehinds/AshenSpire/pull/288), `0.4.0.0911`). Six sections — CLASS, STARTING KIT, KEEPSAKE, SIGIL, TINT, SPRITE — each a card that opens at its turn. CLASS is open on arrival; picking an option collapses the section and opens the next; any face re-opens out of order. After the flow, the column reads back your six choices in words. Keyboard and pad included: the cursor rides the advance, so Confirm-Confirm walks the whole flow accepting defaults.
- **The merchant is five collapsing bars — and Sell is one of them** ([#291](https://github.com/cehinds/AshenSpire/pull/291), `0.4.0.0912`). CARDS · RELICS · FLASKS · REMOVE A CARD · SELL, one open at a time, cards open on arrival. Buying keeps the bar you're looking at open. The merchant buys back what he sells — relics and flasks, at half the low end of the item's own price band — and the whole Sell bar can be switched off in Settings (then it's absent, not greyed).
- **The short-screen warning reads whole at the largest text size** ([#289](https://github.com/cehinds/AshenSpire/pull/289), `0.4.0.0901`). At Text XL on a very short screen, the last-resort refusal message no longer loses its sentence to its own glyph.
- **Flask display verified healthy everywhere** ([#286](https://github.com/cehinds/AshenSpire/pull/286), `0.4.0.0900`). Evidence-only: fourteen photographs of every reachable flask surface, both shapes — no source change; closed #277.
- **Fullscreen is the first option under Display** ([#287](https://github.com/cehinds/AshenSpire/pull/287), `0.4.0.0900`). One toggle at the head of Settings → Display, reflecting the real fullscreen state.
- **Title screen no longer crashes on a detached map board** ([#244](https://github.com/cehinds/AshenSpire/pull/244), `0.4.0.0893`). The map's scroll-commit debounce could fire after leaving the map and take the title screen down.
- **Status & Daily Briefs linked from the README** ([#226](https://github.com/cehinds/AshenSpire/pull/226), `0.4.0.0885`). Docs only.
- **Combat action row no longer overlaps or mis-scales** ([#224](https://github.com/cehinds/AshenSpire/pull/224), `0.4.0.0885`).
- **Hint-strip selftest runs on Windows** ([#225](https://github.com/cehinds/AshenSpire/pull/225), `0.4.0.0878`). Tooling only.
- **buildversion selftest cleanup is deterministic on macOS** ([#221](https://github.com/cehinds/AshenSpire/pull/221), `0.4.0.0878`). Tooling only.
- **Build-stamp browser fixture inputs repaired** ([#223](https://github.com/cehinds/AshenSpire/pull/223), `0.4.0.0878`). Tooling only.
- **Friendly card targets are visibly distinct, on every input** ([#220](https://github.com/cehinds/AshenSpire/pull/220), `0.4.0.0878`). Cards that target you or an ally say so with the same clarity for mouse, keyboard, and pad.
- **Combat fits short landscape screens** ([#219](https://github.com/cehinds/AshenSpire/pull/219), `0.4.0.0869`).
- **Guard absorption and residual damage show as separate floats** ([#218](https://github.com/cehinds/AshenSpire/pull/218), `0.4.0.0867`). What your block ate and what got through are two numbers, not one.
- **Audio cues with optional samples stay immediate** ([#217](https://github.com/cehinds/AshenSpire/pull/217), `0.4.0.0850`). No late hit-sounds while an optional sample resolves.

## 2026-08-19

- **The current dev Pages preview is surfaced in the README** ([#212](https://github.com/cehinds/AshenSpire/pull/212), `0.4.0.0841`). Docs only.

## 2026-08-18

- **Hybrid combat input parity completed** ([#210](https://github.com/cehinds/AshenSpire/pull/210), `0.4.0.0841`). Mixing mouse, keyboard, and pad mid-combat keeps one coherent cursor and one set of affordances.
- **Text size scales text, and only text** ([#206](https://github.com/cehinds/AshenSpire/pull/206), `0.4.0.0835`). The accessibility text setting stops resizing non-text UI; UI size remains the whole-game control.
- **Native map pan belongs to the map again** ([#203](https://github.com/cehinds/AshenSpire/pull/203), `0.4.0.0828`).
- **Escape during the tutorial cancels the right thing** ([#201](https://github.com/cehinds/AshenSpire/pull/201), `0.4.0.0822`).
- **Map structure contrast is measurable — and raised** ([#202](https://github.com/cehinds/AshenSpire/pull/202), `0.4.0.0807`). Paths and nodes hold a checked contrast floor.

## 2026-08-17

- **Combat HUD pages long strips and shows drag targets** ([#199](https://github.com/cehinds/AshenSpire/pull/199), `0.4.0.0807`).
- **Map zoom and camera persist correctly** ([#200](https://github.com/cehinds/AshenSpire/pull/200), `0.4.0.0799`). Returning to the map returns to your zoom and place.
- **The verified current build lives at the repository root** ([#186](https://github.com/cehinds/AshenSpire/pull/186), `0.4.0.0788`). `AshenSpire.html` at the root is the same bytes as `dist/`, checked by `tools/verify-shipped.mjs`.
- **A reversible architecture map** ([#180](https://github.com/cehinds/AshenSpire/pull/180), `0.4.0.0777`). Docs only.
