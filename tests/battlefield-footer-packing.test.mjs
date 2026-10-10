import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { combatTargetAnchors } from '../src/ui/models/CombatOverheadModel.js';

// Exercise the production measurement/packing block with screen-space DOM boxes.
const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const block = stage.slice(stage.indexOf('    placePlayerHud();\n    const boxes'), stage.indexOf('    for (const frame of frames) fitIconTray'));
const rect = (left, top, width, height) => ({ left, right: left + width, top, bottom: top + height, width, height });
const node = box => ({ style: { translate: '', setProperty() {} }, getBoundingClientRect() {
  const [x = 0, y = 0] = this.style.translate.split(' ').map(value => parseFloat(value) || 0);
  return rect(box.left + x, box.top + y, box.width, box.height);
} });
function pack({ narrow = false, height = 390, obstacles = [] } = {}) {
  let hudPlaced = false;
  const footers = [node(rect(300, 193, 104, 20)), node(rect(300, 216, 104, 23))];
  const frame = { style: { setProperty() {} }, dataset: { eid: 'enemy' }, classList: { contains: name => name === 'enemy-target-hitbox' },
    getBoundingClientRect: () => rect(300, 100, 104, 110),
    querySelector: selector => selector === '.intent' ? { ...node(rect(300, 70, 104, 44)), dataset: {} } : null,
    querySelectorAll: selector => selector.includes('.combatant-card') ? footers : [] };
  const context = {
    placed: [{ frame, sprite: { style: { setProperty() {} }, firstElementChild: node(rect(300, 100, 104, 90)), getBoundingClientRect: () => rect(300, 100, 104, 90), querySelector: () => node(rect(300, 100, 104, 90)) } }],
    zoom: 1, VIEWPORT_ORIGIN: rect(0, 0, 0, 0),
    anchorLocalBox: (origin, box) => ({ left: box.left - origin.left, top: box.top - origin.top }),
    targetOutline: () => ({ width: 1, offset: 1 }),
    fieldRect: rect(0, 0, 650, 320), window: { innerHeight: height }, narrow,
    placePlayerHud: () => { hudPlaced = true; }, combatTargetAnchors,
    combat: { dataset: { waistOverlap: 'false' }, querySelectorAll: selector => {
      assert.ok(hudPlaced, 'the player HUD must be placed before its obstacle is measured');
      assert.match(selector, /\.hand/); assert.match(selector, /\.hand \.card/); assert.match(selector, /\.player \.combatant-mini-hud/);
      return obstacles.map(node);
    } },
  };
  const first = runInNewContext('(() => {' + block + '\nreturn targets;})()', context);
  const bounds = footers.map(footer => footer.getBoundingClientRect());
  const second = runInNewContext('(() => {' + block + '\nreturn targets;})()', context);
  assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(JSON.stringify(first)), 'repeated refreshes do not drift');
  obstacles.forEach(obstacle => bounds.forEach(box => assert.ok(box.right + 2 <= obstacle.left || box.left >= obstacle.right + 2
    || box.bottom + 2 <= obstacle.top || box.top >= obstacle.bottom + 2, 'applied visible footer clears the obstacle')));
  return first;
}

test('runtime packs compact footers above the hand and enlarged cards', () => {
  const [target] = pack({ obstacles: [rect(0, 220, 650, 100), rect(250, 195, 200, 125)] });
  assert.equal(target.obstructed, undefined); assert.ok(target.y + 23 <= 193);
  assert.equal(target.x, 352, 'a clear vertical slot keeps its actor center');
});
test('runtime reserves the player details panel together with the hand', () => {
  const [target] = pack({ narrow: true, height: 844, obstacles: [rect(0, 195, 650, 125), rect(280, 90, 144, 95)] });
  assert.equal(target.obstructed, undefined);
  assert.ok(target.x + 52 <= 278 || target.x - 52 >= 426 || target.y + 22 <= 88);
});
test('normal-height wide combat preserves attached footers', () => {
  const [target] = pack({ height: 900, obstacles: [] });
  assert.equal(target.x, 352); assert.equal(target.y, 216);
});
