# AshenSpire player polish inspiration

Created October 1, 2026 with the built-in image generation tool. Twelve PNG boards contain 24 feature views, each illustrated for desktop and portrait mobile: 48 screen renditions. These are concept artwork, not implemented screenshots or measured responsive specifications.

Open **index.html** in a browser for the searchable gallery and full-size viewer. The folder is self-contained and needs no dependencies. **prompts.json** contains the full prompt for every board.

## The visual direction

Quiet grandeur: expansive painted environments, warm ivory typography, soot and umber surfaces, worn iron and leather, restrained oxidized brass, regional fog and ember light. Fighters and carried objects should have a coherent painted finish. Cards read as documents, trays as folios or field cases. Keep readable information on calm surfaces.

Desktop can reveal context and comparison together. Mobile should recompose around the current choice, a single open tray, touch-sized controls and reachable bottom actions. The viewport labels in the generated art are target descriptions, not evidence that these designs have been tested at those resolutions.

## Boards and coverage

| Board | Player surfaces |
| --- | --- |
| [01 · Arrival & Identity](01-arrival-and-identity.png) | Title, save slots & resume; Character creation |
| [02 · Story & Consequence](02-story-and-choices.png) | Opening sequence; Events & dialogue |
| [03 · World & Routes](03-world-and-routes.png) | World Journey; Classic Climb map |
| [04 · Places & Encounters](04-cities-and-dungeons.png) | Crownfall services & quests; Legacy dungeon exploration |
| [05 · Combat & Threats](05-combat-and-threats.png) | Tactical combat; Boss & status inspection |
| [06 · Armoury & Carry](06-armoury-and-inventory.png) | Character & equipment; Inventory & comparison |
| [07 · Deck & Relics](07-cards-and-relics.png) | Deck & card inspection; Relics & flasks |
| [08 · Trade & Forge](08-merchant-and-forge.png) | Merchant; Smith services |
| [09 · Rest & Spoils](09-rest-and-rewards.png) | Rest site; Post-combat rewards |
| [10 · Growth & Discovery](10-growth-and-discovery.png) | Class progression; Compendium |
| [11 · Company & Legacy](11-company-and-history.png) | Forsaken Together co-op; Run results & history |
| [12 · Preferences & Run Setup](12-preferences-and-run-setup.png) | Settings, controls & profile; Custom run & draft |

Additional surfaces are represented within these families: save-slot receipts in Arrival, quest-board entry and Road Warden conversation in Places/Story, status help and targeting in Combat, prepared sets and swap receipts in Armoury, card ownership in Deck, selling/removal in Trade, upgrade selection in Rest, readiness/reconnection and route votes in Company, and accessibility/rebind/profile/archive/changelog navigation in Preferences. About/credits and profile confirmation dialogs would inherit the shared menu and folio presentation; they do not have separate artwork. Developer-only editors and combat test tools are outside the player-art scope.

## What to polish first

1. **Compact the shared HUD.** Bring HP, mana, stamina, relics and flasks into a calm consistent strip. Reserve the largest area for the battlefield or map.
2. **Unify the painted finish.** Match fighter grounding shadows, regional lighting and object crops. Replace emoji with a coherent engraved icon family.
3. **Improve card hierarchy.** Make cost, name, effect and ownership immediately readable; keep illustration rich but secondary to the tactical read.
4. **Give comparisons an explicit receipt.** Show equip load, resulting weight class, capacity/Poise changes and equipment-granted card changes together.
5. **Recompose mobile.** Use one open details tray, readable card inspection and bottom actions. Do not reduce a desktop grid uniformly.
6. **Use consistent action states.** Gold for selection, restrained green for available primary actions, red for focused exits/destructive actions, and clear reasons when unavailable. Follow the existing End Turn exception.
7. **Make places recognizable.** Distinct city-service landmarks, dungeon room states and route markers can improve orientation without more text.
8. **Keep optional depth folded.** Details, progression prerequisites and custom-run options should open around the current decision.

## Board review notes

### Arrival & Identity

Use scenery to establish scale, with one prominent resume action. Fold creation choices progressively on mobile.

**Before implementation:** Portraits, starting values, kit names and keepsakes are illustrative; retain canonical class identity and data.

### Story & Consequence

Give narrative scenes room to breathe. Put consequence previews beside the choice that causes them.

**Before implementation:** Opening prose, event copy and the Road Warden portrait are concept inventions; retain authored dialogue and consequences.

### World & Routes

Make destinations recognizable from landmarks and routes. Keep mobile destination details in a bottom tray.

**Before implementation:** Several map labels and the desktop navigation rail are invented presentation ideas, not new world content.

### Places & Encounters

Treat towns as places, with service landmarks. Give dungeons visited, reachable and unknown room states.

**Before implementation:** Room names, threat stars, service labels and projected rewards are illustrative; do not introduce unimplemented exploration rules.

### Combat & Threats

Ground fighters in the environment. Keep intent, health and buildup close to the relevant target.

**Before implementation:** The generated Dodge Roll text is inaccurate, and the boss End Turn is red. Preserve the real Dexterity/Stamina/Block rules, canonical card effects and shared End Turn color contract.

### Armoury & Carry

Use the character as the visual anchor. Show load, weight class and card changes in the swap receipt.

**Before implementation:** The invented Materials category and trinket slot are not feature proposals. Item values, prepared-set count and card-package receipts must come from the real equipment model.

### Deck & Relics

Let cards read as documents and relics as carried objects. Keep equipment ownership visible.

**Before implementation:** The image implies a persistent 24/30 deck cap and direct add/remove of equipment cards. The real deck cap applies only at creation, and equipment cards follow ownership. Relic effects and extra names are invented.

### Trade & Forge

Give services a human face. Open one offer category at a time and explain unavailable operations.

**Before implementation:** The merchant shows 120 cinders and a 120-price offer as unaffordable: correct this in implementation. The desktop smith mount is hypothetical; current shipped equipment may have none. Use canonical merchant and smith text.

### Rest & Spoils

Keep recovery previews and collection state explicit. Use quieter scenes for moments of relief.

**Before implementation:** The recovery preview must respect max HP; 62 to 72 is only illustrative. Checkmarks must distinguish collected rewards from merely selected rewards, and collection actions must remain per reward.

### Growth & Discovery

Show one progression branch at a time on mobile. Preserve the mystery of undiscovered objects.

**Before implementation:** The generated 6-second skill duration does not belong to turn-based combat. Node names, effects, weapon ranges and favorite controls are placeholders, not new mechanics.

### Company & Legacy

Make party readiness and connection states clear. Let results have atmosphere without burying the run record.

**Before implementation:** The board combines lobby readiness with an in-run vote for coverage. Keep their actual flows separate and disable Start when readiness or reconnection prevents it. History names and values are illustrative.

### Preferences & Run Setup

Use readable, plain labels for settings. Keep optional configuration folded around the current decision.

**Before implementation:** The Low/Medium/High/Epic art-quality labels are invented; preserve actual built-in/local-high-res choices. Draft card rules and availability must use canonical data.

## Grounding and limits

Grounded in the current checkout’s README, docs/GDD.md (especially visual language), docs/WORLD-ATLAS.md, docs/LORE-WORLD.md, docs/architecture-handoff/COLOR-INTERACTION-CONTRACT.md, player screen modules under src/ui/screens/, and viewed screenshots/art from docs/preview/ and assets/.

References actually attached to generation include the existing title and combat captures, portrait equipment capture, world-atlas desktop capture, Reaver opening figure, opening road art, Cinder Reach combat-environment art, and the first generated board as the shared style reference. Each board was visually inspected in the conversation. Exact reference lists are recorded in provenance.json.

Generated item names, effects, numbers, invented map labels, slogans and some controls are concept placeholders. In particular: no persistent post-creation deck cap; no bypass of equipment-card ownership; no timed-in-seconds skill rules for turn-based combat; no recovery above max HP; no fabricated crafting/material system; no assurance that authored smith packages already ship; no ready signal for a co-op party that cannot start. The boards are versioned design references; they do not change runtime gameplay. Reusable desktop/mobile artwork and UI pieces are saved in the [player polish asset kit](../player-polish-asset-kit-2026-10-02/index.html).

The broad design direction is consistent, but a production pass should reduce some decorative repetition, use canonical class portraits, and verify real screen geometry, contrast, focus, touch targets and the short-wide landscape layout in the actual game. These concepts illustrate portrait mobile; they do not validate landscape phone layouts.
