// Recipient-only sprite vocabulary. Reused shapes and palettes are presentation,
// never additional combat tags or effects. Each production strip has three frames.
import { RECIPIENT_EFFECT_SETTINGS as SETTINGS } from './recipientEffectSettings.js';
export const RECIPIENT_EFFECT_PALETTES = SETTINGS.behavior.palettes;

// Presentation identity vocabulary lives with the recipe data, separate from
// the engine's mechanic readers and its generated ownership documentation.
export const RECIPIENT_ELEMENT_PALETTES = Object.freeze([
  'fire', 'frost', 'lightning', 'force', 'alteration', 'illusion', 'divine', 'decay', 'earth', 'blood',
]);
export const RECIPIENT_LEGACY_MAGIC_TAGS = Object.freeze(['magic', 'arcane', 'starstone', 'ritual', 'oath']);
export const RECIPIENT_SILENT_STATUSES = Object.freeze(['stanceShifted']);
export const RECIPIENT_BLOOD_STATUSES = Object.freeze(['bleed', 'bleeding']);

export const RECIPIENT_ATTRIBUTE_ALIASES = Object.freeze({
  str: 'strength', dex: 'dexterity', int: 'intelligence',
  con: 'constitution', wis: 'wisdom', cha: 'charisma', sp: 'stamina', mp: 'mana',
});

export const RECIPIENT_EFFECT_ALIASES = Object.freeze({
  sacred: 'divine', holy: 'divine', arcane: 'force', starstone: 'force',
  rot: 'decay', necrotic: 'decay', blight: 'decay', venom: 'decay',
  poison: 'decay', gorefire: 'fire', ember: 'fire', ice: 'frost',
  shock: 'lightning', thunder: 'lightning', ritual: 'decay', oath: 'divine',
});

export const RECIPIENT_STATUS_PALETTES = Object.freeze({
  burn: 'fire', frost: 'frost', frozen: 'frost', chilled: 'frost', chill: 'frost', freeze: 'frost', brittle: 'frost',
  paralysis: 'lightning', shock: 'lightning', shocked: 'lightning', venom: 'decay',
  crimsonBlight: 'decay', necroticBlight: 'decay', necroticBuildup: 'decay',
  bleed: 'blood', bleeding: 'blood', confused: 'illusion', insanity: 'illusion',
  sleep: 'illusion', slowed: 'earth', entombed: 'earth', stoneskin: 'earth', bedrock: 'earth',
});

export const RECIPIENT_NEGATIVE_STATUSES = Object.freeze([
  'weak', 'vulnerable', 'frail', 'silenced', 'offBalance', 'prone', 'dazed',
  'burn', 'frost', 'frozen', 'chilled', 'chill', 'freeze', 'brittle', 'paralysis', 'venom',
  'crimsonBlight', 'necroticBlight', 'necroticBuildup', 'bleed', 'bleeding', 'confused', 'insanity',
  'sleep', 'slowed', 'entombed', 'shock', 'shocked', 'magicVulnerable', 'staggered', 'knockback',
]);

export const RECIPIENT_POSITIVE_STATUSES = Object.freeze([
  'precision', 'evade', 'prepared', 'starstoneCharge', 'grounded',
  'invulnerability', 'decoy', 'concealed', 'stoneskin', 'bedrock', 'regen',
]);

export const RECIPIENT_EFFECT_TIMING = Object.freeze({
  frameCount: SETTINGS.behavior.frameCount,
  impactMs: SETTINGS.motion.clipMs,
  auraMs: SETTINGS.motion.auraMs,
});
