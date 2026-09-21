import { equippedPieces } from './loadout.js';
import { resolveUpgradedRelic } from './itemUpgrades.js';

export const ratingIds = ['ar', 'dr', 'pr', 'poise', 'ward'];
const attributes = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
const rule = (weights, base = 0) => ({ base, multiplier: 1, ...Object.fromEntries(attributes.map(id => [id, weights[id] || 0])) });
export const combatRatingDefaults = {
  enabled: true,
  // EVERY RATING IS A SUM OF FLOORED ATTRIBUTE TERMS, then multiplied (owner,
  // 2026-09-21): `multiplier × <rating>.multiplier × Σ floor(weight × attribute)
  // + base`. Both multipliers ship at 1 — they are the handle for scaling a
  // rating, or every rating, without editing five weights, and the weight
  // itself is the rate a point converts at. The pair `pointsPerIncrease`/`gain`
  // they replace divided the SUMMED points, which made a 0.25 weight mean
  // nothing on its own and hid a second rate behind a first.
  multiplier: 1,
  ratings: {
    ar: rule({ strength: 0.5 }), dr: rule({ dexterity: 0.5 }),
    pr: rule({ wisdom: 0.5, intelligence: 0.5 }),
    // POISE AND WARD OPEN AT 1 (owner, 2026-09-21: "poise, mp, sp, ward are
    // base 1"). A vessel of nothing is not a vessel: with every attribute term
    // floored on its own, a character who put no points in the stats these
    // read would carry a meter of zero, and the break rules floor it to 1
    // anyway. Stating it on the row is the same number where a player can see
    // and move it. AR and DR stay at 0 — they are damage terms, not vessels.
    poise: rule({ constitution: 1, strength: 0.5 }, 1),
    ward: rule({ wisdom: 1, intelligence: 0.5 }, 1),
  },
  resistance: { physicalK: 100, magicalK: 100, statusK: 100, maximum: 0.8 },
  impact: { magic: 1, light: 1, medium: 2, heavy: 3, colossal: 4,
    lightMaxWeight: 3, mediumMaxWeight: 6, heavyMaxWeight: 8, unarmed: 1, enemyPhysical: 2 },
  breaks: { poiseActionLoss: 1, wardActionLoss: 1, thresholdGrowth: 1.25, recoveryPerTurn: 0 },
  statuses: {
    bleed: { poise: 1, ward: 0 }, frost: { poise: 0.5, ward: 0.5 },
    insanity: { poise: 0, ward: 1 }, madness: { poise: 0, ward: 1 },
    crimsonBlight: { poise: 0.5, ward: 0.5 }, venom: { poise: 1, ward: 0 },
    burn: { poise: 0.25, ward: 0.75 },
  },
};
const prefix = 'gameConfig.combatRatings.';
const words = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

export function ratingSourceKey(piece) {
  return piece.kind === 'armor' ? `armor:${piece.classId}:${piece.id}` : `armament:${piece.id}`;
}

export function combatRatingRows(bundle) {
  const rows = [];
  const add = (path, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Ratings & Resistance', statTopic: topic,
    key: prefix + path, def, label,
    ...(typeof def === 'number' ? { type: 'number', min: 0, max: 999, step: 0.01, integer: false } : {}),
    note: 'Applies to new runs. Existing runs and combat saves keep their rules.', ...extra,
  });
  add('enabled', true, 'Enable ratings, Poise & Ward', 'General');
  add('multiplier', combatRatingDefaults.multiplier, 'All ratings — multiplier', 'General', {
    note: 'Scales the attribute total of every rating at once, before each rating’s own multiplier. 1 leaves the formulas as written.',
  });
  for (const [id, values] of Object.entries(combatRatingDefaults.ratings)) {
    for (const [field, value] of Object.entries(values)) add(`ratings.${id}.${field}`, value,
      `${id.toUpperCase()} — ${words(field)}`, `${id === 'poise' || id === 'ward' ? words(id) : id.toUpperCase()} formula`, {
        note: field === 'base' ? 'Added after the multipliers, then equipment and other bonuses.'
          : field === 'multiplier' ? 'Scales this rating’s attribute total. 1 leaves the weights as written.'
          : 'Contribution from each point in this attribute, floored on its own: a weight of 0.25 gives nothing until the attribute reaches 4. Set 0 to ignore it.',
      });
  }
  for (const group of ['resistance', 'impact', 'breaks']) {
    for (const [field, value] of Object.entries(combatRatingDefaults[group])) add(`${group}.${field}`, value, ({ physicalK: 'Poise resistance curve', magicalK: 'Ward resistance curve', statusK: 'Status resistance curve', maximum: 'Resistance cap', magic: 'Magic impact', lightMaxWeight: 'Light weapon weight limit', mediumMaxWeight: 'Medium weapon weight limit', heavyMaxWeight: 'Heavy weapon weight limit', thresholdGrowth: 'Break threshold multiplier' })[field] || words(field), words(group), {
      min: field.endsWith('K') ? 0.01 : field === 'thresholdGrowth' ? 1 : 0,
      max: field === 'maximum' ? 0.95 : 999,
      note: field.endsWith('K') ? 'Rating needed for 50% resistance before the cap. A higher value makes resistance weaker.' : field === 'maximum' ? 'Maximum damage or status reduction: 0.8 means 80%.' : field === 'thresholdGrowth' ? 'After a break, multiply the threshold by this amount. 1.25 means 25% higher; 1 disables growth.' : group === 'impact' ? 'Physical hits pressure Poise; magical hits pressure Ward. Only hits that pass Block cause impact.' : 'Applies to new runs.',
      integer: group === 'impact' || field.endsWith('ActionLoss') || field === 'recoveryPerTurn',
      step: group === 'impact' || field.endsWith('ActionLoss') || field === 'recoveryPerTurn' ? 1 : 0.01,
    });
  }
  for (const status of bundle.statuses) {
    for (const id of ['poise', 'ward']) add(`statuses.${status.id}.${id}`, combatRatingDefaults.statuses[status.id]?.[id] || 0,
      `${status.name} — ${words(id)} weight`, 'Status resistance', {
        max: 1, step: 0.05,
        note: 'Reduces hostile buildup or incoming stacks, never duration or proc severity. Both weights zero means unresisted. Weights are added without normalization.',
      });
    for (const id of ratingIds) add(`bonuses.status:${status.id}.${id}`, 0, `${status.name} — ${id.toUpperCase()} per stack`, 'Status bonuses', { note: id === 'poise' || id === 'ward' ? 'Extra resistance per status stack. Temporary bonuses do not change the current break threshold.' : 'Extra rating per status stack, added to eligible card effects.' });
  }
  for (const piece of [...bundle.equipment.armaments, ...bundle.equipment.armour]) {
    for (const id of ratingIds) add(`bonuses.${ratingSourceKey(piece)}.${id}`, 0,
      `${piece.name}${piece.classId ? ` (${piece.classId})` : ''} — additional ${id.toUpperCase()}`, piece.kind === 'armor' ? 'Armour bonuses' : 'Weapon bonuses', {
        note: 'Adds to the item’s authored ratings while equipped. Every equipped item contributes once.',
      });
  }
  for (const relic of bundle.relics) for (const id of ratingIds) add(`bonuses.relic:${relic.id}.${id}`, 0, `${relic.name} — additional ${id.toUpperCase()}`, 'Relic bonuses');
  for (const enemy of bundle.enemies) {
    for (const id of ['poise', 'ward']) add(`enemyRatings.${enemy.id}.${id}`, enemy.poiseMax || 1, `${enemy.name} — ${words(id)}`, 'Enemy defences', { integer: true, step: 1, note: 'Sets this enemy’s resistance rating and initial break threshold. Zero removes passive resistance; the break threshold stays at least 1.' });
    add(`enemyImpact.${enemy.id}`, -1, `${enemy.name} — physical impact`, 'Enemy impact', {
      min: -1, max: 99, integer: true, step: 1, note: '-1 uses the default enemy impact. Set 1, 2, 3 or 4 to match this enemy’s weapon class. Magical hits use the magic value.',
    });
    for (const [id, move] of Object.entries(enemy.moves)) add(`enemyAttackType.${enemy.id}:${id}`, 'auto',
      `${enemy.name} — ${words(id)} type`, 'Enemy attack types', { type: 'choice', dropdown: true, choices: ['auto', 'physical', 'magic'],
        note: 'Selects Poise or Ward for damage resistance and impact. Auto follows the attack’s authored type; untyped attacks are physical.',
      });
  }
  for (const card of bundle.cards) add(`attackImpact.${card.id}`, -1, `${card.name} — impact override`, 'Attack overrides', {
    min: -1, max: 99, integer: true, step: 1, note: '-1 uses attack type and weapon weight. 0 causes no impact. Other values override impact per hit.',
  });
  return rows;
}

/**
 * onGrid(value, row) → the value the row could actually have produced.
 *
 * THE PANEL'S STEP IS THE DOMAIN, AND THE IMPORT DOOR DOES NOT ENFORCE IT.
 * `parseAdvancedConfigFile` checks finite/min/max/integer and nothing else, so
 * a hand-edited configuration can carry a weight of 0.9999999999 on a row
 * whose step is 0.01 — a number no player could type here. `ratingReceipt`
 * floors with a 1e-9 epsilon (which is what makes 0.29 × 100 land on 29
 * instead of 28.999999999999996), and that epsilon would read such a weight as
 * a clean 1: the receipt would pay a point the config does not state. Snapping
 * to the row's own step closes it at the door instead of loosening the floor,
 * so the number the receipt uses is the number the panel would show.
 */
function onGrid(value, row) {
  if (!Number.isFinite(value) || !Number.isFinite(row.step) || row.step <= 0) return value;
  return Number((Math.round(value / row.step) * row.step).toFixed(6));
}

export function resolveCombatRatings(settings, bundle) {
  const config = structuredClone(combatRatingDefaults);
  config.bonuses = {}; config.attackImpact = {}; config.enemyImpact = {}; config.enemyAttackType = {}; config.enemyRatings = {};
  for (const row of combatRatingRows(bundle)) {
    const raw = settings[row.key] ?? (row.type === 'choice' || row.key.includes('.enemyRatings.') ? row.def : undefined);
    if (raw === undefined) continue;
    const value = row.type === 'choice' ? raw : typeof row.def === 'boolean' ? raw === true : onGrid(Number(raw), row);
    if (row.type === 'choice' && !row.choices.includes(value)) continue;
    if (typeof value === 'number' && (!Number.isFinite(value) || value < row.min || value > row.max || (row.integer && !Number.isInteger(value)))) continue;
    const path = row.key.slice(prefix.length).split('.');
    let dest = config;
    for (const key of path.slice(0, -1)) dest = dest[key] ||= {};
    dest[path.at(-1)] = value;
  }
  // A status weight is written ONE FIELD AT A TIME, and the clone above carries
  // both fields only for the seven statuses `combatRatingDefaults.statuses`
  // names. Tuning Poise for any other status therefore created `{ poise: 0.5 }`
  // with no `ward` — which combatRatingProblems reads as a broken config and
  // reports as "Invalid status resistance weights" forever, on a panel the
  // player left in a perfectly reasonable state. The pair is the unit, so a
  // side nobody wrote reads 0: unresisted, which is exactly what the row's own
  // note promises for a status with no weights. A named status never reaches
  // this — its authored weight came in with the clone and is already finite —
  // so there is no second home for the defaults here.
  for (const weights of Object.values(config.statuses)) {
    for (const field of ['poise', 'ward']) if (!Number.isFinite(weights[field])) weights[field] = 0;
  }
  return config;
}

export function combatRatingProblems(config) {
  if (!config || typeof config !== 'object') return ['Missing combat rating rules'];
  const problems = [];
  // A MULTIPLIER THIS BUILD ADDED IS ABSENT FROM EVERY SAVED FIGHT, and
  // `combatSnapshotProblems` runs this over a restored snapshot's own rules.
  // Requiring the field would have refused every in-flight combat save written
  // before it existed — the run would not resume. Absent reads as 1, exactly
  // as `ratingReceipt` reads it; a WRITTEN one is still held to its domain.
  if (config.multiplier !== undefined && (!Number.isFinite(config.multiplier) || config.multiplier < 0)) problems.push('Invalid rating multiplier');
  for (const id of ratingIds) {
    const r = config.ratings?.[id];
    if (!r || [...attributes, 'base'].some(k => !Number.isFinite(r[k]) || r[k] < 0)
      || (r.multiplier !== undefined && (!Number.isFinite(r.multiplier) || r.multiplier < 0))) problems.push(`Invalid ${id} formula`);
  }
  if (!config.resistance || ['physicalK', 'magicalK', 'statusK'].some(k => !(config.resistance[k] > 0)) || !(config.resistance.maximum >= 0 && config.resistance.maximum < 1)) problems.push('Invalid resistance curve');
  const impact = config.impact;
  if (!impact || !(impact.lightMaxWeight <= impact.mediumMaxWeight && impact.mediumMaxWeight <= impact.heavyMaxWeight)) problems.push('Weapon weight thresholds must be ordered');
  if (!impact || Object.values(impact).some(n => !Number.isInteger(n) || n < 0 || n > 999)) problems.push('Invalid impact values');
  const b = config.breaks;
  if (!b || !Number.isFinite(b.thresholdGrowth) || b.thresholdGrowth < 1 || ['poiseActionLoss', 'wardActionLoss', 'recoveryPerTurn'].some(k => !Number.isInteger(b[k]) || b[k] < 0 || b[k] > 999)) problems.push('Invalid break settings');
  for (const weights of Object.values(config.statuses || {})) if (!weights || ['poise', 'ward'].some(k => !Number.isFinite(weights[k]) || weights[k] < 0 || weights[k] > 1)) problems.push('Invalid status resistance weights');
  for (const bonuses of Object.values(config.bonuses || {})) if (!bonuses || Object.values(bonuses).some(n => !Number.isFinite(n) || n < 0 || n > 999)) problems.push('Invalid rating bonus');
  for (const n of [...Object.values(config.attackImpact || {}), ...Object.values(config.enemyImpact || {})]) if (!Number.isInteger(n) || n < -1 || n > 99) problems.push('Invalid impact override');
  if (Object.values(config.enemyAttackType || {}).some(v => !['auto', 'physical', 'magic'].includes(v))) problems.push('Invalid enemy attack type');
  for (const values of Object.values(config.enemyRatings || {})) if (!values || ['poise', 'ward'].some(id => !Number.isInteger(values[id]) || values[id] < 0 || values[id] > 999)) problems.push('Invalid enemy defences');
  return problems;
}

export function ratingReceipt(registries, run, config) {
  const totals = Object.fromEntries(ratingIds.map(id => [id, 0]));
  const sources = [];
  const add = (name, values) => { sources.push({ name, ...values }); for (const id of ratingIds) totals[id] += Number(values[id]) || 0; };
  const stat = {};
  // EACH ATTRIBUTE TERM IS FLOORED ON ITS OWN, and the multipliers scale what
  // they add up to (owner, 2026-09-21): a weight IS the rate that attribute
  // converts at, so a 0.25 weight is "four points buy one", visible in the
  // receipt as the term it contributes rather than as a share of a pooled sum.
  //
  // NOTHING DIVIDES BY THE CREATION SCALE ANY MORE. A shrunken starting pool
  // used to be handed back to these formulas multiplied by its inverse — 12
  // points on the 35-point scale meant every attribute entered here at 2.92×
  // its own value, and a Starseer reading INT 8 on the sheet scored Ward as if
  // it held 23. The panel's own weights were the one honest description of the
  // arithmetic and they were wrong by that factor. The scale is gone from the
  // formulas entirely; a smaller pool now means smaller ratings, which is what
  // shrinking it says.
  for (const id of ratingIds) {
    const r = config.ratings[id];
    const points = attributes.reduce((n, a) => n + Math.floor((run.attributes?.[a] || 0) * r[a] + 1e-9), 0);
    stat[id] = r.base + Math.floor(points * (config.multiplier ?? 1) * (r.multiplier ?? 1) + 1e-9);
  }
  add('Attributes', stat);
  if (run.loadout) for (const piece of equippedPieces(registries, run.loadout, run.class || run.player?.classId, { itemUpgradeLevels: run.itemUpgradeLevels || {} })) {
    const profile = registries.equipment.basicCardProfiles.find(p => p.id === piece.attackProfile);
    const magical = profile && profile.damageSchool !== 'physical';
    const values = { ar: magical ? 0 : piece.attackRating || 0, pr: magical ? piece.attackRating || 0 : 0,
      dr: piece.defenseRating || 0, poise: piece.kind === 'armor' ? piece.poiseThreshold || 0 : 0 };
    const bonus = config.bonuses?.[ratingSourceKey(piece)] || {};
    for (const id of ratingIds) values[id] = (values[id] || 0) + (bonus[id] || 0);
    add(piece.name, values);
  }
  for (const id of run.relics || run.player?.relicIds || []) {
    const relic = resolveUpgradedRelic(registries, `relic/${id}`, run.itemUpgradeLevels?.[`relic/${id}`] || 0);
    const values = { ...config.bonuses?.[`relic:${id}`] };
    values.poise = (values.poise || 0) + (relic.passives?.poiseThresholdAdd || 0);
    for (const statId of ratingIds) values[statId] = (values[statId] || 0) + (relic.passives?.[`${statId}Bonus`] || 0);
    add(relic.name, values);
  }
  return { totals, sources };
}

export function ratingValue(ctx, entity, id) {
  let value = entity?.ratings?.[id] || 0;
  for (const [status, instance] of Object.entries(entity?.statuses || {})) value += (ctx.ratingsRules?.bonuses?.[`status:${status}`]?.[id] || 0) * (instance.stacks || 0);
  return Math.max(0, value);
}

export function isMagicalAttack(ctx, carrier) {
  const def = carrier?.cardId ? ctx.registries.cards.get(carrier.cardId) : null;
  const school = carrier?.damageSchool || def?.damageSchool;
  if (school) return school !== 'physical';
  const tags = carrier?.tags || def?.tags || [];
  return tags.some(t => ['magic', 'magical', 'arcane', 'holy', 'fire', 'spell'].includes(t.split(':').at(-1))) || (def?.manaCost || 0) > 0;
}

export function ratingDamageMultiplier(ctx, target, magical) {
  if (!ctx.ratingsRules || !target?.ratings) return 1;
  const r = ctx.ratingsRules.resistance;
  const rating = ratingValue(ctx, target, magical ? 'ward' : 'poise');
  return 1 - Math.min(r.maximum, rating / (rating + (magical ? r.magicalK : r.physicalK)));
}

export function attackImpact(ctx, source, carrier) {
  const config = ctx.ratingsRules;
  if (!config) return 0;
  const explicit = config.attackImpact?.[carrier?.cardId];
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  if (isMagicalAttack(ctx, carrier)) return config.impact.magic;
  const enemyOverride = config.enemyImpact?.[source?.enemyId];
  if (Number.isFinite(enemyOverride) && enemyOverride >= 0) return enemyOverride;
  const item = ctx.registries.equipment.armaments.find(p => p.id === carrier?.sourceArmamentId);
  if (!item) return source?.kind === 'enemy' ? config.impact.enemyPhysical : config.impact.unarmed;
  const w = item.weight || 0, i = config.impact;
  return w <= i.lightMaxWeight ? i.light : w <= i.mediumMaxWeight ? i.medium : w <= i.heavyMaxWeight ? i.heavy : i.colossal;
}
