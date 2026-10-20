import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRangeActionPlan, rangeHitLabel } from '../src/ui/models/CombatRangeActionModel.js';
const target = { targetId: 'e1', band: 1, currentInRange: false, currentHitChance: 0, inRange: true, hitChance: 73.25, precisionDelta: 0 };
const quote = () => ({ range: { enabled: true, selectedRoute: 'advance', targets: [target], routes: [
  { id: 'advance', available: true, affordable: false, advanceSp: 1, precisionDelta: 0, costs: { energy: 3, stamina: 3, mana: 0 }, targets: [target] },
  { id: 'throw', available: true, affordable: true, advanceSp: 0, precisionDelta: -1, costs: { energy: 2, stamina: 2, mana: 0 }, targets: [{ ...target, hitChance: 66.5, precisionDelta: -1 }] },
] } });
test('current unreachable chance stays zero, separate from quoted after-route odds', () => {
  const q = quote();
  assert.equal(rangeHitLabel(q), 'Out of range · 0%');
  assert.equal(rangeHitLabel(q, { current: false }), '73.25%');
  const plan = combatRangeActionPlan(q, { targetName: () => 'Soldier' });
  assert.equal(plan.routes[0].label, 'Advance · +1 SP');
  assert.equal(plan.routes[0].total, 'Total 3 SP');
  assert.match(plan.routes[0].odds[0].text, /Soldier · Reach · Out of range · 0% → After Advance 73.25%/);
  assert.equal(plan.routes[1].label, 'Throw · -1 Precision');
  assert.equal(plan.routes[1].total, 'Total 2 SP');
  assert.equal(plan.selectedRoute, 'advance', 'unaffordable Advance never silently selects Throw');
});
test('disabled mechanics have no attachment and a refused Throw is never repriced as Advance', () => {
  assert.equal(combatRangeActionPlan({}), null);
  const q = quote(); q.range.selectedRoute = 'throw'; q.range.routes[1].available = false; q.range.routes[1].reason = 'range';
  const plan = combatRangeActionPlan(q);
  assert.equal(plan.selectedRoute, 'throw'); assert.equal(plan.routes[1].available, false);
  assert.equal(plan.routes[1].reason, 'Unavailable at this distance'); assert.equal(plan.routes[1].total, 'Total 2 SP');
});
test('multi-target approach prints every engine-quoted target and chance', () => {
  const q = quote(); q.range.routes[0].targets.push({ ...target, targetId: 'e2', band: 2, hitChance: 41.1 });
  const plan = combatRangeActionPlan(q);
  assert.equal(plan.routes[0].odds.length, 2); assert.match(plan.routes[0].odds[1].text, /e2 · Ranged.*41.1%/);
});

test('route controls keep native keyboard ownership and send only the chosen id', async () => {
  const { combatRangeAction } = await import('../src/ui/components/combatRangeAction.js');
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  withKitDom(({ document, Event }) => {
    const chosen = [];
    const node = combatRangeAction(quote(), { onChoose: id => chosen.push(id) });
    document.body.append(node);
    assert.equal(node.dataset.uiComponent, 'combat-range-action');
    const buttons = node.querySelectorAll('button');
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
    assert.equal(buttons[0].disabled, false, 'an unaffordable route remains readable/selectable');
    buttons[1].dispatchEvent(new Event('click', { bubbles: true }));
    assert.deepEqual(chosen, ['throw']);
    const tab = new Event('keydown', { key: 'Tab', bubbles: true });
    node.dispatchEvent(tab);
    assert.equal(tab.propagationStopped, true);
    assert.equal(tab.defaultPrevented, false, 'native Tab still moves focus within controls');
  });
});

test('unaffordable default remains selectable without changing its route or price', async () => {
  const { canChooseRangeRoute } = await import('../src/ui/models/CombatRangeActionModel.js');
  const q = quote();
  assert.equal(canChooseRangeRoute(q), true);
  assert.equal(q.range.selectedRoute, 'advance');
  assert.equal(q.range.routes[0].affordable, false);
  assert.equal(q.range.routes[0].costs.energy, 3);
  q.range.enabled = false;
  assert.equal(canChooseRangeRoute(q), false);
});

test('fully covered attacks keep the face clear while target odds retain Reach benefit', () => {
  const q = quote();
  q.range.targets = [{ ...target, band: 0, currentInRange: true, currentHitChance: 80, hitChance: 80, precisionDelta: 1 }];
  q.range.routes.forEach(route => { route.advanceSp = 0; route.targets = q.range.targets; });
  assert.equal(combatRangeActionPlan(q), null);
  assert.equal(rangeHitLabel(q), '80% · +1 Precision');
});
test('Throw beyond its extension is omitted unless explicitly selected, then stays refused', () => {
  const q = quote(); q.range.routes[1].available = false;
  q.range.routes[1].targets = [{ ...target, band: 2, inRange: false, hitChance: 0 }];
  assert.deepEqual(combatRangeActionPlan(q).routes.map(route => route.id), ['advance']);
  q.range.selectedRoute = 'throw';
  const refused = combatRangeActionPlan(q).routes.find(route => route.id === 'throw');
  assert.equal(refused.available, false); assert.equal(refused.selected, true);
});

test('paid Counter variants show their own canonical route total and return odds', async () => {
  const { summarizeCardOption } = await import('../src/ui/models/CardOptionSummaryModel.js');
  const q = quote();
  const option = { id: 'counter-throw', name: 'Counter', play: { cardInstanceId: 'c1', rangeRoute: 'throw' }, staminaCost: 99, range: q.range };
  const summary = summarizeCardOption({ enemies: new Map([['soldier', { name: 'Soldier' }]]) }, { enemies: [{ id: 'e1', enemyId: 'soldier' }] }, option);
  assert.ok(summary.costs.includes('Throw · -1 Precision'));
  assert.ok(summary.costs.includes('Total 2 SP'));
  assert.match(summary.costs.join(' '), /Soldier.*Throw 66.5%/);
  assert.doesNotMatch(summary.costs.join(' '), /99/);
  assert.equal(summary.id, 'counter-throw', 'the modal still returns the engine option identity');
});

test('window capture preserves native route Enter and route Tab cannot switch a co-op seat', async () => {
  const { initInput, focusElement, clearFocus } = await import('../src/ui/input.js');
  const { combatRangeAction } = await import('../src/ui/components/combatRangeAction.js');
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  withKitDom(({ document, Event }, _window, listeners) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const previousStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
    globalThis.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
    try {
      const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
      const staleCard = document.createElement('button'); staleCard.className = 'card'; app.append(staleCard);
      focusElement(staleCard);
      initInput();
      let seatsChanged = 0, cancelled = 0;
      const root = combatRangeAction(quote(), { onCancel: () => { cancelled += 1; } });
      app.append(root);
      const button = root.querySelector('button'); button.focus();
      const enter = new Event('keydown', { key: 'Enter', target: button, bubbles: true });
      // Exercise the installed production window capture before component bubbling.
      for (const handler of listeners.get('keydown').slice(0, 2)) handler(enter);
      assert.equal(enter.defaultPrevented, false, 'global confirm cannot activate its stale card cursor');
      const tab = new Event('keydown', { key: 'Tab', target: button, bubbles: true });
      root.dispatchEvent(tab);
      if (!tab.propagationStopped) seatsChanged += 1;
      assert.equal(seatsChanged, 0); assert.equal(tab.defaultPrevented, false);
      root.dispatchEvent(new Event('keydown', { key: 'Escape', target: button, bubbles: true }));
      assert.equal(cancelled, 1);
      clearFocus();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator;
      if (previousStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = previousStyle;
    }
  });
});

test('mixed weapon coverage never prints a false single chance or whole-attack zero', () => {
  const q = quote();
  const mixed = { ...target, currentInRange: false, currentHitChance: null, currentHitChances: [0, 82.5], hitChance: null, hitChances: [68, 82.5],
    contacts: [{ currentInRange: false, inRange: true }, { currentInRange: true, inRange: true }] };
  q.range.targets = [mixed]; q.range.routes[0].targets = [mixed];
  assert.equal(rangeHitLabel(q), '0–82.5% (varies by hit)');
  assert.equal(rangeHitLabel(q, { current: false }), '68–82.5% (varies by hit)');
  assert.match(combatRangeActionPlan(q).routes[0].odds[0].text, /After Advance 68–82.5% \(varies by hit\)/);
});

test('configured free Advance still appears for a partially uncovered mixed action', () => {
  const q = quote();
  const mixed = { ...target, currentInRange: true, allCurrentInRange: false, currentHitChance: null, currentHitChances: [0, 80], contacts: [{ currentInRange: false, inRange: true }, { currentInRange: true, inRange: true }] };
  q.range.targets = [mixed]; q.range.routes[0].targets = [mixed]; q.range.routes[0].advanceSp = 0;
  assert.equal(combatRangeActionPlan(q).routes[0].label, 'Advance · +0 SP');
});

test('range attachment cleanup removes resize/transition listeners, observers and pending layout', async () => {
  const { mountCombatRangeAction } = await import('../src/ui/components/combatRangeAction.js');
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  withKitDom(({ document, window, Event }) => {
    const listeners = new Map(), observers = [], frames = new Set(), cancelled = [];
    let nextFrame = 0;
    window.addEventListener = (type, callback) => listeners.set(type, [...(listeners.get(type) || []), callback]);
    window.removeEventListener = (type, callback) => listeners.set(type, (listeners.get(type) || []).filter(fn => fn !== callback));
    globalThis.requestAnimationFrame = () => { const id = ++nextFrame; frames.add(id); return id; };
    globalThis.cancelAnimationFrame = id => { frames.delete(id); cancelled.push(id); };
    class Observer {
      constructor() { this.disconnected = false; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    }
    const priorResize = globalThis.ResizeObserver;
    globalThis.ResizeObserver = globalThis.MutationObserver = Observer;
    try {
      const host = document.createElement('div'); host.className = 'hand-overlay';
      const card = document.createElement('div'); card.className = 'card';
      document.body.append(host); host.append(card);
      const cleanup = mountCombatRangeAction(card, quote(), {});
      assert.equal(listeners.get('resize').length, 1);
      assert.equal(observers.length, 2);
      assert.equal(frames.size, 1);
      assert.equal(host.querySelectorAll('.combat-range-action').length, 1);
      cleanup();
      assert.equal(listeners.get('resize').length, 0);
      assert.equal(frames.size, 0);
      assert.deepEqual(cancelled, [1]);
      assert.ok(observers.every(observer => observer.disconnected));
      assert.equal(host.querySelectorAll('.combat-range-action').length, 0);
      card.dispatchEvent(new Event('transitionend'));
      for (const callback of listeners.get('resize')) callback();
      assert.equal(frames.size, 0, 'a detached attachment schedules no later layout');
    } finally {
      if (priorResize === undefined) delete globalThis.ResizeObserver;
      else globalThis.ResizeObserver = priorResize;
    }
  });
});
