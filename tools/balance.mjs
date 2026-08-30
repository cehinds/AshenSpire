// tools/balance.mjs — headless balance analysis (SPEC §9 M3).
//
// Produces the "elite HP vs. average deck DPS" sanity table the M3 acceptance
// criteria call for, plus an empirical Act-1 win-rate pass driven by the same
// naive bot the tests use. Pure engine calls — no UI, deterministic per seed.
//
// Sections printed as Markdown (piped into docs/BALANCE.md):
//   1. Enemy roster: avg HP, weighted intent DPS, self-heal/turn, poise.
//   2. Encounters: total HP + incoming DPS per encounter (elites/bosses flagged).
//   3. Player baselines: MEASURED naive starting-deck DPS per class.
//   4. Sanity table: elites/bosses — turns-to-kill at reference DPS bands vs.
//      turns-to-die, with an unbeatable-by-construction (heal >= DPS) check.
//   5. Act-1 empirical: greedy-bot win rate + avg HP lost, starting decks.
//
// Run: node tools/balance.mjs   (or `node tools/balance.mjs > docs/BALANCE.md`)

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRunState } from '../src/model/state.js';

// A no-op punching bag for measuring unopposed player DPS.
const DUMMY = { id: 'balanceDummy', name: 'Dummy', hp: [100000, 100000], poiseMax: 999999, moves: { wait: { intent: 'unknown', weight: 1 } } };
const REG = createRegistries({ ...contentBundle, enemies: [...contentBundle.enemies, DUMMY] });

const round1 = (n) => Math.round(n * 10) / 10;
const avgHp = (def) => (def.hp[0] + def.hp[1]) / 2;

// Weighted intent DPS over base-phase (non-locked) moves; also self-heal/turn.
function enemyStats(def) {
  const moves = Object.values(def.moves).filter((m) => !m.locked);
  const totalW = moves.reduce((a, m) => a + m.weight, 0) || 1;
  let dps = 0;
  let heal = 0;
  for (const m of moves) {
    const p = m.weight / totalW;
    if (m.intent === 'attack') dps += p * (m.damage || 0) * (m.hits || 1);
    heal += p * (m.effects || []).filter((e) => e.op === 'heal').reduce((a, e) => a + (e.amount || 0), 0);
  }
  return { hp: avgHp(def), dps, heal, poise: def.poiseMax };
}

// --- naive bot: leftmost affordable card, aim at first living enemy ---------
const firstLiving = (c) => c.enemies.find((e) => e.alive);
function affordable(c) {
  return c.piles.hand.find((h) => {
    const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
    if ((def.keywords || []).includes('unplayable')) return false;
    const cost = def.cost === 'X' ? 0 : def.cost;
    return cost <= c.player.energy && (def.manaCost || 0) <= c.player.mana;
  });
}
function botStep(c) {
  const card = affordable(c);
  if (!card) { dispatch(c, { type: 'endTurn' }); return; }
  const tgt = firstLiving(c);
  try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: tgt && tgt.id }); }
  catch { dispatch(c, { type: 'endTurn' }); }
}

function newRun(classId) {
  return createRunState({ seed: 1, classId, registries: REG });
}

// The run's own stamped pools, by name — createPlayerCombatEntity REFUSES an
// unstamped energyMax/drawPerTurn since the derived-stat train, and this tool
// crashed on its first createCombat from the day that landed until 2026-08-15:
// the third dead simulator of the same class (runsim and measure-classes were
// the first two, repaired 2026-08-14). Same fix, same shape.
function stampedPlayer(run, cls) {
  return {
    classId: run.class, attributes: run.attributes, loadout: run.loadout,
    maxHp: run.maxHp, hp: run.maxHp,
    maxMana: run.maxMana, mana: run.maxMana,
    maxStamina: run.maxStamina, stamina: run.maxStamina,
    energyMax: run.energyMax, drawPerTurn: run.drawPerTurn,
    equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
    deck: run.deck, relicIds: [cls.startingRelic],
  };
}

// Measured unopposed DPS: bot vs. the dummy for T player turns.
function measureDps(classId, T = 10) {
  const cls = REG.classes.get(classId);
  const run = newRun(classId);
  const c = createCombat({
    registries: REG, rng: createRng(0xba1a),
    player: stampedPlayer(run, cls),
    enemyIds: ['balanceDummy'],
  });
  let guard = 0;
  while (c.turn <= T && !c.result && guard++ < 4000) botStep(c);
  const dmg = c.eventLog.filter((e) => e.type === 'damageDealt' && e.sourceId === 'player').reduce((a, e) => a + e.amount, 0);
  return dmg / T;
}

// Bot fights one encounter from full HP; returns { win, hpLost }.
function simFight(classId, enemyIds, seed) {
  const cls = REG.classes.get(classId);
  const run = newRun(classId);
  const c = createCombat({
    registries: REG, rng: createRng(seed),
    player: stampedPlayer(run, cls),
    enemyIds,
  });
  let guard = 0;
  while (!c.result && guard++ < 8000) botStep(c);
  // run.maxHp, NOT cls.maxHp: HP has been DERIVED (class base + vigour per
  // point, D17) since the derived-stat train — the class field alone is the
  // wrong denominator for every class.
  return { win: c.result === 'victory', hpLost: run.maxHp - Math.max(0, c.player.hp) };
}

// --- report -----------------------------------------------------------------
const out = [];
const P = (s = '') => out.push(s);

P('# AshenSpire — Balance Notes (M3)');
P('');
P('Auto-generated by `node tools/balance.mjs`. Regenerate after any tuning change.');
P('Intent DPS = weighted average attack damage per turn over an enemy\'s base-phase');
P('moves (locked/phase-2 moves excluded). "Heal/t" is self-heal from move effects.');
P('');

// Group enemies by the act of the encounters that use them.
function actOf(enemyId) {
  const enc = REG.encounters.all().find((x) => x.enemies.includes(enemyId));
  return enc ? enc.act || 1 : 1;
}

P('## 1. Enemy roster');
P('');
P('| Act | Enemy | Avg HP | Intent DPS | Heal/t | Poise | Role |');
P('|----:|-------|-------:|-----------:|-------:|------:|------|');
for (const def of REG.enemies.all()) {
  if (def.id === 'balanceDummy') continue;
  const s = enemyStats(def);
  const pool = REG.encounters.all().find((x) => x.enemies.includes(def.id));
  const role = pool ? pool.pool : 'normal';
  P(`| ${actOf(def.id)} | ${def.name} | ${s.hp} | ${round1(s.dps)} | ${s.heal ? round1(s.heal) : '—'} | ${s.poise} | ${role} |`);
}
P('');

P('## 2. Encounters (incoming totals)');
P('');
P('| Act | Encounter | Pool | Enemies | Total HP | Incoming DPS | Heal/t |');
P('|----:|-----------|------|--------:|---------:|-------------:|-------:|');
for (const enc of REG.encounters.all()) {
  const stats = enc.enemies.map((id) => enemyStats(REG.enemies.get(id)));
  const hp = stats.reduce((a, s) => a + s.hp, 0);
  const dps = stats.reduce((a, s) => a + s.dps, 0);
  const heal = stats.reduce((a, s) => a + s.heal, 0);
  P(`| ${enc.act || 1} | ${enc.id} | ${enc.pool} | ${enc.enemies.length} | ${hp} | ${round1(dps)} | ${heal ? round1(heal) : '—'} |`);
}
P('');

P('## 3. Player baselines (measured naive starting-deck DPS)');
P('');
P('Naive bot (leftmost affordable card) vs. an infinite-HP dummy, 10 turns,');
P('starting deck + starting relic. Real players sequence better, so these are a');
P('conservative floor. Reference bands assume deck growth: mid = ×1.6, late = ×2.4.');
P('');
P('| Class | Max HP (derived) | Start DPS | ~Mid (×1.6) | ~Late (×2.4) |');
P('|-------|-----------------:|----------:|------------:|-------------:|');
const dpsByClass = {};
// Derived max HP per class (class base + vigour per point, D17) — what a run
// actually fights at. cls.maxHp is only the base half of that number.
const derivedHp = {};
for (const cls of REG.classes.all()) derivedHp[cls.id] = newRun(cls.id).maxHp;
for (const cls of REG.classes.all()) {
  const d = measureDps(cls.id);
  dpsByClass[cls.id] = d;
  P(`| ${cls.name} | ${derivedHp[cls.id]} | ${round1(d)} | ${round1(d * 1.6)} | ${round1(d * 2.4)} |`);
}
const avgStartDps = Object.values(dpsByClass).reduce((a, b) => a + b, 0) / Object.values(dpsByClass).length;
P('');

P('## 4. Sanity table — elites & bosses');
P('');
P('Reference DPS by act: Act 1 = measured start, Act 2 = ×1.6, Act 3 = ×2.4 (avg');
P('across classes). "Turns to kill" = HP / (refDPS − heal). "Turns to die" =');
P('lowest class HP / incoming DPS. Verdict flags unbeatable-by-construction');
P('(heal ≥ refDPS → cannot kill) and races (kill ≥ die).');
P('');
P('| Act | Encounter | HP | Heal/t | refDPS | Turns to kill | InDPS | Turns to die | Verdict |');
P('|----:|-----------|---:|-------:|-------:|--------------:|------:|-------------:|---------|');
const minHp = Math.min(...Object.values(derivedHp));
const bandMult = { 1: 1, 2: 1.6, 3: 2.4 };
for (const enc of REG.encounters.all()) {
  if (enc.pool === 'normal') continue;
  const act = enc.act || 1;
  const stats = enc.enemies.map((id) => enemyStats(REG.enemies.get(id)));
  const hp = stats.reduce((a, s) => a + s.hp, 0);
  const heal = stats.reduce((a, s) => a + s.heal, 0);
  const inDps = stats.reduce((a, s) => a + s.dps, 0);
  const refDps = avgStartDps * bandMult[act];
  const net = refDps - heal;
  const ttk = net > 0 ? hp / net : Infinity;
  const ttd = inDps > 0 ? minHp / inDps : Infinity;
  let verdict = 'ok';
  if (!isFinite(ttk)) verdict = '**UNBEATABLE (heal ≥ DPS)**';
  else if (ttk >= ttd) verdict = '**race — check**';
  else if (ttk <= 2) verdict = 'trivial?';
  P(`| ${act} | ${enc.id} | ${hp} | ${heal ? round1(heal) : '—'} | ${round1(refDps)} | ${round1(ttk)} | ${round1(inDps)} | ${round1(ttd)} | ${verdict} |`);
}
P('');
P('> Note: the Blighted Valkyrie (final boss) also heals **3 per hit she lands** via a');
P('> phase trigger (not a move effect), up to ~15/turn on her 5-hit moves — the');
P('> tightest DPS check in the game. Factor this into her row above.');
P('');

P('## 5. Act-1 empirical win rate (naive bot, starting deck)');
P('');
P('Greedy bot, starting deck only (no card acquisition), from full HP, 300 seeds.');
P('Act 1 is the only act where a starting deck is the correct reference; later acts');
P('assume deck growth (§4 bands). These are a **floor** — real play does better.');
P('');
P('| Class | Encounter | Win % | Avg HP lost (of max) |');
P('|-------|-----------|------:|---------------------:|');
const N = 300;
const act1 = REG.encounters.all().filter((e) => (e.act || 1) === 1);
for (const cls of REG.classes.all()) {
  for (const enc of act1) {
    let wins = 0, hpLost = 0;
    for (let s = 1; s <= N; s++) {
      const r = simFight(cls.id, enc.enemies, s * 7 + cls.id.length);
      if (r.win) wins++;
      hpLost += r.hpLost;
    }
    P(`| ${cls.name} | ${enc.id} (${enc.pool}) | ${round1((wins / N) * 100)} | ${round1(hpLost / N)} / ${derivedHp[cls.id]} |`);
  }
}
P('');

// THE ASSERTION'S OWN PASS — EVERY POOL, and the table above is not its home.
//
// Section 4's table is deliberately elites & bosses: those are the tight fights
// a reader wants to see. The ACCEPTANCE CRITERION is not scoped that way — SPEC
// §9 says no encounter is unbeatable by construction, and a normal encounter
// that cannot be killed fails it exactly as a boss does.
//
// This is not a hypothetical. Planting `heal: 800` on the Court Surgeon — real
// content, the door every enemy enters by — produced NO row and exit 0, because
// the Surgeon appears only in `normal` encounters and the table skipped them.
// The check could not see a shipped enemy that out-healed every deck in the
// game. Watched, 2026-08-15; that observation is why this pass exists.
const unbeatable = [];
for (const enc of REG.encounters.all()) {
  const act = enc.act || 1;
  const stats = enc.enemies.map((id) => enemyStats(REG.enemies.get(id)));
  const heal = stats.reduce((a, s) => a + s.heal, 0);
  const refDps = avgStartDps * bandMult[act];
  if (refDps - heal <= 0) unbeatable.push(`${enc.id} (act ${act}, ${enc.pool}): heal ${round1(heal)}/t vs refDPS ${round1(refDps)}`);
}
const unbeatableCount = unbeatable.length;

P('## 6. Findings');
P('');
// COMPUTED, not remembered. This section restated section 4/5 numbers as prose
// for the life of the tool ("Reaver ~36%, Herald ~8%, Starseer ~1%") while the
// content moved and the tool itself sat dead — a second copy of a measurement,
// drifted. The claims below are derived from this run or they are dated.
if (unbeatableCount === 0) {
  P(`- **No unbeatable-by-construction encounters** (SPEC §9 acceptance):`);
  P(`  all ${REG.encounters.all().length} encounters — every pool, not just the`);
  P('  elites and bosses tabled above — resolved to refDPS > self-heal. ✓');
} else {
  P(`- **${unbeatableCount} UNBEATABLE-BY-CONSTRUCTION encounter(s)** — SPEC §9`);
  P('  acceptance FAILS this run:');
  for (const u of unbeatable) P(`  - ${u}`);
}
P('- The sanity model **ignores player Block** — the whole defensive layer — so');
P('  "turns to die" is a zero-block floor. Bosses showing as a "race" is intended');
P('  StS design: you survive by blocking and bursting, not by out-HP-ing.');
P('- Class-vs-boss floors, deck growth, and the why behind the spread are');
P('  section 5 above and `node tools/runsim.mjs <n> --deep` — read the numbers');
P('  there; prose repeating them here is the copy that drifts.');
P('- **Dated note (M3, kept for the trigger it names):** the Blighted Valkyrie');
P('  also heals **3 per hit she lands** via a phase trigger (not a move effect),');
P('  so her sanity row understates her sustain — the intended apex check.');
P('');
P('## Boundary — what this green does NOT cover');
P('');
P('- A **static model**: intent-weighted averages, zero player Block, no card');
P('  acquisition past section 5, no status interactions, no phase triggers');
P('  (the Valkyrie note above is exactly the hole this leaves).');
P('- **One pilot**: the leftmost-affordable bot. It cannot sequence Starstone');
P('  combos, hold a flask for a boss, or curate a deck. A bot floor is not a');
P('  player ceiling, and nothing here is a claim about a human.');
P('- **Section 5 is act 1 only**, starting deck only, 300 seeds per row.');
P('- It asserts exactly ONE thing (SPEC §9 acceptance: no encounter is');
P('  unbeatable by construction). Every other number above is a report.');
P('');

console.log(out.join('\n'));

// THE ONE ASSERTION, and it is the reason this tool is kept rather than
// deleted: SPEC §9's acceptance criterion — no encounter unbeatable by
// construction — has no other home in the tree. runsim measures completability
// with a bot; measure-classes checks its own agreement with runsim. Neither can
// say "this encounter cannot be killed by any DPS," because a bot that dies
// early and a boss that cannot be killed produce the same lost run. A report
// nobody can fail is a document; this exit code is what makes it a check.
if (unbeatableCount > 0) {
  console.error(`\nBALANCE: ${unbeatableCount} encounter(s) UNBEATABLE by construction (heal >= refDPS) — SPEC §9 acceptance FAILS.`);
  process.exit(1);
}
