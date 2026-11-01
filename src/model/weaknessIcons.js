// Weakness chip icons (owner, 2026-11-01; SPEC 5.3). Every trigger an enemy can be weak to maps to one tag-symbol id
// (ui/components/cardTagSymbols.js): the damage-type and school marks card faces use, the status marks the badges use.
// No trigger falls back to a letter. Pure data; tests/enemy-weakness-chips.test.mjs checks every authored `to` resolves.
export const WEAKNESS_ICON = Object.freeze({
  blunt: 'damage:blunt', slashing: 'damage:slashing', piercing: 'damage:piercing',
  magic: 'effect:power', fire: 'element:fire', frost: 'element:frost', lightning: 'element:lightning',
  sacred: 'element:sacred', decay: 'element:decay', arcane: 'element:arcane', earth: 'element:earth',
  psychic: 'element:psychic', poison: 'effect:poison',
  burn: 'status:burn', bleed: 'status:bleed', paralysis: 'effect:paralysis', venom: 'effect:poison', vulnerable: 'effect:cracked',
});
export const weaknessIconId = to => WEAKNESS_ICON[to] || null;
