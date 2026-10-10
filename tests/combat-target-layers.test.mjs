// Source-side contract only: evaluate the declared layers/geometry against the
// original screenreach patch predicate. Chromium still owns the real cascade,
// pseudo-element hit testing and tooltip/inspection acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const layers = read('../styles/combat-layers.css').replace(/\/\*[\s\S]*?\*\//g, '');
const geometry = read('../styles/combat.css').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), declarations: Object.fromEntries(
    body.split(';').filter(x => x.includes(':')).map(x => {
      const at = x.indexOf(':'); return [x.slice(0, at).trim(), x.slice(at + 1).trim().replace(/\s*!important$/, '')];
    })) }));
const all = rules(layers);
const pick = predicate => {
  const rule = all.find(predicate); assert.ok(rule, 'required combat layer rule exists'); return rule;
};
const proxy = pick(r => r.selector.includes('.combatant:is(') && r.selector.endsWith('::before'));
const enemyProxy = pick(r => r.selector.includes('.combatant.enemy-target-hitbox') && r.selector.endsWith('::before'));
const visual = pick(r => r.selector.includes('.enemy-target-hitbox') && r.selector.endsWith('::after'));
const reading = pick(r => r.selector.includes(':is(.nm,.meters,.statuses)') && r.declarations['z-index']);
const leading = pick(r => r.selector.endsWith('.combatant-leading'));
const inspector = pick(r => r.selector.includes('.combatant-inspector-host'));
const plate = rules(geometry).find(r => r.selector.endsWith('.combatant:is(.enemy-target-hitbox,.player-target-hitbox)::after'));
assert.ok(plate);

function numeric(value, vars) {
  while (value.includes('var(')) {
    const at = value.indexOf('var('); let end = at + 4, depth = 1;
    while (depth) { if (value[end] === '(') depth++; if (value[end] === ')') depth--; end++; }
    const args = value.slice(at + 4, end - 1), comma = args.indexOf(',');
    const name = (comma < 0 ? args : args.slice(0, comma)).trim();
    const replacement = vars[name] ?? args.slice(comma + 1).trim();
    assert.ok(replacement != null && replacement !== '', `custom property ${name} resolves`);
    value = value.slice(0, at) + replacement + value.slice(end);
  }
  const expression = value.replace(/px\b/g, '').replace(/\bcalc\(/g, '(').replace(/\bmin\(/g, 'Math.min(');
  assert.match(expression.replaceAll('Math.min', ''), /^[\d\s.+*/(),\-]+$/);
  return Function(`return (${expression})`)();
}
const z = rule => numeric(rule.declarations['z-index'], { '--combat-layer-selection': 500 });
const reachSource = read('../tools/screenreach.mjs');
const reachAt = reachSource.indexOf('  const exposedPatch = ');
assert.ok(reachAt >= 0);
const reachCode = reachSource.slice(reachAt, reachSource.indexOf('\n  for (const c of all)', reachAt)) + '\nexposedPatch';

function fixture({ zoom = 1, includeProxy = true, higherControl = false, enemy = false, plateWidth = 104 } = {}) {
  const vars = { '--ui-zoom': zoom, '--enemy-hit-x': `${148 / zoom}px`, '--enemy-hit-y': `${122 / zoom}px`,
    '--enemy-hit-width': `${plateWidth / zoom}px`, '--enemy-hit-height': `${44 / zoom}px` };
  const bounds = { left: 148 - plateWidth / 2, right: 148 + plateWidth / 2, top: 100, bottom: 144 };
  const frame = {}, name = {}, hp = {}, statuses = {}, control = {};
  const surfaces = [
    { node: frame, bounds, z: z(visual) },
    { node: name, bounds: { ...bounds, bottom: 120 }, z: z(reading) },
    { node: hp, bounds: { ...bounds, top: 120, bottom: 132 }, z: z(reading) },
    { node: statuses, bounds: { ...bounds, top: 132 }, z: z(reading) },
  ];
  const width = numeric(proxy.declarations.width, vars) * zoom;
  const height = numeric(proxy.declarations.height, vars) * zoom;
  const x = numeric((enemy ? enemyProxy : proxy).declarations.left, vars) * zoom, y = numeric(proxy.declarations.top, vars) * zoom;
  if (includeProxy) surfaces.push({ node: frame, z: z(proxy),
    bounds: { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 } });
  if (higherControl) surfaces.push({ node: control, z: z(leading), bounds });
  const hit = (px, py) => surfaces.filter(({ bounds: b }) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom)
    .sort((a, b) => b.z - a.z)[0]?.node;
  const patch = runInNewContext(reachCode, { innerWidth: 390, innerHeight: 650,
    document: { elementFromPoint: hit } });
  return { patch: () => patch(frame, 24, bounds, top => top === frame), hit, frame, name, hp, control, width, height, x, y, bounds };
}

test('enemy name center inspects beside a full frame-owned square within the original footer', () => {
  const old = fixture();
  assert.equal(old.hit(148, 110), old.frame, 'the old centered cap intercepts the name center');
  for (const zoom of [0.65, 0.738, 1, 1.5]) {
    for (const plateWidth of [96, 104]) {
      const f = fixture({ zoom, enemy: true, plateWidth });
      assert.equal(f.hit(148, 110), f.name, 'unchanged name-button center owns its real hit');
      assert.equal(f.hit(f.x, f.y), f.frame);
      assert.equal(f.width, 44); assert.equal(f.height, 44);
      assert.equal(f.patch(), true, 'original five-point24px patch predicate still passes');
      assert.ok(Math.abs(f.x - 22 - f.bounds.left) < 1e-9, 'core left edge shares the footer edge within arithmetic precision');
      assert.ok(f.x + 22 <= f.bounds.right + 1e-9);
      assert.equal(f.y, 122); assert.equal(f.hit(186, 125), f.hp);
    }
  }
  const covered = fixture({ enemy: true, higherControl: true });
  assert.equal(covered.patch(), false, 'explicit overlapping inspection controls remain obstructing');
});

test('the transparent frame square restores the original 24px predicate over its own HP strips', () => {
  assert.equal(fixture({ includeProxy: false }).patch(), false, 'old own-name/HP/status strips leave no frame-owned patch');
  for (const zoom of [0.65, 0.738, 1, 1.5]) {
    const f = fixture({ zoom });
    assert.equal(f.width, 44); assert.equal(f.height, 44);
    assert.equal(f.patch(), true, `physical tap square at zoom ${zoom}`);
    assert.equal(f.hit(110, 110), f.name, 'outer name remains an inspection surface');
    assert.equal(f.hit(186, 125), f.hp, 'outer HP remains a tooltip surface');
  }
});

test('inspection and leading controls keep priority over the tap square', () => {
  assert.ok(z(visual) < z(reading) && z(reading) < z(proxy));
  assert.ok(z(proxy) < z(leading) && z(leading) < z(inspector));
  const f = fixture({ higherControl: true });
  assert.equal(f.hit(148, 122), f.control);
  assert.equal(f.patch(), false, 'the strict predicate still rejects an overlapping explicit control');
});

test('the player proxy paints nothing and shares the fitted center, height and transform', () => {
  // Packing may shift only the transparent core (--enemy-core-x/y); without
  // that override the proxy resolves to exactly the plate's fitted center.
  const unpacked = value => value?.replace(/^var\(--enemy-core-([xy]), (.*)\)$/, '$2');
  for (const property of ['left', 'top']) {
    assert.match(proxy.declarations[property], /^var\(--enemy-core-[xy], /, `${property} accepts only the core override`);
    assert.equal(unpacked(proxy.declarations[property]), plate.declarations[property]);
    assert.doesNotMatch(plate.declarations[property], /--enemy-core/, 'the visible plate never follows the packed core');
  }
  for (const property of ['height', 'transform']) assert.equal(proxy.declarations[property], plate.declarations[property]);
  assert.equal(proxy.declarations.background, 'none');
  assert.equal(proxy.declarations.border, '0');
  assert.equal(proxy.declarations['box-shadow'], 'none');
  assert.equal(proxy.declarations['pointer-events'], 'auto');
  assert.ok(proxy.selector.includes(":root .combat[data-layout='formation']"));
  assert.ok(proxy.selector.includes(':not(.dead)'), 'dead actors do not gain an auto-pointer child');
  assert.ok(proxy.selector.includes('.enemy-target-hitbox,.player-target-hitbox'));
  assert.equal(visual.declarations.background, undefined, 'the existing visual plate is not repainted');
  assert.equal(reading.declarations.visibility, undefined, 'name/HP/status remain visible');
  assert.equal(reading.declarations['pointer-events'], undefined, 'reading controls keep their existing pointer semantics');
});
