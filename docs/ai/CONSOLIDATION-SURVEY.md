# UI consolidation survey (2026-11-17)

Read-only survey of `src/ui/**` and `styles/*.css` (Opus 5.5), plus a mechanical clone scan of 3,137 functions.
The scan found 11 exact-shape clone groups and 17 pairs that are at least 80% alike.
Line counts below are estimates.
The prompt that drives the work is [CLEAN-CODE-PROMPT.md](CLEAN-CODE-PROMPT.md).

**Main finding:** the shared pieces already exist, and much of the code bypasses them.

- `OpenModal`/`BindModalDismiss`/`registerModal` already trap focus.
- `optionRowList`, `gesture.armPress` and an exported `deepFreeze` are all available.
- Copies of these keep being hand-written anyway.

## Counts

| Area | Copies | Est. saving |
|---|---|---|
| Modals hand-building veil / Escape / Tab trap / focus return | 19 sites (10 extra Tab traps, 9 "topmost modal?" checks) | ~300 lines |
| "Tap selects, primary commits" choice modals | 7 | ~200 lines |
| Selected-state toggles, arrow-key lists, Enter/Space click shims | ~64 sites | ~250 lines |
| Screen scaffolding: room frame, knowledge door, clear-root-then-append | 5 room screens, bestiary ≈ compendium, 14 screens | ~150 lines |
| Button effects: long-press timers ×6, double-press guards, sfx ≈ haptics | — | ~120 JS lines |
| Button CSS: 4 stacked hover/disabled layers, 3 identical card lifts, twin rules | — | ~40 rules |
| Inheritance / dedups: 8 private `deepFreeze`, effect planes, rail items, save notices, twin handlers | — | ~250 lines |
| Whole screen or list redrawn for a one-piece change | 9 hot spots (flask → 6 screens remount; `deckEditor`/`equipment` `draw()` with 26–27 callers) | feel and perf |

**Live inconsistency:** the inspect long-press is set in two places that can drift apart.

- `combatTargetHud.js:140` hard-codes 500 ms / 8 px.
- `combat.js:1278` reads the same gesture from config.

## 1. Modals

| Hand-builds | Sites |
|---|---|
| Everything: veil, dialog, aria-modal, Escape, Tab trap, focus return | `equipCompareModal.js:89-399`, `smithUpgradeModal.js:270-318`, `saveSlotSelector.js:164,253,502-538`, `title.js:386-405` |
| Veil and dialog by hand, then `BindModalDismiss` | `bookLearning.js:18-20` and `:96-99`, `upgradeDesk.js:52-58`, `deckEditor.js:114` |
| Own veil and Escape, no Tab trap | `overlay.js:320`, `quicknav.js:206-216`, `equipment.js:1888`, `bestiary.js:17`, `holdconfirm.js:1010`, `menuComponents.js:85`, `armouryComponents.js:43`, `rewardDoor.js:138-153`, `upright.js:285` |
| Redundant Tab trap on top of `openModal` | `profileArchive.js:291-308`, `profileNotice.js:180-200`, `cardInspection.js:348-354` |
| Tab trap on the stat-allocation card | `customize.js:980-997`, `rest.js:542-552` |

**Target:**

- `OpenModal({..., onEscape, onBackdrop})`
- a `ModalController` base class that owns close, back-out and focus return, built on `registerModal({dismiss})`.

## 2. Menus, pickers, lists

| Pattern | Copies | Examples |
|---|---|---|
| Choice modal | 7 | `smithOptionsModal.js:14` ≈ `rankUpCardModal.js:30` (84%), `smithOptionsModal.js:58`, `cardChoiceModal.js:17`, `discardChoiceModal.js:8`, `reactionChoiceModal.js:66`, `armouryEquipModals.js:96` |
| Selected-state toggle (class + aria) | ~30 | `mountServiceModal.js:105`, `blacksmith.js:366`, `smithUpgradeModal.js:238`, `bestiary.js:42` ≈ `compendium.js:284`, `customize.js:1071,1327,1903`, `creationPageParts.js:169,233,305` |
| Arrow-key navigation | 6 | `optionRowList.js:80` (shared), `upgradeDesk.js:77`, `modalShell.js:286`, `settings.js:1975`, `flask.js:316`, `deckEditor.js:932` |
| Enter/Space → `click()` | 28 | `smithUpgradeModal.js:217`, `combat.js:1294`, `customize.js:1303`, `iconTray.js:200`, `damageReceipt.js:149` |

**Target:** `OpenChoiceModal` (data-driven), `markSelected`, `rovingList`, `activateOnKey`.

## 3. Views and screens

- **Room frame** (`MountRoomFrame`)
  - `shop.js:47-66` and `blacksmith.js:302-328` build the same tree, one with `el` and one with an HTML string.
  - `restFrame.js:22`, `event.js:73-90` and `dialogue.js:107,192` repeat the same frame.
- **Knowledge door** (`MountKnowledgeDoor`)
  - `bestiary.js:7-50` and `compendium.js:218-339` are twins.
  - `history.js:57`, `gameover.js:86` and `profileNotice.js:128` use the same pattern.
- **Clear root then append:** 14 screens.
- **Screen-level Escape-to-back:** 3 copies.
- **Pass-through aliases**
  - `kit/index.js:44-53` holds 10 wrappers.
  - `ComponentModel.js:87/96/113/129` exports names in both casings.

## 4. Button effects

- **Long-press, 6 copies:**
  - `combat.js:1266`
  - `combatTargetHud.js:140`
  - `armamentRadial.js:117`
  - `tooltip.js:599`
  - `holdconfirm.js:190` and `:711`
  
  `gesture.js:102 armPress` exists but goes unused. Target: `armLongPress(el, {ms, tolerance, onHold})`.
- **Double-press guards:**
  - `ashenBlight.js:55`
  - `offlinePlay.js:163,199,216`
  - `cardUpgradeModal.js:667`
  - `cardShelf.js:64`
  - `gameProfileSelector.js:89`
  
  Target: `guardOnce(btn, fn)`.
- **Input shield:** only the confirmation modal has one; the choice modals don't.
- **Cue channel:** `sfx.js:20` ≈ `haptics.js:13`. Target: `createCueChannel()`.
- **CSS**
  - card-lift hover ×3: `ui.css:343`, `kit.css:1209`, `kit.css:1363`
  - button hover/disabled in 4 layers: `base.css:277-299`, `kit.css:104-118`, `kit.css:4846`, `player-polish.css:317`
  - twin rules: `kit.css:3839`/`:3929`, `ui.css:1949`/`:1962`
  
  Target: one `--btn-*` state layer.

## 5. Inheritance and unused bases

- **Barely used bases**
  - `ModalModel` is used by only 5 files.
  - `RewardModalModel` is an empty subclass.
  - The modal kinds in `modal.json` are skipped by the hand-built modals.
  - Only 17 of 133 `models/` files use `ComponentModel`.
- **Effect planes:** `cardEffectLayers.js:11` ≈ `combatantEffectLayers.js:18`. Target: `createEffectPlanes`.
- **`deepFreeze`:** 8 private copies, while `framework/compiler.js:58` and `model/registries.js:69` already export it.
- **Rail items:** `ArmouryWorkspaceModel:16`, `CreationWorkspaceModel:88`, `PileViewerModel:13`, `ProfileWorkspaceModel:28` all build the same list. Target: `railItems`.
- **Combat composition**
  - `CombatBodyModel` `bodyResize` is `bodyPlacement` with fixed feet.
  - `CombatCompositionModel` ground lines differ by a single field.
- **Twin handlers:** `blacksmith.js:141/152`, `controls.js:82/110`, `customize.js:1294/1311`.
- **Save notices:** `saveSlotSelector.js:602` and `:620` are identical.

## 6. Full redraws

| Site | Trigger | What actually changed | Partial update |
|---|---|---|---|
| Flask remount: `map.js:133,238`, `shop.js:51`, `blacksmith.js:319`, `event.js:90,171`, `dialogue.js:194,222`, `rest.js:106` | Drinking a flask | HP, potion count | `RunHud.Update(run)` |
| `blacksmith.js:67` → `render():299` | Any purchase | Purse, one row | `ShopRow.Update`, `Purse.SetValue` |
| `rest.js:519,597,607,638` | Shrine use, level-up | One option, HP | `RestOption.Update` |
| `equipment.js:1688` `draw()` (26 callers) | A refusal message; Back | Message text; selection | `Notice.Show`, `InventoryRow.SetSelected` |
| `deckEditor.js:804` `draw()` (27 callers) | Filter chips, holding a row | One chip; one row | `FilterChip.SetOn`, `DeckRow.SetHeld` |
| `settings.js:2038-2043` | Topic tab | Tab selection | Drop the repaint |
| `settings.js:2311` | Reset one setting | One row | `SettingRow.Update(key)` |
| `bookLearning.js:44-56` | Pick a lesson | `aria-pressed` on two buttons | `markOptionRows` |
| `saveSlotSelector.js:516` | Escape out of the review | Body view | `SlotDoor.ShowList` |

**These already update in place, so copy them:**

- `markOptionRows`
- `smithUpgradeModal.draw`
- `OpenSmithKeepModal.paint`
- `overlay.selectTab`
- `hand.js:444`
- `combatTools.js:299`
- `rewardDoor.refreshOwnedDoor`
- `RefreshRunHud`
- `compendium.paintDetail`

## 7. Interfaces and structure

**Today there are no contracts.**

- The type check does not cover `src/ui` at all.
- Nothing in `src/ui` uses `@interface` or `@implements`.
- The only exported classes are the three in `ModalModel.js`.

| Interface | Methods | Implementations today | Shape |
|---|---|---|---|
| `Modal` | `open`, `update`, `close({restoreFocus})`, `panel`, `onClose` | `OpenModal`, `MountEquipCompareModal`, `mountSmithUpgradeModal`, `MountCardUpgradeModal`, `mountMountServiceModal`, `openProfileArchive`, `OpenConfirmationModal` | `ModalController` base + JSDoc |
| `Picker` | `render`, `select`, `mark`, `update`, `focusFirst`, `onSelect` | `optionRowList`, `cardOptionGrid`, smith candidates, `bookLearning`, `upgradeDesk`, `gameProfileOffers` radios | JSDoc; `optionRowList` as the default |
| `ChoiceModal` | `open({rows, multi, commitLabel})`, `commit`, `cancel` | the 7 choice modals | base class |
| `CardRenderer` | `render(registries, ref, opts) → {el, model}`, `update`, `fit` | `renderCard`, `renderEquipmentCard`, `renderCollectibleCard`, `RenderRankUpOfferCard`, `RenderStatAllocationCard`, `illustratedCardHtml`, `renderInventoryItemCard` | JSDoc; return types disagree today |
| `EffectLayers` | `mount → {show, update, stop}`, `play → stop` | card and combatant effect layers | base |
| `FeedbackChannel` | `play`, `sink`, `recent`, `enabled` | `sfx`, `haptics` | `createCueChannel` |
| `RailModel` | `railItems` | 4 workspace models | one function + typedef |
| `Screen` | `mount(app, opts) → {update?, dispose}` | 26 screens returning 6 different shapes | JSDoc + `MountRoomFrame` |
| `Pressable` | `armLongPress`, `guardOnce`, `activateOnKey` → `disarm` | the section 4 sites | helpers |

**Inconsistencies:**

- **Casing** of the same exported verbs is mixed: `Open*` 7 vs `open*` 44, `Mount*` 5 vs `mount*` 55, `Render*` 2 vs `render*` 34.
- **Teardown** has five names for one job: `release` 36, `teardown` 13, `dispose` 10, `disarm` 10, `cleanup` 4.
- **Module styles** mix classes, factory functions, singletons and free functions for the same role.

## Ranked plan (payoff vs. risk)

| # | Wave | Payoff | Risk |
|---|---|---|---|
| 1 | `ChoiceModal`/`OpenChoiceModal` over the 7 pickers, configured in `modal.json` | ~200 lines | Low |
| 2 | Pure dedups: `deepFreeze`, `createCueChannel`, `railItems`, `bodyResize`, ground line, `openSaveNotice`, `createEffectPlanes` | ~180 lines | Very low |
| 3 | `src/ui/contracts.js` (Modal, Picker, CardRenderer, Screen, FeedbackChannel), type-checked | stops new copies | Low |
| 4 | Remove the 3 redundant Tab traps; move `equipCompareModal`, `smithUpgradeModal`, `bookLearning` onto `ModalController` | ~300 lines | Medium |
| 5 | `markSelected`, `activateOnKey`, `rovingList`, `armLongPress` (fixes the 500 ms drift) | ~65 sites | Low |
| 6 | `RunHud.Update` instead of 6 screen remounts; blacksmith row update | feel and perf | Medium |
| 7 | CSS button-state layer | ~40 rules | Low–medium (visual check) |
| 8 | `MountRoomFrame` + `Screen` contract; partial updates in `deckEditor`, `equipment`, `settings` | 50+ full redraws | Higher |
