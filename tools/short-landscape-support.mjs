// tools/short-landscape-support.mjs — #27's short-wide combat composition.
//
// This is the focused browser door for the band below the ordinary combat
// composition and above the last height at which even the compact composition
// can keep its complete board on glass. It asserts both boundaries:
//
//   * at gateBelowH and above, the established wide composition remains;
//   * from shortWideMinH through gateBelowH - 1, the compact wide composition
//     owns the board and no upright refusal stands;
//   * below shortWideMinH, the refusal remains — a compact layout is not a
//     licence to draw a clipped board;
//   * a real resize crosses all three states and returns without stale data.
//
// The lower boundary is derived through the rendered CSS, not copied from
// balance.js: --derive forces only the composition attribute while sweeping
// every height at Text XL, then compares the first geometrically complete frame
// with balance.ui.uiScale.shortWideMinH. A tuning number that moves without its
// rendered premise therefore goes red in either direction.
//
// Usage
//   node tools/short-landscape-support.mjs
//   node tools/short-landscape-support.mjs --dist
//   node tools/short-landscape-support.mjs --shots DIR
//   node tools/short-landscape-support.mjs --selftest
//
// Exit 0 means every asserted source/artifact frame held; 1 is a finding; 2 is
// no browser, no board, or no derived boundary. Headless Chromium is not a real
// phone: moving browser chrome, OS gestures and platform fonts remain outside.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const REAL_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || REAL_ROOT);
const useDist = args.includes('--dist');
const shotsDir = argOf('--shots');
const quick = args.includes('--quick');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

if (args.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const cssAnchor = ":root[data-composition='short-wide'] .hand-area { height: 10rem; }";
  const minAnchor = '      shortWideMinH: 340,';
  const sourcePlants = [
    {
      name: 'the layout answer stops publishing the compact composition',
      file: 'src/main.js',
      find: "  document.documentElement.setAttribute('data-composition', compact ? 'short-wide' : 'standard');",
      replace: "  document.documentElement.setAttribute('data-composition', 'standard'); // plant: stale composition",
      expectRed: /FAIL .*844x344.*composition=standard/,
    },
    {
      name: 'the compact hand rules no longer answer the selected composition',
      file: 'styles/combat.css',
      find: cssAnchor,
      replace: ":root[data-composition='short-wide-plant'] .hand-area { height: 10rem; }",
      expectRed: /FAIL .*844x344.*geometry=/,
    },
    {
      name: 'live resize leaves the short-wide answer stale',
      file: 'src/main.js',
      find: "  window.addEventListener('resize', () => {",
      replace: "  window.addEventListener('resize-plant', () => {",
      expectRed: /FAIL live resize/,
    },
    {
      name: 'the refusal is lowered below the derived compact floor',
      file: 'src/content/balance.js',
      find: minAnchor,
      replace: '      shortWideMinH: 0, // plant: boundary no longer follows rendered premise',
      expectRed: /FAIL (?:derived lower boundary|below lower edge 844x339 keeps the refusal)/,
    },
  ];
  // The shipped door is the standalone byte itself. All four authored anchors
  // survive bundling exactly once, so selected-root plants enter at the bytes a
  // player opens instead of rebuilding inside doorplant's deliberately non-Git
  // scratch tree (buildversion correctly refuses to invent a commit there).
  const plants = useDist
    ? sourcePlants.map((plant) => ({ ...plant, file: 'dist/AshenSpire.html' }))
    : sourcePlants;
  const code = await doorSelftest({
    tool: 'short-landscape-support.mjs',
    args: ['--quick', ...(useDist ? ['--dist'] : [])],
    timeoutMs: 300000,
    extraCopy: useDist ? ['dist/AshenSpire.html'] : [],
    plants,
  });
  process.exit(code);
}

const browserCandidates = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
const browserPath = argOf('--browser') || browserCandidates.find((path) => existsSync(path));
if (!browserPath) {
  console.error('short-landscape-support: no Chromium found; set CHROME=/path/to/chrome');
  process.exit(2);
}

const { balance } = await import(`${pathToFileURL(join(ROOT, 'src/content/balance.js')).href}?short-wide=${Date.now()}`);
const ui = balance.ui.uiScale;
const configuredMin = ui.shortWideMinH;
const gateBelow = ui.gateBelowH;
if (!Number.isInteger(configuredMin) || !Number.isInteger(gateBelow) || configuredMin >= gateBelow) {
  console.error(`short-landscape-support: invalid bounds shortWideMinH=${configuredMin}, gateBelowH=${gateBelow}`);
  process.exit(2);
}

printArtifactProvenance(useDist ? join(ROOT, 'dist/AshenSpire.html') : join(ROOT, 'index.html'), ROOT);

function cdpConnect(url) {
  const ws = new WebSocket(url);
  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve: yes, reject: no } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? no(new Error(msg.error.message)) : yes(msg.result);
  });
  return {
    ready: new Promise((yes, no) => { ws.addEventListener('open', yes); ws.addEventListener('error', no); }),
    send(method, params = {}, sessionId) {
      const call = id++;
      return new Promise((yes, no) => {
        pending.set(call, { resolve: yes, reject: no });
        ws.send(JSON.stringify({ id: call, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

const READ = `(() => {
  const rect = (el) => el ? (() => { const r = el.getBoundingClientRect(); return {
    l: +r.left.toFixed(2), t: +r.top.toFixed(2), r: +r.right.toFixed(2), b: +r.bottom.toFixed(2),
    w: +r.width.toFixed(2), h: +r.height.toFixed(2)
  }; })() : null;
  const inside = (a, b, pad = .75) => !!a && !!b && a.l >= b.l - pad && a.r <= b.r + pad && a.t >= b.t - pad && a.b <= b.b + pad;
  const viewport = { l: 0, t: 0, r: innerWidth, b: innerHeight };
  const field = rect(document.querySelector('.field'));
  const handArea = rect(document.querySelector('.hand-area'));
  const hintBar = rect(document.querySelector('.hint-bar.hint-combat'));
  const overlaps = (a, b, pad = .75) => !!a && !!b && a.l < b.r - pad && a.r > b.l + pad && a.t < b.b - pad && a.b > b.t + pad;
  const controls = ['.end-turn', '.energy-orb', '.pile.draw', '.pile.discard'].map((sel) => {
    const el = document.querySelector(sel); const box = rect(el);
    let ownsCentre = false;
    if (el && box && box.w > 0 && box.h > 0) {
      const hit = document.elementFromPoint((box.l + box.r) / 2, (box.t + box.b) / 2);
      ownsCentre = !!hit && (hit === el || el.contains(hit));
    }
    return { sel, box, onGlass: inside(box, viewport), ownsCentre };
  });
  const cards = [...document.querySelectorAll('.hand .card')].map((el) => ({
    box: rect(el), onGlass: inside(rect(el), viewport), avoidsHint: !overlaps(rect(el), hintBar)
  }));
  const models = [...document.querySelectorAll('.combatant')].map((el) => ({
    who: el.classList.contains('player') ? 'player' : (el.querySelector('.nm')?.textContent || 'enemy'),
    box: rect(el), inField: inside(rect(el), field, 1.25), visible: getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'
  }));
  const topbar = rect(document.querySelector('.topbar.combat-hud'));
  const geometry = !!field && field.h >= 1 && controls.every((x) => x.onGlass && x.ownsCentre)
    && cards.length > 0 && cards.every((x) => x.onGlass && x.avoidsHint)
    && models.length >= 2 && models.every((x) => x.visible && x.inField)
    && inside(topbar, viewport);
  return {
    w: innerWidth, h: innerHeight, zoom: +(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom') || 1),
    layout: document.documentElement.dataset.layout || null,
    composition: document.documentElement.dataset.composition || null,
    short: document.documentElement.dataset.short || null,
    gate: !!document.querySelector('.upright-veil'),
    geometry, field, handArea, hintBar, topbar, controls, cards, models,
  };
})()`;

async function main() {
  let base;
  let stopServer = () => {};
  if (useDist) base = pathToFileURL(join(ROOT, 'dist/AshenSpire.html')).href;
  else {
    const served = await serve({ root: ROOT, port: Number(argOf('--port') || 8317), open: false });
    base = `http://127.0.0.1:${served.port}/index.html`;
    stopServer = () => served.server.close();
  }

  const launched = await launchBrowser({
    prefix: 'short-wide-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--hide-scrollbars'], timeoutMs: 20000,
  });
  const cdp = cdpConnect(launched.wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const ev = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'browser evaluation failed');
    return result.result.value;
  };
  const size = async (w, h) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 3, mobile: true }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await wait(320);
  };
  const navigate = async (settings, h = 344) => {
    await size(844, h);
    const q = `shot=combat&shotSettings=${encodeURIComponent(JSON.stringify(settings))}`;
    await cdp.send('Page.navigate', { url: `${base}?${q}` }, sessionId);
    for (let i = 0; i < 120; i++) {
      if (await ev(`!!document.querySelector('.combat .hand .card')`)) break;
      await wait(100);
    }
    await wait(700);
  };

  const findings = [];
  let checks = 0;
  const ok = (name, condition, detail) => {
    checks++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!condition) findings.push(`${name}${detail ? `: ${detail}` : ''}`);
  };
  const summarize = (r) => `composition=${r.composition} gate=${r.gate} geometry=${r.geometry} field=${r.field?.t}..${r.field?.b} (${r.field?.h}px) models=${r.models.map((m) => `${m.who}:${m.box?.t}..${m.box?.b}/${m.inField}`).join(',')} hint=${r.hintBar?.t}..${r.hintBar?.b} cards=${r.cards.map((c) => `${c.box?.t}..${c.box?.b}/${c.avoidsHint}`).join(',')}`;
  const expect = (label, r, composition, gate, geometry = true) => {
    ok(label, r.composition === composition && r.gate === gate && (geometry == null || r.geometry === geometry), summarize(r));
  };

  console.log(`\nshort-landscape-support — ${useDist ? 'standalone artifact' : ROOT}`);
  console.log(`  configured band: ${configuredMin}..${gateBelow - 1}px; standard resumes at ${gateBelow}px\n`);

  // Rendered derivation. Force the selected CSS composition after each resize,
  // remove only the refusal overlay, and ask the complete board geometry. This
  // is independent of shortWideMinH, so that number cannot grade itself.
  await navigate({ uiScale: 'auto', textSize: 'XL' }, Math.max(240, configuredMin - 4));
  let derivedMin = null;
  const ladderFrom = quick ? Math.max(340, configuredMin - 4) : 240;
  const ladderTo = quick ? configuredMin : gateBelow - 1;
  for (let h = ladderFrom; h <= ladderTo; h++) {
    await size(844, h);
    await ev(`document.documentElement.dataset.composition='short-wide'; document.documentElement.dataset.short='false'; document.querySelector('.upright-veil')?.remove(); true`);
    await wait(50);
    const r = await ev(READ);
    if (r.geometry) { derivedMin = h; break; }
  }
  if (derivedMin == null) {
    ok('derived lower boundary exists below gateBelowH', false, `none in ${ladderFrom}..${gateBelow - 1}`);
  } else {
    ok('derived lower boundary matches balance.ui.uiScale.shortWideMinH', derivedMin === configuredMin,
      `rendered first-safe=${derivedMin}px configured=${configuredMin}px`);
  }

  // The issue closes on a swept range, not on three representative numbers.
  // Reload to undo the forced derivation attributes, then drive every height in
  // the declared band through the real resize listener and real layout decider.
  // Quick mode keeps one cell so door plants stay fast; the delivery gate runs
  // the complete 340..464 range and names the first hole if monotonicity breaks.
  await navigate({ uiScale: 'auto', textSize: 'XL' }, configuredMin);
  const bandHeights = quick
    ? [configuredMin]
    : Array.from({ length: gateBelow - configuredMin }, (_, i) => configuredMin + i);
  const bandFailures = [];
  for (const h of bandHeights) {
    await size(844, h);
    const r = await ev(READ);
    if (r.composition !== 'short-wide' || r.gate || !r.geometry) {
      bandFailures.push(`${h}px ${summarize(r)}`);
    }
  }
  ok(`live 844-wide sweep owns every height ${configuredMin}..${gateBelow - 1}`,
    bandFailures.length === 0,
    bandFailures.length ? `${bandFailures.length} hole(s); first ${bandFailures[0]}` : `${bandHeights.length}/${bandHeights.length} complete`);

  const settingsRows = quick
    ? [{ uiScale: 'auto', textSize: 'XL', tag: 'Auto/Text XL' }]
    : [
        ...['S', 'M', 'L', 'XL'].map((textSize) => ({ uiScale: 'auto', textSize, tag: `Auto/Text ${textSize}` })),
        ...['s', 'm', 'l', 'xl'].map((uiScale) => ({ uiScale, textSize: 'XL', tag: `UI ${uiScale.toUpperCase()}/Text XL` })),
      ];
  for (const row of settingsRows) {
    await navigate({ uiScale: row.uiScale, textSize: row.textSize }, 344);
    for (const h of [344, 390, gateBelow - 1]) {
      await size(844, h);
      const r = await ev(READ);
      expect(`${row.tag} 844x${h}`, r, 'short-wide', false);
    }
  }

  await navigate({ uiScale: 'auto', textSize: 'XL' }, 344);
  if (configuredMin > 0) {
    await size(844, configuredMin);
    expect(`lower edge 844x${configuredMin}`, await ev(READ), 'short-wide', false);
    await size(844, configuredMin - 1);
    const below = await ev(READ);
    ok(`below lower edge 844x${configuredMin - 1} keeps the refusal`, below.composition === 'standard' && below.gate === true,
      summarize(below));
  } else {
    ok('lower edge is configured above zero', false, `shortWideMinH=${configuredMin}`);
  }
  await size(844, gateBelow);
  expect(`upper edge 844x${gateBelow}`, await ev(READ), 'standard', false, null);

  // One page, three resize states, then return. This specifically catches the
  // cached composition failure that a navigate-per-cell matrix cannot see.
  await navigate({ uiScale: 'auto', textSize: 'XL' }, 344);
  const first = await ev(READ);
  await size(844, gateBelow + 40);
  const middle = await ev(READ);
  await size(844, 344);
  const last = await ev(READ);
  ok('live resize short-wide -> standard -> short-wide',
    first.composition === 'short-wide' && !first.gate && middle.composition === 'standard' && !middle.gate
      && last.composition === 'short-wide' && !last.gate && last.geometry,
    `${first.composition}/${first.gate}/${first.geometry} -> ${middle.composition}/${middle.gate}/${middle.geometry} -> ${last.composition}/${last.gate}/${last.geometry}`);

  // The control outside the short band: ordinary desktop composition is byte-
  // and geometry-stable, rather than every frame being forced compact.
  await size(1200, 730);
  await cdp.send('Page.navigate', { url: `${base}?shot=combat`, }, sessionId);
  await wait(900);
  expect('desktop 1200x730 remains standard', await ev(READ), 'standard', false, null);

  if (shotsDir) {
    mkdirSync(resolve(shotsDir), { recursive: true });
    for (const [w, h, name] of [
      [1200, 730, '1200x730'],
      [844, 390, '844x390'],
      [844, 344, '844x344'],
      [844, configuredMin - 1, `844x${configuredMin - 1}-refusal`],
    ]) {
      await size(w, h);
      await wait(250);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      const out = join(resolve(shotsDir), `${name}.png`);
      writeFileSync(out, Buffer.from(shot.data, 'base64'));
      console.log(`  shot ${out}`);
    }
  }

  cdp.close();
  await launched.close();
  stopServer();
  if (!checks) {
    console.error('\nNOTHING MEASURED — unknown is not a pass');
    process.exit(2);
  }
  console.log(`\n${findings.length ? `FAIL — ${findings.length} finding(s) over ${checks} checks` : `PASS — ${checks} checks, 0 findings`}`);
  for (const finding of findings) console.log(`  - ${finding}`);
  process.exit(findings.length ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(2); });
