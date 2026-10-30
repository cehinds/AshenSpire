import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlternativeAuraRenderer, alternativeAuraLayers } from '../src/ui/alternativeAuraRenderer.js';
import { auraFilter } from '../src/ui/combatAura.js';
import { COMBAT_POSE_STATES } from '../src/content/combatPoseStates.js';

function fixture(options = {}) {
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
  const renderer = createAlternativeAuraRenderer({ ...options, createCanvas() {
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

test('immutable repeated frames reuse current pixels without allocating another surface or skipping readback', () => {
  const f = fixture(), image = {}, filter = 'drop-shadow(0 0 7px #aabbcc) brightness(1.2)';
  const draw = (source = image, text = filter, x = 128, y = 16, width = 512, height = 512) =>
    f.renderer.draw(f.target, source, text, x, y, width, height, {immutable:true,materialize:true});
  draw();
  const first = f.draws.length;
  draw();
  assert.equal(f.draws.length, first + 1, 'only composite the existing aura on an unchanged frame');
  assert.equal(f.clears.length, 1);
  assert.equal(f.reads.length, 2, 'both first and reused frames materialize when requested');
  assert.equal(f.draws.at(-1).filter, 'brightness(1.2)');
  // A direct draw cannot alter the separate work surface.
  f.renderer.draw(f.target, {}, 'blur(2px)', 0, 0);
  draw(); assert.equal(f.clears.length, 1);
  for (const args of [[{},filter], [image,filter,129], [image,filter,129,17],
    [image,filter,129,17,511], [image,filter,129,17,511,510], [image,'drop-shadow(0 0 8px #aabbcc)']]) {
    const before = f.clears.length; draw(...args);
    assert.equal(f.clears.length, before + 1, 'source, filter and every geometry input invalidate current pixels');
  }
  draw();
  assert.equal(f.surfaces.length, 1, 'the cache owns no additional canvas');
  // A mutable source must render on every call and replace the old work pixels.
  const mutable = {};
  f.renderer.draw(f.target, mutable, filter, 128, 16);
  const before = f.clears.length;
  f.renderer.draw(f.target, mutable, filter, 128, 16);
  assert.equal(f.clears.length, before + 1);
  draw(); assert.equal(f.clears.length, before + 2);
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


test('selected aerial Smash keeps the whole expanded aura surface without changing default dimensions',()=>{
  const f=fixture({canvasHeight:625});
  f.renderer.draw(f.target,{},'drop-shadow(0 0 2px #aabbcc)',-78,-95,768,768);
  assert.equal(f.surfaces[0].width,768);
  assert.equal(f.surfaces[0].height,625);
  assert.deepEqual(f.clears[0].args,[0,0,768,625]);
  assert.deepEqual(f.draws.at(-2).args.slice(1),[-78,-95,768,768],'source registration stays pixel exact on the larger surface');
  assert.deepEqual(f.draws.at(-1).args,[f.surfaces[0],0,0]);
  f.renderer.dispose();
});

test('the selected turning Sweep aura retains both horizontal margins at the original logical size',()=>{
  const f=fixture({canvasWidth:932,canvasHeight:625});
  f.renderer.draw(f.target,{},'drop-shadow(0 0 2px #aabbcc)',-53,-173,1024,1024);
  assert.deepEqual([f.surfaces[0].width,f.surfaces[0].height],[932,625]);
  assert.deepEqual(f.clears[0].args,[0,0,932,625]);
  assert.deepEqual(f.draws.at(-2).args.slice(1),[-53,-173,1024,1024]);
  assert.deepEqual(f.draws.at(-1).args,[f.surfaces[0],0,0]);
  f.renderer.dispose();
});

test('opt-in fixed phase reuse preserves pixels, filter and materialization with four bounded entries',()=>{
  const surfaces=[],draws=[];
  const context=owner=>({save(){},restore(){},clearRect(){},drawImage(...args){draws.push({owner,args,filter:this.filter});},getImageData(){draws.push({owner,read:true});}});
  const visible=context('visible');
  const renderer=createAlternativeAuraRenderer({createCanvas(){const canvas={width:0,height:0,getContext:()=>context('surface'+surfaces.length)};surfaces.push(canvas);return canvas;}});
  const filter=auraFilter('class-smash-impact','smash',['stamina'],true),image={};
  renderer.draw(visible,image,filter,120.5,17,340.25,440,{reuse:true});
  const before=draws.length;
  renderer.draw(visible,image,filter,120.5,17,340.25,440,{reuse:true,materialize:true});
  assert.deepEqual(draws.slice(before).map(row=>[row.owner,!!row.read]),[['visible',false],['visible',true]],'cached phase draws only the exact composed surface and retains the contact readback');
  assert.equal(draws[before].args[0],surfaces[1]);
  for(let i=0;i<4;i++)renderer.draw(visible,{},filter,120.5,17,340.25,440,{reuse:true});
  assert.equal(surfaces[1].width,0,'oldest phase canvas is released when the four-entry budget is exceeded');
  const bright=auraFilter('power2','idle',['stamina','mana'],true);
  renderer.draw(visible,image,bright,125.75,9.5,340.25,440,{reuse:true});
  const brightBefore=draws.length;
  renderer.draw(visible,image,bright,125.75,9.5,340.25,440,{reuse:true});
  assert.equal(draws.length,brightBefore+1,'same brightness/placement is reused without shadow work');
  assert.equal(draws.at(-1).filter,'brightness(1.16)','cached brightness is applied exactly once');
  renderer.draw(visible,image,bright,126.75,9.5,340.25,440,{reuse:true});
  assert.ok(draws.length>brightBefore+2,'a changed placement cannot use stale cached geometry');
  renderer.dispose();assert.ok(surfaces.every(surface=>surface.width===0&&surface.height===0));
});

test('a still (Effects off) aura rasterizes once per artwork + glow and never reads pixels back', () => {
  const surfaces = [], draws = [], reads = [];
  const context = owner => ({
    filter: 'none', shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    save() {}, restore() {}, clearRect() {},
    drawImage(...args) { draws.push({ owner, args, blur: this.shadowBlur }); },
    getImageData() { reads.push(owner); return { data: new Uint8ClampedArray(4) }; },
  });
  const renderer = createAlternativeAuraRenderer({ createCanvas() {
    const canvas = { width: 0, height: 0, getContext: () => context('surface' + surfaces.length) }; surfaces.push(canvas); return canvas;
  } });
  const target = context('visible');
  const image = { name: 'body' }, other = { name: 'pose2' };
  const glow = auraFilter('ready', 'bulwark', [], false);
  assert.notEqual(glow, 'none', 'the held stance has a glow to keep');
  const shadowed = () => draws.filter(d => d.owner !== 'visible' && d.blur > 0).length;
  for (let frame = 0; frame < 10; frame++) {
    // the body drifts a little each frame (a lunge); the glow bitmap is only shifted
    assert.equal(renderer.draw(target, image, glow, 128 + frame, 16, 512, 512, { still: true, materialize: false }), true);
  }
  const once = shadowed();
  assert.ok(once > 0, 'the glow was rasterized');
  assert.equal(surfaces.length, 1, 'one baked bitmap for ten frames');
  assert.equal(reads.length, 0, 'no getImageData readback');
  assert.equal(draws.filter(d => d.owner === 'visible').length, 10, 'each frame is a single blit');
  renderer.draw(target, other, glow, 128, 16, 512, 512, { still: true });
  assert.equal(surfaces.length, 2, 'a new pose is a new key');
  renderer.draw(target, image, glow, 140, 16, 512, 512, { still: true });
  assert.equal(surfaces.length, 2, 'going back to a known key reuses its bitmap');
});
