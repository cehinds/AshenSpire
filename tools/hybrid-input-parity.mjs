#!/usr/bin/env node
// tools/hybrid-input-parity.mjs — same-door acceptance for AshenSpire #204.
//
// The approved combat hybrid already has pointer-drag coverage. This instrument
// asks the complementary question through a real Chromium page: do mouse,
// keyboard, and a standard-mapping controller reach the same one-commit combat
// outcomes, and do Cancel / Previous / Next act on the real targeting and focus
// state? It starts from the product's public input doors. The gamepad is a
// standard-mapping navigator.getGamepads() device whose real polling loop reads
// rising/falling button edges; no input module function is called directly.
//
// Usage:
//   node tools/hybrid-input-parity.mjs
//   node tools/hybrid-input-parity.mjs --only 390x844
//   node tools/hybrid-input-parity.mjs --screenshots
//   node tools/hybrid-input-parity.mjs --standalone --screenshots
//   node tools/hybrid-input-parity.mjs --artifact-parity  # only after shared artifacts may move
//   CHROME=/path/to/chrome node tools/hybrid-input-parity.mjs
//
// Exit 0 = every measured cell held; 1 = a product finding; 2 = nothing was
// measured / browser or fixture failure. Generated root/build/dist artifacts
// are deliberately outside this lane until #201/#203/#37 sequencing clears.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : null; };
const only = argOf('--only');
const screenshots = args.includes('--screenshots');
const standalone = args.includes('--standalone');
const artifactParity = args.includes('--artifact-parity');
const evidenceDoor = standalone ? 'root standalone' : 'source';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonicalLfBytes = (bytes) => {
  const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  return Buffer.from(text.replace(/\r\n?/g, '\n'), 'utf8');
};
const gitBlobOid = (bytes) => {
  const canonical = canonicalLfBytes(bytes);
  return createHash('sha1')
    .update(Buffer.from(`blob ${canonical.length}\0`, 'utf8'))
    .update(canonical)
    .digest('hex');
};
const canonicalIdentity = (bytes) => {
  const canonical = canonicalLfBytes(bytes);
  return {
    canonicalLfSha256: sha256(canonical),
    gitBlobOidSha1: gitBlobOid(canonical),
  };
};
// Every authored product path whose bytes can change the outcomes/geometry in
// this evidence. Keep the list in the manifest itself as well as the hashes:
// a patch identity that omits a decisive stylesheet can make a bad layout and
// its correction look like the same reviewed product.
const PRODUCT_PATHS = [
  'src/ui/components/flask.js',
  'src/ui/components/overlay.js',
  'src/ui/components/quicknav.js',
  'src/ui/input.js',
  'src/ui/screens/combat.js',
  'src/ui/screens/equipment.js',
  'styles/ui.css',
];
const TOOL_PATH = 'tools/hybrid-input-parity.mjs';
const lines = (file, ...rows) => {
  const bytes = readFileSync(join(ROOT, file), 'utf8');
  for (const eol of ['\r\n', '\n']) {
    const candidate = rows.join(eol);
    if (bytes.includes(candidate)) return candidate;
  }
  return rows.join(bytes.includes('\r\n') ? '\r\n' : '\n');
};

if (args.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const wantedPlant = argOf('--plant');
  const sourcePlants = [{
      name: 'contextual flask rows regress to a local 44px floor under body zoom',
      file: 'styles/ui.css',
      find: '  width: 100%; min-height: var(--tap-floor); height: auto;',
      replace: '  width: 100%; min-height: 44px; height: auto; /* planted: local rather than device-pixel floor */',
      expectRed: /FAIL keyboard Crimson menu rows retain the 44 device-pixel floor/,
    }, {
      name: 'same-flask activation closes and immediately reopens its menu',
      file: 'src/ui/components/flask.js',
      find: lines('src/ui/components/flask.js', '  if (activeFlaskActionMenu?.anchor === anchor) {',
        '    closeFlaskActionMenu({ cancelled: true, restoreFocus: true });', '    return null;', '  }'),
      replace: '  /* planted: same-flask activation falls through and reopens */',
      expectRed: /FAIL same-flask re-click toggles off and restores its exact anchor/,
    }, {
      name: 'trusted outside click leaves the contextual flask menu standing',
      file: 'src/ui/components/flask.js',
      find: "  document.addEventListener('click', onDocumentClick, true);",
      replace: '  /* planted: no trusted click-away listener */',
      expectRed: /FAIL trusted outside click closes the flask menu without stealing focus/,
    }, {
      name: 'competing menu surface opens over a stale flask menu',
      edits: [{
        file: 'src/ui/components/overlay.js',
        find: '  closeFlaskActionMenu({ cancelled: true });',
        replace: '  /* planted: competing menu leaves flask menu standing */',
      }, {
        file: 'src/ui/components/flask.js',
        find: lines('src/ui/components/flask.js', '  const onDocumentClick = (ev) => {',
          '    const target = ev.target;',
          '    if (root.contains(target) || anchor === target || anchor.contains(target)) return;'),
        replace: lines('src/ui/components/flask.js', '  const onDocumentClick = (ev) => {',
          '    const target = ev.target;',
          "    if (target.closest?.('#combat-menu')) return; // planted: competing control is exempt from click-away",
          '    if (root.contains(target) || anchor === target || anchor.contains(target)) return;'),
      }],
      expectRed: /FAIL competing Menu surface closes the flask menu before it opens/,
    }, {
      name: 'playCard commit door records a duplicate cardPlayed event',
      file: 'src/ui/screens/combat.js',
      find: "      out = dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: targetId || undefined });",
      replace: "      out = dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: targetId || undefined });\n      combat.eventLog.push({ type: 'cardPlayed', cardInstanceId: instanceId }); // planted: duplicate commit receipt",
      expectRed: /FAIL held controller Confirm fires one activation and one multi-target commit/,
    }, {
      name: 'controller self Cancel leaves stale self targeting armed',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '        const cancelledSelf = selfArm;', '        selected = null;', '        selectedFlask = null;', '        selfArm = null;'),
      replace: lines('src/ui/screens/combat.js', '        const cancelledSelf = selfArm;', '        selected = null;', '        selectedFlask = null;', '        /* planted: stale self target remains armed */'),
      expectRed: /FAIL controller self Cancel spends nothing, clears targeting, and restores the exact card focus/,
    }, {
      name: 'all-enemy controller Confirm is restored to the false self-target arm',
      file: 'src/ui/screens/combat.js',
      find: "      } else if (ev.isTrusted || dragTargetMode === 'all') {",
      replace: '      } else if (ev.isTrusted) {',
      expectRed: /FAIL controller multi-target Confirm commits once without a false self target/,
    }, {
      name: 'keyboard Escape leaves the selected card armed',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', "    if (ev.key === 'Escape') {", '      if (selected || selectedFlask != null || selfArm) {', '        const cancelledSelf = selfArm;', '        selected = null;'),
      replace: lines('src/ui/screens/combat.js', "    if (ev.key === 'Escape') {", '      if (selected || selectedFlask != null || selfArm) {', '        const cancelledSelf = selfArm;', '        /* planted: selected card not cleared */'),
      expectRed: /FAIL keyboard Escape spends nothing and clears selection\/targetables/,
    }, {
      name: 'single-target selection no longer moves focus to a legal enemy',
      file: 'src/ui/screens/combat.js',
      find: lines('src/ui/screens/combat.js', '        render();', '        if (selected) focusTargeting();'),
      replace: lines('src/ui/screens/combat.js', '        render();', '        /* planted: focusTargeting omitted */'),
      expectRed: /FAIL controller Confirm arms and moves real focus to a legal enemy/,
    }, {
      name: 'controller self card no longer arms the player confirmation',
      file: 'src/ui/screens/combat.js',
      find: '    selfArm = selfArm === instanceId ? null : instanceId;',
      replace: '    selfArm = null; // planted: blue self-confirm arm omitted',
      expectRed: /FAIL controller self card arms the player blue and moves real focus/,
    }, {
      name: 'pager activation drops the remembered card cursor',
      file: 'src/ui/screens/combat.js',
      find: "    if (at < 0 && handPageCursor) at = cards.findIndex((card) => card.dataset.instanceId === handPageCursor);",
      replace: '    /* planted: remembered page cursor omitted */',
      expectRed: /FAIL keyboard Next\/Previous follows exact hand order and wraps/,
    }, {
      name: 'top-bar flask anchors are removed from the unified cursor',
      file: 'src/ui/input.js',
      find: "(el) => visible(el) && (inModal || el.matches('.flask-slot') || !(el.closest && el.closest(CHROME)))",
      replace: '(el) => visible(el) && (inModal || !(el.closest && el.closest(CHROME)))',
      expectRed: /FAIL keyboard Crimson menu opens on Use and arrows to Inspect/,
    }, {
      name: 'D-pad menu movement no longer synchronizes DOM focus',
      file: 'src/ui/input.js',
      find: lines('src/ui/input.js', "    if (el.closest && el.closest('[role=\"menu\"]') && document.activeElement !== el", "      && typeof el.focus === 'function') el.focus();"),
      replace: '    /* planted: menu DOM focus is not synchronized */',
      expectRed: /FAIL controller Azure menu opens on Use and D-pad moves to Inspect/,
    }, {
      name: 'Home and End leave the unified cursor on the old flask row',
      file: 'src/ui/components/flask.js',
      find: lines('src/ui/components/flask.js', "    else if (ev.key === 'Home') {", '      ev.preventDefault();',
        '      const first = buttons[0];', '      first?.focus();', '      focusElement(first);',
        "    } else if (ev.key === 'End') {", '      ev.preventDefault();', '      const last = buttons.at(-1);',
        '      last?.focus();', '      focusElement(last);', '    }'),
      replace: lines('src/ui/components/flask.js', "    else if (ev.key === 'Home') { ev.preventDefault(); buttons[0]?.focus(); }",
        "    else if (ev.key === 'End') { ev.preventDefault(); buttons.at(-1)?.focus(); }"),
      expectRed: /FAIL keyboard Home\/End keep DOM focus and the unified cursor aligned/,
    }, {
      name: 'targeted flask use no longer moves the cursor to a legal enemy',
      file: 'src/ui/screens/combat.js',
      find: '          if (selectedFlask != null) focusTargeting();',
      replace: '          /* planted: targeted flask cursor handoff omitted */',
      expectRed: /FAIL keyboard Blight Use enters real enemy targeting/,
    }, {
      name: 'pad poller bypasses the standard navigator gamepad door',
      file: 'src/ui/input.js',
      find: '  const pads = navigator.getGamepads ? navigator.getGamepads() : [];',
      replace: '  const pads = globalThis.__parityPad ? [globalThis.__parityPad] : []; // planted: fake direct source',
      expectRed: /timeout waiting for pad button .* observed/,
    }].filter((plant) => !wantedPlant || plant.name.includes(wantedPlant));
  const geometryPlants = [{
    name: 'Text XL battlefield intent obstructs the visible combat flask centres',
    file: 'styles/ui.css',
    find: lines('styles/ui.css', '.combat .topbar.combat-hud {', '  position: relative;', '  z-index: 2;', '}'),
    replace: lines('styles/ui.css', '.combat .topbar.combat-hud {', '  position: relative;', '  z-index: 0; /* planted: battlefield may cover HUD controls */', '}'),
    expectRed: /FAIL every captured interaction state keeps measured control centres hittable/,
  }].filter((plant) => !wantedPlant || plant.name.includes(wantedPlant));
  const packagingPlants = [{
    name: 'standalone evidence capture serializes the full inlined BODY text',
    file: 'tools/hybrid-input-parity.mjs',
    find: "    return value.length > 240 ? value.slice(0, 239) + '\\u2026' : value;",
    replace: '    return value; // planted: unbounded document text reaches the manifest',
    expectRed: /hybrid-input-parity-root-manifest\.json refuses .* field\(s\) above 4096 bytes/,
  }].filter((plant) => !wantedPlant || plant.name.includes(wantedPlant));
  const artifactPlants = [{
    name: 'standalone artifact reopens the old controller multi false-self behavior',
    file: 'AshenSpire.html',
    find: "      } else if (ev.isTrusted || dragTargetMode === 'all') {",
    replace: '      } else if (ev.isTrusted) { /* planted only in selected standalone artifact */',
    expectRed: /FAIL controller multi-target Confirm commits once without a false self target/,
  }].filter((plant) => !wantedPlant || plant.name.includes(wantedPlant));
  const provenancePlants = [{
    name: 'manifest verifier is blind to stale exact-head product bytes',
    file: 'styles/ui.css',
    append: '/* planted: reviewed HEAD has product bytes absent from both manifests */',
    expectRed: /manifest canonical identity mismatch for styles\/ui\.css/,
  }, {
    name: 'manifest verifier hashes checkout-specific raw EOL bytes',
    file: TOOL_PATH,
    find: "  return Buffer.from(text.replace(/\\r\\n?/g, '\\n'), 'utf8');",
    replace: "  return Buffer.from(text, 'utf8'); // planted: checkout EOL leaks into identity",
    expectRed: /canonical LF normalization is checkout-EOL invariant/,
  }].filter((plant) => !wantedPlant || plant.name.includes(wantedPlant));
  if (wantedPlant && sourcePlants.length === 0 && geometryPlants.length === 0
    && packagingPlants.length === 0 && artifactPlants.length === 0 && provenancePlants.length === 0) {
    console.error(`unknown --plant filter: ${wantedPlant}`);
    process.exit(2);
  }
  if (sourcePlants.length) {
    const sourceStatus = await doorSelftest({
      tool: 'hybrid-input-parity.mjs',
      args: ['--only', '390x844'],
      timeoutMs: 180000,
      extraCopy: ['AshenSpire.html'],
      plants: sourcePlants,
    });
    if (sourceStatus) process.exit(sourceStatus);
  }
  if (geometryPlants.length) {
    const geometryStatus = await doorSelftest({
      tool: 'hybrid-input-parity.mjs',
      args: ['--only', '320x640', '--screenshots'],
      timeoutMs: 240000,
      extraCopy: ['AshenSpire.html'],
      plants: geometryPlants,
    });
    if (geometryStatus) process.exit(geometryStatus);
  }
  if (packagingPlants.length) {
    const packagingStatus = await doorSelftest({
      tool: 'hybrid-input-parity.mjs',
      args: ['--standalone', '--only', '320x640', '--screenshots'],
      timeoutMs: 240000,
      extraCopy: ['AshenSpire.html', 'dist', 'buildordinal.json'],
      plants: packagingPlants,
    });
    if (packagingStatus) process.exit(packagingStatus);
  }
  if (artifactPlants.length) {
    const artifactStatus = await doorSelftest({
      tool: 'hybrid-input-parity.mjs',
      args: ['--standalone', '--only', '390x844'],
      timeoutMs: 180000,
      extraCopy: ['AshenSpire.html', 'dist'],
      plants: artifactPlants,
    });
    if (artifactStatus) process.exit(artifactStatus);
  }
  if (provenancePlants.length) {
    const provenanceStatus = await doorSelftest({
      tool: 'hybrid-input-parity.mjs',
      args: ['--verify-manifests'],
      timeoutMs: 30000,
      extraCopy: ['docs', 'AshenSpire.html', 'buildordinal.json'],
      includePng: true,
      plants: provenancePlants,
    });
    if (provenanceStatus) process.exit(provenanceStatus);
  }
  process.exit(0);
}
function gitText(argv) {
  const result = spawnSync('git', argv, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function manifestPatchBasis() {
  const inGit = gitText(['rev-parse', '--is-inside-work-tree']) === 'true';
  if (!inGit) {
    return { patchBaseRef: 'COPY_DOOR_NO_GIT_BASE', productPatchSha256: null };
  }
  const base = spawnSync('git', ['merge-base', 'origin/dev', 'HEAD'], {
    cwd: ROOT, encoding: 'utf8', windowsHide: true,
  });
  if (base.status !== 0 || !/^[0-9a-f]{40}$/i.test((base.stdout || '').trim())) {
    throw new Error(`manifest basis refused: cannot resolve merge-base origin/dev HEAD (exit ${base.status})`);
  }
  const patchBaseRef = base.stdout.trim();
  const patch = spawnSync('git', ['diff', '--binary', patchBaseRef, '--', ...PRODUCT_PATHS], {
    cwd: ROOT, encoding: null, windowsHide: true,
  });
  if (patch.status !== 0 || !Buffer.isBuffer(patch.stdout)) {
    throw new Error(`manifest basis refused: git diff from ${patchBaseRef} failed (exit ${patch.status})`);
  }
  return { patchBaseRef, productPatchSha256: sha256(patch.stdout) };
}

function verifyManifestIdentity() {
  let failed = 0;
  const verify = (ok, label, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
  };
  const lfProbe = canonicalIdentity(Buffer.from('alpha\nbeta\n', 'utf8'));
  const crlfProbe = canonicalIdentity(Buffer.from('alpha\r\nbeta\r\n', 'utf8'));
  verify(JSON.stringify(lfProbe) === JSON.stringify(crlfProbe),
    'canonical LF normalization is checkout-EOL invariant', JSON.stringify({ lfProbe, crlfProbe }));

  const names = ['hybrid-input-parity-manifest.json', 'hybrid-input-parity-root-manifest.json'];
  const manifests = [];
  for (const name of names) {
    const path = join(ROOT, 'docs', 'preview', name);
    if (!existsSync(path)) {
      verify(false, `${name} exists`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifests.push({ name, manifest });
    verify(manifest.schemaVersion === 2, `${name} uses canonical identity schema 2`);
    verify(JSON.stringify(manifest.productPaths) === JSON.stringify(PRODUCT_PATHS),
      `${name} declares the complete authored product path set`);
    for (const file of PRODUCT_PATHS) {
      const actual = canonicalIdentity(readFileSync(join(ROOT, file)));
      const recorded = manifest.sourceFiles?.[file];
      verify(JSON.stringify(recorded) === JSON.stringify(actual),
        `manifest canonical identity mismatch for ${file}`,
        JSON.stringify({ recorded, actual, manifest: name }));
    }
    const actualTool = canonicalIdentity(readFileSync(join(ROOT, TOOL_PATH)));
    verify(manifest.toolFile?.path === TOOL_PATH
      && JSON.stringify(manifest.toolFile?.identity) === JSON.stringify(actualTool),
    `manifest canonical identity mismatch for ${TOOL_PATH}`,
    JSON.stringify({ recorded: manifest.toolFile, actual: actualTool, manifest: name }));
    const imageRows = [...(manifest.contactSheets || []), ...(manifest.evidence || [])]
      .filter((row) => row.filename && row.sha256);
    for (const row of imageRows) {
      const imagePath = join(ROOT, 'docs', 'preview', row.filename);
      const bytes = existsSync(imagePath) ? readFileSync(imagePath) : null;
      verify(Boolean(bytes) && bytes.length === row.bytes && sha256(bytes) === row.sha256,
        `${name} binds image ${row.filename}`);
    }
    if (manifest.standaloneArtifact) {
      const artifactPath = join(ROOT, manifest.standaloneArtifact.path);
      const bytes = existsSync(artifactPath) ? readFileSync(artifactPath) : null;
      verify(Boolean(bytes) && bytes.length === manifest.standaloneArtifact.bytes
        && sha256(bytes) === manifest.standaloneArtifact.sha256,
      `${name} binds exact standalone artifact ${manifest.standaloneArtifact.path}`);
      const ordinalPath = join(ROOT, manifest.standaloneArtifact.buildOrdinalPath);
      verify(existsSync(ordinalPath)
        && JSON.stringify(canonicalIdentity(readFileSync(ordinalPath)))
          === JSON.stringify(manifest.standaloneArtifact.buildOrdinalIdentity),
      `${name} binds exact build ordinal metadata`);
    }
  }

  if (manifests.length === 2) {
    const [source, root] = manifests.map(({ manifest }) => manifest);
    verify(source.patchBaseRef === root.patchBaseRef && source.productPatchSha256 === root.productPatchSha256,
      'source and root manifests bind the same patch base and product patch');
    verify(JSON.stringify(source.sourceFiles) === JSON.stringify(root.sourceFiles)
      && JSON.stringify(source.toolFile) === JSON.stringify(root.toolFile),
    'source and root manifests bind identical canonical product/tool identities');
  }

  const head = gitText(['rev-parse', 'HEAD']);
  const tree = gitText(['rev-parse', 'HEAD^{tree}']);
  if (head && tree) {
    const dirty = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', ...PRODUCT_PATHS, TOOL_PATH], {
      cwd: ROOT, windowsHide: true,
    });
    verify(dirty.status === 0, 'exact-head product/tool paths match the checked-out Git commit');
    for (const file of [...PRODUCT_PATHS, TOOL_PATH]) {
      const blob = spawnSync('git', ['show', `HEAD:${file}`], { cwd: ROOT, windowsHide: true, encoding: null });
      verify(blob.status === 0 && JSON.stringify(canonicalIdentity(blob.stdout))
        === JSON.stringify(canonicalIdentity(readFileSync(join(ROOT, file)))),
      `exact HEAD canonical Git blob matches ${file}`);
    }
    const expectedBase = gitText(['merge-base', 'origin/dev', 'HEAD']);
    verify(Boolean(expectedBase) && manifests.length === 2
      && manifests.every(({ manifest }) => manifest.patchBaseRef === expectedBase),
    'manifests bind the verified origin/dev merge-base', JSON.stringify({ expectedBase }));
    if (expectedBase && manifests.length === 2) {
      const patch = spawnSync('git', ['diff', '--binary', expectedBase, 'HEAD', '--', ...PRODUCT_PATHS], {
        cwd: ROOT, encoding: null, windowsHide: true,
      });
      const expectedPatch = patch.status === 0 && Buffer.isBuffer(patch.stdout) ? sha256(patch.stdout) : null;
      verify(Boolean(expectedPatch)
        && manifests.every(({ manifest }) => manifest.productPatchSha256 === expectedPatch),
      'manifests bind the verified product diff from their recorded base',
      JSON.stringify({ expectedPatch, diffExit: patch.status }));
    }
    console.log(`EXACT HEAD ${head}`);
    console.log(`EXACT TREE ${tree}`);
  } else {
    console.log('COPY DOOR — Git HEAD/tree receipt unavailable; canonical file/manifests were still verified');
  }
  console.log(failed ? `MANIFEST VERIFY RED — ${failed} finding(s)` : 'MANIFEST VERIFY GREEN');
  return failed ? 1 : 0;
}

if (args.includes('--verify-manifests')) {
  process.exit(verifyManifestIdentity());
}

const SHAPES = [[320, 640], [390, 844], [1200, 730]];
const REQUIRED_SOURCE_STATES = [
  'ready',
  'mouse-armed', 'mouse-confirm',
  'keyboard-armed', 'keyboard-confirm', 'keyboard-cancel-restored',
  'controller-armed', 'controller-confirm', 'controller-cancel-restored',
  'paging-before', 'paging-next', 'paging-return',
  'controller-multi', 'controller-self', 'controller-self-cancel-restored',
  'keyboard-crimson-charge-menu', 'controller-azure-charge-menu',
  'keyboard-blight-target', 'controller-blight-target',
  'flask-menu-open', 'flask-menu-toggle-closed', 'flask-menu-outside-closed',
  'flask-menu-competing-closed', 'flask-menu-switched',
];
const BROWSERS = [
  argOf('--browser'), process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome',
].filter(Boolean);
const browserPath = BROWSERS.find((path) => existsSync(path));
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

function cdpConnect(url) {
  const ws = new WebSocket(url); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolveCall, rejectCall } = pending.get(message.id); pending.delete(message.id);
    if (message.error) rejectCall(new Error(message.error.message)); else resolveCall(message.result);
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      ws.addEventListener('open', resolveReady); ws.addEventListener('error', rejectReady);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolveCall, rejectCall });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

const PAD_SHIM = `(() => {
  const makeButton = () => ({ pressed: false, touched: false, value: 0 });
  const pad = {
    id: 'AshenSpire parity standard pad', index: 0, connected: true,
    mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 18 }, makeButton), vibrationActuator: null,
  };
  globalThis.__parityPadReads = 0;
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true, value: () => {
      globalThis.__parityPadReads++;
      return [pad, null, null, null];
    },
  });
  Object.defineProperty(globalThis, '__parityPad', { configurable: true, value: pad });
})()`;

const STATE = `(() => {
  const combat = window.__combat;
  const focus = document.querySelector('.gp-focus');
  const cardText = (node) => (node && node.textContent || '').replace(/\\s+/g, ' ').trim();
  const cards = [...document.querySelectorAll('.hand .card')].map((node, index) => ({
    index, id: node.dataset.instanceId || null, text: cardText(node),
    selected: node.classList.contains('selected'), focus: node.classList.contains('gp-focus'),
    unaffordable: node.classList.contains('unaffordable'),
  }));
  const plays = (combat && combat.eventLog || []).filter((event) => event.type === 'cardPlayed');
  const active = document.activeElement;
  const menu = document.querySelector('.flask-action-menu');
  return {
    cards,
    plays: plays.length,
    lastPlay: plays.length ? plays[plays.length - 1] : null,
    discard: combat ? combat.piles.discard.length : null,
    exhaust: combat ? combat.piles.exhaust.length : null,
    energy: combat ? combat.player.energy : null,
    player: combat ? { hp: combat.player.hp, block: combat.player.block, statuses: structuredClone(combat.player.statuses || {}) } : null,
    enemies: combat ? combat.enemies.map((enemy) => ({ id: enemy.id, hp: enemy.hp, block: enemy.block, alive: enemy.alive, statuses: structuredClone(enemy.statuses || {}) })) : [],
    flaskCharges: combat ? structuredClone(combat.player.flaskCharges || {}) : {},
    flasks: combat ? combat.player.flasks.map((flask) => ({ flaskId: flask.flaskId, charges: flask.charges ?? null })) : [],
    selected: cards.filter((card) => card.selected).map((card) => card.id),
    targetable: [...document.querySelectorAll('.combatant.enemy.targetable')].map((node) => node.dataset.eid),
    playerArmed: !!document.querySelector('.combatant.player.armed'),
    aimEnemy: [...document.querySelectorAll('.combatant.enemy.aiming')].map((node) => node.dataset.eid),
    aimPlayer: !!document.querySelector('.combatant.player.aiming'),
    focus: focus ? {
      tag: focus.tagName, id: focus.id || null, classes: focus.className,
      instanceId: focus.dataset.instanceId || null, eid: focus.dataset.eid || null,
      parityAnchor: focus.dataset.parityAnchor || null,
      flaskAction: focus.dataset.flaskAction || null,
      text: cardText(focus).slice(0, 80),
    } : null,
    active: active ? {
      tag: active.tagName, classes: active.className || '',
      parityAnchor: active.dataset?.parityAnchor ?? null,
      flaskSlot: active.dataset?.flaskSlot ?? null,
      flaskAction: active.dataset?.flaskAction ?? null,
      text: cardText(active).slice(0, 80),
    } : null,
    menu: menu ? {
      label: menu.getAttribute('aria-label'),
      actions: [...menu.querySelectorAll('[data-flask-action]')].map((node) => ({
        id: node.dataset.flaskAction,
        enabled: node.getAttribute('aria-disabled') === 'false',
        active: node === active,
      })),
    } : null,
    pad: {
      reads: globalThis.__parityPadReads || 0,
      mapping: globalThis.__parityPad?.mapping || null,
    },
  };
})()`;

// A screenshot proves pixels; this parallel record binds those pixels to the
// real focus/AX/geometry state that produced them. The manifest intentionally
// describes the source worktree as a patch over a base ref until the shared
// generated artifacts are allowed to move after #206.
const EVIDENCE_READING = `(() => {
  const visible = (node) => {
    if (!node) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const accessibleName = (node) => {
    if (!node) return '';
    const labelledBy = node.getAttribute('aria-labelledby');
    const labelled = labelledBy
      ? labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ')
      : '';
    const value = (node.getAttribute('aria-label') || labelled || node.getAttribute('title') || node.textContent || '')
      .replace(/\\s+/g, ' ').trim();
    // A standalone page inlines the full game script under <body>. BODY can be
    // the active element, but its complete text is not an accessible control
    // name: serializing it repeated the 3.2 MiB bundle into every evidence row.
    // Preserve explicit control names whole; deterministically summarize only
    // pathological document/container text before it reaches the manifest.
    return value.length > 240 ? value.slice(0, 239) + '\u2026' : value;
  };
  const describe = (node) => {
    if (!visible(node)) return null;
    const rect = node.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      tag: node.tagName.toLowerCase(),
      role: node.getAttribute('role') || (node.tagName === 'BUTTON' ? 'button' : null),
      name: accessibleName(node),
      classes: String(node.className || '').replace(/\\s+/g, ' ').trim(),
      rect: {
        left: +rect.left.toFixed(2), top: +rect.top.toFixed(2),
        right: +rect.right.toFixed(2), bottom: +rect.bottom.toFixed(2),
        width: +rect.width.toFixed(2), height: +rect.height.toFixed(2),
      },
      onGlass: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      centerHit: !!hit && (node === hit || node.contains(hit)),
      centerHitBy: hit ? {
        tag: hit.tagName.toLowerCase(),
        classes: String(hit.className || '').replace(/\\s+/g, ' ').trim(),
        name: accessibleName(hit),
      } : null,
      tap44: Math.min(rect.width, rect.height) >= 44,
    };
  };
  const modal = document.querySelector('.modal-veil');
  const interactionSelector = [
    '.hand-prev', '.hand-next', '.end-turn', '.hand .card.gp-focus', '.hand .card.selected',
    '.combatant.enemy.targetable', '.combatant.player.armed',
    '.flask-slot', '[role="menuitem"]', '.flask-action-menu button',
  ].join(',');
  // Once a modal owns the interaction surface, obscured combat controls are
  // correctly non-hittable. Measure the active modal controls instead of
  // falsely treating intentional modality as an obstruction regression.
  const interactionScope = modal && visible(modal) ? modal : document;
  const interactive = [...interactionScope.querySelectorAll(interactionSelector)].filter(visible).map(describe);
  return {
    viewport: { width: innerWidth, height: innerHeight },
    focus: describe(document.querySelector('.gp-focus')),
    active: describe(document.activeElement),
    interactive,
    allNamed: interactive.every((row) => !!row.name),
    allOnGlass: interactive.every((row) => row.onGlass),
    allCenterHit: interactive.every((row) => row.centerHit),
    allTap44: interactive.every((row) => row.tap44),
  };
})()`;

const cleanTargeting = (state) => state.selected.length === 0 && state.targetable.length === 0
  && !state.playerArmed && state.aimEnemy.length === 0 && !state.aimPlayer;

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge found; pass --browser or set CHROME');
  const served = await serve({ root: ROOT, port: 8299, open: false });
  const base = `http://127.0.0.1:${served.port}/index.html`;
  const launched = await launchBrowser({ prefix: 'hybrid-parity-', browser: browserPath, timeoutMs: 20000 });
  const cdp = cdpConnect(launched.wsUrl); await cdp.ready;
  let findings = 0; let checks = 0; let measured = 0;
  const evidence = [];
  const contactSheets = [];
  const concise = args.includes('--concise');
  const check = (value, label, detail = '') => {
    checks++;
    const showDetail = detail && (!concise || !value);
    console.log(`    ${value ? 'PASS' : 'FAIL'} ${label}${showDetail ? ` — ${detail}` : ''}`);
    if (!value) findings++;
    return value;
  };

  try {
    for (const [width, height] of SHAPES) {
      const shape = `${width}x${height}`;
      if (only && only !== shape) continue;
      measured++;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PAD_SHIM }, sessionId);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: width < 700,
      }, sessionId);

      const ev = async (expression) => {
        const out = await cdp.send('Runtime.evaluate', {
          expression, awaitPromise: true, returnByValue: true,
        }, sessionId);
        if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || 'page evaluation failed');
        return out.result.value;
      };
      const until = async (expression, label, timeoutMs = 20000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          if (await ev(expression).catch(() => false)) return;
          await wait(100);
        }
        throw new Error(`${shape}: timeout waiting for ${label}`);
      };
      const openCombat = async ({ artifact = standalone, textSize = 'M' } = {}) => {
        const settings = encodeURIComponent(JSON.stringify({ textSize }));
        const page = artifact ? 'AshenSpire.html' : 'index.html';
        await cdp.send('Page.navigate', { url: `${base.replace(/index\.html$/, page)}?shot=combat&shotSettings=${settings}` }, sessionId);
        await until(`!!document.querySelector('.combat .hand .card') && !!window.__parityPad`, 'combat + gamepad shim');
        await wait(350);
      };
      const state = () => ev(STATE);
      const key = async (keyName) => {
        const code = /^[1-9]$/.test(keyName) ? `Digit${keyName}` : keyName === 'Enter' ? 'Enter'
          : keyName === 'Escape' ? 'Escape' : keyName;
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code }, sessionId);
        await wait(35);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code }, sessionId);
        await wait(120);
      };
      const pad = async (button, pollTicks = 2) => {
        const reads = await ev('window.__parityPadReads');
        await ev(`(() => { const b=window.__parityPad.buttons[${button}]; b.pressed=true; b.touched=true; b.value=1; window.__parityPad.timestamp++; })()`);
        await until(`window.__parityPadReads >= ${reads + pollTicks}`, `pad button ${button} observed for ${pollTicks} poll ticks`, 3000);
        await ev(`(() => { const b=window.__parityPad.buttons[${button}]; b.pressed=false; b.touched=false; b.value=0; window.__parityPad.timestamp++; })()`);
        await until(`window.__parityPadReads >= ${reads + pollTicks + 1}`, `pad button ${button} release observed`, 3000);
        await wait(100);
        return (await ev('window.__parityPadReads')) - reads;
      };
      const point = (selector) => ev(`(() => {
        const node=document.querySelector(${JSON.stringify(selector)}); if(!node)return null;
        node.scrollIntoView({block:'center',inline:'center'});
        const r=node.getBoundingClientRect();
        const x=r.left+r.width/2, y=r.top+r.height/2;
        return {x,y,hit:document.elementFromPoint(x,y)?.closest(${JSON.stringify(selector)})===node};
      })()`);
      const tap = async (selector) => {
        const at = await point(selector); if (!at || !at.hit) return false;
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
        await wait(35);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
        await wait(180); return true;
      };
      const card = async (pattern) => ev(`(() => { const rx=new RegExp(${JSON.stringify(pattern)},'i'); const nodes=[...document.querySelectorAll('.hand .card')]; const node=nodes.find((item)=>rx.test(item.textContent)); return node ? {index:nodes.indexOf(node),id:node.dataset.instanceId,text:(node.textContent||'').replace(/\\s+/g,' ').trim()} : null; })()`);
      const cardKey = (index) => index < 9 ? String(index + 1) : 'q';
      const focusCard = async (instanceId, mode) => {
        for (let i = 0; i < 28; i++) {
          const current = await state();
          if (current.focus && current.focus.instanceId === instanceId) return true;
          const direction = await ev(`(() => {
            const target=document.querySelector('.hand .card[data-instance-id="${instanceId}"]');
            const cursor=document.querySelector('.gp-focus');
            if(!target)return null;
            if(!cursor)return {button:15,key:'ArrowRight'};
            const tr=target.getBoundingClientRect(), cr=cursor.getBoundingClientRect();
            const dx=(tr.left+tr.width/2)-(cr.left+cr.width/2);
            const dy=(tr.top+tr.height/2)-(cr.top+cr.height/2);
            if(Math.abs(dy)>Math.abs(dx)*0.7)return dy<0?{button:12,key:'ArrowUp'}:{button:13,key:'ArrowDown'};
            return dx<0?{button:14,key:'ArrowLeft'}:{button:15,key:'ArrowRight'};
          })()`);
          if (!direction) return false;
          if (mode === 'keyboard') await key(direction.key);
          else await pad(direction.button);
        }
        return false;
      };
      const focusCardWithPad = (instanceId) => focusCard(instanceId, 'controller');
      const focusCardWithKeys = (instanceId) => focusCard(instanceId, 'keyboard');
      const focusClass = async (className, mode) => {
        for (let i = 0; i < 32; i++) {
          const current = await state();
          if (current.focus && current.focus.classes.includes(className)) return true;
          const direction = await ev(`(() => {
            const target=document.querySelector('.${className}');
            const cursor=document.querySelector('.gp-focus');
            if(!target)return null;
            if(!cursor)return {button:15,key:'ArrowRight'};
            const tr=target.getBoundingClientRect(), cr=cursor.getBoundingClientRect();
            const dx=(tr.left+tr.width/2)-(cr.left+cr.width/2);
            const dy=(tr.top+tr.height/2)-(cr.top+cr.height/2);
            if(Math.abs(dy)>Math.abs(dx)*0.55)return dy<0?{button:12,key:'ArrowUp'}:{button:13,key:'ArrowDown'};
            return dx<0?{button:14,key:'ArrowLeft'}:{button:15,key:'ArrowRight'};
          })()`);
          if (!direction) return false;
          if (mode === 'keyboard') await key(direction.key); else await pad(direction.button);
        }
        return false;
      };
      const focusClassWithKeys = (className) => focusClass(className, 'keyboard');
      const focusClassWithPad = (className) => focusClass(className, 'controller');
      const focusTextWithKeys = async (pattern, keyName = 'ArrowRight') => {
        const rx = new RegExp(pattern, 'i');
        for (let i = 0; i < 24; i++) {
          const current = await state();
          if (current.focus && rx.test(current.focus.text)) return true;
          await key(keyName);
        }
        return false;
      };
      const focusTextWithPad = async (pattern, button = 15) => {
        const rx = new RegExp(pattern, 'i');
        for (let i = 0; i < 24; i++) {
          const current = await state();
          if (current.focus && rx.test(current.focus.text)) return true;
          await pad(button);
        }
        return false;
      };
      const focusAnchor = async (marker, mode) => {
        for (let i = 0; i < 40; i++) {
          const current = await state();
          if (current.focus?.parityAnchor === marker) return true;
          const direction = await ev(`(() => {
            const target=document.querySelector('[data-parity-anchor="${marker}"]');
            const cursor=document.querySelector('.gp-focus');
            if(!target)return null;
            if(!cursor)return {button:15,key:'ArrowRight'};
            const tr=target.getBoundingClientRect(), cr=cursor.getBoundingClientRect();
            const dx=(tr.left+tr.width/2)-(cr.left+cr.width/2);
            const dy=(tr.top+tr.height/2)-(cr.top+cr.height/2);
            if(Math.abs(dy)>Math.abs(dx)*0.55)return dy<0?{button:12,key:'ArrowUp'}:{button:13,key:'ArrowDown'};
            return dx<0?{button:14,key:'ArrowLeft'}:{button:15,key:'ArrowRight'};
          })()`);
          if (!direction) return false;
          if (mode === 'keyboard') {
            await key(direction.key);
          } else {
            await pad(direction.button);
          }
        }
        return false;
      };
      const oneCommit = (before, after, id) => after.plays === before.plays + 1
        && after.lastPlay && after.lastPlay.cardInstanceId === id;
      const gameplay = (value) => JSON.stringify({
        plays: value.plays, discard: value.discard, exhaust: value.exhaust, energy: value.energy,
        player: value.player, enemies: value.enemies, flaskCharges: value.flaskCharges, flasks: value.flasks,
      });
      const enemyById = (value, id) => value.enemies.find((enemy) => enemy.id === id);
      const meter = (enemy, statusId) => enemy?.statuses?.[statusId]?.meter?.value || 0;
      const singleOutcome = (prior, next) => {
        const deltas = prior.enemies.map((enemy) => ({
          id: enemy.id,
          hp: enemy.hp - (enemyById(next, enemy.id)?.hp ?? enemy.hp),
        }));
        return next.energy === prior.energy - 1
          && next.discard === prior.discard + 1 && next.exhaust === prior.exhaust
          && deltas.filter((row) => row.hp === 7).length === 1
          && deltas.filter((row) => row.hp !== 0 && row.hp !== 7).length === 0;
      };
      const multiOutcome = (prior, next) => prior.enemies.filter((enemy) => enemy.alive).every((enemy) => {
        const afterEnemy = enemyById(next, enemy.id);
        return afterEnemy && enemy.hp - afterEnemy.hp === 8
          && meter(afterEnemy, 'bleed') - meter(enemy, 'bleed') === 2;
      }) && next.energy === prior.energy - 2
        && next.discard === prior.discard + 1 && next.exhaust === prior.exhaust;
      const selfOutcome = (prior, next) => next.energy === prior.energy - 1
        && next.discard === prior.discard + 1 && next.exhaust === prior.exhaust
        && next.player.hp === prior.player.hp && next.player.block === prior.player.block + 7
        && JSON.stringify(next.enemies) === JSON.stringify(prior.enemies);
      const markFlaskAnchors = () => ev(`(() => {
        const charges=[...document.querySelectorAll('.flask-slot.flask-charge')];
        if(charges[0])charges[0].dataset.parityAnchor='crimson-charge';
        if(charges[1])charges[1].dataset.parityAnchor='azure-charge';
        const blight=document.querySelector('.flask-slot[data-flask-slot="1"]');
        if(blight)blight.dataset.parityAnchor='blight';
        return {
          crimson:!!charges[0], azure:!!charges[1], blight:!!blight,
          names:[...document.querySelectorAll('.flask-slot')].map((node)=>(node.textContent||'').replace(/\\s+/g,' ').trim()),
        };
      })()`);
      const poseMulti = async () => ev(`(() => {
        const donor=window.__combat.piles.hand[0];
        const trigger=[...document.querySelectorAll('.hand .card')].find((node)=>/Slashing Strike/.test(node.textContent));
        if(!donor||!trigger)return null;
        donor.cardId='crimsonCleave'; donor.upgraded=false;
        delete donor.profileId; delete donor.mods; delete donor.damageSchool; delete donor.exposureBuildupPerHit;
        trigger.click(); const deselect=[...document.querySelectorAll('.hand .card')].find((node)=>/Slashing Strike/.test(node.textContent));
        if(deselect)deselect.click(); return donor.instanceId;
      })()`);
      const screenshot = async (suffix) => {
        if (!screenshots) return;
        const dir = join(ROOT, 'docs', 'preview'); mkdirSync(dir, { recursive: true });
        const stem = standalone ? `hybrid-input-parity-root-${shape}` : `hybrid-input-parity-${shape}`;
        const filename = `${stem}-${suffix}.png`;
        const path = join(dir, filename);
        const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
        writeFileSync(path, Buffer.from(image.data, 'base64'));
        const reading = await ev(EVIDENCE_READING);
        const axTree = await cdp.send('Accessibility.getFullAXTree', {}, sessionId);
        const ax = axTree.nodes
          .map((node) => ({ role: node.role?.value || '', name: node.name?.value || '' }))
          .filter((node) => node.name && ['button', 'menu', 'menuitem', 'dialog', 'listbox', 'option'].includes(node.role));
        const bytes = readFileSync(path);
        evidence.push({
          viewport: shape, state: suffix, filename,
          sha256: sha256(bytes), bytes: statSync(path).size,
          gameplay: await state(), geometry: reading, ax,
        });
      };
      const contactSheet = async () => {
        if (!screenshots) return;
        const rows = evidence.filter((entry) => entry.viewport === shape);
        const cards = rows.map((entry) => {
          const focus = (entry.geometry.focus?.name || entry.geometry.active?.name || 'none').slice(0, 96);
          const checks = [
            entry.geometry.allNamed ? 'named' : 'UNNAMED',
            entry.geometry.allOnGlass ? 'on-glass' : 'OFF-GLASS',
            entry.geometry.allCenterHit ? 'center-hit' : 'OBSTRUCTED',
            entry.geometry.allTap44 ? '44px+' : 'SUB-44',
          ].join(' · ');
          const src = `${base.replace(/index\.html$/, '')}docs/preview/${entry.filename}`;
          return `<figure><img src="${src}" alt="${entry.viewport} ${entry.state}"><figcaption><strong>${entry.state}</strong><br>focus: ${focus}<br>${checks}</figcaption></figure>`;
        }).join('');
        const html = `<!doctype html><meta charset="utf-8"><title>#204 ${shape} ${evidenceDoor} evidence</title><style>
          *{box-sizing:border-box}body{margin:0;padding:24px;background:#111318;color:#f4ead4;font:18px/1.35 system-ui,sans-serif}
          h1{margin:0 0 18px;font:700 30px/1.2 system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
          figure{margin:0;padding:10px;border:1px solid #8d7747;background:#1a1d23;border-radius:8px;break-inside:avoid}
          img{display:block;width:100%;height:420px;object-fit:contain;background:#07080a;border:1px solid #353945}
          figcaption{padding:8px 2px 0;color:#ddd4c2;font-size:15px}strong{color:#f3c86d}
        </style><h1>AshenSpire #204 · ${evidenceDoor} evidence · ${shape}</h1><main class="grid">${cards}</main>`;
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false,
        }, sessionId);
        await ev(`(() => { document.open(); document.write(${JSON.stringify(html)}); document.close(); })()`);
        await until(`[...document.images].length===${rows.length} && [...document.images].every((img)=>img.complete&&img.naturalWidth>0)`, 'contact-sheet images', 30000);
        await wait(150);
        const metrics = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
        const size = metrics.cssContentSize || metrics.contentSize;
        const image = await cdp.send('Page.captureScreenshot', {
          format: 'png', fromSurface: true, captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
        }, sessionId);
        const filename = standalone
          ? `hybrid-input-parity-root-${shape}-contact-sheet.png`
          : `hybrid-input-parity-${shape}-contact-sheet.png`;
        const path = join(ROOT, 'docs', 'preview', filename);
        writeFileSync(path, Buffer.from(image.data, 'base64'));
        const bytes = readFileSync(path);
        contactSheets.push({ viewport: shape, filename, sha256: sha256(bytes), bytes: statSync(path).size, states: rows.map((entry) => entry.state) });
      };
      const layoutReading = () => ev(`(() => {
        const selectors=['.hand-prev','.hand-next','.end-turn','.energy-orb','.hand-area'];
        const box=(selector)=>{const node=document.querySelector(selector);if(!node)return null;const r=node.getBoundingClientRect();return {selector,left:+r.left.toFixed(2),top:+r.top.toFixed(2),right:+r.right.toFixed(2),bottom:+r.bottom.toFixed(2),width:+r.width.toFixed(2),height:+r.height.toFixed(2)};};
        const rects=selectors.map(box);
        const controls=rects.filter((row)=>row&&['.hand-prev','.hand-next','.end-turn'].includes(row.selector));
        const onGlass=rects.every((row)=>row&&row.left>=0&&row.top>=0&&row.right<=innerWidth&&row.bottom<=innerHeight);
        const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        const pages=controls.filter((row)=>row.selector!=='.end-turn');
        const fixed=[...document.querySelectorAll('.end-turn,.energy-orb,.pile')].filter((node)=>getComputedStyle(node).display!=='none').map((node)=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});
        const hand=document.querySelector('.hand').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.hand .card')].map((node)=>{const r=node.getBoundingClientRect();return {left:Math.max(r.left,hand.left),top:Math.max(r.top,hand.top),right:Math.min(r.right,hand.right),bottom:Math.min(r.bottom,hand.bottom)};}).filter((row)=>row.right>Math.max(0,row.left)&&row.bottom>row.top&&row.left<innerWidth);
        const overlap=pages.some((page)=>fixed.some((item)=>hit(page,item))||cards.some((card)=>hit(page,card)));
        return {viewport:{width:innerWidth,height:innerHeight},rects,minimumTap:Math.min(...controls.map((row)=>Math.min(row.width,row.height))),onGlass,overlap};
      })()`);

      console.log(`\n  ${shape} — ${evidenceDoor} real page input parity`);

      // Single-target mouse: trusted click arms; trusted enemy click commits.
      await openCombat();
      const sourceLayout = await layoutReading();
      check(sourceLayout.minimumTap >= 44, 'primary combat controls retain a 44px minimum target', JSON.stringify(sourceLayout));
      check(sourceLayout.onGlass && !sourceLayout.overlap, 'primary controls stay on glass without paging overlap', JSON.stringify(sourceLayout));
      const axTree = await cdp.send('Accessibility.getFullAXTree', {}, sessionId);
      const axButtons = axTree.nodes.filter((node) => node.role?.value === 'button').map((node) => node.name?.value || '');
      check(['Previous card', 'Next card'].every((name) => axButtons.includes(name))
        && axButtons.some((name) => /^END TURN/.test(name)),
      'AX tree exposes named Previous, Next, and End Turn buttons', JSON.stringify(axButtons));
      await screenshot('ready');
      let chosen = await card('Slashing Strike');
      if (!chosen) throw new Error(`${shape}: Slashing Strike fixture missing`);
      let before = await state();
      await tap(`.hand .card[data-instance-id="${chosen.id}"]`);
      let armed = await state();
      check(armed.selected.length === 1 && armed.targetable.length >= 2, 'mouse single-target selection arms legal enemies', JSON.stringify(armed));
      await screenshot('mouse-armed');
      await tap('.combatant.enemy.targetable'); await wait(650);
      let after = await state();
      check(oneCommit(before, after, chosen.id), 'mouse single-target path commits exactly once', `${before.plays} -> ${after.plays}`);
      check(singleOutcome(before, after), 'mouse single-target outcome spends one, discards once, preserves exhaust, and damages one enemy', JSON.stringify({ before, after }));
      check(cleanTargeting(after), 'mouse single-target completion clears targeting state', JSON.stringify(after));
      await screenshot('mouse-confirm');

      // Single-target keyboard: positional key arms; target number commits.
      await openCombat(); chosen = await card('Slashing Strike'); before = await state();
      await key(cardKey(chosen.index)); armed = await state();
      check(armed.selected.length === 1 && armed.targetable.length >= 2, 'keyboard card key arms the same single-target state', JSON.stringify(armed));
      await key('1'); await wait(650); after = await state();
      check(oneCommit(before, after, chosen.id), 'keyboard target key commits exactly once', `${before.plays} -> ${after.plays}`);
      check(singleOutcome(before, after), 'keyboard target-key outcome matches the single-target resource and HP delta', JSON.stringify({ before, after }));
      check(cleanTargeting(after), 'keyboard completion clears targeting state', JSON.stringify(after));
      await screenshot('keyboard-confirm');

      // Keyboard cursor parity: Arrows reach the real card, Enter arms it,
      // Arrows move among legal targets, and Enter commits exactly once.
      await openCombat(); chosen = await card('Slashing Strike'); before = await state();
      const keyReached = await focusCardWithKeys(chosen.id);
      check(keyReached, 'keyboard Arrows reach the real single-target card', JSON.stringify((await state()).focus));
      if (keyReached) await key('Enter');
      armed = await state();
      check(armed.selected.length === 1 && armed.targetable.length >= 2 && !!(armed.focus && armed.focus.eid),
        'keyboard Enter arms and restores focus to a legal target', JSON.stringify(armed));
      await screenshot('keyboard-armed');
      const firstKeyTarget = armed.focus && armed.focus.eid;
      await key('ArrowRight'); const movedKeyTarget = await state();
      check(!!(firstKeyTarget && movedKeyTarget.focus && movedKeyTarget.focus.eid
        && movedKeyTarget.focus.eid !== firstKeyTarget),
      'keyboard Arrows move the real target focus before confirmation', JSON.stringify({ first: armed.focus, moved: movedKeyTarget.focus }));
      if (movedKeyTarget.focus && movedKeyTarget.focus.eid) await key('Enter');
      await wait(650); after = await state();
      check(oneCommit(before, after, chosen.id), 'keyboard cursor path commits exactly once', `${before.plays} -> ${after.plays}`);
      check(singleOutcome(before, after), 'keyboard cursor outcome matches the single-target resource and HP delta', JSON.stringify({ before, after }));
      check(cleanTargeting(after), 'keyboard cursor completion clears targeting state', JSON.stringify(after));

      await openCombat(); chosen = await card('Slashing Strike'); before = await state();
      if (await focusCardWithKeys(chosen.id)) await key('Enter');
      await key('ArrowRight'); await key('Escape'); after = await state();
      check(gameplay(after) === gameplay(before) && cleanTargeting(after) && !!(after.focus && after.focus.instanceId),
        'keyboard cursor Escape preserves gameplay and restores hand focus', JSON.stringify(after));

      // Keyboard cancel: selected card, no spend, no stale target.
      await openCombat(); chosen = await card('Slashing Strike'); before = await state();
      await key(cardKey(chosen.index)); await key('Escape'); after = await state();
      check(after.plays === before.plays && after.energy === before.energy && cleanTargeting(after),
        'keyboard Escape spends nothing and clears selection/targetables', JSON.stringify(after));
      await screenshot('keyboard-cancel-restored');

      // Controller single target through D-pad + Confirm + Confirm.
      await openCombat(); chosen = await card('Slashing Strike'); before = await state();
      const reached = await focusCardWithPad(chosen.id);
      check(reached, 'controller D-pad reaches the real single-target card', JSON.stringify((await state()).focus));
      if (reached) await pad(0);
      armed = await state();
      check(armed.selected.length === 1 && armed.targetable.length >= 2 && !!(armed.focus && armed.focus.eid),
        'controller Confirm arms and moves real focus to a legal enemy', JSON.stringify(armed));
      await screenshot('controller-armed');
      if (armed.focus && armed.focus.eid) await pad(0);
      await wait(650); after = await state();
      check(oneCommit(before, after, chosen.id), 'controller target Confirm commits exactly once', `${before.plays} -> ${after.plays}`);
      check(singleOutcome(before, after), 'controller target outcome matches the single-target resource and HP delta', JSON.stringify({ before, after }));
      check(cleanTargeting(after), 'controller completion clears targeting state', JSON.stringify(after));
      await screenshot('controller-confirm');

      // Controller cancel from the armed target state.
      await openCombat(); chosen = await card('Slashing Strike'); before = await state();
      if (await focusCardWithPad(chosen.id)) await pad(0);
      await pad(1); after = await state();
      check(after.plays === before.plays && after.energy === before.energy && cleanTargeting(after)
        && !!(after.focus && after.focus.instanceId),
        'controller Cancel spends nothing and clears selection/targetables', JSON.stringify(after));
      await screenshot('controller-cancel-restored');

      // Hand paging is a real focus move, not a repaint. Pointer, keyboard and
      // pad must all preserve the same ordered cursor even though keyboard/pad
      // first have to focus the pager button itself. Exercise the full wrap;
      // a one-step check cannot distinguish a remembered cursor from "always
      // jump to the first card".
      await openCombat();
      await pad(15); const pageBefore = await state();
      await screenshot('paging-before');
      await tap('.hand-next'); const pageAfter = await state();
      await screenshot('paging-next');
      check(!!(pageBefore.focus && pageAfter.focus && pageAfter.focus.instanceId
        && `${pageBefore.focus.classes}|${pageBefore.focus.instanceId}` !== `${pageAfter.focus.classes}|${pageAfter.focus.instanceId}`),
      'Previous/Next moves the real hand focus', JSON.stringify({ before: pageBefore.focus, after: pageAfter.focus }));
      await tap('.hand-prev'); const pageReturn = await state();
      check(!!(pageReturn.focus && pageReturn.focus.instanceId && pageReturn.focus.instanceId !== pageAfter.focus.instanceId),
        'Previous returns the real focus cursor through the hand', JSON.stringify({ next: pageAfter.focus, returned: pageReturn.focus }));
      await screenshot('paging-return');

      const pagerSequence = async (mode, direction) => {
        await openCombat();
        const initial = await state();
        const ids = initial.cards.map((entry) => entry.id);
        const seen = [];
        const className = direction > 0 ? 'hand-next' : 'hand-prev';
        for (let i = 0; i <= ids.length; i++) {
          const reachedPager = mode === 'keyboard'
            ? await focusClassWithKeys(className)
            : await focusClassWithPad(className);
          if (!reachedPager) { seen.push(null); break; }
          if (mode === 'keyboard') await key('Enter'); else await pad(0);
          seen.push((await state()).focus?.instanceId || null);
        }
        const expected = [];
        for (let i = 0; i <= ids.length; i++) {
          const index = direction > 0
            ? i % ids.length
            : (ids.length - 1 - (i % ids.length) + ids.length) % ids.length;
          expected.push(ids[index]);
        }
        return { initial, final: await state(), ids, seen, expected };
      };
      const keyNext = await pagerSequence('keyboard', 1);
      check(JSON.stringify(keyNext.seen) === JSON.stringify(keyNext.expected)
        && gameplay(keyNext.final) === gameplay(keyNext.initial),
      'keyboard Next/Previous follows exact hand order and wraps', JSON.stringify(keyNext));
      const keyPrev = await pagerSequence('keyboard', -1);
      check(JSON.stringify(keyPrev.seen) === JSON.stringify(keyPrev.expected)
        && gameplay(keyPrev.final) === gameplay(keyPrev.initial),
      'keyboard Previous follows reverse hand order and wraps without mutation', JSON.stringify(keyPrev));
      const padNext = await pagerSequence('controller', 1);
      check(JSON.stringify(padNext.seen) === JSON.stringify(padNext.expected)
        && gameplay(padNext.final) === gameplay(padNext.initial)
        && padNext.final.pad.mapping === 'standard' && padNext.final.pad.reads > padNext.initial.pad.reads,
      'controller Next follows exact hand order and wraps through the standard pad door', JSON.stringify(padNext));
      const padPrev = await pagerSequence('controller', -1);
      check(JSON.stringify(padPrev.seen) === JSON.stringify(padPrev.expected)
        && gameplay(padPrev.final) === gameplay(padPrev.initial),
      'controller Previous follows reverse hand order and wraps without mutation', JSON.stringify(padPrev));

      // Multi-target: pointer and keyboard commit on one activation. Controller
      // must not misclassify an allEnemies card as a blue self-target arm.
      await openCombat(); let multiId = await poseMulti();
      let multi = await card('Crimson Cleave');
      if (!multiId || !multi) throw new Error(`${shape}: Crimson Cleave pose failed`);
      before = await state(); await tap(`.hand .card[data-instance-id="${multi.id}"]`); await wait(650); after = await state();
      check(oneCommit(before, after, multi.id), 'mouse multi-target card commits exactly once', `${before.plays} -> ${after.plays}`);
      check(multiOutcome(before, after), 'mouse multi-target outcome reaches every living enemy once with exact cost/status deltas', JSON.stringify({ before, after }));

      await openCombat(); multiId = await poseMulti(); multi = await card('Crimson Cleave'); before = await state();
      await key(cardKey(multi.index)); await wait(650); after = await state();
      check(oneCommit(before, after, multi.id), 'keyboard multi-target card commits exactly once', `${before.plays} -> ${after.plays}`);
      check(multiOutcome(before, after), 'keyboard multi-target outcome reaches every living enemy once with exact cost/status deltas', JSON.stringify({ before, after }));

      await openCombat(); multiId = await poseMulti(); multi = await card('Crimson Cleave'); before = await state();
      const multiReached = await focusCardWithPad(multi.id);
      check(multiReached, 'controller D-pad reaches the real multi-target card', JSON.stringify((await state()).focus));
      const heldReads = await ev('window.__parityPadReads');
      await ev(`(() => {
        window.__parityActivationCount=0;
        const commitDoor=document.querySelector('.hand .card[data-instance-id=${JSON.stringify(multi.id)}]');
        commitDoor?.addEventListener('click',()=>window.__parityActivationCount++,true);
      })()`);
      if (multiReached) await pad(0, 3);
      await wait(650); after = await state();
      const activations = await ev('window.__parityActivationCount');
      const multiControllerOk = oneCommit(before, after, multi.id) && cleanTargeting(after)
        && multiOutcome(before, after);
      check(multiControllerOk, 'controller multi-target Confirm commits once without a false self target', JSON.stringify(after));
      check(activations === 1 && oneCommit(before, after, multi.id)
        && after.pad.mapping === 'standard' && after.pad.reads > heldReads,
        'held controller Confirm fires one activation and one multi-target commit', JSON.stringify({ activations, heldReads, after }));
      check(multiOutcome(before, after), 'controller multi-target outcome reaches every living enemy once with exact cost/status deltas', JSON.stringify({ before, after }));
      if (screenshots) await screenshot(multiControllerOk ? 'controller-multi' : 'controller-multi-red');

      // Self card: mouse and keyboard commit directly. Controller deliberately
      // arms blue, supports a lossless Cancel back to the exact card, then on a
      // fresh board confirms the player once with clean teardown.
      await openCombat(); let self = await card('Shield Defend');
      if (!self) throw new Error(`${shape}: Shield Defend fixture missing`);
      before = await state(); await tap(`.hand .card[data-instance-id="${self.id}"]`); await wait(650); after = await state();
      check(oneCommit(before, after, self.id), 'mouse self card commits exactly once', `${before.plays} -> ${after.plays}`);
      check(selfOutcome(before, after), 'mouse self outcome spends once, blocks once, and preserves enemy state', JSON.stringify({ before, after }));

      await openCombat(); self = await card('Shield Defend');
      if (!self) throw new Error(`${shape}: Shield Defend fixture missing`);
      before = await state(); await key(cardKey(self.index)); await wait(650); after = await state();
      check(oneCommit(before, after, self.id), 'keyboard self card commits exactly once', `${before.plays} -> ${after.plays}`);
      check(selfOutcome(before, after), 'keyboard self outcome spends once, blocks once, and preserves enemy state', JSON.stringify({ before, after }));

      await openCombat(); self = await card('Shield Defend'); before = await state();
      const selfReached = await focusCardWithPad(self.id);
      check(selfReached, 'controller D-pad reaches the real self card', JSON.stringify((await state()).focus));
      if (selfReached) await pad(0); armed = await state();
      check(armed.playerArmed && armed.aimPlayer && !!(armed.focus && /player/.test(armed.focus.classes)),
        'controller self card arms the player blue and moves real focus', JSON.stringify(armed));
      await screenshot('controller-self');

      await pad(1); after = await state();
      check(gameplay(after) === gameplay(before) && cleanTargeting(after)
        && after.focus?.instanceId === self.id,
      'controller self Cancel spends nothing, clears targeting, and restores the exact card focus', JSON.stringify({ before, armed, after }));
      await screenshot('controller-self-cancel-restored');

      await openCombat(); self = await card('Shield Defend'); before = await state();
      const selfConfirmReached = await focusCardWithPad(self.id);
      if (selfConfirmReached) await pad(0); armed = await state();
      if (armed.playerArmed) await pad(0);
      await wait(650); after = await state();
      check(oneCommit(before, after, self.id), 'controller self confirm commits exactly once', `${before.plays} -> ${after.plays}`);
      check(selfOutcome(before, after), 'controller self outcome spends once, blocks once, and preserves enemy state', JSON.stringify({ before, after }));
      check(cleanTargeting(after), 'controller self completion clears targeting state', JSON.stringify(after));

      // Contextual flask menus: opening and inspecting are inert, arrow/D-pad
      // navigation stays inside the menu, and Cancel returns DOM focus to the
      // exact slot that opened it. Crimson is driven by keyboard; Azure by the
      // standard pad. Neither path may spend a charge.
      const cancelChargeMenu = async (mode, marker) => {
        await openCombat();
        const anchors = await markFlaskAnchors();
        const prior = await state();
        const reachedAnchor = await focusAnchor(marker, mode);
        if (reachedAnchor) {
          if (mode === 'keyboard') await key('Enter'); else await pad(0);
        }
        const opened = await state();
        let ended = null;
        let homed = null;
        if (mode === 'keyboard') {
          await key('End'); ended = await state();
          await key('Home'); homed = await state();
          await key('ArrowDown');
        } else await pad(13);
        const navigated = await state();
        const menuGeometry = await ev(`(() => [...document.querySelectorAll('.flask-action')].map((node) => {
          const rect=node.getBoundingClientRect();
          return {name:(node.textContent||'').trim(),width:+rect.width.toFixed(2),height:+rect.height.toFixed(2)};
        }))()`);
        await screenshot(`${mode}-${marker}-menu`);
        if (mode === 'keyboard') await key('Escape'); else await pad(1);
        const cancelled = await state();
        return { anchors, prior, reachedAnchor, opened, ended, homed, navigated, menuGeometry, cancelled };
      };
      const crimsonMenu = await cancelChargeMenu('keyboard', 'crimson-charge');
      check(crimsonMenu.reachedAnchor && crimsonMenu.opened.menu
        && crimsonMenu.opened.menu.actions.map((row) => row.id).join(',') === 'use,inspect'
        && crimsonMenu.opened.active?.flaskAction === 'use'
        && crimsonMenu.navigated.active?.flaskAction === 'inspect',
      'keyboard Crimson menu opens on Use and arrows to Inspect', JSON.stringify(crimsonMenu));
      check(crimsonMenu.ended?.active?.flaskAction === 'inspect'
        && crimsonMenu.ended?.focus?.flaskAction === 'inspect'
        && crimsonMenu.homed?.active?.flaskAction === 'use'
        && crimsonMenu.homed?.focus?.flaskAction === 'use',
      'keyboard Home/End keep DOM focus and the unified cursor aligned', JSON.stringify(crimsonMenu));
      check(crimsonMenu.menuGeometry.length === 2
        && crimsonMenu.menuGeometry.every((row) => Math.min(row.width, row.height) >= 44),
      'keyboard Crimson menu rows retain the 44 device-pixel floor', JSON.stringify(crimsonMenu.menuGeometry));
      check(!crimsonMenu.cancelled.menu && crimsonMenu.cancelled.active?.parityAnchor === 'crimson-charge'
        && gameplay(crimsonMenu.cancelled) === gameplay(crimsonMenu.prior),
      'keyboard Crimson cancel returns the exact anchor and spends no charge', JSON.stringify(crimsonMenu));

      const azureMenu = await cancelChargeMenu('controller', 'azure-charge');
      check(azureMenu.reachedAnchor && azureMenu.opened.menu
        && azureMenu.opened.menu.actions.map((row) => row.id).join(',') === 'use,inspect'
        && azureMenu.opened.active?.flaskAction === 'use'
        && azureMenu.navigated.active?.flaskAction === 'inspect'
        && azureMenu.cancelled.pad.mapping === 'standard'
        && azureMenu.cancelled.pad.reads > azureMenu.prior.pad.reads,
      'controller Azure menu opens on Use and D-pad moves to Inspect', JSON.stringify(azureMenu));
      check(azureMenu.menuGeometry.length === 2
        && azureMenu.menuGeometry.every((row) => Math.min(row.width, row.height) >= 44),
      'controller Azure menu rows retain the 44 device-pixel floor', JSON.stringify(azureMenu.menuGeometry));
      check(!azureMenu.cancelled.menu && azureMenu.cancelled.active?.parityAnchor === 'azure-charge'
        && gameplay(azureMenu.cancelled) === gameplay(azureMenu.prior),
      'controller Azure cancel returns the exact anchor and spends no charge', JSON.stringify(azureMenu));

      // Contextual-menu lifecycle: a second activation is a real toggle;
      // click-away and competing surfaces dismiss without hijacking the new
      // focus; another flask replaces rather than coexists. These are trusted
      // page clicks, not direct component calls.
      await openCombat(); await markFlaskAnchors();
      const dismissalPrior = await state();
      const crimsonSelector = '[data-parity-anchor="crimson-charge"]';
      const azureSelector = '[data-parity-anchor="azure-charge"]';
      await tap(crimsonSelector); const dismissalOpened = await state();
      await screenshot('flask-menu-open');
      await tap(crimsonSelector); const dismissalToggled = await state();
      await screenshot('flask-menu-toggle-closed');
      check(!!dismissalOpened.menu && !dismissalToggled.menu
        && dismissalToggled.active?.parityAnchor === 'crimson-charge'
        && gameplay(dismissalToggled) === gameplay(dismissalPrior),
      'same-flask re-click toggles off and restores its exact anchor',
      JSON.stringify({ prior: dismissalPrior, opened: dismissalOpened, toggled: dismissalToggled }));

      await tap(crimsonSelector);
      const outsideTargeted = await tap('.combatant.enemy');
      const dismissalOutside = await state();
      await screenshot('flask-menu-outside-closed');
      check(outsideTargeted && !dismissalOutside.menu && !dismissalOutside.active?.flaskAction
        && dismissalOutside.active?.parityAnchor !== 'crimson-charge'
        && gameplay(dismissalOutside) === gameplay(dismissalPrior),
      'trusted outside click closes the flask menu without stealing focus', JSON.stringify(dismissalOutside));

      await tap(crimsonSelector);
      const competingClicked = await tap('#combat-menu');
      const dismissalCompeting = await state();
      const competingSurface = await ev(`!!document.querySelector('.modal-veil')`);
      await screenshot('flask-menu-competing-closed');
      check(competingClicked && competingSurface && !dismissalCompeting.menu
        && gameplay(dismissalCompeting) === gameplay(dismissalPrior),
      'competing Menu surface closes the flask menu before it opens',
      JSON.stringify({ competingSurface, state: dismissalCompeting }));

      await openCombat(); await markFlaskAnchors();
      const switchingPrior = await state();
      await tap(crimsonSelector); await tap(azureSelector);
      const dismissalSwitched = await state();
      const menuCount = await ev(`document.querySelectorAll('.flask-action-menu').length`);
      await screenshot('flask-menu-switched');
      check(menuCount === 1 && /Azure Flask actions/.test(dismissalSwitched.menu?.label || '')
        && gameplay(dismissalSwitched) === gameplay(switchingPrior),
      'another flask switches cleanly with exactly one live menu', JSON.stringify({ menuCount, state: dismissalSwitched }));
      await key('Escape');

      // Blight Coating uses the same menu but its enabled Use row enters enemy
      // targeting. Cancel at that second stage must preserve the flask and all
      // combat resources, clear targetables, and restore a hand/flask focus.
      const cancelBlightTarget = async (mode) => {
        await openCombat();
        const anchors = await markFlaskAnchors();
        const prior = await state();
        const reachedAnchor = await focusAnchor('blight', mode);
        if (reachedAnchor) {
          if (mode === 'keyboard') await key('Enter'); else await pad(0);
        }
        const menuOpened = await state();
        if (menuOpened.active?.flaskAction === 'use') {
          if (mode === 'keyboard') await key('Enter'); else await pad(0);
        }
        const armedFlask = await state();
        await screenshot(`${mode}-blight-target`);
        if (mode === 'keyboard') await key('Escape'); else await pad(1);
        return { anchors, prior, reachedAnchor, menuOpened, armedFlask, cancelled: await state() };
      };
      const blightKey = await cancelBlightTarget('keyboard');
      check(blightKey.reachedAnchor && blightKey.menuOpened.active?.flaskAction === 'use'
        && blightKey.armedFlask.targetable.length >= 1 && !!blightKey.armedFlask.focus?.eid,
      'keyboard Blight Use enters real enemy targeting', JSON.stringify(blightKey));
      check(gameplay(blightKey.cancelled) === gameplay(blightKey.prior) && cleanTargeting(blightKey.cancelled),
        'keyboard Blight target cancel preserves flask/resources and clears stale target state', JSON.stringify(blightKey));
      const blightPad = await cancelBlightTarget('controller');
      check(blightPad.reachedAnchor && blightPad.menuOpened.active?.flaskAction === 'use'
        && blightPad.armedFlask.targetable.length >= 1 && !!blightPad.armedFlask.focus?.eid,
      'controller Blight Use enters real enemy targeting through the standard pad', JSON.stringify(blightPad));
      check(gameplay(blightPad.cancelled) === gameplay(blightPad.prior) && cleanTargeting(blightPad.cancelled),
        'controller Blight target cancel preserves flask/resources and clears stale target state', JSON.stringify(blightPad));

      // Exact root/build/dist twins remain intentionally deferred while #206
      // owns the shared generated-artifact surface. The final exact-dev pass
      // opts in after rebasing/regenerating once; source evidence never implies
      // that today's checked-in artifact contains this worktree patch.
      if (artifactParity) {
        await openCombat({ artifact: true });
        const rootLayout = await layoutReading();
        check(JSON.stringify(rootLayout) === JSON.stringify(sourceLayout),
          'source and current root artifact retain exact initial combat rect parity', JSON.stringify({ sourceLayout, rootLayout }));
        await screenshot('root-ready');
      }

      if (shape === '320x640') {
        await openCombat({ textSize: 'XL' });
        const xlLayout = await layoutReading();
        check(xlLayout.minimumTap >= 44 && xlLayout.onGlass && !xlLayout.overlap,
          '320x640 Text XL spot check keeps these controls usable (not a #37 claim)', JSON.stringify(xlLayout));
        await screenshot('text-xl');
      }

      const shapeEvidence = evidence.filter((entry) => entry.viewport === shape);
      check(shapeEvidence.every((entry) => entry.geometry.allNamed),
        'every captured interaction state has non-empty accessible names',
        JSON.stringify(shapeEvidence.filter((entry) => !entry.geometry.allNamed).map((entry) => ({ state: entry.state, rows: entry.geometry.interactive.filter((row) => !row.name) }))));
      check(shapeEvidence.every((entry) => entry.geometry.allOnGlass),
        'every captured interaction state keeps measured controls on glass',
        JSON.stringify(shapeEvidence.filter((entry) => !entry.geometry.allOnGlass).map((entry) => ({ state: entry.state, rows: entry.geometry.interactive.filter((row) => !row.onGlass) }))));
      check(shapeEvidence.every((entry) => entry.geometry.allCenterHit),
        'every captured interaction state keeps measured control centres hittable',
        JSON.stringify(shapeEvidence.filter((entry) => !entry.geometry.allCenterHit).map((entry) => ({ state: entry.state, rows: entry.geometry.interactive.filter((row) => !row.centerHit) }))));
      check(shapeEvidence.every((entry) => entry.geometry.allTap44),
        'every captured interaction state retains 44px measured targets',
        JSON.stringify(shapeEvidence.filter((entry) => !entry.geometry.allTap44).map((entry) => ({ state: entry.state, rows: entry.geometry.interactive.filter((row) => !row.tap44) }))));
      await contactSheet();

      await cdp.send('Target.closeTarget', { targetId });
    }
    if (!measured) throw new Error(`--only ${only} matched no configured shape`);
    if (screenshots) {
      for (const [width, height] of SHAPES) {
        const shape = `${width}x${height}`;
        if (only && only !== shape) continue;
        const states = new Set(evidence.filter((entry) => entry.viewport === shape).map((entry) => entry.state));
        check(REQUIRED_SOURCE_STATES.every((stateName) => states.has(stateName)),
          `${shape} captured the complete raw source-state matrix`,
          JSON.stringify(REQUIRED_SOURCE_STATES.filter((stateName) => !states.has(stateName))));
      }
      const { patchBaseRef, productPatchSha256 } = manifestPatchBasis();
      const sourceFiles = Object.fromEntries(PRODUCT_PATHS
        .map((file) => [file, canonicalIdentity(readFileSync(join(ROOT, file)))]));
      const toolFile = { path: TOOL_PATH, identity: canonicalIdentity(readFileSync(join(ROOT, TOOL_PATH))) };
      const standaloneArtifact = standalone ? (() => {
        const artifact = readFileSync(join(ROOT, 'AshenSpire.html'));
        return {
          path: 'AshenSpire.html',
          sha256: sha256(artifact),
          bytes: artifact.length,
          buildOrdinalPath: 'buildordinal.json',
          buildOrdinalIdentity: canonicalIdentity(readFileSync(join(ROOT, 'buildordinal.json'))),
        };
      })() : null;
      const manifest = {
        schemaVersion: 2,
        issue: 'https://github.com/cehinds/AshenSpire/issues/204',
        evidenceKind: standalone ? 'exact root standalone behavioral checkpoint' : 'source behavioral checkpoint',
        patchBaseRef,
        identityRule: 'canonical UTF-8 text with CRLF/CR normalized to LF; SHA-256 plus Git SHA-1 blob OID',
        exactHeadVerification: 'node tools/hybrid-input-parity.mjs --verify-manifests (run after checkout of the published head)',
        productPaths: PRODUCT_PATHS,
        productPatchSha256,
        toolFile,
        sourceFiles,
        ...(standaloneArtifact ? { standaloneArtifact } : {}),
        viewports: evidence.map((entry) => entry.viewport).filter((value, index, all) => all.indexOf(value) === index),
        requiredSourceStates: REQUIRED_SOURCE_STATES,
        exactArtifactParity: standalone
          ? 'FULL behavioral, accessibility, geometry, and composed drag matrix measured against AshenSpire.html'
          : artifactParity ? 'initial layout measured by legacy explicit opt-in' : 'source half; pair with the root standalone manifest',
        contactSheets,
        evidence,
      };
      const manifestName = standalone ? 'hybrid-input-parity-root-manifest.json' : 'hybrid-input-parity-manifest.json';
      const oversized = [];
      const inspectFields = (value, path = '$') => {
        if (typeof value === 'string') {
          const bytes = Buffer.byteLength(value);
          if (bytes > 4096) oversized.push({ path, bytes });
          return;
        }
        if (Array.isArray(value)) return value.forEach((row, index) => inspectFields(row, `${path}[${index}]`));
        if (value && typeof value === 'object') {
          for (const [key, row] of Object.entries(value)) inspectFields(row, `${path}.${key}`);
        }
      };
      inspectFields(manifest);
      if (oversized.length) {
        throw new Error(`${manifestName} refuses ${oversized.length} field(s) above 4096 bytes: ${JSON.stringify(oversized.slice(0, 4))}`);
      }
      const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
      const manifestBytes = Buffer.byteLength(manifestText);
      const manifestLimit = 8 * 1024 * 1024;
      if (manifestBytes > manifestLimit) {
        throw new Error(`${manifestName} refuses ${manifestBytes} bytes above its ${manifestLimit}-byte evidence limit`);
      }
      writeFileSync(join(ROOT, 'docs', 'preview', manifestName), manifestText);
    }
    const dragArgs = [join(ROOT, 'tools', 'card-drag-targeting.mjs'), '--text', 'M'];
    if (standalone) dragArgs.push('--dist');
    if (only) dragArgs.push('--only', only);
    const drag = spawnSync(process.execPath, dragArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 600000,
      windowsHide: true,
    });
    if (drag.stdout) process.stdout.write(`\n--- composed card-drag-targeting ---\n${drag.stdout}`);
    if (drag.stderr) process.stderr.write(drag.stderr);
    check(drag.status === 0, 'composed card-drag-targeting same-door gate remains GREEN',
      drag.status === 0 ? 'exact pointer-drag acceptance composed' : `exit ${drag.status}; ${String(drag.error || '').trim()}`);
    console.log(`\n${findings ? `FAIL — ${findings} finding(s) in ${checks} checks` : `PASS — ${checks} parity checks across ${measured} viewport(s)`}`);
    process.exitCode = findings ? 1 : 0;
  } finally {
    cdp.close(); await launched.close(); served.server.close();
  }
}

main().catch((error) => {
  console.error(`hybrid-input-parity: ${error.message}`);
  process.exitCode = 2;
});
