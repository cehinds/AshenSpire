import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rewardDom } from './helpers/reward-dom.mjs';
import { alternativeSprite } from '../src/ui/alternativeArt.js';

const source = readFileSync(new URL('../tools/motion-probe.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
const idleSource = source.slice(source.indexOf('async function idle('), source.indexOf('\nconst server ='));

// Exercise the production browser predicate on the actual alternative figure
// tree. Animation objects stand in for measured Web Animations state; the
// same-door browser plants separately exercise real CSS and document clocks.
async function inspect({ missing = false, duplicate = false, imageCarrier = false, flat = false,
  offClock = false, unloaded = false, transparent = false } = {}) {
  const dom = rewardDom();
  const originalDocument = globalThis.document, originalImage = globalThis.Image;
  globalThis.document = dom.document;
  globalThis.Image = function Image() { return dom.document.createElement('img'); };
  try {
    const figure = alternativeSprite('reaver-default', 'player');
    const frame = dom.document.createElement('div'); frame.className = 'combatant player';
    const sprite = dom.document.createElement('div'); sprite.className = 'sprite';
    sprite.appendChild(figure); frame.appendChild(sprite); dom.document.body.appendChild(frame);
    const name = dom.document.createElement('span'); name.className = 'nm'; name.textContent = 'Reaver'; frame.appendChild(name);
    const stage = figure.querySelector('.alternative-silhouette'), crop = figure.querySelector('.alternative-crop');
    const image = figure.querySelector('img');
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
    await idle({ evaluate: expression => runInNewContext(expression, browser) }, 'IDLE');
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
