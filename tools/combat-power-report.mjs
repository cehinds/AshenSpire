#!/usr/bin/env node
// Combat-power table (owner, 2026-11-21): scores every Core card and every item with src/model/combatPower.js and writes
// src/content/generated/combatPower.js ({cardCombatPower, itemCombatPower}).
//
//   node tools/combat-power-report.mjs            # rewrite the generated file
//   node tools/combat-power-report.mjs --check    # exit 1 when the generated file is stale (npm run combat-power:check)
//   node tools/combat-power-report.mjs --print    # print the table to stdout, write nothing
//
// Cards use the renderer's static mechanical baseline through the shared definition
// scorer. Conditions and next-card charges retain their estimated reliability;
// no reference fight's stance, damage receipt or temporary buff changes card CP.
// Items keep the simulator's weapon, armour and relic extraction.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle as b } from '../src/content/index.js';
import { scoring } from '../src/content/generated/scoring.js';
import { GEAR_TYPES } from '../src/content/gearTypes.js';
import { GearWeaponTypeOf, GearArmourGroupOf } from '../src/model/gearEffects.js';
import { BaseFace, ScoreCard, ScoreItem, CombatPower, RankOf, ApplyScoringOverride } from '../src/model/combatPower.js';
import { CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { registries, configuredCustomCardIds, holdable, CLASSES } from './lib/cardBudgetMeasure.mjs';

const OUT = fileURLToPath(new URL('../src/content/generated/combatPower.js', import.meta.url));
const args = process.argv.slice(2);

// ---------------------------------------------------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------------------------------------------------
const statusIds = new Set(Object.keys(scoring.statuses));
/** Shared static scorer face, independent of a sampled combat receipt. */
export function faceOf(def) {
  return CardDefinitionToScoreFace(def, { scoring });
}

export function measureCards() {
  const kitIds = new Set();
  for (const classId of CLASSES) for (const id of holdable(classId).kit) kitIds.add(id);
  const faces = {};
  for (const def of registries.cards.all()) {
    if (def.id.startsWith('core.') || def.id.startsWith('subclass.') || configuredCustomCardIds.has(def.id) || kitIds.has(def.id)) faces[def.id] = faceOf(def);
  }
  return faces;
}

// ---------------------------------------------------------------------------------------------------------------------
// Items (the simulator's extraction: tools that built items-raw.json)
// ---------------------------------------------------------------------------------------------------------------------
const parseMods = mods => (mods || []).map(m => { const [k, v] = String(m).split('='); return [k, Number.isNaN(+v) ? v : +v]; });

export function itemFaces() {
  const rules = Object.fromEntries(b.propertyRules.map(r => [r.tag, r]));
  const everyNthOf = pred => (pred && pred.p === 'everyNthCardThisCombat' && Number.isFinite(pred.n) ? pred.n : 0);
  const ruleOf = r => ({ triggers: (r.triggers || []).map(t => ({ on: t.on, cond: !!t.if, once: !!t.once, perTurn: t.limitPerTurn || 0, everyNth: everyNthOf(t.if), do: t.do })), passives: r.passives || null });
  const tagFam = {};
  for (const t of b.tagging) if (['armament', 'armour', 'relic'].includes(t.family)) (tagFam[t.family + ':' + (t.scope ? t.scope + '/' : '') + t.objectId] ??= []).push(t.tagId);
  const items = [];
  const profile = Object.fromEntries(b.equipment.basicCardProfiles.map(p => [p.id, p]));
  const cardsById = Object.fromEntries(b.cards.map(c => [c.id, c]));
  const artFace = (id, item) => {
    const c = cardsById[id] || cardsById['core.' + id]; if (!c) return null;
    const spell = c.damageSchool && c.damageSchool !== 'physical';
    const m = { ...BaseFace(), name: c.name, camp: spell ? 'spell' : 'physical', type: c.type === 'attack' ? 'attack' : 'skill', sp: c.staminaCost ?? c.cost ?? 1,
      mp: c.manaCost ?? item.weaponArtManaCost ?? 0, kw: [...(c.keywords || [])], tags: [...(c.tags || [])] };
    let dA = 0, bA = 0, pA = 0, hits = 1;
    for (const e of c.effects || []) {
      const a = typeof e.amount === 'number' ? e.amount : 0;
      if (e.op === 'damage') { const h = e.hits || 1; dA += a * h; hits = Math.max(hits, h); }
      else if (e.op === 'block') bA += a; else if (e.op === 'poiseDamage') pA += a;
      else if (e.op === 'applyStatus' && typeof e.stacks === 'number' && statusIds.has(e.status)) m.statuses.push([e.status, e.stacks, e.target === 'self' ? 'self' : 'enemy']);
      else if (e.op === 'draw') m.draw += a || 1; else if (e.op === 'heal') m.heal += a; else if (e.op === 'loseHp') m.loseHp += a;
      else if (e.op === 'moveEngagement') m.move = 1; else if (e.op === 'applyReflect') m.reflect += a || 1; else if (e.op === 'restoreMana') m.restoreMp += a;
    }
    // authored -> card face: x0.35 (spell x0.5) plus the rating add the survey measures (~3 per hit AR, ~6 per Block DR); the scoring's items.kit.weaponArt says the same
    m.dmg = dA ? Math.round(dA * (spell ? scoring.model.AUTH_SPELL : scoring.model.AUTH_PHYS) + (spell ? 0 : 3 * hits)) : 0; m.hits = hits;
    m.blk = bA ? Math.round(bA * scoring.model.AUTH_BLOCK + 6) : 0; m.poise = Math.round(pA * 0.5);
    if (!m.tags.some(t => t.startsWith('camp:'))) m.tags.push(spell ? 'camp:spell' : 'camp:physical');
    return m;
  };
  for (const a of b.equipment.armaments) {
    const tags = tagFam['armament:' + a.id] || [];
    const gearType = GearWeaponTypeOf(a);
    const typeRow = gearType ? GEAR_TYPES.weaponTypes?.[gearType] : null;
    const poiseDamage = Number.isFinite(GEAR_TYPES.itemPoiseDamage?.[a.id])
      ? GEAR_TYPES.itemPoiseDamage[a.id]
      : (Number.isFinite(typeRow?.poiseDamage) ? typeRow.poiseDamage : 1);
    const it = { kind: 'weapon', id: a.id, name: a.name, rarity: a.rarity, base: a.geom, sub: a.kind, gearType,
      typeMods: parseMods(typeRow?.mods), mods: parseMods(a.mods), poiseDamage,
      props: tags.filter(t => rules[t]), tags: tags.filter(t => !rules[t]), poise: a.poiseThreshold, weight: a.weight, dmgType: a.physicalDamageType, range: a.range,
      ...(a.scoringOverride ? { scoringOverride: a.scoringOverride } : {}) };
    const kit = a.weaponCardPackage?.combatKit || {};
    const ap = profile[kit.attackProfileId || a.attackProfile], gp = profile[kit.guardProfileId || a.guardProfile];
    it.attackBase = ap ? ap.baseValue : 3; it.magicShare = ap?.magicShare ? +ap.magicShare : 0; it.guardBase = gp ? gp.baseValue : 1;
    const art = kit.artCardId ? artFace(kit.artCardId, a) : null;
    if (art) it.art = art;
    items.push(it);
  }
  for (const a of b.equipment.armour) {
    const tags = tagFam['armour:' + a.classId + '/' + a.id] || tagFam['armour:' + a.id] || [];
    const gearGroup = GearArmourGroupOf(a);
    const groupRow = gearGroup ? GEAR_TYPES.armourGroups?.[gearGroup] : null;
    items.push({ kind: 'armour', id: a.classId + '.' + a.id, name: a.name, rarity: a.unlock ? 'uncommon' : 'common', base: a.material || 'cloth', sub: a.classId, gearGroup,
      typeMods: parseMods(groupRow?.mods), mods: parseMods(a.mods),
      props: tags.filter(t => rules[t]), tags: tags.filter(t => !rules[t]), poise: a.poiseThreshold,
      ...(a.scoringOverride ? { scoringOverride: a.scoringOverride } : {}) });
  }
  for (const r of b.relics) {
    const tags = [...new Set([...(tagFam['relic:' + r.id] || []), ...(r.properties || [])])];
    const mods = (r.passives?.modifiers || []).map(m => ['passive.' + m.tag + (m.resource ? '.' + m.resource : m.school ? '.' + m.school : ''), m.amount]);
    if (Number.isFinite(r.passives?.poiseThresholdAdd) && r.passives.poiseThresholdAdd !== 0) mods.push(['passive.resource.flat.poise', r.passives.poiseThresholdAdd]);
    items.push({ kind: 'relic', id: r.id, name: r.name, rarity: r.rarity, base: r.icon, mods,
      props: tags.filter(t => rules[t]), tags: tags.filter(t => !rules[t]),
      ...(r.scoringOverride ? { scoringOverride: r.scoringOverride } : {}) });
  }
  return { items, rules: Object.fromEntries(Object.entries(rules).map(([k, r]) => [k, ruleOf(r)])) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------------------------------------------------
export function buildTable() {
  const overrideFor = (key, def) => {
    const rawA = scoring.overrides && scoring.overrides[key];
    const a = rawA && typeof rawA === 'object' ? rawA : null;
    const b = def && def.scoringOverride && typeof def.scoringOverride === 'object' ? def.scoringOverride : null;
    return (a || b) ? { ...(a || {}), ...(b || {}) } : null;
  };
  const cardCombatPower = {};
  const faces = measureCards();
  for (const id of Object.keys(faces).sort()) {
    const f = faces[id], raw = ScoreCard(f).raw, cp = CombatPower(raw, f.rarity);
    cardCombatPower[id] = ApplyScoringOverride({ raw, cp, rank: RankOf(cp), rarity: f.rarity }, overrideFor(id, registries.cards.get(id)), scoring);
  }
  const itemCombatPower = {};
  const { items, rules } = itemFaces();
  for (const it of items.sort((x, y) => (x.kind + ':' + x.id).localeCompare(y.kind + ':' + y.id))) {
    const s = ScoreItem(it, scoring, rules);
    const key = it.kind + ':' + it.id;
    itemCombatPower[key] = ApplyScoringOverride({ raw: s.raw, cp: s.cp, rank: RankOf(s.cp), rarity: it.rarity }, overrideFor(key, it), scoring);
  }
  return { cardCombatPower, itemCombatPower };
}

const oneLine = obj => '{\n' + Object.entries(obj).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}';
const render = ({ cardCombatPower, itemCombatPower }) => '// GENERATED by tools/combat-power-report.mjs from content/source/scoring.json and the Core cards and items\n'
  + '// Do not edit by hand: run `npm run combat-power` (`npm run combat-power:check` fails when this file is stale).\n'
  + '// raw = effect power over 3 rounds, cp = raw - rarity discount, rank 0 = Unranked, 1..10 (src/model/combatPower.js).\n\n'
  + 'export const cardCombatPower = ' + oneLine(cardCombatPower) + ';\n\n'
  + 'export const itemCombatPower = ' + oneLine(itemCombatPower) + ';\n';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = render(buildTable());
  if (args.includes('--print')) console.log(text);
  else if (args.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== text) { console.error('src/content/generated/combatPower.js is stale: run `npm run combat-power`'); process.exit(1); }
    console.log('combat-power: generated table is fresh');
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT}`);
  }
}
