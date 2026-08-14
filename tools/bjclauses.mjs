#!/usr/bin/env node
// tools/bjclauses.mjs — re-derive Constantine's eight D17 map clauses against
// this tree. Bjorn, 2026-08-13. Reads the SOURCE TREE served by tools/serve.mjs.
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day the eight
// D17 map clauses are all GREEN on dev two syncs running, or the day a
// standing tool (mapfit/axisfit) absorbs its readings. It is a re-derivation
// instrument, not a gate — it asserts nothing about the MAP and exits 0 on any
// measured map.
//
// BUT A MEASURER STILL OWES A FLOOR (Bjorn, 2026-08-15). Vira's doors audit
// files this file under NO-KNOWN-BAD — an asserting tool with no observed red.
// Reading my own artifact, she is half right and the half that matters is the
// half I had wrong: it asserts nothing about the map, and it USED TO EXIT 0
// WHEN IT MEASURED NOTHING. Every cell could throw, `report()` would print
// `0/108 cells measured` under a confident header, and the exit code said fine.
// That is the eleven-instruments shape of 2026-08-08 — an instrument running
// dead and printing a plausible number — sitting in my own tree, and SOP 2's
// silence guard already names the verdict: an empty result is `unknown`, and
// unknown is never a pass.
//
// So there are now exactly two things this file can fail on, and neither is a
// claim about the game:
//   exit 2  NOTHING MEASURED — no cell yielded a reading
//   exit 1  a cell threw — printed BY NAME rather than buried in the JSON
// Both are observed by `--selftest`, which points a whole run at a copy of the
// tree whose map cannot mount. A check nobody has watched fail is `unknown`,
// including a check whose only job is to admit it read nothing.
//
// Per cell (?shot=map & seed & pose & shape & settings) it reads, off the DOM:
//   zoom (data-framing-zoom), framing fit/clipped, scroll travel both axes,
//   current-node centring error, reachable-on-screen census, per-edge |dy|/len,
//   computed styles of visited/current/reachable circles.
// Screenshots go to shots/.
//
// Usage: node tools/bjclauses.mjs /path/to/ashenspire [--quick]
//        node tools/bjclauses.mjs /path/to/tree --seeds BJORN1 --shapes 390x844
//        node tools/bjclauses.mjs --selftest        the two floors, observed

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Node >= 22 ships a global WebSocket; no dependency needed.

const __dirname = dirname(fileURLToPath(import.meta.url));
// argv[2] is the repo path — unless it is a flag. It used to be taken blind, so
// `--selftest` was resolved as a directory name and the run died on a path that
// was never a path. A positional read that cannot tell a flag from a tree is
// the same shape as a reader that cannot tell empty from missing.
const REPO = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : join(__dirname, '..'));
const QUICK = process.argv.includes('--quick');
const OUT = process.env.BJ_OUT || join(process.cwd(), 'bj-clauses-shots');
mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8264;

const argOf = (f, d = null) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SELFTEST = process.argv.includes('--selftest');
const SEEDS = (argOf('--seeds') || Array.from({ length: 12 }, (_, i) => `BJORN${i + 1}`).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const ALL_SHAPES = [
  { w: 390, h: 844, d: 3, name: '390x844' },
  { w: 360, h: 640, d: 2, name: '360x640' },
  { w: 412, h: 915, d: 2.6, name: '412x915' },
];
// Narrowing exists so the floors below are cheap enough to observe. A selftest
// nobody can afford to run is a selftest nobody runs.
const SHAPES = argOf('--shapes')
  ? argOf('--shapes').split(',').map((s) => s.trim()).filter(Boolean).map((n) => {
    const found = ALL_SHAPES.find((x) => x.name === n);
    if (!found) { console.error(`bjclauses: --shapes ${n} is not one of ${ALL_SHAPES.map((x) => x.name).join(', ')}`); process.exit(2); }
    return found;
  })
  : ALL_SHAPES;

function launchChrome(userDataDir) {
  return new Promise((res, rej) => {
    const child = spawn(CHROME, [
      '--headless', '--no-sandbox', '--disable-gpu', '--window-size=1440,860',
      '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--no-first-run', 'about:blank',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const onData = (d) => {
      err += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
      if (m) res({ child, wsUrl: m[1] });
    };
    child.stderr.on('data', onData);
    child.stdout.on('data', onData);
    child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-400)}`)), 12000);
  });
}

// PROBE — evaluated in the page after the map settles.
const PROBE = `(() => {
  const scroll = document.querySelector('.map-scroll');
  if (!scroll) return { err: 'no .map-scroll' };
  const d = scroll.dataset;
  const sr = scroll.getBoundingClientRect();
  const cs = getComputedStyle(document.documentElement);
  const uiZoom = Number(cs.getPropertyValue('--ui-zoom')) || 1;
  const inView = (r, pad) => r.right > sr.left - (pad||0) && r.left < sr.right + (pad||0)
    && r.bottom > sr.top - (pad||0) && r.top < sr.bottom + (pad||0);
  const fullyIn = (r) => r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5
    && r.top >= sr.top - 0.5 && r.bottom <= sr.bottom + 0.5;
  // current node centring
  let centring = null;
  const cur = scroll.querySelector('.map-node.current');
  if (cur) {
    const c = cur.querySelector('circle:not(.node-halo)').getBoundingClientRect();
    centring = {
      dx: (c.left + c.width / 2) - (sr.left + sr.width / 2),
      dy: (c.top + c.height / 2) - (sr.top + sr.height / 2),
    };
  }
  // reachable census
  const reach = [...scroll.querySelectorAll('.map-node.reachable')];
  const reachIn = reach.filter((g) => fullyIn(g.querySelector('circle:not(.node-halo)').getBoundingClientRect())).length;
  // edges — SVG-unit geometry off the attributes (zoom-independent)
  const edges = [...scroll.querySelectorAll('line.map-edge')].map((l) => {
    const dx = Math.abs(Number(l.getAttribute('x2')) - Number(l.getAttribute('x1')));
    const dy = Math.abs(Number(l.getAttribute('y2')) - Number(l.getAttribute('y1')));
    const len = Math.hypot(dx, dy);
    return { dx, dy, len, vert: len > 0 ? dy / len : 1 };
  });
  // styling — one sample each
  const style = {};
  const pick = (sel) => scroll.querySelector(sel);
  const circ = (g) => g && g.querySelector('circle:not(.node-halo)');
  const read = (g) => {
    const c = circ(g);
    if (!c) return null;
    const s = getComputedStyle(c);
    const gs = getComputedStyle(g);
    return { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth,
      strokeOpacity: s.strokeOpacity, opacity: gs.opacity, filter: gs.filter,
      animation: s.animationName };
  };
  style.plainVisited = read(pick('.map-node.visited:not(.current):not(.reachable)'));
  style.current = read(pick('.map-node.current'));
  style.reachable = read(pick('.map-node.reachable'));
  style.unvisited = read(pick('.map-node:not(.visited):not(.current):not(.reachable)'));
  const halo = pick('.map-node.reachable .node-halo');
  style.halo = halo ? { present: true, animation: getComputedStyle(halo).animationName } : { present: false };
  return {
    style,
    layout: document.documentElement.dataset.layout,
    uiZoom,
    mode: d.mapMode, framing: d.framing, framingMiss: d.framingMiss,
    zoom: Number(d.framingZoom), framingCount: d.framingCount,
    entranceEnds: d.entranceEnds, entranceMiss: d.entranceMiss,
    nodePx: d.nodePx, nodesDrawn: d.nodesDrawn, nodesTotal: d.nodesTotal,
    hx: scroll.scrollWidth - scroll.clientWidth,
    vy: scroll.scrollHeight - scroll.clientHeight,
    sl: scroll.scrollLeft, st: scroll.scrollTop,
    axis: scroll.getAttribute('data-scroll-axis'),
    why: scroll.getAttribute('data-scroll-axis-why'),
    centring, reachTotal: reach.length, reachFullyIn: reachIn,
    edges,
  };
})()`;

async function main() {
  // serve the source tree
  const { serve } = await import(pathToFileURL(join(REPO, 'tools', 'serve.mjs')).href);
  const s = await serve({ root: REPO, port: PORT, open: false });
  const base = `http://localhost:${s.port}/`;

  const profile = mkdtempSync(join(tmpdir(), 'bjclauses-'));
  const { child, wsUrl } = await launchChrome(profile);

  // minimal CDP client over the ws shim
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.rej(new Error(msg.error.message));
      else p.res(msg.result);
    }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, S);
  await send('Runtime.enable', {}, S);
  const evalIn = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };

  async function cell({ shape, seed, walk, settings, shotName }) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: true,
    }, S);
    const params = new URLSearchParams({ shot: 'map', shotSeed: seed });
    if (walk) params.set('shotWalk', String(walk));
    if (settings) params.set('shotSettings', JSON.stringify(settings));
    await send('Page.navigate', { url: `${base}?${params}` }, S);
    // settle: mount + recenter backstop (120ms) + raf
    await evalIn(`new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        const sc = document.querySelector('.map-scroll');
        if (sc && sc.dataset.framing && performance.now() - t0 > 400) return res(1);
        if (performance.now() - t0 > 5000) return res(0);
        requestAnimationFrame(tick);
      };
      tick();
    })`);
    const r = await evalIn(PROBE);
    if (shotName) {
      const shot = await send('Page.captureScreenshot', { format: 'png' }, S);
      writeFileSync(join(OUT, `${shotName}.png`), Buffer.from(shot.data, 'base64'));
    }
    return r;
  }

  const rows = [];
  const poses = QUICK ? [null, 6] : [null, 3, 6];
  for (const shape of SHAPES) {
    const seeds = shape.name === '390x844' ? SEEDS : (QUICK ? SEEDS.slice(0, 4) : SEEDS);
    for (const seed of seeds) {
      const walks = shape.name === '390x844' ? poses : [null, 4];
      for (const walk of walks) {
        const shotName = (seed === 'BJORN3' || seed === 'BJORN1')
          ? `${shape.name}_${seed}_${walk == null ? 'entrance' : 'walk' + walk}` : null;
        try {
          const r = await cell({ shape, seed, walk, shotName });
          rows.push({ shape: shape.name, seed, walk: walk || 0, ...r, edges: undefined, edgeStats: edgeStats(r.edges), styleSample: rows.length === 0 ? r.style : undefined });
          if (rows.length === 1) rows[0].style = r.style;
        } catch (e) {
          rows.push({ shape: shape.name, seed, walk: walk || 0, err: String(e.message).slice(0, 200) });
        }
      }
    }
  }

  // THE FLOOR, and it stands BEFORE the comparison cells on purpose: a run that
  // read nothing must say so and stop, not print seventy lines of confident
  // context above its emptiness. (release-shots learned the same lesson at its
  // own zero-shot gate; this is that gate, here.)
  const measured = rows.filter((r) => !r.err);
  const threw = rows.filter((r) => r.err);
  if (!measured.length) {
    console.error(`\nbjclauses: NOTHING MEASURED — ${rows.length} cell(s) attempted, every one failed to yield a reading.`);
    for (const r of threw.slice(0, 6)) console.error(`  ${r.shape} ${r.seed} walk${r.walk}: ${r.err}`);
    console.error('An empty measurement is unknown, and unknown is never a pass (SOP 2\'s silence guard).');
    console.error('This tool exiting 0 on a map that never mounted is the instrument running dead and');
    console.error('printing a plausible number — the shape eleven instruments took on 2026-08-08.');
    ws.close(); child.kill(); s.server.close();
    process.exit(2);
  }

  // one Fit-mode cell + one path-mode cell for comparison, 390x844
  const fitR = await cell({ shape: SHAPES[0], seed: 'BJORN3', walk: 6, settings: { mapZoom: 'Fit' }, shotName: '390x844_BJORN3_walk6_FIT' });
  const fitE = await cell({ shape: SHAPES[0], seed: 'BJORN3', walk: null, settings: { mapZoom: 'Fit' }, shotName: '390x844_BJORN3_entrance_FIT' });
  const pathR = await cell({ shape: SHAPES[0], seed: 'BJORN3', walk: 6, settings: { mapMode: 'path' }, shotName: '390x844_BJORN3_walk6_PATH' });

  writeFileSync(join(process.cwd(), 'clauses-raw.json'), JSON.stringify({ rows, fit: { walk: strip(fitR), entrance: strip(fitE) }, path: strip(pathR) }, null, 1));
  report(rows, fitR, fitE, pathR);

  ws.close(); child.kill(); s.server.close();

  // A cell that threw used to live only in the JSON nobody opens. My own
  // failure mode #2: a check nobody reads is not a check — make it fail, not
  // whisper. A partial read is a smaller confident number, which is the half a
  // zero-floor cannot catch.
  if (threw.length) {
    console.error(`\nbjclauses: ${threw.length} of ${rows.length} cell(s) yielded no reading — the numbers above are over ${measured.length}.`);
    for (const r of threw) console.error(`  ${r.shape} ${r.seed} walk${r.walk}: ${r.err}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// THE KNOWN-BAD. Two floors, and the door is a whole run against a real tree.
//
// The plant copies the repo, renames the map scrollport's class in the COPIED
// SOURCE, and runs this file as a program against that copy — so the break
// enters where the real input enters (serve() → chromium → the real page) and
// the probe fails for the reason a real broken map would fail it. Nothing is
// handed to `report()`.
// ---------------------------------------------------------------------------
async function selftest() {
  const { mkdtempSync: mkd, cpSync, rmSync, readFileSync: rf, writeFileSync: wf } = await import('node:fs');
  const { tmpdir: td } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const base = mkd(join(td(), 'bjclauses-selftest-'));
  const tree = join(base, 'planted');
  mkdirSync(tree, { recursive: true });
  for (const p of ['src', 'styles', 'tools', 'content', 'index.html']) cpSync(join(REPO, p), join(tree, p), { recursive: true });
  // The map's scrollport loses its class in the SOURCE the copy serves. The page
  // still boots; the probe finds no `.map-scroll` and every cell reads nothing —
  // which is exactly the state this tool used to call exit 0.
  // WHICH FILE BUILDS THE SCROLLPORT IS DERIVED, NOT TYPED. My first version
  // named `src/ui/screens/map.js` from memory; the class is authored in
  // `src/ui/components/mapboard.js`, and the plant's own "edited nothing" guard
  // is what told me — the guard doing exactly its job, in the file whose whole
  // subject is instruments that cannot fail. A hardcoded path here is also the
  // second copy: it would rot silently the day the markup moves.
  const { readdirSync: rd } = await import('node:fs');
  const walk = (d, out = []) => {
    for (const e of rd(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
  };
  const CLASS_RE = /class\s*=\s*(["'`])[^"'`]*\bmap-scroll\b/;
  const homes = walk(join(tree, 'src')).filter((f) => CLASS_RE.test(rf(f, 'utf8')));
  if (!homes.length) { console.error('bjclauses --selftest: no file constructs .map-scroll — the plant has nothing to break, which is itself a finding.'); return 2; }
  for (const mapFile of homes) {
    const before = rf(mapFile, 'utf8');
    const after = before.replace(/map-scroll/g, 'map-scroll-planted');
    if (after === before) { console.error(`bjclauses --selftest: the plant edited nothing in ${mapFile} — the plant is broken, not the tool.`); return 2; }
    wf(mapFile, after);
  }

  let out = ''; let code = 0;
  try {
    out = execFileSync(process.execPath, [join(tree, 'tools/bjclauses.mjs'), tree, '--quick', '--seeds', 'BJORN1', '--shapes', '390x844'],
      { cwd: tree, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000, env: { ...process.env, BJ_OUT: join(base, 'shots') } });
  } catch (e) { code = e.status ?? -1; out = `${e.stdout || ''}${e.stderr || ''}`; }
  rmSync(base, { recursive: true, force: true });

  const sawFloor = /NOTHING MEASURED/.test(out);
  const ok = sawFloor && code === 2;
  console.log(`bjclauses --selftest — 1 plant: the map's scrollport class renamed in a COPY of the real source.`);
  console.log(`  ${ok ? 'RED ok ' : 'GREEN  '} NOTHING MEASURED floor   exit ${code} (wanted 2)${sawFloor ? '' : '  — the floor never printed'}`);
  if (!ok) console.log(`         tail: ${out.trim().split('\n').slice(-4).join(' | ').slice(0, 300)}`);
  console.log('');
  if (!ok) { console.log('The floor did not fire. This tool may still exit 0 having read nothing.'); return 1; }
  console.log('DOOR: `node <planted copy>/tools/bjclauses.mjs <copy>` — a whole run, through serve(),');
  console.log('  chromium and the real page. The plant is a real edit to a real source file, and the');
  console.log('  probe fails for the reason a genuinely broken map would fail it.');
  console.log('NOT PASSED THROUGH: the build (this tool serves the source tree by design), and the');
  console.log('  PARTIAL floor (exit 1, a cell that threw) is not planted here — it shares the code path');
  console.log('  the zero floor exercises, and I am saying so rather than counting it twice.');
  console.log('BOUNDARY: this proves the tool can refuse. It proves nothing about the eight clauses —');
  console.log('  those are readings, and this file still asserts nothing about the map.');
  return 0;
}

function strip(r) { const { edges, ...rest } = r; return { ...rest, edgeStats: edgeStats(edges) }; }

function edgeStats(edges) {
  if (!edges || !edges.length) return null;
  const verts = edges.map((e) => e.vert).sort((a, b) => a - b);
  const lens = edges.map((e) => e.len).sort((a, b) => a - b);
  const med = (a) => a[Math.floor(a.length / 2)];
  return { n: edges.length, vertMedian: med(verts), vertWorst: verts[0], lenMedian: med(lens), lenMin: lens[0] };
}

function pct(n, d) { return d ? `${n}/${d}` : 'n/a'; }

function report(rows, fitR, fitE, pathR) {
  const ok = rows.filter((r) => !r.err);
  const at390 = ok.filter((r) => r.shape === '390x844');
  console.log(`\n==== BJ-CLAUSES at head ==== ${ok.length}/${rows.length} cells measured`);
  for (const shape of ['390x844', '360x640', '412x915']) {
    const sr = ok.filter((r) => r.shape === shape);
    if (!sr.length) continue;
    const ent = sr.filter((r) => r.walk === 0);
    const mid = sr.filter((r) => r.walk > 0);
    const worstHx = Math.max(...sr.map((r) => r.hx));
    const clipped = sr.filter((r) => r.framing === 'clipped');
    const zooms = sr.map((r) => r.zoom);
    console.log(`\n-- ${shape} · layout=${sr[0].layout} · uiZoom=${sr[0].uiZoom} · mode=${sr[0].mode}`);
    console.log(`   zoom: min ${Math.min(...zooms)} max ${Math.max(...zooms)}`);
    console.log(`   H travel: min ${Math.min(...sr.map((r) => r.hx))} max ${worstHx} px · V travel max ${Math.max(...sr.map((r) => r.vy))}`);
    console.log(`   exemption: axis=${sr[0].axis} why="${sr[0].why}"`);
    console.log(`   framing clipped: ${clipped.length}/${sr.length} (${clipped.map((r) => r.seed + '@' + r.walk + ':' + r.framingMiss + 'px').join(' ')})`);
    console.log(`   reachable fully on screen: ${sr.filter((r) => r.reachFullyIn === r.reachTotal).length}/${sr.length} cells all-in`);
    const cent = mid.filter((r) => r.centring);
    if (cent.length) {
      const err = cent.map((r) => Math.hypot(r.centring.dx, r.centring.dy)).sort((a, b) => a - b);
      console.log(`   centring error (mid-walk, css px): median ${err[Math.floor(err.length / 2)].toFixed(1)} max ${err[err.length - 1].toFixed(1)}`);
    }
    const es = sr.map((r) => r.edgeStats).filter(Boolean);
    if (es.length) {
      const vm = es.map((e) => e.vertMedian).sort((a, b) => a - b);
      const vw = es.map((e) => e.vertWorst).sort((a, b) => a - b);
      console.log(`   edge verticality |dy|/len: median-of-medians ${vm[Math.floor(vm.length / 2)].toFixed(3)} · worst ${vw[0].toFixed(3)} · median len ${es[0].lenMedian.toFixed(1)} SVG u`);
    }
  }
  console.log('\n-- styling sample (390x844 first cell):');
  console.log(JSON.stringify(at390[0] && at390[0].style, null, 1));
  console.log('\n-- Fit opt-in (BJORN3): entrance zoom', fitE.zoom, 'walk6 zoom', fitR.zoom, '· H travel', fitE.hx, '/', fitR.hx);
  console.log('-- path mode (BJORN3 walk6): zoom', pathR.zoom, '· H travel', pathR.hx, '· V travel', pathR.vy);
}

if (SELFTEST) process.exit(await selftest());
else main().catch((e) => { console.error(e); process.exit(1); });
