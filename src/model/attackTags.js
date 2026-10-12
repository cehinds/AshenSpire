// Categorized attack identity. Tags select authored properties; they never
// manufacture buildup, penetration, resource costs, or presentation effects.
export function attackDescriptor(carrier = {}) {
  const tags = carrier.tags || carrier.cardTags || [];
  const sourceTags = tags.filter((tag) => tag.startsWith('source:'));
  if (sourceTags.length > 1) throw new Error('Attack has contradictory source tags');
  const taggedSource = sourceTags[0]?.slice(7);
  const attack = { ...(carrier.attack || {}) };
  if (taggedSource && attack.source && taggedSource !== attack.source) throw new Error('Attack source contradicts its source tag');
  attack.source ||= taggedSource;
  const types = tags.filter((tag) => tag.startsWith('damage:')).map((tag) => tag.slice(7));
  if (!attack.components && !attack.damageType && types.length === 1) attack.damageType = types[0];
  if (!attack.components && !attack.damageType && types.length > 1) throw new Error('Mixed damage tags require explicit component weights');
  const declared = attack.components?.map((c) => c.type) || (attack.damageType ? [attack.damageType] : []);
  if (types.some((type) => !declared.includes(type))) throw new Error('Damage tags contradict attack components');
  return attack;
}

/**
 * The damage type a weapon-typed card deals through a piece of `family` whose
 * own type is `damageType`. A card with `attack.weaponDamage` ({ families,
 * types }) keeps the piece's type only when the piece is of one of those
 * families and its type is one of those types; otherwise it deals types[0]
 * (Blood Tithe: a blade's slashing or piercing, else slashing — owner #19).
 */
export function weaponDamageType(attack, family, damageType) {
  const rule = attack?.weaponDamage;
  if (!rule || !damageType) return damageType;
  return rule.families.includes(family) && rule.types.includes(damageType) ? damageType : rule.types[0];
}

/** Effective tags belong to this resolved attack, never the stored card row. */
export function resolvedAttackTags(cardTags, source, attack, damageTypes) {
  const hasDelivery = cardTags.some((tag) => ['delivery:melee', 'delivery:projectile'].includes(tag));
  const inherited = (source.tags || []).filter((tag) => !hasDelivery || !['delivery:melee', 'delivery:projectile'].includes(tag));
  const passive = (tag) => !/^(source:|damage:|fx:|item:)/.test(tag);
  const components = attack.components || [{ type: attack.damageType || source.damageType }];
  return [...new Set([
    ...cardTags.filter(passive), ...inherited.filter(passive),
    `source:${attack.source || source.sourceType || 'weapon'}`,
    ...components.map((c) => damageTypes[c.type].tag),
  ])];
}
