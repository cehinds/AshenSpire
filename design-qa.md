# Player polish design QA

Status: passed for the reviewed presentation scope.

Reference: the twelve approved boards in `docs/design/player-polish-2026-10-01`
and the reviewed asset kit in `docs/design/player-polish-asset-kit-2026-10-02`.
The 24 runtime recipes and canonical grounding are recorded in
`docs/PLAYER-POLISH-RUNTIME.md`.

Actual built light edition inspected in Chromium at 1280×800, 390×844 and
844×390. Screen captures use the supported reduced-motion setting and the
existing memory-only showcase routes. The route matrix covers title, creation,
opening, dialogue, journey, classic map, dungeon, combat, boss introduction,
merchant, smith, master, rest, rewards, compendium, co-op fight/route votes,
lobby, results, history, settings, profile, custom run and one-off events.
Actual UI navigation also covered Crownfall, Armoury equipment/character/
progression/inventory/comparison, deck editing, card expansion, relic and
flask detail, and custom-run draft picks. No campaign-completion or network
multiplayer-session claim is made by these screenshots.

The captured route checks found no outer document overflow or broken visible
images; captured browser warning/error log was empty. The screenshots were
compared with all twelve boards, including full-size portrait and short-wide
inspection where miniature contact sheets exposed crowding.

Resolved findings: opaque button texture hid semantic fills; generic sprite
framing drew black boxes around canonical combatants; a meter selector painted
empty tracks; smith rows clipped offer names/actions; portrait service totals
crushed the heading; stacked compendium tiles clipped names/art; short-wide
title clipped its final entries and long labels. Final presentation preserves
native primary/selection/exit/disabled colours and End Turn's exception,
canonical actor/map/floor anchors, unknown compendium art, actual ownership,
prerequisites, prices, consequences and recovery caps. High contrast keeps
solid information surfaces. There are no outstanding P0/P1/P2 presentation
findings from this inspection.

Committed proof: `docs/preview/player-polish-runtime/`. Full captures, DOM
snapshots and route measurements are local review evidence under
`D:/repos/.codex/visualizations/2026/10/02/player-polish-runtime/screenshots`.
Engine/tool/CI validation is reported separately in the PR; design QA is not
a substitute for those gates.
