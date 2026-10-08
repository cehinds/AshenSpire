# Combat card sigils

- Card bottoms show one large primary action sigil and a smaller school sigil where applicable.
- Damage types remain written words, including Blunt, Piercing, Slashing, Cold, Fire, Lightning, Force, Holy and Necrotic.
- Extra source, range, counter-mode, technique and theme tags stay in Information.
- All marks use monochrome geometry. Colour is optional emphasis, never the only distinction.
- Information repeats the mark, its name and its explanation. Cards retain accessible names, existing selection controls and focus restoration.
- Effect text retains its numbers, conditions, targets and durations. Redundant damage verbs and layout whitespace are shortened. Long effects borrow room from the artwork instead of being cut off.

## Primary action legend

- Attack: a diagonal blade pointing forward.
- Defend: a shield outline.
- Counter: a returning circular arrow crossed by a blade.
- Sweep: a broad arc with a horizontal arrow.
- Ranged: a bow and arrow.
- Smash: a hammer with impact marks.
- Spell: a four-point arcane star.
- Power: a crown; cast once, Exhaust, and remain active for the combat.
- Skill: an open hand; reusable utility or buffs. Information includes any authored lifecycle exception.
- Status: a warning triangle; injected status-effect cards, usually harmful.

## School legend

- Frost: a snowflake.
- Fire: a flame.
- Lightning: a lightning bolt.
- Force: a small ring sending waves outward.
- Alteration: mountains on a grounded baseline, including earth and grounding.
- Illusion: an eye crossed by a diagonal stroke.
- Divine: a radiant ring crossed by a plus.
- Decay: a damaged leaf with falling fragments.

## Implementation boundary

- Identity follows the shared primary type supplied by the combat expansion and authored school metadata. A name, class colour or damage type never selects a school.
- These are original inline vector marks in source; the existing paintings and artwork packages remain in use.
- The editor inventory was checked at `e116cfd1414bce9effb2e12ed643a481342ee934`. Its card adapter handles data definitions; native layout and runtime renderer changes are separate. The shared vector renderer uses normal source tools.
- Build identities, review, test results, desktop/phone captures and branch promotions are recorded with delivery evidence.
