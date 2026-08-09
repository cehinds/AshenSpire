// tools/statprice.mjs — price a flat damage constant and an HP constant
// against the live content tables, through the real combat door.
//
// WHY THIS EXISTS. Constantine (D17, 2026-08-08): "vigour shoudl be 1 hp point
// per, strength +1 damange per every 5 points but scales heavy and blunt
// weapons." Character stats do not exist in this tree; before they are built,
// the house needs to know what those constants are WORTH in the game that
// ships. This tool measures, it does not tune: his numbers are defaults, the
// output is their price.
//
// THE DOOR (the instrument rule, same-door clause — development.md):
//   contentBundle → createRegistries → createCombat → dispatch('playCard')
//   → damageDealt event.
// Flat damage enters as 'strength' stacks through createCombat's
// playerStatuses — the same applyStatus path every content status travels.
// Damage is read off the emitted event, not off a formula. The lane claim
// (flat add enters BEFORE all multipliers) is asserted per cell as
//   observed == floor((base + add) × mults),
// so a lane reordering upstream goes red here.
//
// SELFTEST (--selftest): the known-bad enters by the SAME DOOR — a content
// bundle whose 'strength' row is rewritten to a multiplying modifier is fed
// through createRegistries → createCombat → dispatch, and the lane assertion
// must be OBSERVED red. A selftest that cannot fail is not evidence.
//
// Usage:  node tools/statprice.mjs [--selftest]
//
// Removal condition (SOP 1's corollary): delete this tool the day a real stat
// system ships with its own invariant tests — its subject then has a better
// instrument.

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng, seedFromString } from '../src/engine/rng.js';
import { createCombat, dispatch, getEntity } from '../src/engine/combat.js';
import { act1Enemies } from '../src/content/enemies/act1.js';
import { act2Enemies } from '../src/content/enemies/act2.js';
import { act3Enemies } from '../src/content/enemies/act3.js';
import { classes } from '../src/content/classes.js';
import { weapons } from '../src/content/generated/weapons.js';
import { balance } from '../src/content/balance.js';

const out = (s = '') => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------
// 1 · The lane, measured through the real door
// ---------------------------------------------------------------------------

/** Play one un-upgraded Strike (base 6) with `str` strength stacks against a
 *  wanderingSoldier carrying `enemyStatuses`, player carrying `extra` statuses.
 *  Returns the damageDealt amount from the event log. */
function strikeDamage(registries, str, { enemyStatuses = [], playerStatuses = [] } = {}) {
  const rng = createRng(seedFromString('statprice'));
  const cls = registries.classes.get('reaver');
  const ps = [...playerStatuses];
  if (str > 0) ps.push({ status: 'strength', stacks: str });
  // A deck of Strikes: legal player data through the same door any deck takes,
  // and it guarantees the measured card is in the opening hand.
  const deck = [1, 2, 3, 4, 5].map((i) => ({ instanceId: `s${i}`, cardId: 'strike', upgraded: false }));
  const combat = createCombat({
    registries,
    rng,
    player: { classId: 'reaver', maxHp: cls.maxHp, hp: cls.maxHp, deck },
    enemyIds: ['wanderingSoldier'],
    enemyStatuses,
    playerStatuses: ps,
  });
  const hand = combat.piles.hand;
  const strike = hand.find((c) => c.cardId === 'strike');
  if (!strike) throw new Error('statprice: no Strike in opening hand (seed-dependent draw?)');
  const enemy = combat.enemies[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
  const ev = combat.eventLog.filter((e) => e.type === 'damageDealt' && e.isAttack).pop();
  if (!ev) throw new Error('statprice: Strike produced no damageDealt event');
  return ev.amount;
}

/** Same door, multi-hit: play one Twinblade Flurry (3 dmg × 3 hits) with `str`
 *  strength stacks; return TOTAL damage across the three damageDealt events. */
function flurryDamage(registries, str) {
  const rng = createRng(seedFromString('statprice'));
  const cls = registries.classes.get('reaver');
  const ps = str > 0 ? [{ status: 'strength', stacks: str }] : [];
  const deck = [1, 2, 3, 4, 5].map((i) => ({ instanceId: `f${i}`, cardId: 'twinbladeFlurry', upgraded: false }));
  const combat = createCombat({
    registries,
    rng,
    player: { classId: 'reaver', maxHp: cls.maxHp, hp: cls.maxHp, deck },
    enemyIds: ['wanderingSoldier'],
    playerStatuses: ps,
  });
  const card = combat.piles.hand.find((c) => c.cardId === 'twinbladeFlurry');
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
  return combat.eventLog
    .filter((e) => e.type === 'damageDealt' && e.isAttack)
    .reduce((n, e) => n + e.amount, 0);
}

function runPerHit(registries) {
  out('PER-HIT — the flat add applies to EVERY hit (same door, Twinblade Flurry 3×3):');
  let red = 0;
  for (const add of ADDS) {
    const got = flurryDamage(registries, add);
    const want = 3 * (3 + add);
    if (got !== want) red++;
    out(`  +${add}: observed ${got}, expected 3×(3+${add}) = ${want}${got === want ? '' : '  !'}`);
  }
  out(
    red
      ? `  PER-HIT RED: ${red} row(s) diverge`
      : '  PER-HIT GREEN: a flat add is worth hits× its face value — multi-hit weapons harvest it 2–3×.'
  );
  return red;
}

const BASE = 6; // Strike, un-upgraded — src/content/cards/reaver.js
const SCENARIOS = [
  { name: 'bare (act-1 common, no modifiers)', mult: 1, opts: {} },
  { name: 'target Vulnerable (×1.5)', mult: 1.5, opts: { enemyStatuses: [{ status: 'vulnerable', stacks: 2 }] } },
  { name: 'player Weak (×0.75)', mult: 0.75, opts: { playerStatuses: [{ status: 'weak', stacks: 2 }] } },
  { name: 'Glass Cannon (×1.25)', mult: 1.25, opts: { playerStatuses: [{ status: 'glassCannon', stacks: 1 }] } },
  {
    name: 'Glass Cannon + Vulnerable (×1.875)',
    mult: 1.25 * 1.5,
    opts: {
      playerStatuses: [{ status: 'glassCannon', stacks: 1 }],
      enemyStatuses: [{ status: 'vulnerable', stacks: 2 }],
    },
  },
];
const ADDS = [0, 1, 2, 4, 8];

function runLane(registries, { expectRed = false } = {}) {
  let red = 0;
  out('LANE — dmg = (base + flatAdd) × mults, floor once. Observed via dispatch:');
  out('  door: contentBundle → createRegistries → createCombat → dispatch(playCard) → damageDealt');
  const header = ['scenario'.padEnd(42), ...ADDS.map((a) => `+${a}`.padStart(5))].join('');
  out('  ' + header);
  for (const sc of SCENARIOS) {
    const cells = [];
    for (const add of ADDS) {
      const got = strikeDamage(registries, add, sc.opts);
      const want = Math.max(0, Math.floor((BASE + add) * sc.mult));
      const ok = got === want;
      if (!ok) red++;
      cells.push(String(got).padStart(4) + (ok ? ' ' : '!'));
    }
    out('  ' + sc.name.padEnd(42) + cells.join(''));
  }
  if (red) {
    out(`  LANE ${expectRed ? 'RED as planted' : 'RED'}: ${red} cell(s) diverge from floor((base+add)×mult)`);
  } else {
    out('  LANE GREEN: every cell matches floor((base+add)×mult) — flat add is upstream of every multiplier');
  }
  return red;
}

// ---------------------------------------------------------------------------
// 2 · Census — HP scale, enemy damage, tags, stats
// ---------------------------------------------------------------------------

function biggestTurn(def) {
  // Largest single-move damage × hits an enemy def can land in one turn.
  let best = 0;
  for (const m of Object.values(def.moves || {})) {
    if (m.intent !== 'attack' || m.damage == null) continue;
    best = Math.max(best, m.damage * (m.hits || 1));
  }
  return best;
}

function census() {
  out('CENSUS — read from the content tables at this ref:');
  out('  classes maxHp: ' + classes.map((c) => `${c.id}=${c.maxHp}`).join('  '));
  out(`  flask heal 25% maxHp; shrine heal ${balance.shrine.healPct}% maxHp; coop mend ${balance.coop.mendHealPct}%`);
  const acts = [
    ['act1', act1Enemies],
    ['act2', act2Enemies],
    ['act3', act3Enemies],
  ];
  for (const [name, defs] of acts) {
    const hits = defs.map((d) => [d.id, biggestTurn(d)]).filter(([, n]) => n > 0);
    const hp = defs.map((d) => d.hp[1]);
    out(
      `  ${name}: ${defs.length} enemies, hp max ${Math.min(...hp)}–${Math.max(...hp)}; ` +
        `biggest single-turn hit per enemy: ${hits.map(([id, n]) => `${id}=${n}`).join(' ')}`
    );
  }
  const tagSet = new Set();
  for (const w of weapons) for (const t of [].concat(w.tags || [])) tagSet.add(t);
  out('  weapon tags (closed set as authored): ' + [...tagSet].sort().join(', '));
  out(`  'heavy' on: ${weapons.filter((w) => [].concat(w.tags || []).includes('heavy')).map((w) => w.id).join(', ')}`);
  out(`  'blunt' in weapon tags: ${tagSet.has('blunt') ? 'YES' : 'NO — the word does not exist in this vocabulary'}`);
  out("  character stats (vigour/faith/arcane/wisdom/intelligence…): NONE in the tree — 'strength' and");
  out('  \'dexterity\' exist only as COMBAT STATUSES (statuses.js), not as character attributes.');
}

// ---------------------------------------------------------------------------
// 3 · Selftest — the known-bad, through the same door
// ---------------------------------------------------------------------------

function selftest() {
  out('SELFTEST — known-bad enters by the same door the real content enters:');
  out('  planted: strength row rewritten to modifiers:{damageDealtMult:2} (flat add → multiplier),');
  out('  fed through createRegistries → createCombat → dispatch. The lane assertion must go RED.');
  const badBundle = {
    ...contentBundle,
    statuses: contentBundle.statuses.map((s) =>
      s.id === 'strength'
        ? { ...s, modifiers: { damageDealtMult: 2 }, tooltip: s.tooltip }
        : s
    ),
  };
  const badReg = createRegistries(badBundle);
  const red = runLane(badReg, { expectRed: true });
  if (red === 0) {
    out('  SELFTEST FAILED: the planted lane defect was NOT observed red — this tool proves nothing.');
    process.exit(1);
  }
  out(`  SELFTEST OK: planted defect observed red in ${red} cell(s), from the real entry point.`);
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
out(`statprice — EldenSpire content pricing (base Strike = ${BASE})`);
if (args.includes('--selftest')) {
  selftest();
} else {
  const registries = createRegistries(contentBundle);
  census();
  out('');
  runLane(registries);
  out('');
  runPerHit(registries);
  out('');
  out('BOUNDARY: tagged vulnerability (frostExposed ×1.25 on starstone, insanityExposed ×1.3 on');
  out('ritual/blight) is priced from the table rows, NOT dispatched here — a Strike carries no');
  out('effect tags, so that lane multiplies spell damage only. Ceiling of shipped player-side');
  out('multipliers on one tagged hit: 1.25 × 1.5 × 1.25 ≈ ×2.34 (glassCannon · vulnerable · exposed).');
  out('This tool measures the SHIPPED game; a future stat system may add lanes this cannot see.');
}
