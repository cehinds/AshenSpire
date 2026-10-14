import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../tools/screenreach.mjs', import.meta.url), 'utf8');
const begin = source.indexOf('  const visible = node => {', source.indexOf('const INTENT_OVERLAP ='));
const end = source.indexOf('  const a = intent.getBoundingClientRect()', begin);
assert.ok(begin > 0 && end > begin);
const selection = source.slice(begin, end);

function fixture(depths, { hidden = [], dead = [], separate = false } = {}, code = selection) {
  const parent = {};
  const frames = depths.map((z, index) => {
    const node = kind => ({ kind, index, zIndex: String(z), display: hidden.includes(index) ? 'none' : 'block',
      visibility: 'visible', getBoundingClientRect: () => ({ width: 44, height: 80 }) });
    const sprite = node('sprite'), intent = node('intent');
    return { parentElement: separate ? {} : parent, sprite, intent,
      classList: { contains: name => name === 'dead' && dead.includes(index) },
      querySelector: selector => selector === '.intent' ? intent : sprite };
  });
  return runInNewContext(code + '\n({low, high, intent, sprite})', {
    document: { querySelectorAll: () => frames }, getComputedStyle: node => node,
  });
}

test('actual overlap setup retains the original distinct-depth adversary', () => {
  const result = fixture([202, 200, 201]);
  assert.equal(result.intent.index, 1);
  assert.equal(result.sprite.index, 0);
});

test('captured1518 equal-depth enemies use earlier intent and later sibling artwork', () => {
  const result = fixture([200, 200, 200]);
  assert.equal(result.intent.index, 0);
  assert.equal(result.sprite.index, 1);
  assert.equal(result.sprite.zIndex, '200', 'fixture never invents a sprite layer');
  assert.equal(result.intent.zIndex, '200');
});

test('actual selection skips dead and hidden actors but rejects an absent pair', () => {
  const result = fixture([200, 200, 200], { dead: [0] });
  assert.equal(result.intent.index, 1);
  assert.equal(result.sprite.index, 2);
  assert.throws(() => fixture([200, 200], { hidden: [0] }), /missing its two enemies/);
  assert.throws(() => fixture([200]), /missing its two enemies/);
});

test('equal-depth actors require shared sibling painting context and numeric layers', () => {
  assert.throws(() => fixture([200, 200], { separate: true }), /ordered same-depth siblings/);
  assert.throws(() => fixture(['auto', 200]), /numeric sprite depth/);
});

test('captured equal-depth setup rejects the original strict-depth-only assumption', () => {
  const original = `const frames = [...document.querySelectorAll('.combatant.enemy')];
    const depth = frame => Number(getComputedStyle(frame.querySelector('.combatant-card > .sprite')).zIndex);
    const low = frames.reduce((a, b) => depth(a) < depth(b) ? a : b);
    const high = frames.find(frame => depth(frame) > depth(low));
    const intent = low?.querySelector('.intent');
    const sprite = high?.querySelector('.combatant-card > .sprite');
    if (!intent || !sprite) throw new Error('screenreach: intent overlap fixture is missing its two enemies');`;
  assert.throws(() => fixture([200, 200, 200], {}, original), /missing its two enemies/);
});

test('actual fixture moves the complete reading host coherently and keeps uniform neighbouring art cover', () => {
  const begin=source.indexOf('  const intentHost = intent.closest('),end=source.indexOf('  const b = sprite.getBoundingClientRect()',begin);
  assert.ok(begin>0&&end>begin);
  const zoom=.83,spriteScale=.1773,a={left:70.891,top:100.742,width:88,height:26};
  const grown={left:170,top:100,width:104,height:125};
  let dx=0,dy=0;
  const style={set transform(value){const match=value.match(/^translate\(([^p]+)px, ([^p]+)px\) /);assert.ok(match);dx=Number(match[1])*zoom;dy=Number(match[2])*zoom;this.savedTransform=value;}};
  const host={style},intent={closest:()=>host,getBoundingClientRect:()=>({...a,left:a.left+dx,top:a.top+dy})};
  const sprite={style:{}};
  runInNewContext(source.slice(begin,end),{intent,sprite,zoom,spriteScale,a,grown,
    fieldBox:{left:0,top:73.578,width:390,height:282.953},getComputedStyle:()=>({transform:'matrix(1, 0, 0, 1, 0, -57.8313)'})});
  assert.match(style.savedTransform,/matrix\(1, 0, 0, 1, 0, -57\.8313\)$/,'the complete authored host transform is retained');
  const [tx,ty]=sprite.style.translate.split(' ').map(parseFloat),left=grown.left+tx*spriteScale,top=grown.top+ty*spriteScale;
  const canonical=intent.getBoundingClientRect();
  assert.ok(left<=canonical.left&&left+grown.width>=canonical.left+canonical.width);
  assert.ok(top<=canonical.top&&top+grown.height>=canonical.top+canonical.height);
  assert.equal(sprite.style.scale,undefined,'placement does not distort the grown uniform scale');
});
