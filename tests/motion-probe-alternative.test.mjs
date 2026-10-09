import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rewardDom } from './helpers/reward-dom.mjs';
import { alternativeSprite } from '../src/ui/alternativeArt.js';
import { uiConfig } from '../src/config/generated/ui.js';

const source = readFileSync(new URL('../tools/motion-probe.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
const idleSource = source.slice(source.indexOf('async function idle('), source.indexOf('\nconst server ='));

// Exercise the production browser predicate on the actual alternative figure
// tree. Animation objects stand in for measured Web Animations state; the
// same-door browser plants separately exercise real CSS and document clocks.
async function inspect({ missing = false, duplicate = false, imageCarrier = false, flat = false,
  offClock = false, unloaded = false, transparent = false, canvas = false, blank = false, canvasIdle = 'bob' } = {}) {
  const dom = rewardDom();
  const originalDocument = globalThis.document, originalImage = globalThis.Image;
  globalThis.document = dom.document;
  globalThis.Image = function Image() { return dom.document.createElement('img'); };
  try {
    const figure = alternativeSprite('reaver-default', 'player');
    if (canvas) {
      figure.className = 'pose-stage painted-stage alternative-card-stage';
      const painted = dom.document.createElement('canvas');
      painted.width = painted.height = 2;
      painted.getContext = () => ({ getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, blank ? 0 : 255]) }) });
      figure.replaceChildren(painted);
    }
    const frame = dom.document.createElement('div'); frame.className = 'combatant player';
    const sprite = dom.document.createElement('div'); sprite.className = 'sprite';
    sprite.appendChild(figure); frame.appendChild(sprite); dom.document.body.appendChild(frame);
    const name = dom.document.createElement('span'); name.className = 'nm'; name.textContent = 'Reaver'; frame.appendChild(name);
    const stage = canvas ? figure : figure.querySelector('.alternative-silhouette'), crop = canvas ? figure.querySelector('canvas') : figure.querySelector('.alternative-crop');
    const image = figure.querySelector(canvas ? 'canvas' : 'img');
    const walk = node => [node, ...node.children.flatMap(walk)];
    for (const node of walk(dom.document.body)) {
      Object.defineProperty(node, 'parentElement', { get() { return this.parentNode; } });
      node.classList[Symbol.iterator] = function* () { yield* node.className.split(/\s+/).filter(Boolean); };
      node.getBoundingClientRect = () => ({ width: 100, height: 190 });
      node.getAnimations = () => [];
    }
    image.complete = true; image.naturalWidth = unloaded ? 0 : 1024;
    dom.document.timeline = { currentTime: 6000 };
    const animation = {
      animationName: 'sprite-idle', playState: 'running', effect: {
        getComputedTiming: () => ({ activeDuration: Infinity, duration: 3100, delay: 0,
          progress: offClock ? 0 : (6000 % 3100) / 3100 }),
        getKeyframes: () => [{ translate: '0 0' }, { translate: flat ? '0 0' : '0 -4px' }],
      },
    };
    const carriers = missing ? [] : imageCarrier ? [image] : duplicate ? [stage, crop] : [stage];
    for (const carrier of carriers) carrier.getAnimations = () => [animation];
    const browser = { document: dom.document, requestAnimationFrame: callback => callback(),
      getComputedStyle: node => ({ visibility: 'visible', display: 'block', opacity: transparent && node === figure ? '0' : '1',
        animationName: carriers.includes(node) ? 'sprite-idle' : 'none' }) };
    const verdicts = [];
    const idle = runInNewContext(`${idleSource}\nidle`, { check: (ok, label, detail) => verdicts.push({ ok, label, detail }) });
    await idle({ evaluate: expression => runInNewContext(expression, browser) }, 'IDLE', canvasIdle);
    return verdicts;
  } finally {
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalImage === undefined) delete globalThis.Image; else globalThis.Image = originalImage;
  }
}

test('actual alternative figure has one shared moving carrier with existing period, delays and stop states', async () => {
  const alive = /\.combatant \.sprite :is\(([^\n]+)\) \{ animation: sprite-idle 3\.1s ease-in-out infinite;/.exec(css);
  assert.ok(alive?.[1].includes('.alternative-silhouette'), 'the actual alternative stage must be an idle carrier');
  for (const selector of ['.combatant.dead', '.combatant.down', '.reduced-motion', '.combatant.enemy',
    '.combatant:nth-child(2)', '.combatant:nth-child(3)', '.combatant:nth-child(4)']) {
    const line = css.split('\n').find(row => row.startsWith(selector) && row.includes('.alternative-silhouette'));
    assert.ok(line, `${selector} must retain the same carrier rule`);
  }
  const verdicts = await inspect();
  assert.equal(verdicts.length, 1);
  assert.equal(verdicts[0].ok, true, verdicts[0].detail);
  assert.match(verdicts[0].detail, /painted-stage\.alternative-silhouette/);
});

test('alternative browser predicate rejects absent, duplicate, wrong-layer and broken idle motion', async () => {
  const plants = [
    [{ missing: true }, /no idle animation/],
    [{ duplicate: true }, /bobbed twice/],
    [{ imageCarrier: true }, /outside the alternative silhouette carrier/],
    [{ flat: true }, /keyframes never move/],
    [{ offClock: true }, /off the document clock/],
    [{ unloaded: true }, /image did not load/],
    [{ transparent: true }, /no visible figure image/],
  ];
  for (const [plant, reason] of plants) {
    const [verdict] = await inspect(plant);
    assert.equal(verdict.ok, false, JSON.stringify(plant));
    assert.match(verdict.detail, reason);
  }
});

test('the alternative flipbook plant opens the actual production fallback and schedules its six src frames', () => {
  const plantStart = source.indexOf("name: 'the combatant effect flipbook runs under reduced motion'");
  const plantSource = source.slice(plantStart, source.indexOf('\n      },', plantStart));
  const plant = runInNewContext(`({ ${plantSource} })`, { ALTERNATIVE: true });
  assert.equal(plant.edits.length, 2, 'both independent reduced-motion gates must be planted');
  assert.equal(plant.edits[0].file, 'src/ui/fx.js');
  const edit = plant.edits[1];
  assert.equal(edit.file, 'src/ui/combatEffectSprites.js');
  const sprites = readFileSync(new URL('../src/ui/combatEffectSprites.js', import.meta.url), 'utf8');
  const playSource = sprites.slice(sprites.indexOf('export function playCombatEffect(')).replace('export function', 'function');
  assert.equal(playSource.split(edit.find).length, 2, 'the real fallback guard must be planted exactly once');

  const dom = rewardDom(), layer = dom.document.createElement('div'), tickets = [];
  const createElement = dom.document.createElement.bind(dom.document);
  dom.document.createElement = tag => {
    const node = createElement(tag);
    node.animate = () => ({ cancel() {} });
    return node;
  };
  const context = {
    document: dom.document, M: uiConfig.presentation.combatEffectPlayback.motion,
    SZ: uiConfig.presentation.combatEffectPlayback.sizing, active: new WeakMap(),
    reducedMotionRequested: () => true, combatEffectFrames: () => Array.from({ length: 6 }, (_, i) => `frame-${i + 1}.webp`),
    combatEffectPresentation: () => ({ sizeScale: 1, startScale: 1, endScale: 1, opacity: 1 }),
    warmEffectFrames() {}, hintImage: image => image, currentArtUrl: url => url,
    combatEffectAngle: () => 0, combatEffectOrientation: () => '',
    setTimeout(callback, delay) { tickets.push({ callback, delay }); return tickets.length; }, clearTimeout() {},
  };
  const load = text => runInNewContext(`${text}\nplayCombatEffect`, context);
  const from = { left: 0, top: 0, width: 100, height: 190 };
  load(playSource)(layer, from, 'slash');
  assert.equal(layer.children.length, 0, 'production reduced-motion guard mounts no overlay');
  assert.equal(tickets.length, 0, 'production reduced-motion guard schedules no flipbook');

  const stop = load(playSource.replace(edit.find, edit.replace))(layer, from, 'slash');
  const image = layer.querySelector('.painted-combat-effect');
  assert.ok(image, 'the armed plant must mount the actual fallback image');
  assert.equal(tickets.length, 6, 'five later frames and final cleanup are scheduled');
  const frames = [image.src];
  for (const ticket of tickets.slice(0, 5)) { ticket.callback(); frames.push(image.src); }
  assert.deepEqual(frames, Array.from({ length: 6 }, (_, i) => `frame-${i + 1}.webp`));
  assert.ok(plant.expectRed.test('RED REDUCED-SCRIPT setting+os — img.painted-combat-effect (src changed 6 times within 1000 ms)'));
  assert.equal(plant.expectRed.test('RED REDUCED setting+os — unrelated CSSAnimation'), false);
  stop();
});

test('the primary branch retains the attached-layer flipbook plant and exact script-motion predicate', () => {
  const start = source.indexOf("name: 'the combatant effect flipbook runs under reduced motion'");
  const plant = runInNewContext(`({ ${source.slice(start, source.indexOf('\n      },', start))} })`, { ALTERNATIVE: false });
  assert.equal(plant.edits[1].file, 'src/ui/combatantEffectLayers.js');
  assert.ok(plant.expectRed.test('RED REDUCED-SCRIPT setting+os — img.combatant-effect-layer (src changed 6 times within 1000 ms)'));
  assert.equal(plant.expectRed.test('RED REDUCED-SCRIPT setting+os — img.painted-combat-effect'), false);
});

test('every same-door variant plant still changes the current real source', async () => {
  let corpus;
  const selftest = source.slice(source.indexOf("if (argv.includes('--selftest')) {"), source.indexOf('\nconst ROOT ='))
    .replace("await import('./doorplant.mjs')", 'await harness()');
  await runInNewContext(`(async () => { ${selftest} })()`, {
    argv: ['--selftest'], ALTERNATIVE: true, CANVAS_IDLE: 'anchored',
    process: { exit() {} }, console: { log() {}, error() {}, info() {} },
    harness: async () => ({ resolveShard: () => null, doorSelftest: async options => { corpus = options; return 0; } }),
  });
  assert.equal(corpus.plants.length, 18, 'retain the complete corpus plus blank-canvas and canvas reduced-motion plants');
  assert.ok(corpus.extraCopy.includes('assets-display'), 'clean and planted copies must contain the same variant artwork');
  for (const plant of corpus.plants) {
    for (const edit of plant.edits || [plant]) {
      const current = readFileSync(new URL(`../${edit.file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
      assert.ok(current.includes(edit.find), `${plant.name}: drifted mutation in ${edit.file}`);
      assert.notEqual(edit.find, edit.replace, `${plant.name}: a no-op is not a known-bad`);
    }
  }
});


test('canvas figure requires painted pixels and exactly one clocked stage carrier', async () => {
  const [clean] = await inspect({ canvas: true });
  assert.equal(clean.ok, true, clean.detail);
  assert.match(clean.detail, /canvas moved by sprite-idle on div.pose-stage.painted-stage/);
  for (const [fault, reason] of [
    [{ blank: true }, /canvas has no painted pixels/],
    [{ missing: true }, /no idle animation/],
    [{ duplicate: true }, /bobbed twice/],
    [{ imageCarrier: true }, /outside the alternative silhouette carrier/],
    [{ offClock: true }, /off the document clock/],
    [{ transparent: true }, /no visible figure image/],
  ]) {
    const [verdict] = await inspect({ canvas: true, ...fault });
    assert.equal(verdict.ok, false, JSON.stringify(fault));
    assert.match(verdict.detail, reason);
  }
});

test('primary anchored canvas is painted and has no external idle carrier', async () => {
  const [held]=await inspect({canvas:true,missing:true,canvasIdle:'anchored'});
  assert.equal(held.ok,true,held.detail);
  for(const fault of [{blank:true,missing:true},{transparent:true,missing:true},{},{duplicate:true},{imageCarrier:true}]){
    const [bad]=await inspect({canvas:true,canvasIdle:'anchored',...fault});
    assert.equal(bad.ok,false,JSON.stringify(fault));
  }
});
