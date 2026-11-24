import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { proposalCardRules } from '../src/model/proposalStatusRules.js';
import { withModalDom } from './helpers/dom.mjs';
import { openCardInspection } from '../src/ui/components/cardInspection.js';
import { resetModalState } from '../src/ui/modalState.js';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const controlSource = readFileSync(new URL('../src/engine/combatStatusControl.js', import.meta.url), 'utf8');
const functionBody = (text, name, prefix = '  ') => {
  const start = text.indexOf(`${prefix}function ${name}(`);
  const end = text.indexOf(`\n${prefix}}`, start);
  assert.ok(start >= 0 && end > start, name);
  return text.slice(start, end + prefix.length + 2);
};
const shipped = ['playAvailability', 'inspectionPlayAction', 'cardResourceReason', 'unplayableReason', 'blockingStatusName']
  .map(name => functionBody(source, name)).join('\n');
const gateStart = controlSource.indexOf('export function controlGate(');
const gate = controlSource.slice(gateStart, controlSource.indexOf('\n}', gateStart) + 2).replace(/^export /, '');
const sentences = {
  'combat.card.unavailable.sp': 'Not enough SP (need {need}, have {have}).',
  'combat.card.unavailable.mp': 'Not enough MP (need {need}, have {have}).',
  'combat.card.unavailable.effect': 'Blocked by {effect}.',
  'combat.card.unavailable.control': 'Recover from {effects} before playing this card.',
  'combat.card.unavailable.blight': 'Choose your Blight feat before playing cards.',
  'combat.card.unavailable.unplayable': 'This card has the Unplayable restriction.',
};

function harness({ energy = 4, stamina = energy, mana = 3, expansion = 2, preview = {}, definition = {}, selected = null } = {}) {
  const inst = { instanceId: 'c1', cardId: 'edge' };
  const def = { type: 'attack', effects: [], ...definition };
  const quotes = [];
  const scope = {
    combat: { combatExpansionVersion: expansion, phase: 'player', result: null, piles: { hand: [inst] },
      player: { energy, stamina, mana, statuses: {} } },
    combatEl: { isConnected: true }, inputBusy: () => false,
    registries: { statuses: { get: id => ({ name: { sleep: 'Sleep', paralysis: 'Paralysis', cannotAttack: 'Pacified' }[id] || id }) },
      framework: { isUnplayable: value => value.keywords?.includes('unplayable') } },
    resolveCombatCard: (_combat, _inst, options) => { scope.lastDefinitionOptions = options; return def; },
    controlRestrictions: () => ({ locked: scope.locks.length > 0, locks: scope.locks }), locks: [],
    // The play-condition and nonlethal-HP gates come after these reasons; they pass here.
    PlayConditionReachable: () => true, NonlethalHpRefusal: () => '',
    proposalCardPlan: (combat, actor, card) => proposalCardRules({ actor, card,
      rules: { cannotAttack: { behaviors: [{ kind: 'restriction', cardTypes: ['attack'] }] } } }),
    upcastRanksByCard: new Map(), selected, selfArm: null, selectedFlask: null, lastTargetId: null,
    cardTargets: () => ({ legalIds: ['e1', 'e2'] }), getEntity: (_combat, id) => ({ id, kind: 'enemy' }),
    previewCard: (_combat, id, targetId, ranks) => {
      quotes.push({ id, targetId, ranks });
      return { cost: 2, staminaCost: 2, manaCost: 0, needsTarget: true, ...scope.preview };
    }, preview,
    t: (key, tokens = {}) => sentences[key].replace(/\{(\w+)\}/g, (_, token) => tokens[token]),
    render() {}, focusTargeting() {}, playCard() {}, console: { warn() {} },
  };
  // Run the engine's actual recovery-exception gate and the screen's actual
  // availability functions; the fixture supplies only state and quote results.
  runInNewContext(`${gate}\n${shipped}\nthis.action = inspectionPlayAction; this.available = playAvailability;`, scope);
  return { scope, quotes, def, inst, action: () => scope.action(inst.instanceId) };
}

test('a gray Core card explains SP and MP shortages with the live need and have once per pool', () => {
  const h = harness({ energy: 1, mana: 0, preview: { cost: 4, staminaCost: 4, manaCost: 2 } });
  assert.equal(h.action().reason, 'Not enough SP (need 4, have 1). Not enough MP (need 2, have 0).');
  assert.equal(h.action().enabled, false);
});

test('both fields used by the gray face are checked even when their values differ', () => {
  const h = harness({ expansion: 1, energy: 0, stamina: 1, preview: { cost: 2, staminaCost: 3 } });
  assert.equal(h.action().reason, 'Not enough SP (need 2, have 0). Not enough SP (need 3, have 1).');
  const differentPools = harness({ energy: 5, stamina: 1, preview: { cost: 2, staminaCost: 3 } });
  assert.equal(differentPools.action().reason, 'Not enough SP (need 3, have 1).');
});

test('zero-price and X-price cards remain available with empty SP and MP', () => {
  assert.equal(harness({ energy: 0, mana: 0, preview: { cost: 0, staminaCost: 0 } }).action().enabled, true);
  assert.equal(harness({ energy: 0, mana: 0, preview: { cost: 99, costIsX: true, staminaCost: 0 } }).action().enabled, true);
});

test('inspection uses the selected enemy and upcast rank that price the gray face', () => {
  const h = harness({ selected: 'c1' });
  h.scope.lastTargetId = 'e2';
  h.scope.upcastRanksByCard.set('c1', 3);
  h.action();
  assert.deepEqual(h.quotes, [{ id: 'c1', targetId: 'e2', ranks: 3 }]);
  assert.equal(h.scope.lastDefinitionOptions.upcastRanks, 3);
  h.scope.lastTargetId = 'gone';
  h.action();
  assert.equal(h.quotes.at(-1).targetId, 'e1', 'same fallback enemy as the hand face');
  h.scope.selected = null;
  h.action();
  assert.equal(h.quotes.at(-1).targetId, undefined, 'unselected face keeps its untargeted quote');
});

test('a card restriction names its active effect despite ample resources and clears when the effect expires', () => {
  const h = harness();
  h.scope.combat.player.statuses.cannotAttack = { stacks: 1 };
  assert.equal(h.action().reason, 'Blocked by Pacified.');
  h.def.type = 'skill';
  assert.equal(h.action().enabled, true, 'an attack-only restriction leaves skills available');
  h.def.type = 'attack';
  delete h.scope.combat.player.statuses.cannotAttack;
  assert.equal(h.action().enabled, true);
});

test('control explanations name only blocking effects and preserve the engine recovery exceptions', () => {
  const h = harness();
  h.scope.locks = ['sleep', 'paralysis'];
  assert.equal(h.action().reason, 'Recover from Sleep, Paralysis before playing this card.');
  h.def.usableWhile = ['sleep'];
  assert.equal(h.action().reason, 'Recover from Paralysis before playing this card.');
  h.def.usableWhile.push('paralysis');
  assert.equal(h.action().enabled, true);
  h.def.usableWhile = [];
  h.def.builtinRecovery = true;
  assert.equal(h.action().enabled, true);
});

test('Blight choices and authored Unplayable restrictions have explicit explanations', () => {
  const h = harness();
  h.scope.combat.player.ashenBlight = { milestones: [{ path: null }] };
  assert.equal(h.action().reason, sentences['combat.card.unavailable.blight']);
  h.scope.combat.player.ashenBlight.milestones[0].path = 'chosen';
  h.def.keywords = ['unplayable'];
  assert.equal(h.action().reason, sentences['combat.card.unavailable.unplayable']);
});

test('the inspect availability getter reads fresh pools even without a hand repaint', () => {
  const h = harness({ energy: 1 });
  const expression = source.match(/availability: (\{ get play\(\) \{ return playAvailability\(inst\.instanceId\); \} \})/);
  assert.ok(expression, 'the hand passes a live availability getter to the card renderer');
  const scope = { inst: h.inst, playAvailability: h.scope.available };
  runInNewContext(`this.availability = (${expression[1]});`, scope);
  assert.equal(scope.availability.play, 'Not enough SP (need 2, have 1).');
  h.scope.combat.player.energy = 3;
  h.scope.combat.player.stamina = 3;
  assert.equal(scope.availability.play, true);
  h.scope.combat.player.mana = 0;
  h.scope.preview.manaCost = 1;
  assert.equal(scope.availability.play, 'Not enough MP (need 1, have 0).');
});

test('a stale card preview stays inspectable with an unavailable explanation', () => {
  const h = harness();
  h.scope.previewCard = () => { throw new Error('unknown snapshot'); };
  assert.equal(h.action().enabled, false);
  assert.match(h.action().reason, /cannot be played right now/);
});

test('inspection places the refusal before long card details and removes it on an allowed reopening', () => {
  withModalDom(({ document }) => {
    resetModalState();
    document.getSelection = () => null;
    document.documentElement = document.createElement('html');
    let blocked = true;
    const open = () => {
      const details = document.createElement('div');
      details.prepend = node => details.insertBefore(node, details.children[0] || null);
      details.append(document.createElement('section'));
      const shell = openCardInspection({ title: 'Tempered Edge+', card: document.createElement('article'), details,
        actions: () => [{ id: 'play', verb: 'Play card', enabled: !blocked, reason: blocked ? 'Blocked by Bind.' : '' }] });
      return { shell, details };
    };
    const first = open();
    assert.equal(first.details.children[0].className, 'card-action-reason');
    assert.equal(first.details.children[0].textContent, 'Blocked by Bind.');
    assert.equal(first.shell.panel.querySelector('.card-inspection-act').disabled, true);
    first.shell.close();
    blocked = false;
    const second = open();
    assert.equal(second.details.querySelector('.card-action-reason'), null);
    assert.equal(second.shell.panel.querySelector('.card-inspection-act').disabled, false);
    second.shell.close();
  });
});

test('authored Bind agrees with real engine play: block Attack cards, permit skills, recover after removal', async () => {
  const [{ contentBundle }, { createRegistries }, profiles, { loadAuditRuntime }, { makeAuditCombat },
    { resolveCombatCard }, { proposalCardPlan }, { controlGate }, { previewCard }, { PlayConditionReachable }, { NonlethalHpRefusal }] = await Promise.all([
    import('../src/content/index.js'), import('../src/model/registries.js'), import('../src/model/gameProfile.js'),
    import('../tools/combat-audit/runtime.mjs'), import('../tools/combat-audit/fixtures.mjs'),
    import('../src/engine/combatExpansion.js'), import('../src/engine/proposalStatusRuntime.js'),
    import('../src/engine/combatStatusControl.js'), import('../src/engine/combat.js'),
    import('../src/engine/cardBehavior.js'), import('../src/model/cardHpCost.js'),
  ]);
  const profile = profiles.resolveGameProfile('core');
  const registries = profiles.bindGameProfileRegistries(createRegistries(profiles.applyGameProfileToContent(contentBundle, profile)), profile);
  const api = { ...await loadAuditRuntime('native'), registries };
  const { combat } = makeAuditCombat(api, { classId: registries.classes.all()[0].id,
    instance: { instanceId: 'c1', cardId: 'core.temperedEdge', rank: 2, upgraded: true },
    cardInstances: [{ instanceId: 'skill', cardId: 'core.defend', upgraded: false }], relicIds: [] });
  combat.player.statuses['base.bind'] = { stacks: 1 };
  const h = harness();
  Object.assign(h.scope, { combat, registries, resolveCombatCard, proposalCardPlan, controlGate, previewCard, PlayConditionReachable, NonlethalHpRefusal });
  assert.equal(h.scope.action('c1').reason, 'Blocked by Bind.');
  assert.equal(h.scope.action('skill').enabled, true, 'ample SP cannot bypass Bind, but the skill stays available');
  const before = { stamina: combat.player.stamina, mana: combat.player.mana, hand: combat.piles.hand.map(card => card.instanceId) };
  assert.throws(() => api.dispatch(combat, { type: 'playCard', cardInstanceId: 'c1', targetId: combat.enemies[0].id }), /Restricted by base.bind/);
  assert.deepEqual({ stamina: combat.player.stamina, mana: combat.player.mana, hand: combat.piles.hand.map(card => card.instanceId) }, before);
  assert.doesNotThrow(() => api.dispatch(combat, { type: 'playCard', cardInstanceId: 'skill' }));
  delete combat.player.statuses['base.bind'];
  assert.equal(h.scope.action('c1').enabled, true);
  assert.doesNotThrow(() => api.dispatch(combat, { type: 'playCard', cardInstanceId: 'c1', targetId: combat.enemies[0].id }));
  assert.ok(combat.piles.exhaust.some(card => card.instanceId === 'c1'));
});
