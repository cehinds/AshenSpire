import test from 'node:test';
import assert from 'node:assert/strict';
import { combatReadoutLayer, floatNum, callout, clearCallouts, setAnimSpeed } from '../src/ui/fx.js';
import { withKitDom } from './helpers/kit-dom.mjs';

test('root text feedback uses the root ruler and expires without touching sprite effects', context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  withKitDom(({ document }) => {
    const create = document.createElement.bind(document);
    document.createElement = name => Object.assign(create(name), { offsetWidth: 40, offsetHeight: 20 });
    const combat = document.createElement('div'); combat.className = 'combat';
    const fx = document.createElement('div'); fx.className = 'fx-layer'; combat.appendChild(fx);
    const spriteEffect = document.createElement('div'); fx.appendChild(spriteEffect);
    const anchor = document.createElement('div');
    anchor.box = { left: 220, top: 180, width: 80, height: 120 };
    const host = combatReadoutLayer(fx);
    host.box = { left: 20, top: 30, width: 600, height: 700 };
    fx.box = { left: 100, top: 100, width: 200, height: 200 };
    assert.equal(host.parentNode, combat);
    assert.equal(host.style.zIndex, '800');
    assert.equal(combatReadoutLayer(fx), host, 'one host is reused');
    const number = floatNum(fx, anchor, '-7', 'dmg', null, { jitter: false });
    assert.equal(number.parentNode, host);
    assert.equal(number.style.left, '240px', 'root-relative centre ignores the old FX origin');
    assert.equal(number.style.top, '180px');
    setAnimSpeed('normal');
    const word = callout(fx, anchor, 'enemy', 'critical');
    assert.equal(word.parentNode, host);
    clearCallouts(fx);
    assert.ok(!host.children.includes(word));
    assert.ok(host.children.includes(number), 'numbers retain their existing lifetime');
    assert.equal(callout(fx, anchor, 'enemy', 'critical')?.parentNode, host, 'skip clears the deduplication queue');
    context.mock.timers.tick(1000);
    assert.equal(host.children.length, 0);
    assert.ok(fx.children.includes(spriteEffect));
    host.remove();
    assert.notEqual(combatReadoutLayer(fx), host, 'a removed host is recreated');
  });
});
