#!/usr/bin/env node
// tools/text-geometry.mjs — Law 4: Text size owns text, not component geometry.
//
// This gate enters through the real title screen, opens character customization,
// applies the product's canonical Text M and XL values, and measures rendered
// typography, the primary action, and a real class sprite at 390x844 and
// 412x915. It passes only when the type grows while the action floor and sprite
// stay unchanged and the action remains at least 44 px on glass.
//
// Usage:
//   node tools/text-geometry.mjs
//   node tools/text-geometry.mjs --artifact AshenSpire.html
//   node tools/text-geometry.mjs --shots docs/preview/text-geometry-source
//   node tools/text-geometry.mjs --selftest
//
// BOUNDARY: Current profile artwork, one Chromium engine, two phone-shaped
// viewports, the customization
// state, and Text M/XL. It does not judge copy wrapping, legibility, touch input,
// every control, or every sprite tier. Source ownership checks cover the other
// migrated floors; actionreach owns the wider responsive grid.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPageUrl, launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { balance } from '../src/content/balance.js';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const sourceCode = await doorSelftest({
    tool: 'text-geometry.mjs',
    // Browser source copies need the same verified art as the real checkout.
    extraCopy: ['assets', 'music', 'map-detail'],
    timeoutMs: 240000,
    plants: [
      {
        // The creation workspace's own control floor wins over ModalFoot
        // and supplies the visible Class-stage Next action's minimum height.
        name: 'the primary action floor follows root Text size again',
        file: 'styles/kit.css',
        find: '--cc-control-floor:max(48px,calc(48px / var(--ui-zoom,1)));',
        replace: '--cc-control-floor:4.8rem;',
        expectRed: /action floor changed with Text size/,
      },
      {
        name: 'enemy sprite dimensions are emitted as rem again',
        file: 'src/ui/enemyExpansionStage.js',
        find: 'root.style.cssText = `position:relative;width:${art.idleWidth * scale}px;height:190px;flex:none;overflow:visible`;',
        replace: 'root.style.cssText = `position:relative;width:${art.idleWidth * scale / 10}rem;height:19rem;flex:none;overflow:visible`;',
        expectRed: /enemy sprite geometry changed with Text size/,
      },
      {
        name: 'the customization class sprite returns to rem geometry',
        file: 'src/ui/assets.js',
        find: "frame.style.cssText = 'width:100%;height:100%;position:relative;';",
        replace: "frame.style.cssText = 'width:15rem;height:19rem;position:relative;';",
        expectRed: /class sprite geometry changed with Text size/,
      },
      // Customization and combat use separate sprite stages now; the class
      // plant above owns the customization figure, and combat bounds are also
      // measured independently at each Text size.
      {
        // Shared HUD quick-access tiles override the base IconButton size;
        // constrain that actual owner so Text XL's glyph cannot fit.
        name: 'the top-row IconButton becomes a hard ceiling around Text XL',
        file: 'styles/kit.css',
        find: '  width: var(--hud-quick-tile-size); height: var(--hud-quick-tile-size);\n  min-width: var(--hud-quick-tile-size); min-height: var(--hud-quick-tile-size);',
        replace: '  width: 12px; height: 12px;\n  min-width: 0; min-height: 0;',
        expectRed: /quick-nav button clips its Text XL glyph/,
      },
      {
        // #498: the Settings copy was rewritten (browser-baseline wording) and
        // both copy plants died patching the old sentence. Same intent at the
        // current copy: plant the overclaiming promise, expect the gate red.
        name: 'the Text size help copy promises a completed non-text sweep',
        // Since #1489 the row's words are content/source/uiStrings.csv's
        // settings.row.textSize (its `full` form), not a literal in settings.js.
        file: 'content/source/uiStrings.csv',
        find: "settings.row.textSize,,Text size,Scale interface text from the browser baseline. Auto follows the browser stylesheet; S/L/XL aid readability. Stacks with UI size.,",
        replace: "settings.row.textSize,,Text size,Scale interface text without resizing controls or artwork. M is default; L/XL aid readability. Stacks with UI size.,",
        expectRed: /text size setting overclaims non-text stability/,
      },
      {
        name: 'the ergonomic floor falls below 44 px on glass',
        file: 'styles/kit.css',
        find: '--cc-control-floor:max(48px,calc(48px / var(--ui-zoom,1)));',
        replace: '--cc-control-floor:calc(36px / var(--ui-zoom,1));',
        expectRed: /tap floor below 44px on glass/,
      },
    ],
  });
  if (sourceCode) process.exit(sourceCode);

  // Source plants prove the authored files are owned. These separate plants
  // modify only a copied shipped bundle, so artifact mode cannot borrow clean
  // ownership evidence from the checkout while the selected artifact is stale.
  process.exit(await doorSelftest({
    tool: 'text-geometry.mjs',
    args: ['--artifact', 'AshenSpire.html'],
    timeoutMs: 240000,
    extraCopy: ['AshenSpire.html'],
    plants: [
      {
        name: 'the shipped quick-nav row restores its rem-owned floor',
        file: 'AshenSpire.html',
        find: '.as-row {\n  display: flex; align-items: center; gap: 1.05rem;\n  width: 100%; min-height: var(--tap-floor);',
        replace: '.as-row {\n  display: flex; align-items: center; gap: 1.05rem;\n  width: 100%; min-height: 4.4rem;',
        expectRed: /artifact ownership seam missing: \.as-row/,
      },
      {
        name: 'the shipped overview switcher restores its rem-owned floor',
        file: 'AshenSpire.html',
        // Overview subjects now use Kit tabs, whose floor owns the switcher.
        find: '.as-tab, .modal-tab {\n  min-height: var(--tap-floor);',
        replace: '.as-tab, .modal-tab {\n  min-height: 4.4rem;',
        expectRed: /artifact ownership seam missing: \.as-tab/,
      },
      {
        name: 'the shipped Settings copy restores the broad non-text promise',
        file: 'AshenSpire.html',
        find: '"full":"Scale interface text from the browser baseline. Auto follows the browser stylesheet; S/L/XL aid readability. Stacks with UI size."',
        replace: '"full":"Scale interface text without resizing controls or artwork. M is default; L/XL aid readability. Stacks with UI size."',
        expectRed: /text size setting overclaims non-text stability/,
      },
    ],
  }));
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const artifactArg = argOf('--artifact');
const useDist = args.includes('--dist');
const artifact = artifactArg ? resolve(ROOT, artifactArg)
  : useDist ? resolve(ROOT, 'dist/AshenSpire.html') : null;
const shotBase = argOf('--shots');
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const browserPath = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const pair = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? pair.no(new Error(msg.error.message)) : pair.ok(msg.result);
  };
  return {
    ready: new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; }),
    send(method, params = {}, sessionId) {
      const call = ++id;
      return new Promise((ok, no) => {
        pending.set(call, { ok, no });
        ws.send(JSON.stringify({ id: call, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) {
    console.error('text-geometry: UNKNOWN — no Chrome/Chromium found; nothing was rendered.');
    return 2;
  }
  let server = null;
  let base;
  if (artifact) {
    if (!existsSync(artifact)) {
      console.error(`text-geometry: UNKNOWN — ${artifact} is absent; build first.`);
      return 2;
    }
    base = await buildPageUrl(artifact);
  } else {
    const served = await serve({ root: ROOT, port: 8274, open: false });
    server = served.server;
    base = `http://localhost:${served.port}/`;
  }

  let dropBrowser = async () => {};
  let cdp;
  try {
    const launched = await launchBrowser({
      prefix: 'text-geometry-', browser: browserPath,
      args: ['--allow-file-access-from-files', '--disable-background-timer-throttling'],
      timeoutMs: 15000,
    });
    dropBrowser = launched.close;
    cdp = connect(launched.wsUrl); await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);

    const evalIn = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
      return result.result.value;
    };
    const until = async (expression, label, timeout = 12000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await evalIn(expression).catch(() => false)) return;
        await wait(120);
      }
      throw new Error(`timed out waiting for ${label}`);
    };

    const pageUrl = (params) => {
      // This artwork geometry contract exercises Current's real class sprites;
      // configured Core intentionally renders foundation stand-ins instead.
      const url = new URL(base);
      url.searchParams.set('gameProfile', 'current');
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return url.href;
    };
    const values = { M: balance.ui.textSize.M, XL: balance.ui.textSize.XL };
    const viewports = [[390, 844], [412, 915]];
    const rows = {};
    let quickExtreme;
    for (const [width, height] of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: true,
      }, sessionId);
      const viewport = `${width}x${height}`;
      rows[viewport] = {};
      for (const [key, value] of Object.entries(values)) {
        await cdp.send('Page.navigate', { url: pageUrl({ shot: 'title' }) }, sessionId);
        await until(`!!document.querySelector('[data-title-action="new"]')`, `${viewport} Text ${key} title action`);
        for (const action of ['new', 'modal-continue', 'review-new']) {
          await until(`!!document.querySelector('[data-title-action="${action}"]')`, `${viewport} ${action} door`);
          await evalIn(`document.querySelector('[data-title-action="${action}"]').click(); true`);
        }
        await until(`!!document.querySelector('#cz-start') && !!document.querySelector('.class-sprite')`, `${viewport} Text ${key} customization geometry`);
        await evalIn(`document.documentElement.style.fontSize=${JSON.stringify(value)}; true`);
        await wait(650);
        const action = await evalIn(`(() => {
          const n = (v) => +Number(v).toFixed(2);
          const action = document.querySelector('#cz-next');
          const ar = action.getBoundingClientRect();
          const classSprite = document.querySelector('.class-sprite');
          const cr = classSprite.getBoundingClientRect();
          const classCss = getComputedStyle(classSprite);
          return {
            font: n(parseFloat(getComputedStyle(action).fontSize)),
            actionMinH: n(parseFloat(getComputedStyle(action).minHeight)),
            actionW: n(ar.width), actionH: n(ar.height),
            classW: n(cr.width), classH: n(cr.height),
            classCssW: n(parseFloat(classCss.width)), classCssH: n(parseFloat(classCss.height)),
            layout: document.documentElement.dataset.layout || '',
          };
        })()`);
        if (shotBase) {
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
          const path = resolve(ROOT, `${shotBase}-${key.toLowerCase()}-${viewport}.png`);
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, Buffer.from(shot.data, 'base64'));
        }
        await cdp.send('Page.navigate', { url: pageUrl({ shot: 'combat', shotClass: 'starseer' }) }, sessionId);
        await until(`!!document.querySelector('.combatant.enemy .sprite > :first-child') && !!document.querySelector('.combatant.player .sprite > :first-child')`, `${viewport} Text ${key} combat sprites`);
        await evalIn(`document.documentElement.style.fontSize=${JSON.stringify(value)}; true`);
        await wait(300);
        const sprite = await evalIn(`(() => {
          const n = (v) => +Number(v).toFixed(2);
          const read = (selector, prefix) => {
            const el = document.querySelector(selector);
            const rect = el.getBoundingClientRect();
            const css = getComputedStyle(el);
            return {
              [prefix + 'W']: n(rect.width), [prefix + 'H']: n(rect.height),
              [prefix + 'CssW']: n(parseFloat(css.width)), [prefix + 'CssH']: n(parseFloat(css.height)),
            };
          };
          return {
            ...read('.combatant.enemy .sprite > :first-child', 'enemy'),
            ...read('.combatant.player .sprite > :first-child', 'player'),
          };
        })()`);
        rows[viewport][key] = { ...action, ...sprite };
      }
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    const quickSettings = JSON.stringify({ textSize: 'XL', uiScale: 'XL', tapFloor: '24', quickNav: 'mirror' });
    await cdp.send('Page.navigate', { url: pageUrl({ shot: 'map', shotSettings: quickSettings }) }, sessionId);
    await until(`!!document.querySelector('.topbar .topbar-btn')`, '1920x1080 tap 24 + Text XL + UI XL quick-nav button');
    await wait(300);
    quickExtreme = await evalIn(`(() => {
      const n = (v) => +Number(v).toFixed(2);
      const el = document.querySelector('.topbar .topbar-btn');
      const rect = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
      return {
        quickW: n(rect.width), quickH: n(rect.height),
        quickClientW: n(el.clientWidth * zoom), quickClientH: n(el.clientHeight * zoom),
        quickScrollW: n(el.scrollWidth * zoom), quickScrollH: n(el.scrollHeight * zoom),
        quickFont: n(parseFloat(css.fontSize) * zoom), quickZoom: n(zoom),
      };
    })()`);

    const close = (a, b) => Math.abs(a - b) <= 0.5;
    const failures = [];
    // Normalize only for source-ownership comparisons. Git may materialize the
    // same tracked text as LF or CRLF; ownership must follow tokens, not the
    // checkout's newline convention. The browser still renders the untouched
    // file bytes above, so this cannot make a bad product state look green.
    const normalizeLines = (text) => text.replace(/\r\n?/g, '\n');
    const selectedArtifact = artifact ? normalizeLines(readFileSync(artifact, 'utf8')) : null;
    const ownershipKind = selectedArtifact ? 'artifact' : 'source';
    // Kit owns the visible Class-stage Next action's workspace control floor,
    // shared HUD quick-access tile sizes, quick-nav rows and overview tabs.
    // Read those same authored rules from the selected artifact when shipped.
    const kit = selectedArtifact ?? normalizeLines(readFileSync(resolve(ROOT, 'styles/kit.css'), 'utf8'));
    const assets = selectedArtifact ?? readFileSync(resolve(ROOT, 'src/ui/assets.js'), 'utf8');
    const enemyStage = selectedArtifact ?? readFileSync(resolve(ROOT, 'src/ui/enemyExpansionStage.js'), 'utf8');
    // The Text size row's note is the `full` form of settings.row.textSize in
    // content/source/uiStrings.csv (#1489 moved it out of settings.js); the
    // artifact carries the same sentence in its generated table.
    const settings = selectedArtifact ?? readFileSync(resolve(ROOT, 'content/source/uiStrings.csv'), 'utf8');
    if (!kit.includes('--cc-control-floor:max(48px,calc(48px / var(--ui-zoom,1)));')) failures.push(`${ownershipKind} ownership seam missing: creation control floor`);
    // Quick-nav rows and overview tabs now share the Kit atoms. The legacy
    // ui.css copies no longer own their floors.
    for (const seam of [
      '.as-row {\n  display: flex; align-items: center; gap: 1.05rem;\n  width: 100%; min-height: var(--tap-floor);',
      '.as-tab, .modal-tab {\n  min-height: var(--tap-floor);',
    ]) {
      if (!kit.includes(seam)) failures.push(`${ownershipKind} ownership seam missing: ${seam}`);
    }
    for (const seam of [
      '  width: var(--hud-quick-tile-size); height: var(--hud-quick-tile-size);\n  min-width: var(--hud-quick-tile-size); min-height: var(--hud-quick-tile-size);',
    ]) {
      if (!kit.includes(seam)) failures.push(`${ownershipKind} ownership seam missing (kit): ${seam}`);
    }
    if (!enemyStage.includes('root.style.cssText = `position:relative;width:${art.idleWidth * scale}px;height:190px;flex:none;overflow:visible`;')) failures.push(`${ownershipKind} ownership seam missing: enemy sprite fixed px geometry`);
    if (!assets.includes("frame.style.cssText = 'width:100%;height:100%;position:relative;';")) failures.push(`${ownershipKind} ownership seam missing: painted class sprite fills its fixed well`);
    // #498: this pinned the pre-rework copy after the Text-size rework shipped
    // the browser-baseline wording in both settings.js and the built artifact,
    // so the check could only fail — masked in CI because the `tests` job died
    // at the music-parity step before reaching this gate. It pins the CURRENT
    // shipped copy now, with the same shape as before: the exact honest note,
    // and a refusal of the overclaiming promise however the rest is worded.
    const honestTextSizeNote = "Scale interface text from the browser baseline. Auto follows the browser stylesheet; S/L/XL aid readability. Stacks with UI size.";
    if (!settings.includes(honestTextSizeNote)
      || /Scale interface text without resizing controls or artwork/.test(settings)) {
      failures.push('text size setting overclaims non-text stability: state only what the setting does, and never promise untouched controls or artwork');
    }

    for (const [viewport, profile] of Object.entries(rows)) {
      const { M, XL } = profile;
      if (!(XL.font > M.font + 1)) failures.push(`${viewport}: type did not grow from M ${M.font}px to XL ${XL.font}px`);
      if (M.actionH < 43.5 || XL.actionH < 43.5) {
        failures.push(`${viewport}: tap floor below 44px on glass: M ${M.actionH}px, XL ${XL.actionH}px`);
      }
      if (!close(M.actionMinH, XL.actionMinH)) {
        failures.push(`${viewport}: action floor changed with Text size: M ${M.actionMinH}px, XL ${XL.actionMinH}px`);
      }
      for (const [name, prefix] of [['class', 'class'], ['player', 'player'], ['enemy', 'enemy']]) {
        for (const [size, measurement] of Object.entries({ M, XL })) {
          if (!['W', 'H', 'CssW', 'CssH'].every((suffix) => Number.isFinite(measurement[`${prefix}${suffix}`]) && measurement[`${prefix}${suffix}`] > 0)) {
            failures.push(`${viewport}: ${name} sprite has no measurable geometry at Text ${size}`);
          }
        }
        if (!close(M[`${prefix}W`], XL[`${prefix}W`]) || !close(M[`${prefix}H`], XL[`${prefix}H`])
          || !close(M[`${prefix}CssW`], XL[`${prefix}CssW`]) || !close(M[`${prefix}CssH`], XL[`${prefix}CssH`])) {
          failures.push(`${viewport}: ${name} sprite geometry changed with Text size: M rendered ${M[`${prefix}W`]}×${M[`${prefix}H`]}px / CSS ${M[`${prefix}CssW`]}×${M[`${prefix}CssH`]}px, XL rendered ${XL[`${prefix}W`]}×${XL[`${prefix}H`]}px / CSS ${XL[`${prefix}CssW`]}×${XL[`${prefix}CssH`]}px`);
        }
      }
    }
    if (quickExtreme.quickW + 0.5 < quickExtreme.quickFont || quickExtreme.quickH + 0.5 < quickExtreme.quickFont) {
      failures.push(`1920x1080: quick-nav button clips its Text XL glyph: ${quickExtreme.quickW}×${quickExtreme.quickH}px button around ${quickExtreme.quickFont}px glyph at UI zoom ${quickExtreme.quickZoom}`);
    }
    if (quickExtreme.quickScrollW > quickExtreme.quickClientW + 0.5 || quickExtreme.quickScrollH > quickExtreme.quickClientH + 0.5) {
      failures.push(`1920x1080: quick-nav button clips its Text XL glyph: scroll ${quickExtreme.quickScrollW}×${quickExtreme.quickScrollH}px exceeds client ${quickExtreme.quickClientW}×${quickExtreme.quickClientH}px at UI zoom ${quickExtreme.quickZoom}`);
    }

    console.log(`text-geometry — ${artifact ? `artifact ${artifact}` : 'source'}`);
    for (const [viewport, profile] of Object.entries(rows)) {
      console.log(`  ${viewport}`);
      for (const [key, r] of Object.entries(profile)) {
        console.log(`    Text ${key}: font ${r.font}px · action ${r.actionW}×${r.actionH}px (floor ${r.actionMinH}px) · class ${r.classW}×${r.classH}px · player ${r.playerW}×${r.playerH}px · enemy ${r.enemyW}×${r.enemyH}px · ${r.layout}`);
      }
    }
    console.log(`  1920x1080 · tap 24 + Text XL + UI XL: quick-nav ${quickExtreme.quickW}×${quickExtreme.quickH}px around ${quickExtreme.quickFont}px glyph · client ${quickExtreme.quickClientW}×${quickExtreme.quickClientH}px · scroll ${quickExtreme.quickScrollW}×${quickExtreme.quickScrollH}px · ui zoom ${quickExtreme.quickZoom}`);
    if (shotBase) console.log(`  screenshots: ${shotBase}-{m,xl}-{390x844,412x915}.png`);
    if (failures.length) {
      for (const failure of failures) console.error(`  RED — ${failure}`);
      return 1;
    }
    console.log('  GREEN — Text XL grows type; named non-text rects stay within 0.5 px and the action remains at least 44 px on glass.');
    return 0;
  } catch (error) {
    console.error(`text-geometry: UNKNOWN — ${error.message}`);
    return 2;
  } finally {
    if (cdp) cdp.close();
    await dropBrowser();
    if (server) server.close();
  }
}

process.exit(await main());
