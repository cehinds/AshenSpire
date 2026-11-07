// Weakness chip icons (owner, 2026-11-01; SPEC 5.3). Every trigger an enemy can be weak to maps to one tag-symbol name
// (ui/components/cardTagSymbols.js): the damage-type and school marks card faces use, the status marks the badges use.
// No trigger falls back to a letter. Pure data; tests/enemy-weakness-chips.test.mjs checks every authored `to` resolves.
// Built from parts so the mechanics generator (tools/mechanics-generate.mjs) does not read this table as tag vocabulary.
const POISON = ['poi', 'son'].join(''), VENOM = ['ven', 'om'].join('');
export const WEAKNESS_ICON = Object.freeze({
  blunt: 'blunt', slashing: 'slashing', piercing: 'piercing',
  magic: 'power', fire: 'fire', frost: 'frost', lightning: 'lightning',
  sacred: 'divine', decay: 'decay', arcane: 'force', earth: 'earth',
  psychic: 'illusion', [POISON]: POISON,
  burn: 'fire', bleed: 'bleed', paralysis: 'paralysis', [VENOM]: POISON, vulnerable: 'cracked',
});
/** The tag-symbol id (`effect:<name>`) a trigger wears, or null for a trigger with no mark. */
export const weaknessIconId = to => Object.hasOwn(WEAKNESS_ICON, to) ? `effect:${WEAKNESS_ICON[to]}` : null;
