// tools/mapfog.mjs — does the fog cover the right things, and does the screen
// draw what the ladder says it drew?
//
// TWO HALVES, and neither ships without the other.
//
//   --selftest   THE LADDER, headless, against real generated graphs and against
//                a bench of DELIBERATELY BROKEN light rules. Every property here
//                has been watched to fail: each mutant below is a fog somebody
//                could plausibly have written, and the table prints which
//                property caught it. A property no mutant kills is decoration
//                and is reported as such — `unknown`, never green.
//   (default)    THE RENDERED PAGE, over CDP, walking an act step by step and
//                comparing the SET of nodes the DOM actually holds against the
//                set `model/mapknowledge.js` says it should. Two counts agreeing
//                is not two sets agreeing, so this compares ids.
//
// WHY BOTH. The ladder is pure and the screen is what a player meets, and the
// gap between them is where this class of bug lives: a correct ladder whose
// rungs the stylesheet paints identically is a fog that covers nothing, and
// every headless check in the tree stays green through it.
//
// THE PROPERTY THAT IS THE WHOLE DESIGN, and it is the one worth reading first:
//
//   FOG ONLY EVER LOWERS A NODE TO `hidden`. For every node, in every position,
//   the fog rung is either `hidden` or EXACTLY the rung it has in `path` mode.
//
// That is Viki's two-axes finding made executable. `revealUnknown` answers "what
// kind of place is that"; fog answers "is it drawn at all". If fog is ever seen
// changing a node from `known` to `placed`, the two axes have been welded into
// one lever and the relic has become a special case again — which is the defect
// this whole shape exists to prevent, caught rather than remembered.
//
// Usage
//   node tools/mapfog.mjs --selftest            the ladder + the mutant bench
//   node tools/mapfog.mjs                       the rendered walk, source tree
//   node tools/mapfog.mjs --dist                against dist/AshenSpire.html
//   node tools/mapfog.mjs --shots DIR           write a walked sequence as PNGs
//   node tools/mapfog.mjs --seeds A,B --steps 1,3,5,7,9
//   node tools/mapfog.mjs --mutate              falsify the page's own census
//   CHROME=/path/to/chrome node tools/mapfog.mjs
//
// Exit codes
//   0  every property holds, every mutant was caught, and the page's drawn set
//      equals the ladder's at every cell swept
//   1  a finding
//   2  usage / no browser / a screen that would not mount / NOTHING SWEPT —
//      which is unknown, and unknown is never a pass
//
// BOUNDARY, and it is not small. The rendered half is headless Chromium on one
// Linux machine, the shapes and seeds named on the command line, one act each.
// It proves WHICH NODES ARE IN THE DOM. It does not prove the fog reads as fog
// (Sunna), that the parchment is anything but a placeholder (Freja), or that a
// player enjoys climbing blind. And it never renders the `<image>` plate: those
// three files do not exist yet, so every shot below is of the placeholder wash.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';
import { mapConfigs } from '../src/content/mapconfig.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { createRng, seedFromString } from '../src/engine/rng.js';
import {
  mapKnowledge, litNodes, nodeReading, resolveMapMode,
  HIDDEN, PLACED, KNOWN, RUNGS, rungHeight, MAP_MODES, MAP_MODE_DEFAULT,
} from '../src/model/mapknowledge.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const selftest = args.includes('--selftest');
const useDist = args.includes('--dist');
const mutate = args.includes('--mutate');
const shotsDir = argOf('--shots');

/* ===================================================================== the
 * ladder's own bench — pure, no browser, and it must go red on demand
 * ==================================================================== */

/** A walk down a generated act: [id] prefixes, deepest first-`next` each step. */
function walkOf(graph, steps) {
  let id = [...graph.startIds].sort()[0];
  const out = [id];
  for (let i = 1; i < steps; i++) {
    const next = [...(graph.nodes[id].next || [])].sort();
    if (!next.length) break;
    id = next[0];
    out.push(id);
  }
  return out;
}

function actGraph(seed, act = 1) {
  const rng = createRng(seedFromString(seed));
  return generateActMap({ config: mapConfigs[act], rng });
}

/**
 * build({ graph, lit, reveal, demote }) → a knowledge object of the same shape
 * `mapKnowledge` returns. `lit === null` means nothing is fogged; `demote(node)`
 * forces a lit node down to `placed`.
 *
 * A MUTANT MUST BE ABLE TO BREAK EITHER AXIS, and the first draft of this bench
 * could only break one. Every mutant it had changed the LIGHT — so the property
 * that matters most, *fog only ever lowers a node to hidden*, had nothing that
 * could make it fail and came back `unknown`. A property no mutant kills is not
 * a check; it is a sentence. Hence `demote`, and hence mutants that reach into
 * `path` mode as well as `fog`.
 */
function build({ graph, lit, reveal, demote = null, mode = 'fog' }) {
  const rung = new Map();
  const drawn = new Set();
  const counts = { hidden: 0, placed: 0, known: 0 };
  for (const node of Object.values(graph.nodes)) {
    let r;
    if (lit && !lit.has(node.id)) r = HIDDEN;
    else if (demote && demote(node)) r = PLACED;
    else r = nodeReading(node, { reveal }).knowsType ? KNOWN : PLACED;
    rung.set(node.id, r);
    counts[r]++;
    if (r !== HIDDEN) drawn.add(node.id);
  }
  return { mode, rung, drawn, counts };
}

/**
 * THE MUTANTS — fogs somebody could plausibly have written, each wrong in one
 * way. Each takes `{ graph, run, reveal, mode }` and answers for BOTH modes, so
 * a mutant is free to break the mode that is supposed to be untouched.
 *
 * `null` is the shipped rule; it must survive every property.
 */
const MUTANTS = [
  ['SHIPPED (must survive)', null],
  ['flashlight only — the fog closes behind you',
    ({ graph, run, reveal, mode }) => {
      if (mode !== 'fog') return build({ graph, lit: null, reveal, mode });
      const lit = new Set(graph.startIds);
      lit.add(graph.bossId);
      const cur = run.mapNodeId && graph.nodes[run.mapNodeId];
      if (cur) { lit.add(cur.id); for (const t of cur.next) lit.add(t); }
      return build({ graph, lit, reveal, mode });
    }],
  // THE READING HE DID NOT PICK, AND ITS NEW HOME IS HERE. Until 2026-08-08 this
  // was the shipped rule on half the corpus — the narrow reading of "only next
  // node and all previous nodes" — and it was a mutant only on the `+forks`
  // cells. He answered: a fork stays lit once you are past it. So the boolean
  // and its shot flag are deleted from the game (model/mapknowledge.js) and the
  // losing reading is DEMOTED to a known-bad, red on every cell now, killed by
  // the monotone property below. A reading we chose against belongs in the
  // instrument, not in a setting nobody selected.
  ['the trail, but the roads not taken re-fog (the reading he did not pick)',
    ({ graph, run, reveal, mode }) => {
      if (mode !== 'fog') return build({ graph, lit: null, reveal, mode });
      const lit = new Set(run.path || []);
      for (const id of graph.startIds) lit.add(id);
      lit.add(graph.bossId);
      const cur = run.mapNodeId && graph.nodes[run.mapNodeId];
      if (cur) for (const t of cur.next) lit.add(t);
      return build({ graph, lit, reveal, mode });
    }],
  ['no boss — the end of the act is never shown',
    ({ graph, run, reveal, mode }) => {
      if (mode !== 'fog') return build({ graph, lit: null, reveal, mode });
      const lit = litNodes({ graph, run }); lit.delete(graph.bossId);
      return build({ graph, lit, reveal, mode });
    }],
  ['no doors — the act opens on nothing',
    ({ graph, run, reveal, mode }) => {
      if (mode !== 'fog') return build({ graph, lit: null, reveal, mode });
      const lit = litNodes({ graph, run });
      for (const id of graph.startIds) lit.delete(id);
      return build({ graph, lit, reveal, mode });
    }],
  ['fog eats the split — your own next options are covered',
    ({ graph, run, reveal, mode }) => {
      if (mode !== 'fog') return build({ graph, lit: null, reveal, mode });
      const lit = litNodes({ graph, run });
      const cur = run.mapNodeId && graph.nodes[run.mapNodeId];
      if (cur) for (const t of cur.next) lit.delete(t);
      return build({ graph, lit, reveal, mode });
    }],
  ['fog lifts everything — a mode that does nothing',
    ({ graph, reveal, mode }) => build({ graph, lit: null, reveal, mode })],
  // THE TWO AXES WELDED INTO ONE LEVER — and this is the mutant the bench was
  // missing. It is not a strawman: "you can see a place is there but not what it
  // is until you stand next to it" is a perfectly reasonable fog, and it is the
  // design that quietly makes the Sealstone Key mode-dependent. Fog would then
  // move a node between `known` and `placed`, which is the relic's axis, and the
  // relic would be a special case again with nothing able to say so.
  ['fog demotes — an unvisited node reads `?` even when its kind is known',
    ({ graph, run, reveal, mode }) => {
      if (mode !== 'fog') return build({ graph, lit: null, reveal, mode });
      const seen = new Set(run.path || []);
      return build({
        graph, reveal, mode,
        lit: litNodes({ graph, run }),
        demote: (n) => !seen.has(n.id) && n.id !== graph.bossId,
      });
    }],
  // …and the mirror: a fog that leaks into the mode it must not touch. `path` is
  // the game as it shipped, and "nobody who does not opt in sees a pixel move"
  // is a claim that needs something able to falsify it.
  ['fog leaks into `path` — the unreached half of the act goes dark for everyone',
    ({ graph, run, reveal, mode }) => build({ graph, reveal, mode, lit: litNodes({ graph, run }) })],
];

/** Knowledge under a mutant; `null` uses the shipped ladder. */
function knowledgeUnder(mutantFn, { graph, run, reveal, mode }) {
  if (!mutantFn) return mapKnowledge({ graph, run, mode, reveal });
  return mutantFn({ graph, run, reveal, mode });
}

/**
 * THE PROPERTIES. Each takes the whole swept corpus for one light rule and
 * returns null (holds) or a one-line reason. Written against a DISTRIBUTION of
 * real graphs, never one seed — a fog that is correct on `SHOWCASE` and wrong on
 * the next map is the anecdote this repo keeps catching itself telling.
 */
const PROPERTIES = [
  ['the framing set is always drawn — the camera never frames blank parchment',
    (cells) => {
      for (const c of cells) {
        for (const id of c.framing) {
          if (!c.fog.drawn.has(id)) return `${c.label}: ${id} is in the framing set and is not drawn`;
        }
      }
      return null;
    }],
  // THE TRAIL CLAUSE — a node the player has stood on never goes dark again.
  // "previously visited locations remain revealed" with nothing added to it.
  // It is kept as its own row even though the wider clause below now subsumes
  // it: this is the half of his sentence that was never in question, and a
  // property that survives the day the other one is re-argued is worth having
  // separately.
  ['the TRAIL never re-fogs — a node you stood on stays drawn',
    (cells) => {
      for (const c of cells) {
        for (const id of c.run.path) {
          if (!c.fog.drawn.has(id)) return `${c.label}: ${id} is on the walked path and is fogged`;
        }
      }
      return null;
    }],
  // UNCONDITIONAL SINCE 2026-08-08, and that is the upgrade rather than a
  // widening. It used to run on the `+forks` half of the corpus only, because
  // the other half was a legal reading of his sentence where it must NOT hold.
  // The wide reading ships as THE FAMILY'S DEFAULT — asked, he answered "idk
  // about hte forks part" (D19, claude-family), an honest idk and not a pick,
  // so this rule is ours until he rules — and it is the check standing behind
  // `FOG_TRAIL_CLAUSE`, the sentence the settings screen shows a player. A
  // promise on a screen with no property behind it is the defect this row was
  // written out of.
  ['NOTHING ever lit goes dark — the drawn set only grows',
    (cells) => {
      const bySeed = new Map();
      for (const c of cells) {
        const prev = bySeed.get(c.seed);
        if (prev) {
          for (const id of prev.fog.drawn) {
            if (!c.fog.drawn.has(id)) return `${c.label}: ${id} was drawn at step ${prev.steps} and is fogged again at step ${c.steps}`;
          }
        }
        bySeed.set(c.seed, c);
      }
      return null;
    }],
  ['the boss is drawn from the first frame',
    (cells) => {
      for (const c of cells) {
        if (!c.fog.drawn.has(c.graph.bossId)) return `${c.label}: the boss (${c.graph.bossId}) is fogged`;
      }
      return null;
    }],
  ['every entrance is drawn, for the whole act',
    (cells) => {
      for (const c of cells) {
        for (const id of c.graph.startIds) {
          if (!c.fog.drawn.has(id)) return `${c.label}: entrance ${id} is fogged`;
        }
      }
      return null;
    }],
  ['fog HIDES something — a mode that covers nothing is not a mode',
    (cells) => {
      const covered = cells.filter((c) => c.fog.counts.hidden > 0).length;
      return covered === cells.length ? null
        : `${cells.length - covered} of ${cells.length} cells have nothing fogged at all`;
    }],
  ['fog only ever LOWERS a node to hidden — the two axes stay two',
    (cells) => {
      for (const c of cells) {
        for (const [id, r] of c.fog.rung) {
          const p = c.path.rung.get(id);
          if (r !== HIDDEN && r !== p) return `${c.label}: ${id} reads '${p}' unfogged and '${r}' fogged — fog moved the relic's axis`;
          if (rungHeight(r) > rungHeight(p)) return `${c.label}: ${id} is HIGHER under fog (${r}) than without it (${p})`;
        }
      }
      return null;
    }],
  ['path mode hides nothing — the shipped screen is this ladder with its bottom rung empty',
    (cells) => {
      for (const c of cells) {
        if (c.path.counts.hidden !== 0) return `${c.label}: path mode fogged ${c.path.counts.hidden} node(s)`;
      }
      return null;
    }],
];

function sweepCells(seeds, stepList, reveal) {
  const cells = [];
  for (const seed of seeds) {
    const graph = actGraph(seed);
    // ONE READING NOW, AND THE CORPUS IS HALF THE SIZE IT WAS. It used to sweep
    // both answers to the fork question because the shipped code could be in
    // either state. It cannot any more — the boolean is deleted — so a second
    // axis here would be sweeping a state the game has no way to reach, which
    // is a corpus lying about its own coverage. The reading he did not pick is
    // still exercised, as a mutant.
    for (const steps of stepList) {
      const path = walkOf(graph, steps);
      const run = { path, mapNodeId: path[path.length - 1] };
      const cur = graph.nodes[run.mapNodeId];
      const framing = [run.mapNodeId, ...(cur ? cur.next : [])];
      cells.push({ seed, steps, graph, run, framing, reveal, label: `${seed}@${steps}` });
    }
  }
  return cells;
}

function runSelftest() {
  const seeds = (argOf('--seeds') || 'FOG1,FOG2,FOG3,FOG4,FOG5,FOG6,FOG7,FOG8').split(',').map((s) => s.trim()).filter(Boolean);
  const stepList = (argOf('--steps') || '1,2,3,5,8,11').split(',').map(Number).filter(Number.isInteger);
  const reveal = false;

  console.log(`\nmapfog --selftest — the ladder over ${seeds.length} generated act(s) x ${stepList.length} walk position(s),`
    + ` and ${MUTANTS.length - 1} deliberately broken light rule(s).\n`);

  const base = sweepCells(seeds, stepList, reveal);
  if (!base.length) { console.error('mapfog: nothing swept — unknown, never a pass.'); process.exit(2); }

  // Every cell, under every light rule.
  const table = MUTANTS.map(([label, fn]) => {
    const cells = base.map((c) => ({
      ...c,
      fog: knowledgeUnder(fn, { graph: c.graph, run: c.run, reveal, mode: 'fog' }),
      path: knowledgeUnder(fn, { graph: c.graph, run: c.run, reveal, mode: 'path' }),
    }));
    const verdicts = PROPERTIES.map(([, p]) => {
      try { return p(cells); } catch (e) { return `threw: ${e.message}`; }
    });
    return { label, mutant: fn != null, verdicts };
  });

  const shipped = table[0];
  console.log(`  --- the shipped rule, against every property ---\n`);
  let shippedOk = true;
  PROPERTIES.forEach(([name], i) => {
    const v = shipped.verdicts[i];
    if (v) shippedOk = false;
    console.log(`  ${v ? 'RED  ' : 'HOLDS'}  ${name}`);
    if (v) console.log(`         ^ ${v}`);
  });

  console.log(`\n  --- the mutant bench: each broken rule, and which property killed it ---\n`);
  let allCaught = true;
  const killedBy = new Set();
  for (const row of table.slice(1)) {
    const hits = row.verdicts.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    hits.forEach((i) => killedBy.add(i));
    if (!hits.length) allCaught = false;
    console.log(`  ${hits.length ? 'CAUGHT' : 'ESCAPED'}  ${row.label}`);
    if (hits.length) console.log(`           ^ by: ${hits.map((i) => PROPERTIES[i][0]).join(' · ')}`);
    else console.log(`           ^ NOTHING FAILED. A fog this broken is indistinguishable from the shipped one here.`);
  }

  console.log(`\n  --- which properties have been OBSERVED red (the instrument rule) ---\n`);
  let unwatched = 0;
  PROPERTIES.forEach(([name], i) => {
    const seen = killedBy.has(i);
    if (!seen) unwatched++;
    console.log(`  ${seen ? 'WATCHED' : 'unknown'}  ${name}`);
  });

  // The vocabulary itself, because a mode nobody can select is a mode that does
  // not exist, and a resolver that accepts a typo is a fog that silently is not.
  console.log(`\n  --- the mode vocabulary ---\n`);
  const modeRows = [
    ['unset resolves to the shipping default', resolveMapMode({}) === MAP_MODE_DEFAULT],
    ['a value this build cannot read resolves to the default', resolveMapMode({ settings: { mapMode: 'FOG ' } }) === MAP_MODE_DEFAULT],
    ['no meta at all resolves to the default', resolveMapMode(null) === MAP_MODE_DEFAULT],
    ['every declared mode round-trips', MAP_MODES.every((m) => resolveMapMode({ settings: { mapMode: m } }) === m)],
    ['the default is a declared mode', MAP_MODES.includes(MAP_MODE_DEFAULT)],
    // THIS ROW WAS PINNED TO A VALUE AND THE TREE REACHED IT. It read "the
    // default is `path` — nobody's first run is the experiment", and it was a
    // correct guard for exactly as long as that sentence was the ruling. On
    // 2026-08-08 Constantine said "the fog needs to be the default", and the row
    // went red on the commit that obeyed him: a check pinned to a value does not
    // find a defect the day the value moves, it becomes one.
    //
    // It is re-pinned rather than deleted, because the thing it guards is real:
    // a default is not a preference, it is the only reading most runs will ever
    // get, and it should not drift by accident. The value is HIS, and the row
    // now names whose it is — so the next person to move it has to argue with
    // him rather than with me.
    ['the default is `fog` — Constantine, 2026-08-08, and a default is not an accident', MAP_MODE_DEFAULT === 'fog'],
    ['the ladder has three rungs, low to high', RUNGS.length === 3 && rungHeight(HIDDEN) === 0 && rungHeight(KNOWN) === 2],
  ];
  let modeOk = true;
  for (const [name, ok] of modeRows) {
    if (!ok) modeOk = false;
    console.log(`  ${ok ? 'HOLDS' : 'RED  '}  ${name}`);
  }

  const ok = shippedOk && allCaught && modeOk && unwatched === 0;
  console.log(`\n  ${ok ? 'PASS' : 'FAIL'} — ${PROPERTIES.length}/${PROPERTIES.length} properties hold on the shipped rule, `
    + `${table.slice(1).filter((r) => r.verdicts.some(Boolean)).length}/${table.length - 1} mutants caught, `
    + `${PROPERTIES.length - unwatched}/${PROPERTIES.length} properties observed red, ${modeRows.filter(([, o]) => o).length}/${modeRows.length} vocabulary rows hold`);
  console.log(`\n  BOUNDARY — arithmetic on generated graphs. NOTHING HERE WAS RENDERED: the ladder`);
  console.log(`  can be perfect while the stylesheet paints two rungs identically, and every row above`);
  console.log(`  stays green through that. \`node tools/mapfog.mjs\` (no flag) is the half that has`);
  console.log(`  opened a browser, and it compares the DOM's own set of nodes against this one.\n`);
  process.exit(ok ? 0 : 1);
}

/* ===================================================================== the
 * rendered half
 * ==================================================================== */

const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpConnect(url) {
  const ws = new WebSocket(url);
  let n = 1;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = n++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

// WHAT THE PAGE ACTUALLY HOLDS. Ids, not counts: two counts agreeing is not two
// sets agreeing, and the failure worth catching (the fog covers the wrong node)
// keeps the count identical.
const PROBE = `(() => {
  const s = document.querySelector('.map-scroll');
  if (!s) return { error: 'no .map-scroll' };
  const nodes = [...document.querySelectorAll('.map-node')];
  const idOf = (n) => n.dataset.node || null;
  return {
    mode: s.dataset.mapMode || null,
    drawn: nodes.map(idOf).filter(Boolean),
    known: nodes.filter((n) => n.classList.contains('k-known')).map(idOf),
    placed: nodes.filter((n) => n.classList.contains('k-placed')).map(idOf),
    reachable: nodes.filter((n) => n.classList.contains('reachable')).map(idOf),
    current: nodes.filter((n) => n.classList.contains('current')).map(idOf),
    visited: nodes.filter((n) => n.classList.contains('visited')).map(idOf),
    saidDrawn: Number(s.dataset.nodesDrawn),
    saidTotal: Number(s.dataset.nodesTotal),
    saidHidden: Number(s.dataset.nodesHidden),
    ground: !!document.querySelector('.map-fog-ground'),
    framing: s.dataset.framing || null,
  };
})()`;

async function runRendered() {
  printArtifactProvenance(useDist ? resolve(ROOT, 'dist/AshenSpire.html') : resolve(ROOT, 'index.html'), ROOT);
  const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
  if (!browserPath) { console.error('mapfog: no chromium found. Set CHROME=/path/to/chrome.'); process.exit(2); }

  const seeds = (argOf('--seeds') || 'FOG1,FOG2,FOG3').split(',').map((s) => s.trim()).filter(Boolean);
  const stepList = (argOf('--steps') || '1,3,5,7,9').split(',').map(Number).filter(Number.isInteger);
  const shape = { w: 390, h: 844, d: 3 }; // mobile decides — the shape Constantine looks at
  // TWO CELLS PER POSITION. It was three while the fork question was open — the
  // third posed the wider reading through `mapFogForks`. He answered on
  // 2026-08-08 and that flag is deleted, so asking for it here would pose a
  // state the build cannot be in and quietly measure the default twice.
  const MODE_CELLS = ['path', 'fog'];

  let base;
  let stop = () => {};
  if (useDist) {
    base = pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href;
  } else {
    const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8291), open: false });
    base = `http://127.0.0.1:${s.port}/index.html`;
    stop = () => s.server.close();
  }
  if (shotsDir) mkdirSync(resolve(ROOT, shotsDir), { recursive: true });

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'mapfog-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--hide-scrollbars'],
    timeoutMs: 20000,
  });
  const cdp = cdpConnect(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: true }, sessionId);
  const evaluate = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;

  console.log(`\nmapfog — ${useDist ? 'dist/AshenSpire.html' : 'source tree'} · ${shape.w}x${shape.h} · `
    + `${seeds.length} seed(s) x ${stepList.length} step(s) x ${MAP_MODES.length} mode(s)`
    + `${mutate ? '  ·  --mutate: the page\'s census is falsified after each mount' : ''}`
    + `${shotsDir ? `  ·  shots → ${shotsDir}` : ''}\n`);

  const findings = [];
  let cells = 0;
  const shots = [];

  for (const seed of seeds) {
    const graph = actGraph(seed);
    let prevDrawn = null;
    for (const steps of stepList) {
      // STEP 0 IS THE ACT AS IT OPENS — no move made, `run.path` empty. It is
      // the first of the frames Constantine asked to see and the only one
      // `?shotWalk` cannot pose, because a walk of zero steps is not a walk.
      const walk = steps === 0 ? [] : walkOf(graph, steps);
      if (steps > 0 && walk.length < steps) { console.log(`  (skipped ${seed}@${steps}: the act runs out at ${walk.length})`); continue; }
      const run = { path: walk, mapNodeId: walk.length ? walk[walk.length - 1] : null };

      for (const mode of MODE_CELLS) {
        const q = [
          'shot=map',
          `shotSeed=${encodeURIComponent(seed)}`,
          ...(steps > 0 ? [`shotWalk=${steps}`] : []),
          `shotSettings=${encodeURIComponent(JSON.stringify({ mapMode: mode }))}`,
        ];
        await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
        let up = false;
        for (let i = 0; i < 80; i++) {
          if (await evaluate(`document.querySelectorAll('.map-node').length > 0`)) { up = true; break; }
          await wait(120);
        }
        if (!up) { findings.push(`${seed}@${steps} ${mode}: the map never mounted`); continue; }
        await wait(400); // the camera settles on a ResizeObserver + a 120 ms backstop

        // THE MUTATION: make the page's published census contradict the DOM it
        // is describing. It touches ONLY the confession, so the drawn set this
        // tool compares is the real one — a census that can be falsified without
        // the cross-check noticing is a census nobody is reading.
        if (mutate) await evaluate(`(() => { const s = document.querySelector('.map-scroll');`
          + ` if (!s) return 0; s.dataset.nodesDrawn = String(Number(s.dataset.nodesDrawn) + 1); return 1; })()`);

        const r = await evaluate(PROBE);
        if (r && r.error) { findings.push(`${seed}@${steps} ${mode}: ${r.error}`); continue; }
        cells++;

        const expect = mapKnowledge({ graph, run, mode, reveal: false });
        const domSet = new Set(r.drawn);
        const label = `${seed}@${steps} ${mode}`;

        if (r.mode !== mode) findings.push(`${label}: the page says it is in '${r.mode}' mode`);
        // SET against SET.
        for (const id of expect.drawn) if (!domSet.has(id)) findings.push(`${label}: ${id} should be drawn and is not in the DOM`);
        for (const id of domSet) if (!expect.drawn.has(id)) findings.push(`${label}: ${id} is in the DOM and the ladder says it is fogged`);
        // The page's own confession against the DOM it describes.
        if (r.saidDrawn !== r.drawn.length) findings.push(`${label}: the screen says it drew ${r.saidDrawn} nodes and the DOM holds ${r.drawn.length}`);
        if (r.saidTotal !== Object.keys(graph.nodes).length) findings.push(`${label}: the screen says the act has ${r.saidTotal} nodes; the generator made ${Object.keys(graph.nodes).length}`);
        // The rungs, as classes.
        for (const id of expect.drawn) {
          const want = expect.rung.get(id);
          const has = r.known.includes(id) ? KNOWN : (r.placed.includes(id) ? PLACED : null);
          if (has !== want) findings.push(`${label}: ${id} is drawn as '${has}' and the ladder says '${want}'`);
        }
        // The two clauses of the ask that are visible from here.
        if (mode === 'fog') {
          if (!r.ground) findings.push(`${label}: fog mode drew no parchment ground`);
          if (!domSet.has(graph.bossId)) findings.push(`${label}: the boss is not on the board`);
          if (r.drawn.length >= r.saidTotal) findings.push(`${label}: fog covered nothing — ${r.drawn.length} of ${r.saidTotal} drawn`);
          // THE TRAIL CLAUSE, ON THE RENDERED PAGE — and the wider one under it,
          // which used to be checked only on the `+forks` cell and is now the
          // rule everywhere: nothing that was on the board comes off it.
          for (const id of run.path) if (!domSet.has(id)) findings.push(`${label}: ${id} is on the walked path and is not on the board`);
          if (prevDrawn) {
            for (const id of prevDrawn) if (!domSet.has(id)) findings.push(`${label}: ${id} was on the board earlier in this walk and has been fogged again`);
          }
          prevDrawn = domSet;
          console.log(`  ${label.padEnd(20)} drawn ${String(r.drawn.length).padStart(2)}/${r.saidTotal}`
            + `  known ${String(r.known.length).padStart(2)}  placed ${String(r.placed.length).padStart(2)}`
            + `  trail ${String(r.visited.length).padStart(2)}  next ${r.reachable.length}  framing:${r.framing}`);
        } else if (r.drawn.length !== r.saidTotal) {
          findings.push(`${label}: path mode drew ${r.drawn.length} of ${r.saidTotal} — path mode hides nothing`);
        }

        if (shotsDir) {
          const png = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
          const tag = mode;
          const name = `${String(steps).padStart(2, '0')}-${tag}-${seed}.png`;
          writeFileSync(resolve(ROOT, shotsDir, name), Buffer.from(png.data, 'base64'));
          shots.push(name);
        }
      }
    }
  }

  cdp.close();
  await dropBrowser();
  stop();

  if (shots.length) console.log(`\n  ${shots.length} shot(s) written to ${shotsDir}`);
  if (!cells) { console.error('\nmapfog: nothing swept — unknown, never a pass.'); process.exit(2); }

  if (mutate) {
    const caught = findings.some((f) => /says it drew/.test(f));
    console.log(`\n  --mutate: ${caught ? 'CAUGHT' : 'MISSED'} — the falsified census ${caught ? 'was reported' : 'went unnoticed'}`);
    process.exit(caught ? 0 : 2);
  }

  if (findings.length) {
    console.log(`\nFINDINGS (${findings.length}):`);
    for (const f of findings.slice(0, 40)) console.log(`  · ${f}`);
    if (findings.length > 40) console.log(`  … and ${findings.length - 40} more`);
  }
  console.log(`\nRESULT: ${cells} cell(s) swept, ${findings.length} finding(s).`);
  console.log(`\nBOUNDARY — headless Chromium, one Linux machine, ${shape.w}x${shape.h}, one act per seed, the`);
  console.log(`steps named on the command line. It proves WHICH NODES ARE IN THE DOM and that the`);
  console.log(`screen's own census agrees with them. It is silent on whether the fog READS as fog`);
  console.log(`(Sunna), on the parchment (a placeholder — Freja owns the plates), and on the`);
  console.log(`Sealstone Key's value under fog, which is a balance question and not a rendering one.\n`);
  process.exit(findings.length ? 1 : 0);
}

if (selftest) runSelftest();
else await runRendered();
