# AshenSpire current-head UI decision atlas

Status: decision aid only; no UI authority is selected here.  
Base: `origin/dev` at `e420e53c5794d483489c01a12fa46bf7fe5e47af`.  
Release: RED. Marina approval is required before any development merge.

## Evidence boundary

This atlas reads the source and remote branch topology at the base above. It
does not claim current visual acceptance. The existing HUD witness refused to
run because Chrome did not expose a DevTools endpoint in the Windows sandbox;
the existing hand witness refused before measurement because Node treated a
Windows drive path as an unsupported ESM URL. Those refusals are evidence gaps,
not UI failures or approvals.

The dirty primary checkout was not used. Its four changed CSVs, `.vs`, generated
bundles, release state, and existing Falk-owned implementation paths remain
outside this lane.

## Claim and path map

| Priority surface | Existing authority or carried work | Shared paths at current head | Atlas ruling |
|---|---|---|---|
| HP, MP, SP composition and length | Three incompatible specifications remain live: the current hybrid; three separate rows whose maxima determine visual length; and the later 5-to-50-percent endpoint rule. `origin/freja/the-hud-bars-scale` records prior Falk work. | `src/content/balance.js`, `src/content/resources.js`, `src/model/resources.js`, `src/ui/components/resbars.js`, `src/ui/screens/combat.js`, `styles/combat.css`, `tools/hudbars.mjs` | Contested. Assign no implementation file until Constantine selects the governing composition and length rule. |
| Overlapping hand with paging/layout choice | Current data already declares both `paging` and `overlap`, with paging as default. Prior Falk work is carried in the current head and related Vega branches. | `src/content/balance.js`, `src/main.js`, `src/model/validate.js`, `src/ui/components/hand.js`, `src/ui/screens/combat.js`, `styles/combat.css`, `tools/handlayout.mjs`, `tools/handrenderers.mjs` | Existing shared surface; no file-disjoint implementation claim found. Re-witness after the Windows harness path defect is repaired in a separately claimed tools lane. |
| Structured calculation tooltip | Calculation receipts exist in the model and several UI consumers have local tooltip forms, but no verified universal grammar is established by this atlas. | `src/model/statProjection.js`, `src/model/loadout.js`, `src/ui/components/tooltip.js`, `src/ui/components/card.js`, `src/ui/components/equipmentReceipts.js`, plus each consuming screen | Cross-cutting and likely to collide with HUD and Armoury work. First decide the receipt schema and consumer boundary; do not start with presentation files. |
| End Turn hold states | Hold behavior and its evidence already have Falk ownership history and current shared machinery. | `src/model/secondbeat.js`, `src/ui/components/holdbeat.js`, `src/ui/components/holdconfirm.js`, `src/ui/screens/combat.js`, `styles/ui.css`, `tools/holdbeat.mjs`, `tools/holdconfirm.mjs` | No unclaimed implementation slice shown. Re-witness states without changing behavior. |
| Flask allocation arrows | Flask authority spans content, model, engine, save, combat UI, and existing Falk probes. | `src/content/balance.js`, `src/model/gracerefill.js`, `src/model/flaskgrowth.js`, `src/model/state.js`, `src/ui/components/flask.js`, combat/rest screens, and `tools/flask-*.mjs` | Not file-disjoint. Await Marina's exact active claim and Constantine's interaction choice before assigning arrows. |
| Selected-weapon two-pane Armoury | Existing equipment screen and prior `origin/freja/armoury-reach` work own the visible surface. | `src/ui/screens/equipment.js`, `src/ui/components/equipmentReceipts.js`, `src/model/equipmentPresentation.js`, `styles/ui.css`, equipment evidence tools | Contested/shared. Define selected-weapon detail contract before editing the screen. |

## HUD decision table

| Choice | Composition | Length semantics | What must be demonstrated before selection |
|---|---|---|---|
| Current hybrid | Health on its own line; Mana and Stamina share a band; Poise remains represented by the current resource plan. | Per-resource domains and existing minimum-width/broken-axis behavior. | Phone and desktop renders across minimum, typical, domain maximum, and overflow maxima; labels and top controls remain collision-free. |
| Separate rows | Health, Mana, and Stamina each receive a distinct row, in that order. | Each maximum determines its trough length; starting Mana and Stamina remain compact. | The same maxima sweep plus proof that three rows do not displace battlefield, hand, or End Turn controls. |
| 5-to-50 endpoint | Composition is not safely inferred from the endpoint statement alone. | A later rule maps the resource range to 5%-50%; its domain, clamping, and per-resource/shared meaning require an explicit answer. | Worked examples for every resource at both endpoints, below/above bounds, and comparison against the other two specifications. |

No row above is a recommendation or default. A selection must name which prior
specifications it supersedes and whether Poise follows the same composition and
length rule.

## Smallest safe next slice

The smallest genuinely file-disjoint deliverable at this head is this atlas.
Every requested implementation surface touches a current shared or Falk-carried
path. After Constantine selects the HUD authority and Marina returns exact
claims, the next smallest maker slice should be one newly claimed component plus
one focused witness, not a composed-screen rewrite. Phone (`390x844`) and desktop
(`1200x730`) acceptance remain mandatory before that slice is called complete.

## Required decisions and returns

1. Constantine: select the governing HUD composition and length semantics; say
   explicitly how Poise participates.
2. Marina: return exact current owner, branch, and path scope for each surface
   above, especially tool-only versus implementation claims.
3. Independent reviewer: confirm the chosen slice enters through the real
   source and embedded artifact doors and witnesses both phone and desktop.

