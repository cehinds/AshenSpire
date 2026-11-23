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
import { previewIntent, dispatch } from '../src/engine/combat.js';
import { enemyMoveDamage } from '../src/model/state.js';
import { expandedEnemyMove, enemyMoveCarrier } from '../src/engine/combatCardTactics.js';
import { registries, begin, holdable, measure, CLASSES, SHIPPED_SETTINGS, tagOf, num, round } from './lib/cardBudgetMeasure.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? true; };
const OUT = flag('--out'), JSON_OUT = flag('--json');

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
