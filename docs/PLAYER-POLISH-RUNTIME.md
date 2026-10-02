# Player interface polish

The runtime uses the approved [twelve boards](design/player-polish-2026-10-01/README.md)
and [source kit](design/player-polish-asset-kit-2026-10-02/README.md).
`styles/player-polish.css` layers painted places, leather veils and scalable
folio frames under the existing shared DOM interface. Utility/resource icons
use the engraved family with live semantic colours. Costs, prose, ownership,
availability, selections, focus and values remain actual interface elements.

The component catalog includes the new `player.scenePainting` and
`player.engravedIcon` miniatures and the shared exported folio treatment:
[interactive catalog](component-catalog.html), [catalog contract](COMPONENT-CATALOG.md).
Exports and source/output hashes are in [the runtime art record](../art/player-polish-runtime/README.md).

## All 24 feature recipes

| Kit recipe | Runtime surface and presentation |
| --- | --- |
| 01a · Title, saves and resume | Separate landscape/portrait Spire composition; current save receipt remains beside the desktop menu and below it on portrait phones. Short landscape uses a two-column menu beside the receipt. Existing save review and resume rules remain authoritative. |
| 01b · Character creation | Spire world layer behind the live creation folio; canonical class figures, equipment and progressively disclosed choices. |
| 02a · Opening sequence | Authored desktop/mobile opening paintings and configured captions, poses, timing and controls; shared folio/control finish. |
| 02b · Events and dialogue | One-off choices gain a separate illustration aperture. Authored dialogue retains its canonical staged actors/environment and actual consequence/review flow. Short landscape yields illustration space to the choices. |
| 03a · World Journey | Canonical world art, authored coordinates, zoom/pan and destination details; shared HUD, engraved utility icons and detail folios. |
| 03b · Classic Climb | Existing route graph, camera and node states; calm HUD and folio destination tray. |
| 04a · Crownfall services and quests | Existing landmark/service map and quest flow; shared destination, choice and receipt surfaces. |
| 04b · Legacy dungeon | Canonical room graph, unknown/visited/reachable states, separate background/floor and camera; shared HUD/detail treatment. |
| 05a · Tactical combat | Existing regional atlas/floor and pose anchors; engraved resource/cost icons, document card frames and live action rail. Player opacity, sprites, layout and hand settings remain effective. |
| 05b · Boss and status inspection | Existing boss introduction, silhouette, intent and inspection; shared modal and control finish. End Turn retains its early-neutral/spent-green exception. |
| 06a · Character and equipment | Canonical character anchor against the Spire in its figure pane; current Armoury categories, item rows, slots and controls. |
| 06b · Inventory and comparison | Quiet still-life folio, complete contained item art, and actual equipment/load/weight/card-package comparison receipts. |
| 07a · Deck and inspection | Real card identities/art, document frames and engraved live costs; existing pile/card inspector and ownership rules. |
| 07b · Relics and flasks | Canonical carried-object art, current charges and selected-object details in the shared folio. |
| 08a · Merchant | Landscape stall beside desktop stock/details; independently composed portrait scene above the category selector and selected offer tray. Prices and affordability remain model-derived. |
| 08b · Smith services | Separate forge scene with the same responsive service workspace; actual compatibility, refusal and upgrade/mount receipts. |
| 09a · Rest | Chapel or forge illustration above live recovery/service choices; capped recovery and per-location rules remain unchanged. |
| 09b · Rewards | Spire fallback world layer, document cards and shared reward folio; per-reward selection, taken/skipped/blocked states and collection actions remain distinct. |
| 10a · Progression | Still-life study treatment around the existing training/skill family; actual prerequisites and banked progression values. |
| 10b · Compendium | Still-life folio, two-column portrait gallery and one inspector; existing unknown silhouettes and discovery concealment. |
| 11a · Forsaken Together | Chapel lobby and shared co-op HUD/action/choice surfaces; lobby readiness and in-run route votes remain separate actual flows. |
| 11b · Results and history | Spire scenery behind the current expandable run receipt and history archive. |
| 12a · Settings, controls and profile | Searchable existing categories, settings and profile review in a calm folio; text zoom, contrast, reduced motion, focus, bindings and configured touch sizes remain active. |
| 12b · Custom run and draft | Spire world layer, folded existing configuration and document card picks; canonical draft rules and availability. |

## Deliberate grounding

The concept boards contain illustrative prose, mechanics, values and identities.
The runtime does not adopt their invented deck cap, timed skills, Dodge text,
uncapped rest preview, crafting/material slots or fictitious mount/readiness
states. Generic kit portraits and card paintings are not assigned by broad tags.
Canonical atlas rectangles, floors, map coordinates, outfit/pose anchors and
item geometry remain owned by their existing models.

The new close artwork is decorative inside the existing named close control;
focus/escape/return behavior remains in the shared modal shell. Engraved icons
are hidden from assistive technology and preserve surrounding labels and live
values. Unknown/class-specific symbols retain their authored representation.
High contrast uses a calm solid information surface with the live semantic edge.

Engraved high/light vectors have identical geometry. A served high-res folder
may be partial, so masks retain their embedded original for that unverified
overlay; a picked-folder blob can replace it. This prevents a missing served
SVG from making an icon-only control invisible.
