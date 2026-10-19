// tests/card-option-summary.test.mjs — the picker tile line: live numbers, with their direction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardEffectLine, summarizeCardOption } from '../src/ui/models/CardOptionSummaryModel.js';

const counterDef = { id: 'testCounter', name: 'Counter', type: 'attack', tags: ['maneuver:counter', 'camp:physical'],
  effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'damage', target: 'enemy', amount: 4 }] };
const strikeDef = { id: 'testStrike', name: 'Strike', type: 'attack', effects: [{ op: 'damage', target: 'enemy', amount: 6 }] };
const line = (def, preview) => cardEffectLine(def, preview, null).map(row => `${row.label} ${row.value}${row.dir ? `:${row.dir}` : ''}`);

test('counter reads Def and Return from the live preview', () => {
  const preview = { values: [{ op: 'block', value: 7 }, { op: 'damage', value: 4 }] };
  assert.deepEqual(line(counterDef, preview), ['Def 7:up', 'Return 4']);
});
test('a lowered number is down, an unchanged one has no direction', () => {
  assert.deepEqual(line(strikeDef, { values: [{ op: 'damage', value: 3 }] }), ['Dmg 3:down']);
  assert.deepEqual(line(strikeDef, { values: [{ op: 'damage', value: 6 }] }), ['Dmg 6']);
});
test('with no preview the authored numbers show and nothing is coloured', () => {
  assert.deepEqual(line(counterDef, null), ['Def 5', 'Return 4']);
});
test('summarizeCardOption: name, line and cost chips; a missing reader gives a name-only tile', () => {
  const option = { id: 'o1', name: 'Counter', staminaCost: 2, manaCost: 1, play: { cardInstanceId: 'c1', targetId: 'e1' } };
  const full = summarizeCardOption(null, {}, option, { defOf: () => counterDef,
    previewOf: (opt) => { assert.equal(opt.play.targetId, 'e1'); return { values: [{ op: 'block', value: 7 }, { op: 'damage', value: 4 }] }; } });
  assert.equal(full.name, 'Counter');
  assert.deepEqual(full.costs, ['2 SP', '1 MP']);
  assert.equal(full.line[0].dir, 'up');
  const bare = summarizeCardOption(null, {}, option);
  assert.deepEqual(bare.line, []);
  const broken = summarizeCardOption(null, {}, option, { defOf: () => { throw new Error('no card'); } });
  assert.deepEqual(broken.line, []);
});
test('a gain row places its number first and keeps a plain label', () => {
  const healDef = { id: 'testHeal', name: 'Mend', type: 'skill', effects: [{ op: 'heal', target: 'self', amount: 5 }] };
  const [row] = cardEffectLine(healDef, { values: [{ op: 'heal', value: 5 }] }, null);
  assert.equal(row.label, 'HP');
  assert.equal(row.before, '+');
  assert.equal(row.after, ' HP');
});
test('a non-spell Barrier gain is labelled Barrier, not Def', () => {
  const barrierDef = { id: 'testBarrier', name: 'Brace', type: 'skill', tags: ['camp:physical'], effects: [{ op: 'gainBarrier', target: 'self', amount: 4 }] };
  const rows = cardEffectLine(barrierDef, { values: [{ op: 'gainBarrier', value: 6 }] }, null);
  assert.deepEqual(rows.map(row => [row.label, row.value, row.dir, row.before, row.after]), [['Barrier', 6, 'up', '+', ' Barrier']]);
});
test('a multi-hit card keeps its hit count after the number', () => {
  const flurry = { id: 'testFlurry', name: 'Flurry', type: 'attack', effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }] };
  const [live] = cardEffectLine(flurry, { values: [{ op: 'damage', value: 4, hits: 3 }] }, null);
  assert.deepEqual([live.value, live.hits, live.after, live.dir], [4, 3, ' ×3', 'up']);
  const [authored] = cardEffectLine(flurry, null, null);
  assert.equal(authored.after, ' ×3', 'the authored hit count shows with no preview');
  const [single] = cardEffectLine({ ...flurry, effects: [{ op: 'damage', target: 'enemy', amount: 3 }] }, null, null);
  assert.equal(single.after, '', 'one hit shows no multiplier');
});
test('a counter payload returns HP, Poise and Ward as separate Return parts', () => {
  const payload = { id: 'testPayload', name: 'Rebuke', type: 'attack', tags: ['maneuver:counter', 'camp:physical'],
    counterPayload: { hp: 4, poise: 3, ward: 2 }, effects: [{ op: 'block', target: 'self', amount: 5 }] };
  const rows = cardEffectLine(payload, { values: [{ op: 'block', value: 5 }, { op: 'damage', value: 6 }, { op: 'poiseDamage', value: 3 }] }, null);
  assert.deepEqual(rows.map(row => `${row.before}${row.value}${row.after}`), ['Def 5', 'Return 6', 'Return 3 Poise', 'Return 2 Ward']);
  assert.deepEqual(rows.map(row => row.dir), [null, 'up', null, null]);
});
test('a counter with Poise and Ward effects reads them as Return parts', () => {
  const effects = { id: 'testCounterFx', name: 'Rebuke', type: 'attack', tags: ['maneuver:counter', 'camp:physical'],
    effects: [{ op: 'poiseDamage', target: 'enemy', amount: 3 }, { op: 'wardDamage', target: 'enemy', amount: 2 }] };
  assert.deepEqual(cardEffectLine(effects, null, null).map(row => `${row.before}${row.value}${row.after}`), ['Return 3 Poise', 'Return 2 Ward']);
});
// The screens cannot run here without a browser, so these pin the two call-site rules by source.
import { readFileSync } from 'node:fs';
test('co-op base reaction options resolve at tier 0, not the hand-selected tier', () => {
  const source = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
  assert.match(source, /cardDef\(inst, o\.play\.upcastTier \|\| 0\)/);
});
test('solo round reactions preview against the pending offer attacker', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(source, /o\.play\.targetId \?\? o\.sourceId \?\? pending\.sourceId/);
});
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
test('a non-counter Ward damage effect is shown, and reads as Poise when Ward is off', () => {
  const ward = { id: 'testWardHit', name: 'Sunder', type: 'attack', tags: ['maneuver:attack', 'camp:physical'],
    effects: [{ op: 'wardDamage', target: 'enemy', amount: 8 }] };
  const live = { values: [{ op: 'wardDamage', value: 10 }] };
  assert.deepEqual(cardEffectLine(ward, live, null).map(row => `${row.before}${row.value}${row.after}:${row.dir}`), ['Ward dmg 10:up']);
  // Core 2 with Ward off: the card text projection folds Ward into Poise, and so does the tile.
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const merged = { ...ward, effects: [{ op: 'poiseDamage', target: 'enemy', amount: 3 }, { op: 'wardDamage', target: 'enemy', amount: 8 }] };
  assert.deepEqual(cardEffectLine(merged, null, core).map(row => `${row.before}${row.value}${row.after}`), ['Poise 11']);
});
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registriesByProfile = { current: createRegistries(contentBundle),
  core: bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile) };
test('repeated same-kind effects add up into one figure', () => {
  const twice = { id: 'testTwice', name: 'Twin', type: 'attack', effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'damage', target: 'enemy', amount: 4 }] };
  const [row] = cardEffectLine(twice, { values: [{ op: 'damage', value: 7 }, { op: 'damage', value: 4 }] }, null);
  assert.deepEqual([row.value, row.base, row.dir, row.after], [11, 10, 'up', '']);
});
test('a card with conditional branches uses its own text, so the other branch is never mistaken for the figure', () => {
  const iron = contentBundle.cards.find(card => card.id === 'ironResolve');
  const registries = registriesByProfile.current;
  for (const preview of [null, { values: [{ op: 'block', value: 5 }, { op: 'block', value: 9 }] }]) {
    const summary = summarizeCardOption(registries, null, { id: 'i', name: iron.name }, { defOf: () => registries.cards.get('ironResolve'), previewOf: () => preview });
    assert.deepEqual(summary.line, [], 'no single numeric figure for a conditional card');
    assert.match(summary.html, /bulwark/i, 'the condition is stated');
    assert.match(summary.html, />5</); assert.match(summary.html, />9</);
    assert.doesNotMatch(summary.html, /\u2026/);
  }
});
test('a card with an effect that has no number falls back to its own text, never an empty row', () => {
  const poison = { id: 'testPoison', name: 'Venom', type: 'skill', effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'poison', stacks: 3 }] };
  const summary = summarizeCardOption(null, null, { id: 'p', name: 'Venom' }, { defOf: () => poison, previewOf: () => null });
  assert.deepEqual(summary.line, []);
  assert.ok(summary.html.length > 0, 'the compact card text stands in');
});
for (const [name, registries] of Object.entries(registriesByProfile)) {
  test(`every ${name} card gets a non-empty tile effect`, () => {
    const empty = [];
    for (const def of registries.cards.all()) {
      const summary = summarizeCardOption(registries, null, { id: def.id, name: def.name }, { defOf: () => def, previewOf: () => null });
      if (!summary.line.length && !String(summary.html || '').trim()) empty.push(def.id);
    }
    assert.deepEqual(empty, [], `${empty.length} cards have an empty effect row`);
  });
}
test('with a condition reader only the branch that holds is summarized; without one the card text states both', () => {
  const registries = registriesByProfile.current, iron = registries.cards.get('ironResolve');
  const preview = { values: [{ op: 'block', value: 5 }, { op: 'block', value: 9 }] };
  const summarize = holds => summarizeCardOption(registries, null, { id: 'i', name: iron.name },
    { defOf: () => iron, previewOf: () => preview, ...(holds ? { conditionHolds: effect => holds(effect.if) } : {}) });
  const inBulwark = pred => (pred.p === 'inStance' ? true : pred.p === 'not' ? !inBulwark(pred.pred) : undefined);
  const outside = pred => (pred.p === 'inStance' ? false : pred.p === 'not' ? !outside(pred.pred) : undefined);
  const under = summarize(inBulwark), without = summarize(outside);
  assert.deepEqual(under.line.map(row => `${row.before}${row.value}${row.after}`), ['Def 9']);
  assert.deepEqual(without.line.map(row => `${row.before}${row.value}${row.after}`), ['Def 5']);
  assert.equal(under.html, undefined, 'a decided card needs no text fallback');
  const unknown = summarize(() => undefined);
  assert.deepEqual(unknown.line, [], 'an undecided condition falls back to the card text');
  assert.match(unknown.html, /bulwark/i);
  assert.match(summarize(null).html, /bulwark/i, 'no reader at all: the card text');
});
test('the engine predicate evaluator decides ironResolve by stance', async () => {
  const { evalPredicate } = await import('../src/engine/triggers.js');
  const registries = registriesByProfile.current, iron = registries.cards.get('ironResolve');
  const holds = stance => effect => { const player = { stanceId: stance }; return evalPredicate({ player, combatExpansionVersion: 1 }, effect.if, { owner: player, source: player, meta: {} }); };
  const rows = stance => summarizeCardOption(registries, null, { id: 'i', name: 'Iron' }, { defOf: () => iron, previewOf: () => ({ values: [{ op: 'block', value: 5 }, { op: 'block', value: 9 }] }), conditionHolds: holds(stance) }).line.map(row => row.value);
  assert.deepEqual(rows('bulwark'), [9], 'in Bulwark the Bulwark branch is the figure');
  assert.deepEqual(rows(null), [5], 'outside it the other branch is');
});
test('a tile summarizes the definition the preview resolved, so the live effect variant shows', () => {
  const variantCard = (id, amount) => {
    const base = { id, name: id, type: 'skill', effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'applyStatus', target: 'self', status: 'poise', stacks: 1 }],
      effectVariants: [{ if: { p: 'inStance', stance: 'smash' }, effects: [{ op: 'block', target: 'self', amount }] }] };
    return { base, preview: { resolvedDefinition: { ...base, effects: [{ op: 'block', target: 'self', amount }], activeEffectVariant: 0 }, values: [{ op: 'block', value: amount }] } };
  };
  for (const [name, amount] of [['Stance Echo', 6], ['Resource Echo', 8]]) {
    const { base, preview } = variantCard(name, amount);
    const summary = summarizeCardOption(null, null, { id: 'v', name }, { defOf: () => base, previewOf: () => preview });
    assert.deepEqual(summary.line.map(row => `${row.before}${row.value}${row.after}`), [`Def ${amount}`], `${name} shows its live variant`);
    assert.equal(summary.html, undefined, 'the variant is fully numeric');
  }
  // With no resolved definition the authored card is used, as before.
  const { base } = variantCard('Plain', 6);
  assert.deepEqual(summarizeCardOption(null, null, { id: 'v', name: 'Plain' }, { defOf: () => base, previewOf: () => null }).line, []);
});
test('a charged buildup inserted before a Block keeps the Block figure aligned and shows the status', () => {
  const card = { id: 'testCharged', name: 'Frost Guard', type: 'skill', effects: [{ op: 'block', target: 'self', amount: 5 }] };
  const charged = [{ op: 'buildup', target: 'enemy', status: 'frost', amount: 2 }, card.effects[0]];
  const preview = { resolvedDefinition: card, chargedEffects: charged, values: [{ op: 'buildup', value: 2 }, { op: 'block', value: 7 }] };
  const summary = summarizeCardOption(null, null, { id: 'c', name: 'Frost Guard' }, { defOf: () => card, previewOf: () => preview });
  assert.match(summary.html, /7/, 'the Block reads the live 7, not the buildup value');
  assert.match(summary.html, /frost/i, 'the charged status appears');
  // The numeric reader aligns on the same list: Block alone, with the extra row skipped.
  const rows = cardEffectLine({ ...card, effects: [card.effects[0]] }, { values: [{ op: 'block', value: 7 }] }, null);
  assert.deepEqual(rows.map(row => row.value), [7]);
});
test('a card with effect variants and no preview shows its text, not the authored variant numbers', () => {
  const echo = { id: 'testEcho', name: 'Stance Echo', type: 'skill', effects: [{ op: 'block', target: 'self', amount: 4 }],
    effectVariants: [{ if: { p: 'inStance', stance: 'smash' }, effects: [{ op: 'block', target: 'self', amount: 9 }] }] };
  const bare = summarizeCardOption(null, null, { id: 'e', name: 'Stance Echo' }, { defOf: () => echo, previewOf: () => null });
  assert.deepEqual(bare.line, [], 'no numbers without a preview that picked the variant');
  assert.ok(bare.html.length > 0, 'the card text stands in');
  const resolved = { ...echo, effects: [{ op: 'block', target: 'self', amount: 6 }], activeEffectVariant: -1 };
  const live = summarizeCardOption(null, null, { id: 'e', name: 'Stance Echo' }, { defOf: () => echo, previewOf: () => ({ resolvedDefinition: resolved, values: [{ op: 'block', value: 6 }] }) });
  assert.deepEqual(live.line.map(row => row.value), [6], 'with the preview, the variant it picked shows');
});
test('the text fallback fills template tokens with the card numbers', () => {
  const html = (registries, id) => summarizeCardOption(registries, null, { id, name: id }, { defOf: () => registries.cards.get(id), previewOf: () => null }).html;
  assert.match(html(registriesByProfile.current, 'guilt'), /lose 1 HP/);
  assert.match(html(registriesByProfile.current, 'lastRites'), /Draw 2 cards/);
  assert.match(html(registriesByProfile.core, 'base.transmute'), /Gain 10 cinders/);
  // A live preview token wins over the static one.
  const guilt = registriesByProfile.current.cards.get('guilt');
  const live = summarizeCardOption(registriesByProfile.current, null, { id: 'g', name: 'Guilt' }, { defOf: () => guilt, previewOf: () => ({ tokens: { loseHp: 3 }, values: [] }) });
  assert.match(live.html, /lose 3 HP/);
});
test('gainPoise (Dodge Roll) reads as a Poise guard gain, not Poise damage', () => {
  const registries = registriesByProfile.current, def = registries.cards.get('dodgeRoll');
  const gain = def.effects.find(effect => effect.op === 'gainPoise');
  assert.ok(gain, 'Dodge Roll gains Poise');
  const summary = summarizeCardOption(registries, null, { id: 'd', name: def.name }, { defOf: () => def, previewOf: () => null });
  const row = summary.line.find(part => part.label === 'poiseGuard' || /Poise guard/.test(`${part.before}${part.after}`));
  assert.ok(row, JSON.stringify(summary.line));
  assert.equal(`${row.before}${row.value}${row.after}`.replace(/\s+/g, ' ').trim(), `+${row.value} Poise guard`);
  assert.ok(!summary.line.some(part => /^Poise /.test(part.before)), 'no "Poise N" damage label');
});
