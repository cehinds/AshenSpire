# Changelog

What changed, newest first, in the player's words where the change is
player-visible. Every entry is a receipt, not a memory: it names the pull
request that landed it, and the build ordinal is read from `buildordinal.json`
as committed at that merge on `dev` — two merges can share an ordinal when one
of them shipped evidence or docs only, which rebuild nothing.

A receipt may ship in the pull request that makes the change (DEVELOPER.md
asks it of Armoury contract changes). It then names the build its own
projection produces: rebuild, write the receipt at that ordinal plus one, run
`node tools/about-changelog.mjs --write` (which allows exactly that one build
ahead while projecting), rebuild again, and the ordinal on the box equals the
receipt. A later rebuild on the branch — a merge from `dev`, another fix —
moves the box, so the receipt is re-pointed the same way before the merge.

These are **development builds**, not releases. Release status is governed
separately and remains **RED**. The version stamp in-game is
`<release>.<ordinal>` — `0.4.0.<ordinal>` through build 1903, and
`0.5.0-rc.1.<ordinal>` from the first 0.5.0 release candidate on (see
`docs/versioning.md`, "Release candidates").

*This file starts at `0.4.0.0777` (2026-08-17). Below that point the merge
log's pull-request references turn intermittent — whole runs of direct
landings on 2026-08-14 to -16 name no pull request at all — so entries there
would be reconstruction from memory, not receipts. The history before this
point lives in `git log` and is not restated. The in-game changelog is #189's
projection of this file, which remains the one authoritative structured owner.)*

## 2026-09-01

- **Your equipment now has a weight, and the Armoury says what it costs you** ([#520](https://github.com/cehinds/AshenSpire/pull/520), `0.5.0-rc.1.1914`). Beside the Poise threshold, the Armoury's equipment receipts show your Equip load: what your hands and armour weigh against a capacity set by Constitution and Strength, the percent, and the Weight Class it lands you in — Light, Medium or Heavy. Armour weighs its Poise threshold, and every item card shows the same Weight number the total counts, smithed or not. This is a readout for now; the dodge roll that spends it lands separately. The capacity base is tuned so that every class can reach every class of load; no starting kit the creator allows begins Heavy.
- **Status-effect rules and the cost badges on card faces now come from the framework** ([#516](https://github.com/cehinds/AshenSpire/pull/516), `0.4.0.1903`). Behavior-preserving: the ninth port tranche moves status semantics (stacks, meters, decay, procs, resists) behind a framework door and reads the card-face cost, mana and stamina badges from the framework cost profile. Every card's badges are proven identical. Release remains RED.
- **Every status and stance word, and the whole hold-to-confirm surface, route through the framework** ([#514](https://github.com/cehinds/AshenSpire/pull/514), `0.4.0.1902`). Behavior-preserving: the eighth port tranche resolves the remaining status/stance names and tooltips (combat rows, proc bars, stance chips, stagger tooltips, co-op board, arcane exposure) through the framework term registry, verbatim, and moves the tap/hold/inspect interaction surface behind the framework door for all ten screens that use it.
- **Armaments can grant cards and install default weapon arts, dormant until authored** ([#513](https://github.com/cehinds/AshenSpire/pull/513), `0.4.0.1901`). Nothing a player sees changes: no shipped armament authors a grant or a weapon art yet. The mechanism composes them with save-stable ids at creation and on equip, reconciles them across the combat piles on a mid-fight swap and on loading a fight, dedupes a shared weapon art across two hands, and keeps them out of per-copy upgrade and removal offers — all proven by fixture. Status and stance words on card faces now resolve through the framework term registry.
- **Deck composition and confirmation rules adopted as the framework's own** ([#512](https://github.com/cehinds/AshenSpire/pull/512), `0.4.0.1896`). Behavior-preserving: the shipped weapon-deck composer and the fail-closed confirmation derivation become the framework's implementations behind framework doors; the smith upgrade modal routes through the option-decision door. Rides along: the about-changelog instrument's selftest census and verdict lines (#498).
- **Two owner rulings recorded and executed for the framework port** ([#511](https://github.com/cehinds/AshenSpire/pull/511), `0.4.0.1893`). Behavior-preserving: the owner adopted the legacy deck composition and the fail-closed confirmation derivation as the framework's rules; status and stance tooltips on card faces resolve through framework terms.
- **Card costs and load/quit confirmation severity decided by the framework** ([#510](https://github.com/cehinds/AshenSpire/pull/510), `0.4.0.1893`). Behavior-preserving: the second port tranche compiles every card's cost profile (action, mana, stamina, X, Power reduction) through the framework and reads the load/quit dialog tone from the confirmation registry; every card's costs are proven identical, base and upgraded.

- **The data-driven property framework lands as a complete, validated replacement candidate** ([#508](https://github.com/cehinds/AshenSpire/pull/508), `0.4.0.1888`). Nothing a player sees changes: the framework — canonical registries, a deterministic property compiler, gameplay services, shared presentation rules, an importer carrying all 392 existing entities with their exact identities, and a cutover gate that refuses to switch until every check passes — ships alongside the running game without touching it. Evidence and groundwork only; it rebuilds nothing, so it shares the current ordinal. Release remains RED.

## 2026-08-31

- **Smithing upgrades an armament and every basic card it owns** ([#502](https://github.com/cehinds/AshenSpire/pull/502), `0.4.0.1854`). Elite and boss victories award Smithing Stones; the Shrine spends one Stone to improve an owned armament for the run, with exact before-and-after card values shown before confirmation. The upgrade follows the armament through swaps, saves, active combats, legacy runs, rewards, and co-op host restoration. The picker uses the owned weapon or shield art, inventory quantity, WEAPON label, and equipment tags instead of borrowing one combat card's identity.

## 2026-08-28

- **The Review & Approval Hub refreshes its owner decisions and adds Context Rotation** ([#361](https://github.com/cehinds/AshenSpire/pull/361), `0.4.0.1454`). The owner-facing hub promotes the two bounded Art decisions into cards that need Constantine without approving either, adds the #053 Context Rotation dashboard and its 13-team / 52-seat report, and separates registration and cold-start acceptance from execution, rotation, and successor-resume proof. Local-only evidence URLs now resolve to the explicit unavailable page instead of leaking author-local file paths. Evidence and hub only; it rebuilds nothing, so it shares the current ordinal. Release remains RED.

## 2026-08-26

- **Smith now lets you choose, review, and confirm one permanent card upgrade** ([#350](https://github.com/cehinds/AshenSpire/pull/350), `0.4.0.1362`). Back and Escape return to the Shrine without changing the deck; Confirm upgrades exactly the selected card and clearly says that it leaves the Shrine. The same delivery also makes attribute explanations span their allocator rows, gives folded Shrine choices one footprint, gives Armoury trays useful session-scoped opening sizes and snap stops, adds touch-readable combatant inspection with center-seeking tooltips, and codifies the repeatable gameplay QA process and component-catalog receipts.

## 2026-08-25

- **The title now unfolds from the Ashen Spire threshold into one centered menu** ([#347](https://github.com/cehinds/AshenSpire/pull/347), `0.4.0.1352`). The folded startup mark keeps its logo, subtitle, divider, and input-family invitation centered while its phone background is fully transparent. The revealed title presents Continue, Load, New, Collection, Settings, and Quit as one vertical list; Fullscreen and Music stay anchored at the top right. Load and New share one responsive save-slot dialog with selected, empty, focused, disabled, and occupied states plus Back and Continue controls.

- **Combatants now stay centered inside a safe battlefield corridor** ([#348](https://github.com/cehinds/AshenSpire/pull/348), `0.4.0.1354`). Intent remains full size while the combatant card alone scales between the shared HUD and action hand, preserving explicit breathing room above and below on desktop and phone.

## 2026-08-24

- **Cold boot now opens on the Ashen Spire threshold** ([#346](https://github.com/cehinds/AshenSpire/pull/346), `dev artifact; exact BUILD in PR evidence`). The title menu now waits behind a sparse Ashen Spire wordmark, ash, and exact BUILD/source receipt until the first click, tap, Enter, Space, A/Cross, or Start/Menu press is completed. That first press is consumed instead of falling through into a save slot; interrupted presses are cancelled on blur or controller disconnect, and controller buttons already held when polling begins are seeded rather than invented as fresh presses. The title then gives focus to its first available slot. The invitation follows the last active input family, including analog-stick activity, exposes one named startup action without exposing title controls, and keeps pointer/touch focus free of the persistent gamepad cursor. Profile recovery still takes priority, reduced motion keeps a short deterministic exit, and returning to the title during the same boot does not show the threshold again.

- **Fullscreen, music, Settings, and Profile now have one clear home each** ([#344](https://github.com/cehinds/AshenSpire/pull/344), `0.4.0.1271`). Fullscreen and Music sit beneath the top-right HUD on the title, map, and combat screens, including LAN co-op. The Music control now reflects master Audio mute instead of claiming muted music is on, and turning it on releases both mute layers. Browser refusals are explained beside the control instead of disappearing into Settings, and iPhone users see the Add to Home Screen alternative without needing a hover tooltip. The in-run menu now contains only Settings and Controls, with Save Game and Save & Quit to Title in its footer; Profile lives on the title screen; Changelog lives under Advanced; and the old Deck and Stats shortcuts now open the Armoury that owns them without losing the active run’s combat totals. Restoring a profile also rebinds the title HUD immediately. The Profile drawer traps keyboard focus and states its real save-retention limits.

- **Development coordination now has one canonical home** ([#335](https://github.com/cehinds/AshenSpire/pull/335), `0.4.0.1191`). The repository now points owners and reviewers to one workflow for routine evidence, status receipts, cross-family handoffs, and the boundary between development approval and Constantine-only release authority. Docs only; release remains RED.

## 2026-08-23

- **The Armoury is now one configurable equipment workspace** ([#334](https://github.com/cehinds/AshenSpire/pull/334), `0.4.0.1191`). Character, Inventory, and Hybrid views share one loadout and one Inventory; procedural equipment positions support List/Grid presentation, dragging, socket-correct moves, responsive panes, and one Folding Tray grammar with independently sized supporting trays where enabled. Inventory equipment cards now own their complete folded and expanded action surface: the configured hold gesture fills the whole card, early release aborts, and comparison receipts use a wide data-configured hover/focus tooltip or inline presentation.

- **Character creation now owns one shared Inventory and validates every starting hand** ([#329](https://github.com/cehinds/AshenSpire/pull/329), `0.4.0.1126`). Creation preserves customized saves, keeps armour and armament ownership consistent, refuses invalid hand assignments, and introduces the Rogue alongside data-driven starting attributes and kits.

- **Swapped armaments now remain attached to their actual hand sockets** ([#328](https://github.com/cehinds/AshenSpire/pull/328), `0.4.0.1114`). The Armoury maps left- and right-hand equipment through the same socket ownership used by the run model, so swapping and unequipping no longer makes a weapon appear to belong to the opposite hand.

- **Map and combat now share the same three-row HUD** ([#327](https://github.com/cehinds/AshenSpire/pull/327), `0.4.0.1091`). Run information stays across the top with Cinders centered; HP, MP, and SP remain stacked at the left with Relics beneath; and Armoury, Menu, Health, and Mana form one aligned two-by-two control block at the right. The map keeps its zoom and legend controls together below the playfield.

## 2026-08-22

- **Map and combat share one compact player HUD** ([#323](https://github.com/cehinds/AshenSpire/pull/323), `0.4.0.1078`). HP, MP, and SP now keep the same vertical order and percentage scale on both screens; the top HUD leaves Poise to the combat character card, caps its resource area at 40% of the viewport, and centers Floor with Cinders without letting visible resource cards paint through that receipt.

## 2026-08-21

- **The reward menu is written down, in the README and the changelog** ([#317](https://github.com/cehinds/AshenSpire/pull/317), `0.4.0.1000`). Docs only.

- **The Armoury opens on your figure, and CARDS is one click away** ([#316](https://github.com/cehinds/AshenSpire/pull/316), `0.4.0.0983`). The card strip now arrives folded by default, on every shape, so the character you dressed is whole the moment the panel opens instead of being squeezed into a scrolling sliver by the cards beneath it. One click on CARDS opens the strip, another folds it again, and outside a fight whatever you leave it on is what the Armoury gives you next time — it arrives the way you left it. The Armoury you open mid-fight keeps no such memory: it starts folded every time, whatever you did to it last. On a phone nothing changes: that view never showed the figure and already opened folded.

- **Your weapons are in the hands you gave them** ([#305](https://github.com/cehinds/AshenSpire/pull/305), `0.4.0.0947`). The character model faces you, so the armament in its right hand belongs on your left — the way it does when you face another person. It was drawn the other way round in the Armoury, in character creation, and in combat. Sword and shield now sit on the hands you equipped them to. One off-hand piece, the Parrying Dagger, is still on the wrong side and is tracked separately.

- **Stat points and a starting-armour choice at creation** ([#292](https://github.com/cehinds/AshenSpire/pull/292), `0.4.0.0946`). Two more rows on the creation screen, and both stay open where the six pickers fold. STARTING ARMOUR offers your class's own set plus every set you have earned — a new profile sees one, and each prize won becomes another way to begin. STAT POINTS hands you ten to place across the five stats: they arrive laid along your class's grain, dropping a stat gives its points back, and nothing goes below 8 or above 15 at creation. BEGIN THE CLIMB waits while points are unspent, and if an allocation starves your starting kit it says which stat and how much it needs.

- **Your own music obeys the game's mix** ([#296](https://github.com/cehinds/AshenSpire/pull/296), `0.4.0.0930`). Point the game at a folder of your own tracks and a shrine now plays quieter than a boss, the way the built-in score always did — each context's level is one number, read in one place, for played-in files and the internal score alike.

- **Rewards are a menu you open, not a handful you're handed** ([#290](https://github.com/cehinds/AshenSpire/pull/290), `0.4.0.0929`). Cinders, cards, flasks, armaments and relics arrive as rows, and nothing is applied until you take it — so you can look before you collect, and Back leaves the menu exactly as you found it. A reward with nowhere to go — a full flask belt, a full armament bag — says so on its own row before you tap it, and it is the only kind of row that offers Skip. Continue is always pressable and says what it will do; **Settings → Advanced → Reward collection** decides which: Auto (the default) takes everything you did not skip, picking a card for you, while Manual means done — only what you chose comes along. Continue is a press-and-hold on mouse, touch, keyboard, and pad.

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
