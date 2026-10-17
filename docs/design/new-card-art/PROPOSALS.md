# Shared objects and contour fog — proposal 02

[Open the proposal gallery](proposals.html) · [Proposal JSON](art-proposals-v2.json) · [Existing tag catalog](art-catalog.json)

The branch remains `feature/newCardArt`. This is art and naming work only. No gameplay IDs, balance, card details or combat behavior change.

## Visual rule

Reuse one object master per family: sword, scimitar, scythe, hammer, shield, card, leaf, orb, vial and chain. Cleansed adds a reusable flame symbol. Different angles come from the same master; proportions, guard, grip, shield boss, card outline and leaf vein stay fixed. Two overlapping cards are two instances of one card asset. Counter uses the same straight sword and shield as Attack and Defend.

The outer edges fade to near-black. A narrow broken luminous contour releases soft fog from the object surface. Keep dark faces and readable silhouettes; avoid broad detached clouds. Preserve the four layers: background → back effect → object → foreground. Usually two visible identities, never more than four, with one or two central objects.

Choose either an attached contour effect (A) or a compact mark (B) for each selected identity. Do not add both and accidentally double the visual load. Element tint can color the emitted contour; secondary conditions use lower-brightness marks.

Generated sheets demonstrate a visual family; they are not pixel-identical production components. The JSON locks shared asset IDs for actual reuse. Final transparent layers still need to be authored from those masters.

## Boards

- [Shared object masters](proposals/masters.png) — ten base objects.
- [Card types](proposals/card-types.png) — all ten requested types, plus Evade and a scythe Sweep alternative.
- [Elements](proposals/elements.png) — the same sword under ten treatments.
- [Techniques](proposals/techniques.png) — eight families, two alternatives each.
- [Conditions](proposals/conditions.png) — eighteen families, two alternatives each.
- [Buffs and hand effects](proposals/buffs-hand.png) — fifteen families, two alternatives each; corrected Cleansed flame.

## Suggested names

| Attribute | Buff name | Condition adjective | Visual |
| --- | --- | --- | --- |
| STR | Might | Empowered | One broad upward chevron. |
| INT | Insight | Enlightened | An open eye with a small central light. |
| DEX | Haste | Quickened | Two short forward chevrons. |
| CON | Fortitude | Fortified | Two nested corner braces. |
| WIS | Attunement | Attuned | Two nested arcs around one central point. |

These five are proposed attribute-buff names, not aliases for existing statuses. In the current game, `strength` adds attack damage and `dexterity` adds Block; neither should silently become a change to a primary attribute. Reserve **Reflect** for a reflection mechanic, rather than using Reflective as a WIS buff.

Prefer **Alteration** to alternation; **Burning** to burned for an ongoing effect; **Bleeding** to bleed for a condition; **Paralyzed** and **Asleep** for condition labels. Use **Piercing**, **Precision**, **Evasion**, and **Area** for techniques. Cleave is appropriate for a weapon sweep; Area is broader.

**Cleansed uses fire, per the user correction:** a purifying ivory-white flame with a soft gold rim. Its compact variant is also a flame. It has no leaf or sweeping brush arc. Keep it visually separate from orange-red Burning. **Cleanse** names the action; **Cleansed** names the resulting state.

## Elements

| Element | Contour language | Availability |
| --- | --- | --- |
| Divine | Thin warm ivory halo, short straight rays dissolving into fog. | existing-identity |
| Necrotic | Desaturated green tendrils curling inward, small breaks in the contour. | existing-identity |
| Force | Pale lavender concentric pressure arcs, smooth rather than electric. | existing-identity |
| Earth | Dusty ochre outline, two angular dust fragments suspended near the edge. | existing-identity |
| Frost | Ice-blue crystalline rim with short cold vapor trails. | existing-identity |
| Fire | Muted ember-orange rim with one upward flame-shaped fog tongue. | existing-identity |
| Lightning | Fine pale-yellow branching filaments with very little smoke. | existing-identity |
| Psychic | Mauve double contours slightly out of register, one incomplete ripple. | existing-identity |
| Alteration | Sea-green refracted contour bending from angular to rounded. | existing-identity |
| Wind | Desaturated pale teal streamlined ribbons, little sparkle or branching. | proposed-new-element |

Wind is a proposed addition; no Wind gameplay identity was found in the reviewed catalogs. Force references the existing `school:force` / `damage:arcane` IDs; Divine uses existing divine/sacred identities; Necrotic uses decay identities. These are visual labels, not ID renames.

## Component suggestions

Each row has two alternatives; choose one. The JSON records exact references and whether a reference is merely related.

| Family | Attached contour (A) | Compact mark (B) |
| --- | --- | --- |
| Piercing | Fog narrows to a single needle beyond the sword tip. | One fine line passes through a broken ring. |
| Evasion | Two faint offset contours peel away from the leaf. | One offset crescent echo. |
| Dodge | A short hooked motion trail bends clear of an incoming line. | One bent escape arrow. |
| Area | A low spreading contour wave opens outward from the blade. | Three small radial ticks around a partial ring. |
| Precision | Two thin fog lines converge exactly at the tip. | A tiny interrupted reticle. |
| Reflect | A thin incident line reverses from the shield rim. | Two opposed chevrons around a short mirrored line. |
| Retaliation | One short hook of fog returns toward the source. | A single return arrow. |
| Drain | A narrow ribbon of fog returns toward the hilt. | One drop with an inward hook. |
| Paralyzed | Pale electrical threads lock across the same rigid chain. | A bolt trapped between two short bars. |
| Asleep | Soft indigo fog settles downward from the leaf. | A crescent over one low wave. |
| Prone | Same sword laid almost horizontally, low fog settling underneath. | One down chevron meeting a horizontal line. |
| Frozen | A continuous faceted ice outline encloses the same sword. | One closed angular ice shell. |
| Burning | Small ember curls rise directly from the same leaf edge. | One flame-shaped contour and ember. |
| Chilled | Only two short ice patches and thin cold fog on the edge. | One small open crystal branch. |
| Shocked | Two brief residual filaments flicker from the metal edge. | A short broken bolt. |
| Drenched | Thin wet rim and two falling beads on the leaf. | Two drops with one short wet underline. |
| Blighted | Desaturated olive fog and dark branching patches on the same leaf. | One split leaf-shaped vein. |
| Bleeding | One dark crimson contour bead descends from the edge. | One red drop with a tiny downward trail. |
| Confused | Two short offset fog loops cross around the same orb. | Two opposed hooks. |
| Restrained | Cold gray fog traces the same taut links across an object. | Two interlocked link outlines. |
| Weakened | A non-destructive broken contour mask interrupts the same sword edge. | A short downward chevron over a fracture. |
| Vulnerable | One rim gap releases a short outward fog leak. | One open shield outline with a breach. |
| Silenced | Two smooth muted arcs stop at a narrow contour bar. | One crossed resonance ring. |
| Dazed | One short fog spiral loosens from the surface. | One open spiral. |
| Might | Two compact amber pressure wisps cling to the hammer head. | One broad upward chevron. |
| Insight | A fine blue-white contour opens into one clear pupil-like gap. | An open eye with a small central light. |
| Haste | Two closely spaced mint trails follow the same leaf. | Two short forward chevrons. |
| Fortitude | A thickened ochre contour hugs the same shield. | Two nested corner braces. |
| Attunement | Two balanced ivory rings settle around the same orb. | Two nested arcs around one central point. |
| Reshuffle hand | Two identical card instances exchange positions along one closed fog loop. | Two opposed curved arrows around a card outline. |
| Recycle discard | A short circular fog route returns the same card to a dim stack outline. | One return loop. |
| Retain | A steady corner contour holds the same card in place. | A small clasp on one corner. |
| Draw | A second identical card rises on one faint contour ribbon. | One upward card-edge arrow. |
| Discard | A short downward fog ribbon leaves the same card edge. | One downward card-edge arrow. |
| Exhaust | The same card contour dissolves only at its far corner. | One fading corner and two motes. |
| Regeneration | One green contour vein grows outward and gently repeats. | One sprout-shaped line. |
| Barrier | A second thin translucent contour surrounds the same shield. | One enclosing ring. |
| Cleansed | One ivory-white purifying flame with a soft gold edge; clean fog curls upward directly from the flame contour. | A small upright ivory-gold flame outline; no leaf, brush or sweeping arc. |
| Concealed | Part of the same leaf contour disappears beneath a low smoke fold. | One interrupted eye-shaped arc. |
| Poisoned | A dull green rim releases two low-hanging droplets of fog. | A small vial bead. |
| Slowed | Two low trailing contours lag far behind the same leaf. | A short hourglass-shaped mark. |

## Distinctions to keep

- Frost is an element; Chilled has partial ice edges; Frozen has an enclosing ice shell.
- Lightning is an element; proposed Shocked has a brief residual spark; Paralyzed uses electrical bars to suggest restriction.
- Dazed uses one open spiral; Confused uses opposed hooks.
- Evasion is an evasive benefit; Dodge is an action.
- Restrained uses taut chain links. Bind can share the chain family but must retain its distinct gameplay identity.
- Blighted is a visual family for several separate blight IDs. Poisoned likewise must not merge Venom buildup with ongoing Poison.
- Shocked and Drenched are proposals; no elemental interactions are added.
- Reshuffle hand is still ambiguous: discard/redraw, mix back into the draw pile, or another operation. Its visual is proposed without selecting mechanics. Existing `shuffleDiscardIntoDraw` is separately labeled Recycle discard.
- Cleanse artwork applies only when removing a harmful status; a generic `removeStatus` operation can remove beneficial effects too.

The added suggestions include Reflect, Retaliation, Drain, Weakened, Vulnerable, Silenced, Dazed, Poisoned, Slowed, Recycle discard, Draw, Discard, Exhaust, Regeneration, Barrier, Cleansed and Concealed.

## Verification

`node docs/design/new-card-art/validate.mjs` validates references against current registries and the pinned `Feature/json-game-modules` commit, master reuse, component alternatives, and the four-identity limit. Proposal identities remain explicitly separate from registered gameplay identities.
