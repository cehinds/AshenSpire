#!/usr/bin/env node
// Card budget survey (2026-11-18): the numbers a re-tune of every Core card to a cost curve needs.
//
// Zero-dependency and read-only. It boots the shipped Core profile exactly as tests/side-damage-scale-2026-11-18.test.mjs does
// (createRegistries(contentBundle) bound to the shipped game profile, createRunState, createRunCombat, previewCard), then for each
// starting class at level 1 with its baseline kit it previews and plays every Core card the class can hold in a neutral fight and
// records authored values, final in-combat values (preview == play), and where each final number comes from.
//
//   node tools/card-budget-report.mjs                       # prints the markdown tables (sections a to c) to stdout
//   node tools/card-budget-report.mjs --out docs/balance/card-budget-2026-11-18.md   # rewrites only the generated block of that file
//   node tools/card-budget-report.mjs --json rows.json      # also dumps every measured row (do not commit bulk JSON)
//
// "Neutral fight": the Wandering Soldier with its weaknesses cleared, 5000 HP and a 1000 Poise pool (so no hit is clamped or breaks),
// the player topped up so every card is affordable (the cost columns are read from the preview before that). The soldier keeps its
// own Defend stance; "final" numbers are read at the end of the offense stage (after the player and physical scales), before the target-side
// stance advantage and Poise protection, i.e. the number the card face shows. `HP vs soldier` is the HP the soldier actually loses.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState, enemyMoveDamage } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard, previewIntent } from '../src/engine/combat.js';
import { computeBlockGain } from '../src/engine/actions.js';
import { expandedEnemyMove, enemyMoveCarrier } from '../src/engine/combatCardTactics.js';
import { primeAccuracyRolls } from '../tests/accuracyFixture.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? true; };
const OUT = flag('--out'), JSON_OUT = flag('--json');

const shipped = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, shipped)), shipped);
const META = { gameProfileUnlocks: { [shipped.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const CLASSES = ['reaver', 'starseer', 'rogue', 'herald'];
const effects = shipped.modules.effects;
const SHIPPED_SETTINGS = ['playerDamageMultiplier', 'enemyDamageMultiplier', 'blockGainMultiplier', 'baseDamageMultiplier', 'spellPoiseDamageMultiplier', 'strengthDamageWeight', 'dexterityBlockWeight']
  .map(key => `${key} ${effects[key]}`).join(', ');

// ---------------------------------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------------------------------
function begin(classId, { enemyId = 'wanderingSoldier', neutral = true } = {}) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: META });
  // The class relics (Forsaken Medallion: +4 Poise damage on the first attack of a combat; Ashen Grip) are not cards: a card survey leaves them out.
  if (neutral) run.relics = [];
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: [enemyId] });
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const enemy = combat.enemies[0];
  enemy.actorIntentRevealed = true;
  if (neutral) {
    enemy.weaknesses = [];
    enemy.hp = enemy.maxHp = 5000;
    enemy.ratings = { ...enemy.ratings, poise: 1000 };
    enemy.persistentPoise = { value: 1000, max: 1000 };
  }
  return { combat, run, enemy };
}
const topUp = combat => {
  Object.assign(combat.player, { stamina: 10, maxStamina: 10, mana: 10, maxMana: 10 });
  combat.player.energy = combat.player.energyMax = 10;
};
const poolValue = pool => (pool ? (pool.max === 1000 ? pool.value : 1000 - (pool.missing || 0)) : null);

const round = n => Math.round(n * 100) / 100;
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const tagOf = (tags, prefix) => (tags || []).filter(t => t.startsWith(prefix)).map(t => t.slice(prefix.length));

// ---------------------------------------------------------------------------------------------------------------------
// Which cards each class holds: every colorless Core card, the class's own Core cards, and the non-Core cards of its baseline deck
// (the weapon arts and kit cards the class starts with).
// ---------------------------------------------------------------------------------------------------------------------
function holdable(classId) {
  const { run } = begin(classId);
  const ids = new Set();
  for (const card of registries.cards.all()) {
    if (!card.id.startsWith('core.')) continue;
    if (card.class === 'colorless' || card.class === classId) ids.add(card.id);
  }
  const kit = new Set();
  for (const card of run.deck) {
    const id = card.cardId || card.id || card;
    if (!id.startsWith('core.')) { ids.add(id); kit.add(id); }
  }
  return { ids: [...ids], kit, startingDeck: run.deck.map(card => card.cardId || card.id || card) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Authored values (from the card definition) and drawbacks
// ---------------------------------------------------------------------------------------------------------------------
const amt = e => (typeof e.amount === 'number' ? e.amount : e.amount == null ? null : '{' + JSON.stringify(e.amount) + '}');
function authoredOf(def) {
  const out = { damage: [], block: [], poise: [], statuses: [], reflect: 0, heal: 0, loseHp: 0, draw: 0, mana: 0, moves: [], other: [] };
  for (const e of def.effects || []) {
    const tgt = e.target === 'allEnemies' ? ' (all)' : '';
    if (e.op === 'damage') out.damage.push((amt(e) ?? '?') + (e.hits > 1 ? 'x' + e.hits : '') + tgt);
    else if (e.op === 'block') out.block.push(amt(e));
    else if (e.op === 'poiseDamage') out.poise.push(amt(e) + tgt);
    else if (e.op === 'applyStatus') out.statuses.push(`${e.status}${typeof e.stacks === 'number' ? ' ' + e.stacks : e.stacks ? ' f' : ''}@${e.target}${e.chance ? ' ' + e.chance + '%' : ''}`);
    else if (e.op === 'applyReflect') out.reflect += Number(e.amount) || 0;
    else if (e.op === 'heal') out.heal += Number(e.amount) || 0;
    else if (e.op === 'loseHp') out.loseHp += Number(e.amount) || 0;
    else if (e.op === 'draw') out.draw += Number(e.amount) || 0;
    else if (e.op === 'restoreMana') out.mana += Number(e.amount) || 0;
    else if (e.op === 'gainBarrier') out.statuses.push(`barrier ${amt(e)}@self`);
    else if (e.op === 'moveEngagement' || e.op === 'swapRows') out.moves.push(e.op);
    else out.other.push(e.op);
  }
  return out;
}
function drawbacksOf(def) {
  const out = [];
  for (const k of def.keywords || []) out.push(k);
  for (const t of def.tags || []) if (/^lifecycle\./.test(t) && !out.includes(t.slice(10))) out.push(t.slice(10));
  if (def.ramp) out.push(`ramp ${def.ramp.stat}+${def.ramp.per}/${def.ramp.scope}`);
  if (def.costRule && def.costRule !== 'fixed') out.push('costRule ' + def.costRule);
  for (const e of def.effects || []) {
    if (e.op === 'loseHp') out.push(`self HP -${amt(e)}${e.nonlethal ? ' (nonlethal)' : ''}`);
    if (e.op === 'poiseDamage' && e.target === 'self') out.push('self Poise damage');
    if (e.op === 'applyStatus' && e.target === 'self' && ['frail', 'weak', 'vulnerable', 'bleed', 'burn', 'venom', 'chill', 'shock', 'drained', 'fatigue'].includes(e.status)) out.push('self ' + e.status);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Category (primary) for the summary: spell, reflect, counter, evade, then the maneuver tag.
// ---------------------------------------------------------------------------------------------------------------------
function categoryOf(def) {
  const tags = def.tags || [];
  const maneuver = tagOf(tags, 'maneuver:')[0] || 'none';
  const ops = def.effects || [];
  if (tags.includes('camp:spell')) return 'spell';
  if (ops.some(e => e.op === 'applyReflect')) return 'reflect';
  if (maneuver === 'counter') return 'counter';
  if (maneuver === 'evade' || ops.some(e => e.op === 'applyStatus' && e.status === 'evade')) return 'evade';
  if (['attack', 'smash', 'sweep', 'defend'].includes(maneuver)) return maneuver;
  return 'other';
}

// ---------------------------------------------------------------------------------------------------------------------
// Damage decomposition from the engine's own receipt. The chain is base -> base scale (x0.5) -> rating adds (ar/pr) -> stance
// adds ("ar:adjustments") -> stance benefit (x) -> [weakness] -> player side scale (x0.7) and the physical share's cut (x0.7). Shares are of the number before the
// scales.
// ---------------------------------------------------------------------------------------------------------------------
function decomposeDamage(hit) {
  const rows = (hit?.sources || []).filter(s => s.stage === 'offense');
  let authored = 0, rating = 0, stance = 0, other = 0, pre = null, prev = null, side = 1, post = null;
  for (const s of rows) {
    if (s.id === 'base') { prev = s.amount; continue; }
    const before = s.requested ?? prev, after = s.effective ?? (before + s.amount);
    if (s.id === 'base-damage-scale') authored = after;
    else if (/^(ar|pr|dr):\d+$/.test(s.id)) rating += after - before;
    else if (s.id === 'ar:adjustments' || s.id === 'stance-benefit') stance += after - before;
    else if (s.id === 'physical-damage-scale' || s.id === 'side-damage-scale') { if (pre == null) pre = before; side *= s.multiplier ?? 1; post = after; prev = after; continue; }
    else other += after - before;
    prev = after;
  }
  if (pre == null) pre = prev ?? 0, post = pre;
  const total = authored + rating + stance + other;
  return { pre, post, side, shares: total > 0 ? { authored: authored / total, rating: rating / total, stance: stance / total, other: other / total } : null };
}
const offenseAmount = hit => {
  const rows = (hit?.sources || []).filter(s => s.stage === 'offense' && num(s.effective) != null);
  return rows.length ? rows[rows.length - 1].effective : hit?.incoming ?? 0;
};

// ---------------------------------------------------------------------------------------------------------------------
// Block decomposition by counterfactual: the same card with ratings zeroed (authored only), then with its stance (full).
// ---------------------------------------------------------------------------------------------------------------------
function decomposeBlock(combat, def, base) {
  if (typeof base !== 'number') return null;
  try {
    const player = combat.player;
    const full = computeBlockGain(combat, player, base, def);
    const keep = player.ratings;
    player.ratings = { ...keep, dr: 0, pr: 0 };
    const noRatings = computeBlockGain(combat, player, base, def);
    const keepStance = player.combatStance;
    const plain = { ...def, tags: (def.tags || []).filter(t => !/^maneuver:|^trait:reaction/.test(t)) };
    player.combatStance = null;
    const authoredOnly = computeBlockGain(combat, player, base, plain);
    player.ratings = keep; player.combatStance = keepStance;
    if (!(full > 0)) return null;
    return { ratingAdd: full - noRatings, full, noRatings, authoredOnly,
      // authored-only run (no ratings, no stance) -> adding the stance/guard multiplier -> adding the DR/PR rating adds = the final
      shares: { authored: Math.min(1, authoredOnly / full), rating: Math.max(0, (full - noRatings) / full), stance: Math.max(0, (noRatings - authoredOnly) / full) } };
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------------------------------
// Measure one card for one class: preview, then play it in a fresh identical fight.
// ---------------------------------------------------------------------------------------------------------------------
const snap = combat => {
  const p = combat.player, e = combat.enemies[0];
  return {
    pHp: p.hp, pBlock: p.block || 0, pWard: p.persistentWard?.value || 0, pPoise: p.persistentPoise?.value ?? null,
    pSt: Object.fromEntries(Object.entries(p.statuses || {}).map(([k, v]) => [k, v?.stacks ?? v?.value ?? 1])),
    counter: p.counterStacks || 0, reflect: p.reflectStacks || 0, pMana: p.mana, pSta: p.stamina,
    eHp: e.hp, ePoise: poolValue(e.persistentPoise), eBlock: e.block || 0,
    eSt: Object.fromEntries(Object.entries(e.statuses || {}).map(([k, v]) => [k, v?.stacks ?? v?.value ?? 1])),
    hand: combat.piles.hand.length, exhaust: combat.piles.exhaust.length, discard: combat.piles.discard.length,
  };
};
const diffSt = (a, b) => Object.fromEntries(Object.keys({ ...a, ...b }).map(k => [k, (b[k] || 0) - (a[k] || 0)]).filter(([, d]) => d));

function measure(classId, cardId) {
  const def = registries.cards.get(cardId);
  const a = begin(classId);
  a.combat.piles.hand.push({ instanceId: 'probe', cardId });
  const resolved = (() => { try { return previewCard(a.combat, 'probe', a.enemy.id); } catch (err) { return { error: String(err.message || err) }; } })();
  if (resolved.error) return { id: cardId, classId, error: resolved.error };
  const costs = { sp: resolved.costs?.stamina ?? 0, mp: resolved.costs?.mana ?? 0, energy: resolved.costs?.energy ?? 0 };
  topUp(a.combat);
  const authored = authoredOf(def);
  const row = {
    id: cardId, classId, name: def.name, pool: def.class, rarity: def.rarity, type: def.type,
    camp: tagOf(def.tags, 'camp:')[0] || '-', maneuver: tagOf(def.tags, 'maneuver:')[0] || '-',
    tags: (def.tags || []).filter(t => /^(maneuver|camp|school|damage|trait|lifecycle):/.test(t)),
    category: categoryOf(def), costs, totalCost: costs.sp + costs.mp, authoredCost: { sp: def.staminaCost, mp: def.manaCost },
    authored, drawbacks: drawbacksOf(def),
    final: { damage: 0, hits: 0, perHit: [], hpVsSoldier: 0, poise: 0, block: 0, ward: 0, barrier: 0 }, shares: {},
  };
  // preview
  const dmgShares = [];
  for (const v of resolved.values || []) {
    if (v.op === 'damage') {
      const r = v.damageReceipt?.hits || [];
      const perHit = r.length ? r.map(offenseAmount) : (v.hitDamages || []);
      row.final.damage += perHit.reduce((n, x) => n + x, 0);
      row.final.hits += perHit.length;
      row.final.perHit.push(...perHit);
      row.final.hpVsSoldier += Object.values(v.perTarget || {}).reduce((n, x) => n + x, 0);
      row.final.poise += Object.values(v.perTargetPoise || {}).reduce((n, x) => n + (x.removed || 0), 0);
      if (r[0]) dmgShares.push(decomposeDamage(r[0]));
    } else if (v.op === 'poiseDamage') row.final.poise += Object.values(v.perTargetPoise || {}).reduce((n, x) => n + (x.removed || 0), 0);
    else if (v.op === 'block') { row.final.block += v.value || 0; row.defenseSplit = v.defenseSplit || null; }
    else if (v.op === 'gainBarrier') row.final.barrier += v.value || 0;
    else if (v.op === 'loseHp') row.final.selfHp = (row.final.selfHp || 0) + (v.value || 0);
    else if (v.op === 'applyStatus') (row.final.statuses ||= []).push(`${v.status} ${v.value}@${v.target}`);
    else if (v.op === 'applyReflect') row.final.reflectGrant = (row.final.reflectGrant || 0) + (v.value || 0);
    else if (v.op === 'heal') row.final.heal = (row.final.heal || 0) + (v.value || 0);
  }
  if (dmgShares[0]) row.shares.damage = { ...dmgShares[0].shares, pre: dmgShares[0].pre, post: dmgShares[0].post, side: dmgShares[0].side };
  const blockBase = authored.block.find(x => typeof x === 'number');
  if (row.final.block > 0) {
    const split = decomposeBlock(a.combat, resolved.resolvedDefinition || def, blockBase);
    // Only a decomposition that reproduces the previewed Block exactly is reported (a card with two Block rows, or a bonus the formula does not see, is left blank).
    if (split && split.full === row.final.block) row.shares.block = split; else if (split) row.shares.blockUnresolved = { formula: split.full, previewed: row.final.block };
  }
  // play
  const b = begin(classId);
  topUp(b.combat);
  b.combat.piles.hand.push({ instanceId: 'probe', cardId });
  const before = snap(b.combat);
  try {
    dispatch(b.combat, { type: 'playCard', cardInstanceId: 'probe', ...(resolved.needsTarget ? { targetId: b.enemy.id } : {}) });
  } catch (err) { row.playError = String(err.message || err).slice(0, 120); return row; }
  const after = snap(b.combat);
  row.played = {
    hpVsSoldier: before.eHp - after.eHp, poise: before.ePoise - after.ePoise, block: after.pBlock - before.pBlock, ward: after.pWard - before.pWard,
    selfHp: before.pHp - after.pHp, selfPoise: before.pPoise == null ? null : before.pPoise - after.pPoise,
    counterStacks: after.counter - before.counter, reflectStacks: after.reflect - before.reflect,
    selfStatuses: diffSt(before.pSt, after.pSt), enemyStatuses: diffSt(before.eSt, after.eSt),
    exhausted: after.exhaust - before.exhaust,
  };
  const evadeStacks = row.played.selfStatuses.evade || 0;
  row.final.ward = row.played.ward;
  row.final.evade = evadeStacks;
  row.final.counter = row.played.counterStacks;
  row.final.reflect = row.played.reflectStacks;
  // preview == play: HP, Poise and Block must agree (the preview prices a Block + Ward split as one total)
  const blockPlay = row.played.block + row.played.ward;
  // A Counter's damage is the return it deals when hit later, so the play itself deals none: its preview number stands.
  const deferred = row.category === 'counter';
  row.previewMatchesPlay = (deferred || (row.final.hpVsSoldier === row.played.hpVsSoldier && row.final.poise === row.played.poise)) && row.final.block === blockPlay;
  if (!row.previewMatchesPlay) row.preview = { hpVsSoldier: row.final.hpVsSoldier, poise: row.final.poise, block: row.final.block };
  if (!deferred) { row.final.hpVsSoldier = row.played.hpVsSoldier; row.final.poise = row.played.poise; } // the play is the truth where they differ
  if (deferred) row.final.counterReturn = true;
  return row;
}

// ---------------------------------------------------------------------------------------------------------------------
// Run all classes
// ---------------------------------------------------------------------------------------------------------------------
const perClass = {}, kitByClass = {};
for (const classId of CLASSES) {
  const { ids, kit, startingDeck } = holdable(classId);
  kitByClass[classId] = { kit: [...kit], startingDeck };
  perClass[classId] = ids.map(id => { try { return measure(classId, id); } catch (err) { return { id, classId, error: String(err.stack || err).slice(0, 200) }; } });
}
const all = CLASSES.flatMap(c => perClass[c]);
const errors = all.filter(r => r.error || r.playError);

// Reference class per card: the class that owns it, else the class that casts it (Starseer for spells), else Reaver.
const refClass = row => (row.pool !== 'colorless' ? row.pool : row.camp === 'spell' ? 'starseer' : 'reaver');
const byId = new Map();
for (const row of all) { if (!byId.has(row.id)) byId.set(row.id, {}); byId.get(row.id)[row.classId] = row; }
const refRows = [...byId.entries()].map(([id, classes]) => {
  const first = Object.values(classes)[0];
  const ref = classes[refClass(first)] || first;
  return { ref, classes };
}).filter(({ ref }) => !ref.error);

// ---------------------------------------------------------------------------------------------------------------------
// Enemies: every move of every Core enemy against the level-1 Reaver (no Block, Poise 8).
// ---------------------------------------------------------------------------------------------------------------------
function enemyRows() {
  const rows = [];
  for (const def of registries.enemies.all()) {
    for (const [moveId, authored] of Object.entries(def.moves || {})) {
      const row = { enemyId: def.id, name: def.name, moveId, kind: authored.intent, weight: authored.weight ?? 0, tags: (authored.tags || []).filter(t => /^(maneuver|damage|delivery|trait):/.test(t)).join(' '), hpRange: def.hp };
      try {
        const { combat, enemy } = begin('reaver', { enemyId: def.id, neutral: false });
        const move = expandedEnemyMove(enemy, authored, moveId, combat);
        const carrier = enemyMoveCarrier(enemy, authored, moveId, combat);
        const damage = move.damage == null ? null : enemyMoveDamage(enemy, move);
        row.authoredDamage = damage; row.hits = move.hits ?? (damage != null ? 1 : null); row.authoredBlock = move.block ?? null;
        row.effects = (move.effects || []).map(e => e.op === 'applyStatus' ? `${e.status} ${typeof e.stacks === 'number' ? e.stacks : '?'}@${e.target}` : e.op + (typeof e.amount === 'number' ? ' ' + e.amount : '')).join(', ');
        row.reaction = !!authored.reaction; row.delay = authored.delay ? authored.delay.turns ?? 1 : 0; row.sp = authored.sp ?? null;
        enemy.intent = { kind: authored.intent, moveId, damage, hits: move.hits ?? 1, block: move.block ?? null, combatProfile: carrier.combatProfile };
        enemy.actorIntentRevealed = true; enemy.intentRevealed = true; enemy.plannedMoves = [];
        if (damage != null) {
          const p = previewIntent(combat, enemy.id);
          row.finalHit = p.hitDamages || null; row.finalTotal = p.totalDamage ?? null;
        }
        if (!authored.reaction) {
          const hp0 = combat.player.hp;
          dispatch(combat, { type: 'endTurn' });
          row.playedHpLoss = hp0 - combat.player.hp; row.finalBlock = enemy.block || 0;
        }
      } catch (err) { row.error = String(err.message || err).slice(0, 100); }
      rows.push(row);
    }
  }
  return rows;
}
const enemies = enemyRows();

// ---------------------------------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------------------------------
const cell = v => (v == null || v === '' ? '-' : String(v));
const pct = x => (x == null ? '-' : Math.round(x * 100) + '%');
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt3 = xs => (xs.length ? `${Math.min(...xs)} / ${round(median(xs))} / ${Math.max(...xs)} (n=${xs.length})` : '-');
const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows.map(r => '| ' + r.map(cell).join(' | ') + ' |')].join('\n');
const CATS = ['attack', 'smash', 'sweep', 'defend', 'counter', 'evade', 'reflect', 'spell', 'other'];

function summaryTables() {
  const out = [];
  for (const [title, pick] of [['Final damage (card face, per play, all hits summed)', r => r.final.damage], ['Final Block (plus Ward where the card gives it)', r => r.final.block + (r.final.ward || 0)]]) {
    const heads = ['Total cost (SP+MP)', ...CATS];
    const rows = [0, 1, 2, 3, 4].map(cost => [cost === 4 ? '4+' : cost, ...CATS.map(cat => {
      const xs = refRows.filter(({ ref }) => (cost === 4 ? ref.totalCost >= 4 : ref.totalCost === cost) && ref.category === cat && pick(ref) > 0).map(({ ref }) => pick(ref));
      return fmt3(xs);
    })]);
    out.push(`**${title}**: min / median / max across cards with a nonzero value, reference class per card.\n\n` + table(heads, rows));
  }
  const counts = [0, 1, 2, 3, 4].map(cost => [cost === 4 ? '4+' : cost, ...CATS.map(cat => refRows.filter(({ ref }) => (cost === 4 ? ref.totalCost >= 4 : ref.totalCost === cost) && ref.category === cat).length)]);
  const stackRows = refRows.filter(({ ref }) => ref.final.counter || ref.final.evade || ref.final.reflect)
    .sort((x, y) => x.ref.totalCost - y.ref.totalCost || x.ref.id.localeCompare(y.ref.id))
    .map(({ ref }) => [ref.id.replace(/^core\./, ''), ref.category, ref.totalCost, ref.final.counter || '', ref.final.evade || '', ref.final.reflect || '', ref.final.block || '', ref.drawbacks.join(', ')]);
  out.push('**Counter / Evade / Reflect stack cards** (stacks granted by one play; they carry no damage or Block of their own except where shown)\n\n' + table(['card', 'category', 'total cost', 'counter', 'evade', 'reflect', 'block', 'drawbacks'], stackRows));
  out.push('**Cards per cell** (every card, including those with no damage or Block)\n\n' + table(['Total cost', ...CATS], counts));
  return out.join('\n\n');
}

const perClassStr = (classes, pick) => CLASSES.map(c => (classes[c] && !classes[c].error ? pick(classes[c]) : '.')).join('/');
function cardTable() {
  const head = ['id', 'name', 'pool', 'rarity', 'type', 'maneuver', 'SP', 'MP', 'tot', 'auth dmg', 'auth blk', 'auth poise', 'auth other', 'ref', 'final dmg', 'HP vs soldier', 'final poise', 'final blk', 'ward', 'stacks (ctr/evd/rfl)', 'dmg R/S/Ro/H', 'blk R/S/Ro/H', 'dmg share auth/rating/stance', 'blk share auth/rating/stance', 'drawbacks', 'p==p'];
  const rows = refRows.sort((x, y) => x.ref.totalCost - y.ref.totalCost || x.ref.category.localeCompare(y.ref.category) || x.ref.id.localeCompare(y.ref.id)).map(({ ref: r, classes }) => {
    const a = r.authored;
    const sh = r.shares.damage, bs = r.shares.block;
    const other = [...a.statuses, a.reflect ? `reflect ${a.reflect}` : '', a.heal ? `heal ${a.heal}` : '', a.loseHp ? `selfHP ${a.loseHp}` : '', a.draw ? `draw ${a.draw}` : '', a.mana ? `mana ${a.mana}` : '', ...a.moves].filter(Boolean).join('; ');
    const stacks = [r.final.counter || 0, r.final.evade || 0, r.final.reflect || 0].join('/');
    return [r.id.replace(/^core\./, ''), r.name, r.pool, r.rarity, r.type, r.maneuver, r.costs.sp, r.costs.mp, r.totalCost, a.damage.join('+'), a.block.join('+'), a.poise.join('+'), other,
      r.classId, r.final.damage || '', r.final.hpVsSoldier || '', r.final.poise || '', r.final.block || '', r.final.ward || '', stacks === '0/0/0' ? '' : stacks,
      perClassStr(classes, c => c.final.damage || 0), perClassStr(classes, c => (c.final.block || 0) + (c.final.ward || 0)),
      sh ? `${pct(sh.authored)}/${pct(sh.rating)}/${pct(sh.stance)}` : '', bs ? `${pct(bs.shares.authored)}/${pct(bs.shares.rating)}/${pct(bs.shares.stance)}` : '',
      r.drawbacks.join(', '), r.previewMatchesPlay === false ? 'NO' : ''];
  });
  return table(head, rows);
}

function enemyTable() {
  const head = ['enemy', 'move', 'kind', 'tags', 'wt', 'auth dmg x hits', 'final HP to L1 Reaver (per hit)', 'played HP loss', 'auth block', 'final block (enemy)', 'effects', 'flags'];
  const rows = enemies.map(r => [r.enemyId, r.moveId, r.kind, r.tags, r.weight, r.authoredDamage == null ? '' : `${r.authoredDamage} x ${r.hits}`,
    r.finalHit ? r.finalHit.join('+') : '', r.playedHpLoss ?? '', r.authoredBlock ?? '', r.authoredBlock != null || r.finalBlock ? r.finalBlock : '', r.effects || '',
    [r.reaction ? 'reaction' : '', r.delay ? 'delay ' + r.delay : '', r.error ? 'ERR ' + r.error : ''].filter(Boolean).join(' ')]);
  return table(head, rows);
}

const mismatches = all.filter(r => r.previewMatchesPlay === false);
const generated = [
  `Generated by \`node tools/card-budget-report.mjs --out docs/balance/card-budget-2026-11-18.md\` against the shipped Core profile (${SHIPPED_SETTINGS}). Cards measured: ${byId.size} distinct (${all.length} class x card rows); rows with an error: ${errors.length}; preview != play rows: ${mismatches.length}.`,
  '### (a) Per-cost summary', summaryTables(),
  '### (b) Per-card table', 'Reference class (`ref`): the owning class for class cards, Starseer for colorless spells, Reaver for colorless physical cards. `dmg R/S/Ro/H` and `blk R/S/Ro/H` are the final numbers for Reaver / Starseer / Rogue / Herald (`.` = that class cannot hold the card). `final dmg` is the card-face number (after the player side scale and the physical cut, before the target stance advantage and Poise protection); `HP vs soldier` is what the neutral Defend-stance, Poise-protected soldier actually loses. Shares are of the number before the side and physical scales; the block shares come from counterfactual runs (ratings zeroed, then stance stripped). `p==p` is `NO` where the preview differs from the play.\n\n' + cardTable(),
  '### (c) Enemy moves', 'Every move of every Core enemy against the level-1 Reaver (50 HP, DR 1, Poise 8, no Block), forced as the intent then played. `final HP` is `previewIntent` per hit (after the 0.7 enemy scale and the Reaver Poise protection); `played HP loss` is the HP the Reaver actually lost at end of turn. Moves with a delay, a reaction or a range requirement may show 0 when played.\n\n' + enemyTable(),
].join('\n\n');

const START = '<!-- generated:start -->', END = '<!-- generated:end -->';
if (OUT) {
  const block = `${START}\n${generated}\n${END}`;
  let text = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (text.includes(START) && text.includes(END)) text = text.slice(0, text.indexOf(START)) + block + text.slice(text.indexOf(END) + END.length);
  else text = (text ? text + '\n\n' : '') + block + '\n';
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}: ${byId.size} cards, ${enemies.length} enemy moves, ${errors.length} errors, ${mismatches.length} preview/play mismatches`);
} else console.log(generated);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ perClass, enemies, kitByClass }, null, 1));
