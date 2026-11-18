#!/usr/bin/env node
// tools/level-pace-sim.mjs — character level reached at the end of each act.
//
// Walks the real act maps (buildActMap) for many seeds under three path
// policies, assuming every fight is won against mid-range-level enemies:
//   min      fewest elites the map allows (ties random)
//   typical  a random walk
//   max      most elites the map allows (ties random)
// Reports mean / p10 / p50 / p90 level at the end of each act, and the most
// levels any single fight climbed. Zero deps; the engine does the arithmetic.
//
// Usage: node tools/level-pace-sim.mjs [seeds=200] [--json]
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { drawSeatOrder, buildActMap, bossEncounterForNode } from '../src/engine/actmap.js';
import { rollEncounter } from '../src/engine/encounters.js';
import { seatAtTier } from '../src/model/seats.js';
import { combatXpReceipt, climbLevels } from '../src/model/levelup.js';

export const POLICIES = ['min', 'typical', 'max'];
// Owner 2026-11-18: level at the END of each act, low-elite routes at the bottom of the band, elite-heavy at the top.
export const BANDS = [[2, 3], [4, 6], [6, 8]];
export function bandCheck(rep) {
  const bad = [];
  BANDS.forEach(([lo, hi], i) => {
    if (rep.min.acts[i].p10 < lo) bad.push(`min act${i + 1} p10 ${rep.min.acts[i].p10} < ${lo}`);
    if (rep.max.acts[i].p90 > hi) bad.push(`max act${i + 1} p90 ${rep.max.acts[i].p90} > ${hi}`);
  });
  return bad;
}

function poolOf(node) {
  const t = node.type;
  if (t === 'boss') return 'boss';
  if (t === 'elite') return 'elite';
  if (t === 'monster' || t === 'fight') return 'normal';
  if (t === 'event' && node.resolved && node.resolved.kind === 'fight') return 'normal';
  return null;
}
const nextOf = (map, node) => (node.next || node.edges || node.nextIds || []).map((id) => map.nodes[id]).filter(Boolean);

// Elites on the best remaining path from a node (min or max), memoised.
function eliteDp(map, pick) {
  const memo = new Map();
  const f = (node) => {
    if (memo.has(node.id)) return memo.get(node.id);
    const here = node.type === 'elite' ? 1 : 0;
    const nx = nextOf(map, node);
    const v = here + (nx.length ? pick(...nx.map(f)) : 0);
    memo.set(node.id, v);
    return v;
  };
  return f;
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
}
export const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

// One run under one policy. Returns { levels: [after act1..3], fights, maxLevelsInFight }.
export function simulateRun(registries, seed, policy, acts = 3) {
  const rng = createRng(seed);
  const seatOrder = drawSeatOrder(registries, rng);
  const history = [];
  let lv = { level: 1, xp: 0 };
  const levels = [];
  const fights = { normal: 0, elite: 0, boss: 0 };
  let maxLevelsInFight = 0;
  let firstFightXp = null;
  for (let act = 1; act <= acts; act++) {
    const seat = seatAtTier(seatOrder, act);
    const map = buildActMap(registries, rng, seat, act, null, { history });
    const score = policy === 'typical' ? null : eliteDp(map, policy === 'max' ? Math.max : Math.min);
    let opts = map.startIds.map((id) => map.nodes[id]);
    for (let guard = 0; guard < 400; guard++) {
      let cands = opts;
      if (score) {
        const sc = opts.map(score);
        const best = policy === 'max' ? Math.max(...sc) : Math.min(...sc);
        cands = opts.filter((_, i) => sc[i] === best);
      }
      const node = cands[Math.floor(rng.float('misc') * cands.length)];
      const pool = poolOf(node);
      if (pool) {
        const encId = pool === 'boss' ? bossEncounterForNode(registries, map, node.id, { seat, tier: act }) : rollEncounter(registries, rng, { pool, seat, exclude: [] });
        const enc = registries.encounters.get(encId);
        const ids = enc.enemies || enc.enemyIds || enc.members || [];
        const enemies = ids.map((x) => {
          const id = typeof x === 'string' ? x : (x.enemyId || x.id);
          const { min, max } = registries.enemies.get(id).levelProfile;
          return { enemyId: id, level: Math.round((min + max) / 2), alive: false, hp: 0 };
        });
        fights[pool]++;
        const floors = Math.max(...Object.values(map.nodes).map((n) => n.floor || 0));
        const gain = combatXpReceipt(registries, { victory: true, pool, enemies, position: { floor: node.floor, floors, act } }).total;
        if (firstFightXp === null) firstFightXp = gain;
        const c = climbLevels(registries, { level: lv.level, xp: lv.xp, gain });
        maxLevelsInFight = Math.max(maxLevelsInFight, c.level - lv.level);
        lv = c;
      }
      if (node.type === 'boss') break;
      const nx = nextOf(map, node);
      if (!nx.length) break;
      opts = nx;
    }
    levels.push(lv.level);
  }
  return { levels, fights, maxLevelsInFight, firstFightXp };
}

export function paceReport(registries, { seeds = 200, firstSeed = 1000, acts = 3 } = {}) {
  const out = {};
  for (const policy of POLICIES) {
    const byAct = Array.from({ length: acts }, () => []);
    const elites = [];
    const first = [];
    let maxFight = 0;
    for (let s = firstSeed; s < firstSeed + seeds; s++) {
      const r = simulateRun(registries, s, policy, acts);
      r.levels.forEach((l, i) => byAct[i].push(l));
      elites.push(r.fights.elite);
      first.push(r.firstFightXp);
      maxFight = Math.max(maxFight, r.maxLevelsInFight);
    }
    out[policy] = {
      meanElites: mean(elites),
      firstFightXp: mean(first),
      maxLevelsInFight: maxFight,
      acts: byAct.map((a) => {
        const s = [...a].sort((x, y) => x - y);
        return { mean: mean(s), p10: percentile(s, 0.1), p50: percentile(s, 0.5), p90: percentile(s, 0.9) };
      }),
    };
  }
  return out;
}

export function defaultRegistries() {
  const profile = Profile.resolveGameProfile('default');
  const content = Profile.applyGameProfileToContent(contentBundle, profile);
  return Profile.bindGameProfileRegistries(createRegistries(content), profile);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seeds = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) || 200);
  const rep = paceReport(defaultRegistries(), { seeds });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rep, null, 1));
  else {
    console.log(`level at end of act (seeds ${seeds}): mean [p10 p50 p90]`);
    for (const p of POLICIES) {
      const r = rep[p];
      console.log(`${p.padEnd(8)} elites/run ${r.meanElites.toFixed(1)}  maxLevelsInOneFight ${r.maxLevelsInFight}  firstFightXP ${r.firstFightXp.toFixed(1)}  ` + r.acts.map((a, i) => `act${i + 1} ${a.mean.toFixed(2)} [${a.p10} ${a.p50} ${a.p90}]`).join('  '));
    }
    const bad = bandCheck(rep);
    console.log(bad.length ? `OUTSIDE BANDS ${BANDS.map((x) => x.join('-')).join(' / ')}: ${bad.join('; ')}` : `within bands ${BANDS.map((x) => x.join('-')).join(' / ')}`);
  }
}
