// tools/score-studio/itemStudio.js — pure helpers for Weapons, Armours, and Relics in Score Studio.
//
// Keeps item extraction, scoring, convention naming, and gear-trait catalogs aligned with
// tools/combat-power-report.mjs and src/model/combatPower.js.

import { GEAR_TYPES } from '../../src/content/gearTypes.js';
import { GearWeaponTypeOf, GearArmourGroupOf } from '../../src/model/gearEffects.js';
import { BaseFace, ScoreItem, CombatPower, RankOf, ItemNameParts, ApplyScoringOverride, ModValue, ModLabel } from '../../src/model/combatPower.js';
import { scoring as shippedScoring } from '../../src/content/generated/scoring.js';

const clone = (v) => structuredClone(v);

export const ITEM_MOTIF_OPTIONS = Object.freeze([
  '', 'flame', 'frost', 'bleed', 'shock', 'rot', 'venom', 'impact', 'bastion',
  'shield', 'wind', 'counter', 'pierce', 'thorns', 'sprouts', 'arcane', 'might', 'stars', 'weak', 'halo',
]);

export const ITEM_TRAIT_SELECTORS = Object.freeze([
  { id: 'self', label: 'Self (passive)' },
  { id: 'start', label: 'Start of turn' },
  { id: 'end', label: 'End of turn' },
  { id: 'attack', label: 'Attack cards' },
  { id: 'sweep', label: 'Sweep cards' },
  { id: 'smash', label: 'Smash cards' },
  { id: 'counter', label: 'Counter cards' },
  { id: 'defend', label: 'Defend cards' },
  { id: 'anyAttack', label: 'Any physical attack' },
  { id: 'zeroCost', label: '0-cost attacks' },
  { id: 'blockCard', label: 'Block cards' },
  { id: 'spell', label: 'Spells' },
  { id: 'healSpell', label: 'Healing spells' },
]);

export const ITEM_QUICK_TRAITS = Object.freeze([
  { label: '+ Poise', mod: 'self.statPoise=+1' },
  { label: '+ Block', mod: 'blockCard.cardBlock=+1' },
  { label: '+ Ward', mod: 'start.turnWard=+1' },
  { label: '+ Bleed', mod: 'attack.hitBleed=+1' },
  { label: '+ Burn', mod: 'smash.hitBurn=+1' },
  { label: '+ Frost', mod: 'attack.hitFrost=+1' },
  { label: '+ Pierce', mod: 'anyAttack.cardPierce=+1' },
  { label: '+ Thorns', mod: 'self.thorns=+1' },
]);

export function parseModPairs(mods) {
  return (mods || []).map((m) => {
    if (Array.isArray(m)) return [m[0], Number(m[1])];
    const [k, v] = String(m).split('=');
    return [k, Number.isNaN(+v) ? v : +v];
  });
}

export function formatModString(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${key}=${value}`;
  return `${key}=${n >= 0 ? `+${n}` : String(n)}`;
}

/** Build the editable item roster (weapons, armours, relics) and relic property-rule table. */
export function buildItemRoster(bundle) {
  const rawRules = Object.fromEntries((bundle.propertyRules || []).map((r) => [r.tag, r]));
  const everyNthOf = (pred) => (pred && pred.p === 'everyNthCardThisCombat' && Number.isFinite(pred.n) ? pred.n : 0);
  const rules = Object.fromEntries(Object.entries(rawRules).map(([k, r]) => [k, {
    triggers: (r.triggers || []).map((t) => ({
      on: t.on, cond: !!t.if, once: !!t.once, perTurn: t.limitPerTurn || 0, everyNth: everyNthOf(t.if), do: t.do,
    })),
    passives: r.passives || null,
  }]));

  const tagFam = {};
  for (const t of bundle.tagging || []) {
    if (['armament', 'armour', 'relic'].includes(t.family)) {
      (tagFam[`${t.family}:${t.scope ? `${t.scope}/` : ''}${t.objectId}`] ??= []).push(t.tagId);
    }
  }
  const profile = Object.fromEntries((bundle.equipment?.basicCardProfiles || []).map((p) => [p.id, p]));
  const cardsById = Object.fromEntries((bundle.cards || []).map((c) => [c.id, c]));
  const statusIds = new Set(Object.keys(shippedScoring.statuses || {}));

  const artFace = (id, item) => {
    const c = cardsById[id] || cardsById[`core.${id}`];
    if (!c) return null;
    const spell = c.damageSchool && c.damageSchool !== 'physical';
    const m = {
      ...BaseFace(), name: c.name, camp: spell ? 'spell' : 'physical', type: c.type === 'attack' ? 'attack' : 'skill',
      sp: c.staminaCost ?? c.cost ?? 1, mp: c.manaCost ?? item.weaponArtManaCost ?? 0,
      kw: [...(c.keywords || [])], tags: [...(c.tags || [])],
    };
    let dA = 0, bA = 0, pA = 0, hits = 1;
    for (const e of c.effects || []) {
      const a = typeof e.amount === 'number' ? e.amount : 0;
      if (e.op === 'damage') { const h = e.hits || 1; dA += a * h; hits = Math.max(hits, h); }
      else if (e.op === 'block') bA += a;
      else if (e.op === 'poiseDamage') pA += a;
      else if (e.op === 'applyStatus' && typeof e.stacks === 'number' && statusIds.has(e.status)) m.statuses.push([e.status, e.stacks, e.target === 'self' ? 'self' : 'enemy']);
      else if (e.op === 'draw') m.draw += a || 1;
      else if (e.op === 'heal') m.heal += a;
      else if (e.op === 'loseHp') m.loseHp += a;
      else if (e.op === 'moveEngagement') m.move = 1;
      else if (e.op === 'applyReflect') m.reflect += a || 1;
      else if (e.op === 'restoreMana') m.restoreMp += a;
    }
    m.dmg = dA ? Math.round(dA * (spell ? shippedScoring.model.AUTH_SPELL : shippedScoring.model.AUTH_PHYS) + (spell ? 0 : 3 * hits)) : 0;
    m.hits = hits;
    m.blk = bA ? Math.round(bA * shippedScoring.model.AUTH_BLOCK + 6) : 0;
    m.poise = Math.round(pA * 0.5);
    if (!m.tags.some((t) => t.startsWith('camp:'))) m.tags.push(spell ? 'camp:spell' : 'camp:physical');
    return m;
  };

  const items = [];
  for (const a of bundle.equipment?.armaments || []) {
    const tags = tagFam[`armament:${a.id}`] || [];
    const gearType = GearWeaponTypeOf(a);
    const typeRow = gearType ? GEAR_TYPES.weaponTypes?.[gearType] : null;
    const poiseDamage = Number.isFinite(GEAR_TYPES.itemPoiseDamage?.[a.id])
      ? GEAR_TYPES.itemPoiseDamage[a.id]
      : (Number.isFinite(typeRow?.poiseDamage) ? typeRow.poiseDamage : 1);
    const kit = a.weaponCardPackage?.combatKit || {};
    const ap = profile[kit.attackProfileId || a.attackProfile];
    const gp = profile[kit.guardProfileId || a.guardProfile];
    items.push({
      key: `weapon:${a.id}`,
      kind: 'weapon',
      id: a.id,
      name: a.name,
      rarity: a.rarity || 'common',
      base: a.geom,
      sub: a.kind,
      gearType,
      poiseDamage,
      range: a.range || 'melee',
      poise: a.poiseThreshold || 0,
      weight: a.weight || 0,
      dmgType: a.physicalDamageType || 'blunt',
      mods: [...(a.mods || [])],
      props: tags.filter((t) => rawRules[t]),
      tags: tags.filter((t) => !rawRules[t]),
      attackBase: ap ? ap.baseValue : 3,
      magicShare: ap?.magicShare ? +ap.magicShare : 0,
      guardBase: gp ? gp.baseValue : 1,
      art: kit.artCardId ? artFace(kit.artCardId, a) : null,
      raw: clone(a),
    });
  }

  for (const a of bundle.equipment?.armour || []) {
    const tags = tagFam[`armour:${a.classId}/${a.id}`] || tagFam[`armour:${a.id}`] || [];
    const gearGroup = GearArmourGroupOf(a);
    items.push({
      key: `armour:${a.classId}.${a.id}`,
      kind: 'armour',
      id: `${a.classId}.${a.id}`,
      pieceId: a.id,
      classId: a.classId,
      name: a.name,
      rarity: a.unlock ? 'uncommon' : 'common',
      base: a.material || 'cloth',
      sub: a.classId,
      gearGroup,
      poiseDamage: 0,
      poise: a.poiseThreshold || 0,
      mods: [...(a.mods || [])],
      props: tags.filter((t) => rawRules[t]),
      tags: tags.filter((t) => !rawRules[t]),
      raw: clone(a),
    });
  }

  for (const r of bundle.relics || []) {
    const tags = [...new Set([...(tagFam[`relic:${r.id}`] || []), ...(r.properties || [])])];
    const mods = (r.passives?.modifiers || []).map((m) => `passive.${m.tag}${m.resource ? `.${m.resource}` : m.school ? `.${m.school}` : ''}=${m.amount >= 0 ? `+${m.amount}` : m.amount}`);
    if (Number.isFinite(r.passives?.poiseThresholdAdd) && r.passives.poiseThresholdAdd !== 0) {
      mods.push(`passive.resource.flat.poise=+${r.passives.poiseThresholdAdd}`);
    }
    items.push({
      key: `relic:${r.id}`,
      kind: 'relic',
      id: r.id,
      name: r.name,
      rarity: r.rarity || 'common',
      base: r.icon || 'relic',
      sub: r.pool || 'core',
      gearType: null,
      gearGroup: null,
      poiseDamage: 0,
      poise: 0,
      mods,
      props: tags.filter((t) => rawRules[t]),
      tags: tags.filter((t) => !rawRules[t]),
      raw: clone(r),
    });
  }

  items.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  return { items, rules };
}

/** Return the inherited type/group base mods for an editable item entry. */
export function typeModsForEntry(entry) {
  if (entry.kind === 'weapon' && entry.gearType) return [...(GEAR_TYPES.weaponTypes?.[entry.gearType]?.mods || [])];
  if (entry.kind === 'armour' && entry.gearGroup) return [...(GEAR_TYPES.armourGroups?.[entry.gearGroup]?.mods || [])];
  return [];
}

/** Convert an editable studio item entry into the scorer's item face. */
export function itemEntryToFace(entry) {
  return {
    kind: entry.kind,
    id: entry.id,
    name: entry.name,
    rarity: entry.rarity,
    base: entry.base,
    sub: entry.sub,
    gearType: entry.gearType,
    gearGroup: entry.gearGroup,
    typeMods: parseModPairs(typeModsForEntry(entry)),
    mods: parseModPairs(entry.mods),
    poiseDamage: entry.poiseDamage,
    poise: entry.poise,
    range: entry.range,
    attackBase: entry.attackBase,
    magicShare: entry.magicShare,
    guardBase: entry.guardBase,
    art: entry.art,
    props: entry.props || [],
    tags: entry.tags || [],
    passives: entry.passives || null,
    triggers: entry.triggers || null,
  };
}

/** Score an editable item entry, applying any scoring.overrides[entry.key]. */
export function scoreItemEntry(entry, scoring, rules) {
  const face = itemEntryToFace(entry);
  const scored = ScoreItem(face, scoring, rules);
  const baseRow = { raw: scored.raw, cp: scored.cp, rank: RankOf(scored.cp, scoring), rarity: entry.rarity };
  const override = scoring.overrides?.[entry.key] || null;
  const resolved = ApplyScoringOverride(baseRow, override, scoring);
  return {
    ...scored,
    face,
    cp: resolved.cp,
    rank: resolved.rank,
    rarity: resolved.rarity,
    overridden: Boolean(resolved.overridden),
    convention: ItemNameParts(face, 0, scoring, rules),
  };
}

/** Build a live piece object suitable for renderEquipmentCard / renderCollectibleCard preview. */
export function livePieceFromEntry(entry) {
  const piece = clone(entry.raw);
  piece.name = entry.name;
  piece.rarity = entry.rarity;
  if (entry.kind === 'weapon') {
    piece.mods = [...(entry.mods || [])];
    piece.range = entry.range || piece.range;
    piece.gearType = entry.gearType;
    piece.poiseDamage = entry.poiseDamage;
  } else if (entry.kind === 'armour') {
    piece.kind = 'armor';
    piece.mods = [...(entry.mods || [])];
    piece.poiseThreshold = Number(entry.poise) || 0;
    piece.gearGroup = entry.gearGroup;
  }
  return piece;
}

/** Format one mod string with its live CP value for the inspector chip list. */
export function describeItemMod(rawMod, scoring) {
  const [key, valStr] = String(rawMod).split('=');
  const num = Number(valStr);
  const pts = ModValue(key, Number.isFinite(num) ? num : 1, scoring);
  const label = ModLabel(key, scoring);
  return { raw: rawMod, key, value: Number.isFinite(num) ? num : 1, label, pts: Math.round(pts * 10) / 10 };
}
