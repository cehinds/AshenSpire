// Portable rules runtime: engine/runtime/interpreter.mjs (docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md).
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRuntime, loadMechanic, loadMechanics, runCases, createState, PORTABLE_OPS, MAX_DEPTH } from '../engine/runtime/interpreter.mjs';

const ops = JSON.parse(readFileSync(new URL('../engine/runtime/ops.json', import.meta.url), 'utf8'));
const fixtures = fileURLToPath(new URL('./fixtures/mechanics/', import.meta.url));

// Build an in-memory mechanic: slug, handlers [{ on, do, when? }], optional interface.
function mech(slug, handlers, iface = {}) {
  return [slug, { manifest: { id: slug }, model: {}, interface: { mechanic: slug, ...iface }, service: { mechanic: slug, handlers }, cases: [] }];
}
function rt(...mechanics) { return createRuntime({ mechanics: new Map(mechanics) }); }
// A one-command runtime: run `steps` as command.go with params.
function run(steps, state, params = {}) {
  return rt(mech('t', [{ on: 'command.go', do: steps }])).command(state, 't.go', params);
}
const ent = (o = {}) => ({ hp: 10, maxHp: 10, ...o });

// ----- loading -----
test('loadMechanic reads the files mechanic.json names', () => {
  const m = loadMechanic(`${fixtures}fx_heal`);
  assert.equal(m.manifest.id, 'fx_heal');
  assert.equal(m.interface.mechanic, 'fx_heal');
  assert.equal(m.service.handlers.length, 2);
  assert.equal(m.cases.length, 4);
  assert.equal(m.model['x-attach'], 'none');
});

test('loadMechanics maps slug to mechanic and skips folders without mechanic.json', () => {
  const all = loadMechanics(fixtures);
  assert.deepEqual([...all.keys()], ['fx_heal']);
  assert.equal(loadMechanics(`${fixtures}missing`).size, 0);
});

test('the fixture mechanic passes its own cases through runCases', () => {
  const m = loadMechanic(`${fixtures}fx_heal`);
  const results = runCases(m, createRuntime({ mechanics: new Map([['fx_heal', m]]) }));
  assert.equal(results.length, 4);
  for (const r of results) assert.ok(r.ok, `${r.name}: ${r.error}`);
});

test('runCases reports a failing case with its reason', () => {
  const m = loadMechanic(`${fixtures}fx_heal`);
  m.cases = [{ name: 'wrong', given: { entities: { self: { hp: 1, maxHp: 10 } } }, when: { command: 'fx_heal.heal', with: { target: 'self', amount: 2 } }, then: { entities: { self: { hp: 99 } }, events: ['fx_heal.nope'] } }];
  const [r] = runCases(m, createRuntime({ mechanics: new Map([['fx_heal', m]]) }));
  assert.equal(r.ok, false);
  assert.match(r.error, /entities\.self\.hp: expected 99, got 3/);
});

test('runCases checks event order and event-driven cases', () => {
  const runtime = rt(mech('a', [{ on: 'event.a.ping', do: [{ emit: 'a.pong', with: {} }] }]));
  const m = { cases: [
    { name: 'order ok', when: { event: 'a.ping' }, then: { events: ['a.ping', 'a.pong'] } },
    { name: 'order wrong', when: { event: 'a.ping' }, then: { events: ['a.pong', 'a.ping'] } },
  ] };
  const [ok, bad] = runCases(m, runtime);
  assert.ok(ok.ok);
  assert.equal(bad.ok, false);
});

// ----- state -----
test('createState fills defaults and does not mutate its input', () => {
  const input = { entities: { self: { hp: 3 } } };
  const s = createState(input);
  assert.deepEqual(s.entities.self, { hp: 3, maxHp: 0, block: 0, poise: 0, sp: 0, mp: 0, statuses: {}, tags: [] });
  assert.deepEqual(s.piles, { draw: [], hand: [], discard: [], exhaust: [] });
  assert.deepEqual(input, { entities: { self: { hp: 3 } } });
});

test('command does not mutate the state it is given', () => {
  const state = { entities: { self: ent({ hp: 5 }) } };
  const before = structuredClone(state);
  const out = run([{ op: 'heal', target: 'self', amount: 3 }], state);
  assert.deepEqual(state, before);
  assert.equal(out.state.entities.self.hp, 8);
});

// ----- step kinds -----
test('step: op with $param values and entity refs', () => {
  const out = run([{ op: 'damage', target: '$t', amount: '$n' }], { entities: { enemy: ent() } }, { t: 'enemy', n: 4 });
  assert.equal(out.state.entities.enemy.hp, 6);
});

test('step: if/then/else follows the condition', () => {
  const steps = [{ if: { cmp: ['>=', '$n', 5] }, then: [{ op: 'block', target: 'self', amount: 1 }], else: [{ op: 'block', target: 'self', amount: 2 }] }];
  assert.equal(run(steps, { entities: { self: ent() } }, { n: 5 }).state.entities.self.block, 1);
  assert.equal(run(steps, { entities: { self: ent() } }, { n: 4 }).state.entities.self.block, 2);
  assert.equal(run([{ if: { cmp: ['==', 1, 2] }, then: [{ op: 'block', target: 'self', amount: 1 }] }], { entities: { self: ent() } }).state.entities.self.block, 0);
});

test('step: forEach over allEnemies binds the loop variable', () => {
  const state = { entities: { self: ent(), a: ent({ tags: ['enemy'] }), b: ent({ tags: ['enemy'], hp: 3 }) } };
  const out = run([{ forEach: 'allEnemies', as: 'e', do: [{ op: 'damage', target: '$e', amount: 2 }] }], state);
  assert.equal(out.state.entities.a.hp, 8);
  assert.equal(out.state.entities.b.hp, 1);
  assert.equal(out.state.entities.self.hp, 10);
});

test('step: forEach over an array param', () => {
  const state = { entities: { a: ent(), b: ent() } };
  const out = run([{ forEach: '$list', as: 'x', do: [{ op: 'block', target: '$x', amount: 3 }] }], state, { list: ['a', 'b'] });
  assert.equal(out.state.entities.a.block, 3);
  assert.equal(out.state.entities.b.block, 3);
});

test('step: emit raises the event with a resolved payload', () => {
  const out = run([{ emit: 't.hit', with: { who: '$who', n: { f: 'add', args: [1, 2] } } }], { entities: { self: ent() } }, { who: 'self' });
  assert.deepEqual(out.events, [{ name: 't.hit', payload: { who: 'self', n: 3 } }]);
});

test('step: call invokes another mechanic command', () => {
  const runtime = rt(
    mech('a', [{ on: 'command.go', do: [{ call: 'b.shield', with: { target: '$target', amount: 4 } }] }]),
    mech('b', [{ on: 'command.shield', do: [{ op: 'block', target: '$target', amount: '$amount' }] }]),
  );
  const out = runtime.command({ entities: { self: ent() } }, 'a.go', { target: 'self' });
  assert.equal(out.state.entities.self.block, 4);
});

test('step: set writes the mechanic own state and $state reads it', () => {
  const runtime = rt(mech('c', [
    { on: 'command.go', do: [{ set: 'count', value: { f: 'add', args: ['$n', 1] } }, { set: 'deep.flag', value: true }] },
    { on: 'command.use', do: [{ op: 'block', target: 'self', amount: '$state.count' }] },
  ]));
  let out = runtime.command({ entities: { self: ent() } }, 'c.go', { n: 4 });
  assert.deepEqual(out.state.mechanics.c, { count: 5, deep: { flag: true } });
  out = runtime.command(out.state, 'c.use');
  assert.equal(out.state.entities.self.block, 5);
});

test('handler when guard skips the handler', () => {
  const runtime = rt(mech('g', [{ on: 'command.go', when: { cmp: ['>', '$n', 0] }, do: [{ op: 'block', target: 'self', amount: 1 }] }]));
  assert.equal(runtime.command({ entities: { self: ent() } }, 'g.go', { n: 0 }).state.entities.self.block, 0);
  assert.equal(runtime.command({ entities: { self: ent() } }, 'g.go', { n: 1 }).state.entities.self.block, 1);
});

test('an unknown step shape throws', () => {
  assert.throws(() => run([{ nonsense: 1 }], { entities: {} }), /Unknown step/);
});

// ----- conditions -----
test('conditions: all, any, not, cmp, hasTag, hasStatus', () => {
  const state = { entities: { self: ent({ tags: ['boss'], statuses: { burn: 2 } }) } };
  const q = cond => rt(mech('q', [], { queries: { x: { returns: 'boolean', value: cond } } })).query(state, 'q.x');
  assert.equal(q({ all: [{ hasTag: ['self', 'boss'] }, { hasStatus: ['self', 'burn'] }] }), true);
  assert.equal(q({ all: [{ hasTag: ['self', 'boss'] }, { hasStatus: ['self', 'chill'] }] }), false);
  assert.equal(q({ any: [{ hasTag: ['self', 'nope'] }, { cmp: ['!=', 1, 2] }] }), true);
  assert.equal(q({ not: { hasTag: ['self', 'nope'] } }), true);
  for (const [op, a, b, want] of [['<', 1, 2, true], ['<=', 2, 2, true], ['==', 3, 3, true], ['!=', 3, 3, false], ['>=', 1, 2, false], ['>', 3, 2, true]]) {
    assert.equal(q({ cmp: [op, a, b] }), want, `${a} ${op} ${b}`);
  }
  assert.throws(() => q({ cmp: ['~', 1, 2] }), /comparator/);
});

// ----- values -----
test('values: $param and formula objects (percentMaxHp of target)', () => {
  const state = { entities: { target: ent({ hp: 1, maxHp: 45 }) } };
  const out = run([{ op: 'heal', target: 'target', amount: { f: 'percentMaxHp', of: 'target', pct: 10 } }], state);
  assert.equal(out.state.entities.target.hp, 5); // floor(4.5) = 4, 1 + 4
});

test('values: formula of an aliased param resolves through the handler params', () => {
  const state = { entities: { enemy: ent({ hp: 1, maxHp: 50 }) } };
  const out = run([{ op: 'heal', target: '$target', amount: { f: 'percentMaxHp', of: 'target', pct: '$pct' } }], state, { target: 'enemy', pct: 20 });
  assert.equal(out.state.entities.enemy.hp, 11);
});

test('values: stacks, missingHp, hpOf, blockOf read the state', () => {
  const state = { entities: { self: ent({ hp: 4, block: 7, statuses: { burn: 5 } }), a: ent({ tags: ['enemy'], statuses: { burn: 3 } }), b: ent({ tags: ['enemy'], statuses: { burn: 4 } }) } };
  const q = f => rt(mech('q', [], { queries: { x: { returns: 'number', value: f } } })).query(state, 'q.x');
  assert.equal(q({ f: 'stacks', of: 'self', status: 'burn' }), 5);
  assert.equal(q({ f: 'stacks', of: 'allEnemies', status: 'burn', per: 2 }), 3);
  assert.equal(q({ f: 'missingHp', of: 'self' }), 6);
  assert.equal(q({ f: 'hpOf', of: 'self' }), 4);
  assert.equal(q({ f: 'blockOf', of: 'self' }), 7);
  assert.equal(q({ f: 'mul', args: [{ f: 'blockOf', of: 'self' }, 0.5] }), 3);
});

test('values: an unresolved $param throws', () => {
  assert.throws(() => run([{ op: 'block', target: 'self', amount: '$missing' }], { entities: { self: ent() } }), /Unresolved \$missing/);
});

test('query evaluates the interface value with params', () => {
  const runtime = rt(mech('h', [], { queries: { amount: { returns: 'number', value: { f: 'percentMaxHp', of: 'target', pct: '$pct' } } } }));
  assert.equal(runtime.query({ entities: { self: ent({ maxHp: 80 }) } }, 'h.amount', { target: 'self', pct: 25 }), 20);
  assert.throws(() => runtime.query({ entities: {} }, 'h.nope'), /Unknown query/);
});

test('slugs with dots resolve by longest known prefix', () => {
  const runtime = rt(mech('lifecycle.exhaust', [{ on: 'command.go', do: [{ op: 'block', target: 'self', amount: 1 }] }]));
  assert.equal(runtime.command({ entities: { self: ent() } }, 'lifecycle.exhaust.go').state.entities.self.block, 1);
});

// ----- portable ops -----
test('op damage: block absorbs first, then hp, with hits', () => {
  const out = run([{ op: 'damage', target: 'self', amount: 4, hits: 2 }], { entities: { self: ent({ block: 5 }) } });
  assert.equal(out.state.entities.self.block, 0);
  assert.equal(out.state.entities.self.hp, 7); // 4 + 4 = 8 damage, 5 absorbed by block
  assert.equal(run([{ op: 'damage', target: 'self', amount: 99 }], { entities: { self: ent() } }).state.entities.self.hp, 0);
  assert.equal(run([{ op: 'damage', target: 'self', amount: 5, hits: 0 }], { entities: { self: ent() } }).state.entities.self.hp, 10);
});

test('op block adds block', () => {
  assert.equal(run([{ op: 'block', target: 'self', amount: 6 }], { entities: { self: ent({ block: 1 }) } }).state.entities.self.block, 7);
});

test('op loseHp bypasses block and honours nonlethal', () => {
  const out = run([{ op: 'loseHp', target: 'self', amount: 3 }], { entities: { self: ent({ block: 9 }) } });
  assert.equal(out.state.entities.self.hp, 7);
  assert.equal(out.state.entities.self.block, 9);
  assert.throws(() => run([{ op: 'loseHp', target: 'self', amount: 10, nonlethal: true }], { entities: { self: ent() } }), /nonlethal/);
});

test('op heal clamps to maxHp', () => {
  assert.equal(run([{ op: 'heal', target: 'self', amount: 50 }], { entities: { self: ent({ hp: 4 }) } }).state.entities.self.hp, 10);
});

test('op applyStatus and removeStatus change stacks', () => {
  let out = run([{ op: 'applyStatus', target: 'self', status: 'burn', stacks: 3 }, { op: 'applyStatus', target: 'self', status: 'burn' }], { entities: { self: ent() } });
  assert.equal(out.state.entities.self.statuses.burn, 4);
  out = run([{ op: 'removeStatus', target: 'self', status: 'burn', amount: 1 }], out.state);
  assert.equal(out.state.entities.self.statuses.burn, 3);
  out = run([{ op: 'removeStatus', target: 'self', status: 'burn', amount: 9 }], out.state);
  assert.equal('burn' in out.state.entities.self.statuses, false);
  out = run([{ op: 'applyStatus', target: 'self', status: 'chill', stacks: 2 }, { op: 'removeStatus', target: 'self', status: 'chill' }], { entities: { self: ent() } });
  assert.deepEqual(out.state.entities.self.statuses, {});
});

test('ops draw, discard, exhaust move cards between piles', () => {
  const state = { entities: {}, piles: { draw: ['a', 'b', 'c'], hand: ['x', 'y'] } };
  let out = run([{ op: 'draw', amount: 2 }], state);
  assert.deepEqual(out.state.piles.hand, ['x', 'y', 'a', 'b']);
  assert.deepEqual(out.state.piles.draw, ['c']);
  out = run([{ op: 'draw', amount: 5 }], out.state);
  assert.deepEqual(out.state.piles.draw, []);
  out = run([{ op: 'discard', amount: 2 }, { op: 'exhaust' }], out.state);
  assert.deepEqual(out.state.piles.discard, ['x', 'y']);
  assert.deepEqual(out.state.piles.exhaust, ['a']);
  assert.deepEqual(out.state.piles.hand, ['b', 'c']);
});

test('random discard is deterministic for a seed and advances it', () => {
  const state = { entities: {}, piles: { hand: ['a', 'b', 'c', 'd'] }, rng: { seed: 7 } };
  const one = run([{ op: 'discard', random: true }], state);
  const two = run([{ op: 'discard', random: true }], state);
  assert.deepEqual(one.state.piles, two.state.piles);
  assert.notEqual(one.state.rng.seed, 7);
});

test('op addCard puts card ids in a pile, top or bottom', () => {
  const state = { entities: {}, piles: { draw: ['a'] } };
  let out = run([{ op: 'addCard', card: 'wound', count: 2 }], state);
  assert.deepEqual(out.state.piles.discard, ['wound', 'wound']);
  out = run([{ op: 'addCard', card: 'curse', pile: 'draw', position: 'top' }, { op: 'addCard', card: 'dust', pile: 'draw' }], out.state);
  assert.deepEqual(out.state.piles.draw, ['curse', 'a', 'dust']);
  assert.throws(() => run([{ op: 'addCard', card: 'x', pile: 'void' }], state), /Unknown pile/);
});

test('ops gainEnergy, restoreStamina add sp; restoreMana adds mp', () => {
  const state = { entities: { self: ent({ sp: 1, mp: 2, spMax: 5, mpMax: 6 }) } };
  let out = run([{ op: 'gainEnergy', target: 'self', amount: 2 }, { op: 'restoreStamina', target: 'self', amount: 10 }], state);
  assert.equal(out.state.entities.self.sp, 5);
  out = run([{ op: 'restoreMana', target: 'self', amount: 3 }], state);
  assert.equal(out.state.entities.self.mp, 5);
  out = run([{ op: 'restoreMana', target: 'self', amount: 30 }], state);
  assert.equal(out.state.entities.self.mp, 6);
  out = run([{ op: 'gainEnergy', target: 'self', amount: 3, funded: 1 }], state);
  assert.equal(out.state.entities.self.sp, 3);
  out = run([{ op: 'restoreMana', target: 'self', toFloorPct: 50 }], { entities: { self: ent({ mp: 1, mpMax: 10 }) } });
  assert.equal(out.state.entities.self.mp, 5);
});

test('op poiseDamage reduces poise and emits runtime.poiseBroken at zero', () => {
  const state = { entities: { enemy: ent({ poise: 5 }) } };
  let out = run([{ op: 'poiseDamage', target: 'enemy', amount: 3 }], state);
  assert.equal(out.state.entities.enemy.poise, 2);
  assert.deepEqual(out.events, []);
  out = run([{ op: 'poiseDamage', target: 'enemy', amount: 3 }], out.state);
  assert.equal(out.state.entities.enemy.poise, 0);
  assert.deepEqual(out.events, [{ name: 'runtime.poiseBroken', payload: { target: 'enemy' } }]);
  out = run([{ op: 'poiseDamage', target: 'enemy', amount: 3 }], out.state);
  assert.deepEqual(out.events, []);
});

test('ops gainPoise and restorePoise (capped by poiseMax)', () => {
  const state = { entities: { self: ent({ poise: 2, poiseMax: 5 }) } };
  assert.equal(run([{ op: 'gainPoise', target: 'self', amount: 10 }], state).state.entities.self.poise, 12);
  assert.equal(run([{ op: 'restorePoise', target: 'self', amount: 10 }], state).state.entities.self.poise, 5);
});

test('op stagger emits runtime.staggered per target', () => {
  const out = run([{ op: 'stagger', target: 'allEnemies' }], { entities: { a: ent({ tags: ['enemy'] }), b: ent({ tags: ['enemy'] }), self: ent() } });
  assert.deepEqual(out.events.map(e => e.payload.target), ['a', 'b']);
  assert.ok(out.events.every(e => e.name === 'runtime.staggered'));
});

test('an omitted target falls back to the target param, then self', () => {
  const state = { entities: { self: ent(), enemy: ent() } };
  assert.equal(run([{ op: 'block', amount: 1 }], state).state.entities.self.block, 1);
  assert.equal(run([{ op: 'block', amount: 1 }], state, { target: 'enemy' }).state.entities.enemy.block, 1);
});

test('an unknown entity ref throws', () => {
  assert.throws(() => run([{ op: 'block', target: 'ghost', amount: 1 }], { entities: { self: ent() } }), /Unknown entity ref 'ghost'/);
});

// ----- events and listeners -----
test('an event runs the handler of every mechanic that listens, in load order', () => {
  const runtime = rt(
    mech('a', [{ on: 'event.src.fired', do: [{ op: 'block', target: 'self', amount: 1 }, { emit: 'a.done', with: {} }] }]),
    mech('b', [{ on: 'event.src.fired', do: [{ op: 'block', target: 'self', amount: '$n' }] }]),
    mech('c', [{ on: 'event.other.thing', do: [{ op: 'block', target: 'self', amount: 100 }] }]),
  );
  const out = runtime.emit({ entities: { self: ent() } }, 'src.fired', { n: 5 });
  assert.equal(out.state.entities.self.block, 6);
  assert.deepEqual(out.events.map(e => e.name), ['src.fired', 'a.done']);
});

test('a command emitting an event reaches listeners; events are in raise order', () => {
  const runtime = rt(
    mech('p', [{ on: 'command.go', do: [{ emit: 'p.first', with: {} }, { emit: 'p.second', with: {} }] }]),
    mech('l', [{ on: 'event.p.first', do: [{ emit: 'l.reacted', with: {} }] }]),
  );
  const out = runtime.command({ entities: {} }, 'p.go');
  assert.deepEqual(out.events.map(e => e.name), ['p.first', 'l.reacted', 'p.second']);
});

test('a runtime event from an op reaches listeners', () => {
  const runtime = rt(
    mech('p', [{ on: 'command.go', do: [{ op: 'poiseDamage', target: 'enemy', amount: 9 }] }]),
    mech('l', [{ on: 'event.runtime.poiseBroken', do: [{ op: 'applyStatus', target: '$target', status: 'stunned', stacks: 1 }] }]),
  );
  const out = runtime.command({ entities: { enemy: ent({ poise: 4 }) } }, 'p.go');
  assert.equal(out.state.entities.enemy.statuses.stunned, 1);
});

// ----- limits and errors -----
test('recursion deeper than the cap throws', () => {
  const runtime = rt(mech('loop', [{ on: 'event.loop.again', do: [{ emit: 'loop.again', with: {} }] }]));
  assert.throws(() => runtime.emit({ entities: {} }, 'loop.again'), new RegExp(`Recursion depth exceeds ${MAX_DEPTH}`));
  assert.equal(MAX_DEPTH, 32);
});

test('recursion within the cap succeeds', () => {
  const runtime = rt(mech('chain', [
    { on: 'event.chain.step', when: { cmp: ['<', '$n', 20] }, do: [{ emit: 'chain.step', with: { n: { f: 'add', args: ['$n', 1] } } }] },
  ]));
  const out = runtime.emit({ entities: {} }, 'chain.step', { n: 0 });
  assert.equal(out.events.length, 21);
});

test('a legacy op throws "legacy op <op> is not portable"', () => {
  assert.throws(() => run([{ op: 'retain', amount: 1 }], { entities: {} }), /legacy op retain is not portable/);
  assert.throws(() => run([{ op: 'addRelic', id: 'x' }], { entities: {} }), /legacy op addRelic is not portable/);
});

test('an op missing from the catalog throws; a portable op without code is refused at creation', () => {
  assert.throws(() => run([{ op: 'bogus' }], { entities: {} }), /Unknown op 'bogus'/);
  const bad = structuredClone(ops);
  bad.ops.retain.reference = 'portable';
  assert.throws(() => createRuntime({ mechanics: new Map(), ops: bad }), /marks 'retain' portable/);
});

test('unknown commands and mechanics throw', () => {
  const runtime = rt(mech('t', []));
  assert.throws(() => runtime.command({ entities: {} }, 't.nope'), /Unknown command/);
  assert.throws(() => runtime.command({ entities: {} }, 'zzz.go'), /Unknown command/);
});

// ----- catalog consistency -----
test('ops.json portable set equals the implemented ops', () => {
  const portable = Object.entries(ops.ops).filter(([, d]) => d.reference === 'portable').map(([k]) => k).sort();
  assert.deepEqual(portable, [...PORTABLE_OPS].sort());
});

test('ops.json op names equal the case names inside actions.js runOpcode', () => {
  const text = readFileSync(new URL('../src/engine/actions.js', import.meta.url), 'utf8');
  const from = text.indexOf('function runOpcode(');
  const to = text.indexOf('export function createRunContext(');
  assert.ok(from > 0 && to > from);
  const cases = new Set([...text.slice(from, to).matchAll(/case '([A-Za-z]+)':/g)].map(m => m[1]));
  assert.deepEqual([...Object.keys(ops.ops)].sort(), [...cases].sort());
  assert.equal(Object.keys(ops.ops).length, 44);
  assert.equal(ops.format, 'ashen.ops@1');
  for (const def of Object.values(ops.ops)) {
    assert.ok(['portable', 'legacy'].includes(def.reference));
    assert.equal(def.legacy.file, 'src/engine/actions.js');
  }
});

test('formulas.json lists the evaluator op set', async () => {
  const { FORMULA_OPS, FORMULA_OF } = await import('../src/model/formulas.js');
  const doc = JSON.parse(readFileSync(new URL('../engine/runtime/formulas.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(doc.ops).sort(), [...FORMULA_OPS].sort());
  assert.deepEqual(doc.of.values, [...FORMULA_OF]);
});

// ----- $model -----
function modelMech(slug, model, handlers) {
  const [, m] = mech(slug, handlers);
  return [slug, { ...m, model }];
}
const heavy = { type: 'object', properties: { power: { type: 'integer', default: 4 }, nest: { type: 'object', properties: { x: { type: 'integer', default: 7 } } } } };

test('$model reads the schema default when the mechanic state is empty', () => {
  const r = rt(modelMech('m', heavy, [{ on: 'command.go', do: [{ op: 'damage', target: 'enemy', amount: '$model.power' }] }]));
  assert.equal(r.command({ entities: { enemy: ent() } }, 'm.go').state.entities.enemy.hp, 6);
});

test('$model is overridden by state.mechanics[slug], recursively over nested defaults', () => {
  const r = rt(modelMech('m', heavy, [{ on: 'command.go', do: [
    { op: 'damage', target: 'enemy', amount: '$model.power' },
    { op: 'block', target: 'enemy', amount: '$model.nest.x' },
  ] }]));
  const out = r.command({ entities: { enemy: ent() }, mechanics: { m: { power: 1 } } }, 'm.go');
  assert.equal(out.state.entities.enemy.hp, 9);
  assert.equal(out.state.entities.enemy.block, 7);
  assert.equal(r.command({ entities: { enemy: ent() }, mechanics: { m: { nest: { x: 2 } } } }, 'm.go').state.entities.enemy.block, 2);
});

test('$model works inside formula args and an unknown key is unresolved', () => {
  const r = rt(modelMech('m', heavy, [
    { on: 'command.go', do: [{ op: 'block', target: 'enemy', amount: { f: 'mul', args: [2, '$model.power'] } }] },
    { on: 'command.bad', do: [{ op: 'block', target: 'enemy', amount: '$model.nope' }] },
  ]));
  assert.equal(r.command({ entities: { enemy: ent() } }, 'm.go').state.entities.enemy.block, 8);
  assert.throws(() => r.command({ entities: { enemy: ent() } }, 'm.bad'), /Unresolved \$model\.nope/);
});

// ----- runtime events and case triggers -----
test('a handler on event.runtime.poiseBroken runs when poiseDamage empties the meter', () => {
  const r = rt(mech('t', [
    { on: 'command.go', do: [{ op: 'poiseDamage', target: 'enemy', amount: 5 }] },
    { on: 'event.runtime.poiseBroken', do: [{ op: 'applyStatus', target: '$target', status: 'vulnerable' }] },
  ]));
  const out = r.command({ entities: { enemy: ent({ poise: 3 }) } }, 't.go');
  assert.deepEqual(out.state.entities.enemy.statuses, { vulnerable: 1 });
});

test('a case with when { event, with } emits the event and checks the result', () => {
  const m = { ...mech('t', [{ on: 'event.t.ping', do: [{ op: 'block', target: '$who', amount: 2 }] }])[1],
    cases: [{ name: 'ping', given: { entities: { a: { hp: 1 } } }, when: { event: 't.ping', with: { who: 'a' } }, then: { entities: { a: { block: 2 } }, events: ['t.ping'] } }] };
  assert.deepEqual(runCases(m, rt(['t', m])).map(c => c.ok), [true]);
});

test('restoreStamina with a negative amount removes sp, never below 0', () => {
  const state = { entities: { self: ent({ sp: 2 }) } };
  assert.equal(run([{ op: 'restoreStamina', target: 'self', amount: -1 }], state).state.entities.self.sp, 1);
  assert.equal(run([{ op: 'restoreStamina', target: 'self', amount: -5 }], state).state.entities.self.sp, 0);
});

// ----- review fixes (2026-10-17) -----
test('set and emit clone values: a later set never writes into the caller params or an emitted payload', () => {
  const params = { p: { k: 1 } };
  const out = run([{ set: 'x', value: '$p' }, { emit: 't.e', with: { v: '$p' } }, { set: 'x.k', value: 10 }], createState({ entities: { self: ent() } }), params);
  assert.equal(params.p.k, 1);
  assert.equal(out.state.mechanics.t.x.k, 10);
  assert.equal(out.events[0].payload.v.k, 1);
});
test('a missing rng seed reads as 1', () => {
  assert.equal(createState({ rng: {} }).rng.seed, 1);
  assert.equal(createState({}).rng.seed, 1);
});
test('a step without a required op param raises', () => {
  assert.throws(() => run([{ op: 'heal', target: 'self' }], createState({ entities: { self: ent({ hp: 5 }) } })), /op heal needs 'amount'/);
});
test('cases reject unknown then keys', () => {
  const m = mech('t', [{ on: 'command.go', do: [] }])[1];
  m.cases = [{ name: 'typo', when: { command: 't.go' }, then: { entites: { self: { hp: 999 } } } }];
  const [r] = runCases(m, rt(['t', m]));
  assert.equal(r.ok, false);
  assert.match(String(r.error), /unknown key/);
});
test('cmp ordering needs numbers', () => {
  assert.throws(() => run([{ if: { cmp: ['<', 'a', 1] }, then: [] }], createState({ entities: { self: ent() } })), /needs two numbers/);
});
test('set replaces a scalar prefix with a record', () => {
  const st = createState({ entities: { self: ent() }, mechanics: { t: { saved: 1 } } });
  const out = run([{ set: 'saved.field', value: 2 }], st);
  assert.deepEqual(out.state.mechanics.t.saved, { field: 2 });
});

test('funded is a value: variables and formulas resolve before subtracting', () => {
  const state = { entities: { self: ent({ sp: 0, mp: 0 }) } };
  let out = run([{ op: 'gainEnergy', target: 'self', amount: 5, funded: '$paid' }], state, { paid: 3 });
  assert.equal(out.state.entities.self.sp, 2);
  out = run([{ op: 'restoreMana', target: 'self', amount: 5, funded: '$paid' }], state, { paid: 4 });
  assert.equal(out.state.entities.self.mp, 1);
});

test('a mechanic.json naming a missing file is refused at load', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'mech-'));
  writeFileSync(join(dir, 'mechanic.json'), JSON.stringify({ id: 'x', files: { model: 'model.schema.json', interface: 'interface.json', service: 'nope.json' } }));
  writeFileSync(join(dir, 'model.schema.json'), '{}'); writeFileSync(join(dir, 'interface.json'), '{"mechanic":"x"}');
  const { loadMechanic } = await import('../engine/runtime/interpreter.mjs');
  assert.throws(() => loadMechanic(dir), /names service file 'nope\.json'/);
});

test('forEach over an array variable expands allEnemies and refs member by member', () => {
  const state = { entities: { a: ent({ tags: ['enemy'] }), b: ent({ tags: ['enemy'] }), p: ent() } };
  const out = run([{ forEach: '$targets', as: 'who', do: [{ emit: 't.hit', with: { who: '$who' } }] }], state, { targets: ['allEnemies', 'p'] });
  assert.deepEqual(out.events.filter(e => e.name === 't.hit').map(e => e.payload.who), ['a', 'b', 'p']);
});
