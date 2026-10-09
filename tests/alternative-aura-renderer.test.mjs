import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlternativeAuraRenderer, alternativeAuraLayers } from '../src/ui/alternativeAuraRenderer.js';
import { auraFilter } from '../src/ui/combatAura.js';
import { COMBAT_POSE_STATES } from '../src/content/combatPoseStates.js';

function fixture() {
  const surfaces = [], draws = [], clears = [], reads = [];
  const context = owner => {
    const saved = [];
    return {
      filter: 'none', shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      save() { saved.push({ filter: this.filter, shadowColor: this.shadowColor, shadowBlur: this.shadowBlur,
        shadowOffsetX: this.shadowOffsetX, shadowOffsetY: this.shadowOffsetY }); },
      restore() { Object.assign(this, saved.pop()); },
      clearRect(...args) { clears.push({ owner, args }); },
      drawImage(...args) { draws.push({ owner, args, filter: this.filter, color: this.shadowColor,
        blur: this.shadowBlur, x: this.shadowOffsetX, y: this.shadowOffsetY }); },
      getImageData(...args) { reads.push({ owner, args }); return { data: new Uint8ClampedArray(4) }; },
    };
  };
  const target = context('visible');
  const renderer = createAlternativeAuraRenderer({ createCanvas() {
    assert.equal(surfaces.length, 0, 'one work surface is reused for all artwork and aura combinations');
    const canvas = { width: 0, height: 0, getContext: () => context('work') }; surfaces.push(canvas); return canvas;
  } });
  return { renderer, surfaces, draws, clears, reads, target };
}

test('all authored resource orders and resting glows produce bounded independent layers', () => {
  const palette = ['stamina', 'mana', 'hp'];
  const orders = [[]];
  const append = prefix => {
    for (const resource of palette.filter(key => !prefix.includes(key))) {
      const next = [...prefix, resource]; orders.push(next); append(next);
    }
  };
  append([]); assert.equal(orders.length, 16);
  const rests = new Set(['idle', 'guard', 'counter', 'defend', ...Object.keys(COMBAT_POSE_STATES)]);
  for (const rest of rests) for (const frame of ['ready', 'power1', 'power2', 'power3']) {
    for (const paid of orders) for (const active of [true, false]) {
      const text = auraFilter(frame, rest, paid, active), parsed = alternativeAuraLayers(text);
      assert.ok(parsed, text); assert.ok(parsed.shadows.length <= 9);
      const authored = [...text.matchAll(/drop-shadow\((-?[\d.]+)(?:px)? (-?[\d.]+)(?:px)? ([\d.]+)(?:px)? (rgba\([^)]*\)|#[\da-fA-F]+)\)/g)];
      assert.deepEqual(parsed.shadows, authored.map(row => ({ x: +row[1], y: +row[2], blur: +row[3], color: row[4] })));
      assert.equal(parsed.brightness, Number(text.match(/brightness\(([\d.]+)\)/)?.[1] || 1));
    }
  }
  for (const invalid of ['blur(4px)', 'drop-shadow(0 0 -1px #ffffff)', 'brightness(1) drop-shadow(0 0 1px #ffffff)',
    'brightness(1) brightness(2)', 'drop-shadow(0 0 1px #ffffff) unexpected', Array(10).fill('drop-shadow(0 0 1px #ffffff)').join(' ')]) {
    assert.equal(alternativeAuraLayers(invalid), null, invalid);
  }
});

test('independent shadows draw from source alpha at fractional authored placement, body once and brightness once', () => {
  const f = fixture(), image = { width: 256, height: 256 }, filter = auraFilter('power2', 'idle', ['stamina', 'mana'], true);
  const plan = alternativeAuraLayers(filter);
  for (const travel of [0, -12, 12, 45, 21.375, 80]) {
    const begin = f.draws.length, x = 128 + travel;
    f.renderer.draw(f.target, image, filter, x, 16, 512, 512, { materialize: true });
    const rows = f.draws.slice(begin), shadows = rows.slice(0, -2), base = rows.at(-2), final = rows.at(-1);
    assert.equal(shadows.length, 6);
    shadows.forEach((row, i) => {
      assert.equal(row.owner, 'work'); assert.equal(row.args[0], image);
      assert.deepEqual(row.args.slice(2), [16, 512, 512]);
      assert.ok(row.args[1] > 768, 'the extra body copies are wholly outside the stage');
      assert.ok(Math.abs(row.args[1] + row.x - x - plan.shadows[i].x) < 1e-10, 'source compensation preserves the authored offset without pixel rounding');
      assert.equal(row.y, plan.shadows[i].y); assert.equal(row.blur, plan.shadows[i].blur);
      assert.equal(row.color, plan.shadows[i].color); assert.equal(row.filter, 'none');
    });
    assert.deepEqual(base.args, [image, x, 16, 512, 512]); assert.equal(base.color, 'transparent');
    assert.deepEqual(final.args, [f.surfaces[0], 0, 0]); assert.equal(final.filter, 'brightness(1.16)');
  }
  assert.equal(f.surfaces.length, 1); assert.equal(f.surfaces[0].width, 768); assert.equal(f.surfaces[0].height, 544);
  assert.equal(f.reads.length, 6); assert.ok(f.reads.every(row => row.owner === 'visible'));
  assert.equal(f.target.filter, 'none', 'caller state is restored for hit flashing');
});

test('none and unknown future grammar retain original direct rendering; no surface is allocated', () => {
  const f = fixture(), image = {};
  for (const filter of ['none', 'blur(7px) contrast(1.2)']) {
    f.renderer.draw(f.target, image, filter, 149.375, 16);
    assert.deepEqual(f.draws.at(-1).args, [image, 149.375, 16, 512, 512]);
    assert.equal(f.draws.at(-1).filter, filter);
  }
  assert.equal(f.surfaces.length, 0); assert.equal(f.reads.length, 0);
});

test('surface reuse and disposal prevent retained pixels or late allocation/painting', () => {
  const f = fixture();
  for (let n = 0; n < 25; n++) f.renderer.draw(f.target, {}, `drop-shadow(0 0 ${n}px #aabbcc)`, 128, 16);
  assert.equal(f.surfaces.length, 1); assert.equal(f.clears.length, 25);
  f.renderer.dispose(); assert.equal(f.surfaces[0].width, 0); assert.equal(f.surfaces[0].height, 0);
  const count = f.draws.length;
  assert.equal(f.renderer.draw(f.target, {}, 'drop-shadow(0 0 2px #aabbcc)', 128, 16), false);
  assert.equal(f.draws.length, count); assert.equal(f.surfaces.length, 1);
});
