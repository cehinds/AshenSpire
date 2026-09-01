// tests/framework.test.mjs — the replacement candidate's own suite:
// `node tests/framework.test.mjs`. One line per test, exit 1 on any failure.
//
// Covers the framework contract's behavioral rules AND the known-bad corpus
// (Complete validation: "Known-bad tests must reject…") — every rejection is
// observed red by name, never assumed.

import { contentBundle } from '../src/content/index.js';
import {
  createFrameworkRegistries, TermRegistry, AssetRegistry,
} from '../src/framework/registries.js';
import { compileEntity, CompileError, hasProperty, propertyParameters } from '../src/framework/compiler.js';
import {
  destinationAfterPlay, endTurnCleanup, forcedDiscardDestination, ZoneLedger,
} from '../src/framework/lifecycle.js';
import { compileCosts, payAlternativeCost, CostError } from '../src/framework/costs.js';
import { composeCombatDeck, buildEquippedWeaponCardPlan } from '../src/framework/deck.js';
import {
  maximumMana, createResourceState, onTurnStartMana, onRestSpot, spendStamina,
  refundStamina, onTurnEndStamina,
} from '../src/framework/resources.js';
import { computeWeightClass, dodgeRollCheck } from '../src/framework/weight.js';
import { filterInheritable } from '../src/framework/inheritance.js';
import { validateAllContent, contrastRatio } from '../src/framework/validate.js';
import { buildReplacementCandidate, createReplacementCandidate, compareBaseline, captureCurrentBehavior } from '../src/framework/candidate.js';
import { placeTooltip, compileTooltip, TOOLTIP_INPUT_RULES } from '../src/framework/presentation/tooltip.js';
import { requestAction } from '../src/framework/presentation/confirmation.js';
import { fitText } from '../src/framework/presentation/fitText.js';
import { SharedMenu, SharedTooltip, ComponentError } from '../src/framework/presentation/components.js';

import { properties as propertiesData } from '../src/framework/data/properties.js';
import { relations as relationsData } from '../src/framework/data/relations.js';
import { terms as termsData } from '../src/framework/data/terms.js';
import { assets as assetsData } from '../src/framework/data/assets.js';
import { confirmationPolicies } from '../src/framework/data/confirmationPolicies.js';
import { theme as themeData } from '../src/framework/data/theme.js';

let passed = 0;
let failed = 0;
function test(name, body) {
  try {
    body();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${e.message}`);
  }
}
function assert(cond, message) { if (!cond) throw new Error(message || 'assertion failed'); }
function assertThrows(fn, re, message) {
  try { fn(); } catch (e) {
    if (re && !re.test(e.message)) throw new Error(`${message || 'threw'} but wrong message: ${e.message}`);
    return e;
  }
  throw new Error(message || 'expected a throw');
}
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);

// A small fixture registry factory: canonical framework data plus test rows.
function fixtureRegistries({ entities = [], extraProperties = [], extraRelations = [], extraTerms = [], extraAssets = [], confirmation = confirmationPolicies, theme = themeData } = {}) {
  return createFrameworkRegistries({
    properties: [...propertiesData.properties, ...extraProperties],
    relations: [...relationsData.relations, ...extraRelations],
    terms: [...termsData.terms, ...extraTerms],
    assets: [...assetsData.assets, ...extraAssets],
    entities,
    confirmation,
    theme,
  });
}
const namedEntity = (id, kind, props, overrides) => ({
  id, kind, nameTermId: 'term.strike', properties: props, explicitOverrides: overrides,
});

// ---- registries -------------------------------------------------------------

test('registry require() refuses an unknown id by name', () => {
  const regs = fixtureRegistries();
  assertThrows(() => regs.properties.require('damage.emotional'), /unknown id "damage.emotional"/);
  assertThrows(() => regs.terms.require('term.nope'), /unknown id/);
  assertThrows(() => regs.content.require('card.nope'), /unknown id/);
});

test('TermRegistry serves short/plural/accessibility contexts and import aliases', () => {
  const terms = new TermRegistry(termsData.terms);
  eq(terms.displayTerm('term.strength', 'short'), 'STR', 'short');
  eq(terms.displayTerm('term.action', 'plural'), 'Actions', 'plural');
  eq(terms.displayTerm('term.close', 'accessibility'), 'Close dialog', 'accessibility');
  eq(terms.displayTerm('term.equipmentBound'), 'Equipment-Bound', 'canonical');
  eq(terms.idForAlias('bounded'), 'term.equipmentBound', 'legacy alias maps to Equipment-Bound');
});

test('AssetRegistry walks the typed fallback ladder and never loops', () => {
  const loads = (path) => path === 'assets/framework/missing.svg';
  const assets = new AssetRegistry([
    ...assetsData.assets,
    { id: 'asset.test.broken', kind: 'CARD_ART', sourcePath: 'assets/nope.png', fallbackAssetId: 'asset.fallback.cardArt' },
  ], { assetLoads: loads });
  eq(assets.resolveAsset('asset.test.broken').id, 'asset.fallback.cardArt', 'typed fallback');
  eq(assets.resolveAsset('asset.never.registered').id, 'asset.system.missing', 'unknown id lands on system missing');
});

// ---- compiler ---------------------------------------------------------------

test('compileEntity is deterministic under authored row order', () => {
  const props = [
    { propertyId: 'lifecycle.retain', source: 'AUTHORED' },
    { propertyId: 'classification.attack', source: 'AUTHORED' },
    { propertyId: 'cost.action', parameters: { amount: 2 }, source: 'AUTHORED' },
  ];
  const a = compileEntity(fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', props)] }), 'card.t');
  const b = compileEntity(fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [...props].reverse())] }), 'card.t');
  eq(a.properties.map((p) => p.propertyId), b.properties.map((p) => p.propertyId), 'order-independent');
  assert(Object.isFrozen(a) && Object.isFrozen(a.properties), 'deep-frozen');
});

test('expandParents implies the family root and priority ordering holds', () => {
  const regs = fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [{ propertyId: 'lifecycle.recall.afterUse', source: 'AUTHORED' }, { propertyId: 'cost.action', source: 'AUTHORED' }])] });
  const compiled = compileEntity(regs, 'card.t');
  assert(hasProperty(compiled, 'lifecycle.recall'), 'recall parent implied');
  assert(hasProperty(compiled, 'lifecycle'), 'lifecycle root implied');
  assert(compiled.properties.find((p) => p.propertyId === 'lifecycle').implied, 'root marked implied');
});

test('SUPPRESSES resolves Exhaust vs Recall After Use deterministically', () => {
  const regs = fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [{ propertyId: 'lifecycle.exhaust', source: 'AUTHORED' }, { propertyId: 'lifecycle.recall.afterUse', source: 'AUTHORED' }])] });
  const compiled = compileEntity(regs, 'card.t');
  assert(hasProperty(compiled, 'lifecycle.exhaust'), 'exhaust survives');
  assert(!hasProperty(compiled, 'lifecycle.recall.afterUse'), 'recall suppressed');
  eq(compiled.suppressed['lifecycle.recall.afterUse'].relation, 'SUPPRESSES', 'suppression recorded');
});

test('REQUIRES violations and unresolved conflicts throw by name', () => {
  assertThrows(() => compileEntity(
    fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [{ propertyId: 'equipment.mainHand', source: 'AUTHORED' }])] }), 'card.t',
  ), /equipment.mainHand requires equipment.bound/);
  assertThrows(() => compileEntity(
    fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [{ propertyId: 'classification.attack', source: 'AUTHORED' }, { propertyId: 'classification.skill', source: 'AUTHORED' }])] }), 'card.t',
  ), /unresolved conflict/);
});

test('precedence: a STATUS restriction outranks the card author; defaults show through', () => {
  const regs = fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [{ propertyId: 'cost.action', parameters: { amount: 2 }, source: 'AUTHORED' }])] });
  const compiled = compileEntity(regs, 'card.t', {
    statusProperties: [{ propertyId: 'cost.action', parameters: { amount: 3 }, source: 'STATUS', sourceEntityId: 'status.chains' }],
  });
  eq(propertyParameters(compiled, 'cost.action').amount, 3, 'temporary combat restriction wins');
  const defaulted = compileEntity(regs, 'card.t', {});
  eq(propertyParameters(defaulted, 'cost.action').amount, 2, 'authored beats property default');
});

// ---- lifecycle --------------------------------------------------------------

test('destinationAfterPlay follows the contract order', () => {
  const card = (ids) => ({ id: 'c', properties: ids.map((propertyId) => ({ propertyId, parameters: {} })) });
  const legal = { cancelled: false, legal: true };
  eq(destinationAfterPlay(card([]), { cancelled: true, legal: true }), 'HAND', 'cancelled spends nothing');
  eq(destinationAfterPlay(card([]), { cancelled: false, legal: false }), 'HAND', 'illegal spends nothing');
  eq(destinationAfterPlay(card(['lifecycle.seal', 'lifecycle.exhaust']), legal, { sealConditionMet: () => true }), 'SEALED', 'seal first');
  eq(destinationAfterPlay(card(['lifecycle.seal', 'lifecycle.exhaust']), legal, { sealConditionMet: () => false }), 'EXHAUST_PILE', 'unmet seal falls to exhaust');
  eq(destinationAfterPlay(card(['lifecycle.recall.afterUse']), legal), 'HAND', 'recall after use');
  eq(destinationAfterPlay(card([]), legal), 'DISCARD_PILE', 'default discard');
});

test('endTurnCleanup keeps Retain; Ethereal exhausts; forced discard never recalls', () => {
  const retain = { id: 'a', properties: [{ propertyId: 'lifecycle.retain' }] };
  const recall = { id: 'b', properties: [{ propertyId: 'lifecycle.recall.afterUse' }] };
  const ethereal = { id: 'c', properties: [{ propertyId: 'lifecycle.ethereal' }] };
  const both = { id: 'd', properties: [{ propertyId: 'lifecycle.retain' }, { propertyId: 'lifecycle.ethereal' }] };
  const { keep, discard, exhaust } = endTurnCleanup([retain, recall, ethereal, both]);
  eq(keep.map((c) => c.id), ['a', 'd'], 'retain kept, and retain beats ethereal');
  eq(discard.map((c) => c.id), ['b'], 'recall does not survive cleanup');
  eq(exhaust.map((c) => c.id), ['c'], 'ethereal exhausts instead of discarding');
  eq(forcedDiscardDestination(), 'DISCARD_PILE', 'forced discard is not a use');
});

test('a played Power leaves play; an Exhaust Power still exhausts', () => {
  const card = (ids) => ({ id: 'c', properties: ids.map((propertyId) => ({ propertyId, parameters: {} })) });
  const legal = { cancelled: false, legal: true };
  eq(destinationAfterPlay(card(['classification.power']), legal), 'REMOVED_FROM_PLAY', 'power removal preserved');
  eq(destinationAfterPlay(card(['classification.power', 'lifecycle.exhaust']), legal), 'EXHAUST_PILE', 'exhaust wins on a power');
});

test('ZoneLedger enforces exactly one zone per instance', () => {
  const ledger = new ZoneLedger(['strike#1', 'strike#2']);
  ledger.move('strike#1', 'HAND');
  eq(ledger.zoneOf('strike#1'), 'HAND', 'moved');
  eq(ledger.zoneOf('strike#2'), 'DRAW_PILE', 'sibling untouched');
  assert(ledger.assertExactlyOneZoneEach(), 'invariant holds');
  assertThrows(() => ledger.move('strike#1', 'POCKET'), /unknown zone/);
  assertThrows(() => ledger.move('ghost#1', 'HAND'), /unknown card instance/);
});

// ---- costs ------------------------------------------------------------------

test('damage properties never imply costs; cost rows compile to entries', () => {
  const card = { id: 'c', properties: [
    { propertyId: 'damage.physical', parameters: {} },
    { propertyId: 'cost.mana', parameters: { amount: 2 } },
  ], overrides: {} };
  const profile = compileCosts(card, {});
  eq(profile.entries, [{ resource: 'mana', amount: 2 }], 'physical did not add stamina');
});

test('Recall After Use demands a repeat limiter', () => {
  const bare = { id: 'c', properties: [{ propertyId: 'lifecycle.recall.afterUse', parameters: {} }], overrides: {} };
  assertThrows(() => compileCosts(bare, {}), /repeat limiter/);
  const limited = { ...bare, properties: [...bare.properties, { propertyId: 'cost.action', parameters: { amount: 1 } }] };
  assert(compileCosts(limited, {}).entries.length === 1, 'action cost is a limiter');
});

test('incomplete alternative costs are rejected; payment is atomic', () => {
  const noOptions = { id: 'c', properties: [{ propertyId: 'cost.alternative', parameters: {} }], overrides: {} };
  assertThrows(() => compileCosts(noOptions, {}), /no complete option/);
  const card = { id: 'c', properties: [], overrides: {} };
  const option = { entries: [{ resource: 'hp', amount: 3 }, { resource: 'mana', amount: 1 }] };
  const wallet = { hp: 10, mana: 0 };
  assertThrows(() => payAlternativeCost(card, option, wallet), /cannot pay 1 mana/);
  eq(wallet, { hp: 10, mana: 0 }, 'failed payment spends nothing');
  const vetoed = payAlternativeCost(card, option, { hp: 10, mana: 2 }, { confirmTarget: () => false });
  assert(!vetoed.paid && vetoed.wallet.hp === 10, 'veto spends nothing');
  const paid = payAlternativeCost(card, option, { hp: 10, mana: 2 });
  eq(paid.wallet, { hp: 7, mana: 1 }, 'commit is atomic and complete');
});

// ---- deck composition -------------------------------------------------------

const PKGS = {
  sword: { strikeCardId: 'profile.bladeAttack', guardCardId: 'profile.weaponGuard', grantedCards: [], weaponArtDefaults: ['art.cleave'] },
  dagger: { strikeCardId: 'profile.daggerPierceAttack', guardCardId: 'profile.weaponGuard', grantedCards: [], weaponArtDefaults: ['art.cleave', 'art.fan'] },
};
const helpers = {
  packageFor: (id) => PKGS[id],
  isBasicStrike: (id) => id === 'strike',
  isBasicGuard: (id) => id === 'defend',
};
const runDeck = [
  { instanceId: 's1', cardId: 'strike' }, { instanceId: 's2', cardId: 'strike' },
  { instanceId: 'g1', cardId: 'defend' }, { instanceId: 'e1', cardId: 'crimsonCleave', upgraded: true },
];

test('no weapons → the unarmed package, Dodge Roll in the empty slot', () => {
  const plan = buildEquippedWeaponCardPlan({}, helpers);
  eq(plan.strikes, ['framework.unarmedStrike'], 'unarmed strike');
  eq(plan.guards, ['framework.evasiveGuard'], 'evasive guard');
  eq(plan.weaponArts, ['framework.dodgeRoll'], 'dodge roll fallback');
});

test('a left-hand-only weapon receives the complete package', () => {
  const left = buildEquippedWeaponCardPlan({ leftHand: 'sword' }, helpers);
  const right = buildEquippedWeaponCardPlan({ rightHand: 'sword' }, helpers);
  eq(left, right, 'hand does not change a solo package');
});

test('dual wield splits slots ceil/floor with RIGHT_THEN_LEFT unique preference', () => {
  const plan = buildEquippedWeaponCardPlan({ rightHand: 'sword', leftHand: 'dagger' }, helpers);
  eq(plan.weaponArts[0], 'art.cleave', 'right picks first');
  assert(!plan.weaponArts.filter((a, i) => plan.weaponArts.indexOf(a) !== i).length, 'no duplicate art');
  eq(plan.weaponArts.includes('art.fan'), true, 'left contributes its unique art');
});

test('composition is deterministic, idempotent, and preserves earned cards', () => {
  const once = composeCombatDeck(runDeck, { rightHand: 'sword' }, helpers);
  const twice = composeCombatDeck(runDeck, { rightHand: 'sword' }, helpers);
  eq(once, twice, 'same inputs, same deck');
  const earned = once.cards.find((c) => c.instanceId === 'e1');
  eq(earned.cardId, 'crimsonCleave', 'earned card untouched');
  assert(earned.upgraded, 'permanent upgrade preserved');
  eq(once.cards.find((c) => c.instanceId === 's1').cardId, 'profile.bladeAttack', 'basic strike replaced');
});

// ---- resources --------------------------------------------------------------

test('mana: formula weights, zero natural recovery, full rest refill', () => {
  eq(maximumMana({ classBase: 10, wisdom: 4, intelligence: 3 }), 15, 'wisdom + smaller intelligence contribution');
  let state = createResourceState({ maxMana: 5, maxStamina: 3, mana: 1 });
  state = onTurnStartMana(state);
  eq(state.currentMana, 1, 'no natural recovery');
  eq(onRestSpot(state).currentMana, 5, 'rest refills to maximum');
});

test('stamina: idle turns recover 1; a refund does not erase the spend', () => {
  let state = createResourceState({ maxMana: 0, maxStamina: 5, stamina: 3 });
  eq(onTurnEndStamina(state).currentStamina, 4, 'idle turn recovers');
  state = spendStamina(state, 2);
  state = refundStamina(state, 2);
  eq(state.currentStamina, 3, 'refund returns points');
  eq(onTurnEndStamina(state).currentStamina, 3, 'but the spend still blocks recovery');
});

// ---- weight and dodge -------------------------------------------------------

test('weight class thresholds sit at 49/79 load percent', () => {
  const at = (load, capacity) => computeWeightClass({ constitution: 0, strength: 0, bonuses: capacity - 50, weights: { armorWeight: load } }).weightClass.id;
  eq(at(49, 100), 'light', '49% light');
  eq(at(50, 100), 'medium', '50% medium');
  eq(at(79, 100), 'medium', '79% medium');
  eq(at(80, 100), 'heavy', '80% heavy');
});

test('dodge roll: check math, temporary guard, and weight-class costs', () => {
  const { weightClass } = computeWeightClass({ constitution: 10, strength: 10, weights: {} });
  eq(weightClass.id, 'light', 'unburdened is light');
  const win = dodgeRollCheck({ roll: 12, dexterity: 14, weightClass });
  // 12 + 2 (DEX) + 3 (light) = 17 > 10
  assert(win.success && win.check === 17, `check ${win.check}`);
  eq(win.temporaryGuard, 3 + 2 + 3, 'guard = base + DEX mod + class guard');
  eq(win.cost, { stamina: 1, actions: 0 }, 'light dodge costs');
  const lose = dodgeRollCheck({ roll: 5, dexterity: 10, weightClass, incomingAttackModifier: 3 });
  assert(!lose.success && lose.temporaryGuard === 0, 'failed roll grants nothing');
  assertThrows(() => dodgeRollCheck({ roll: 21, dexterity: 10, weightClass }), /not a d20/);
});

// ---- whitelisted inheritance ------------------------------------------------

test('inheritance is an allowlist: attacks take damage, guards refuse it', () => {
  const regs = fixtureRegistries();
  const candidates = [
    { propertyId: 'damage.blade', source: 'EQUIPMENT' },
    { propertyId: 'scaling.strength', source: 'EQUIPMENT' },
    { propertyId: 'presentation', source: 'EQUIPMENT' },
    { propertyId: 'utility.evasion', source: 'EQUIPMENT' },
  ];
  const ontoAttack = filterInheritable(regs, ['classification.attack'], candidates).map((c) => c.propertyId);
  eq(ontoAttack, ['damage.blade', 'scaling.strength'], 'attack whitelist');
  const ontoStrike = filterInheritable(regs, ['classification.strike'], candidates).map((c) => c.propertyId);
  eq(ontoStrike, ['damage.blade', 'scaling.strength'], 'strike inherits the attack whitelist');
  const ontoGuard = filterInheritable(regs, ['classification.guard'], candidates).map((c) => c.propertyId);
  eq(ontoGuard, ['scaling.strength', 'utility.evasion'], 'guard whitelist has no damage, never presentation');
});

// ---- presentation -----------------------------------------------------------

test('fitText never shrinks below the role minimum', () => {
  const role = { id: 'r', minimumRem: 0.8, preferredRem: 1.0, maximumRem: 1.2, overflowPolicy: 'scroll' };
  eq(fitText({ role, fits: () => true }).sizeRem, 1.0, 'preferred fits');
  const shrunk = fitText({ role, fits: (s) => s <= 0.9 });
  eq(shrunk.sizeRem, 0.9, 'steps down to fit');
  const overflow = fitText({ role, fits: () => false });
  eq(overflow.sizeRem, 0.8, 'stops at minimum');
  eq(overflow.overflow, 'scroll', 'hands off to the component policy');
});

test('tooltip placement prefers the contract sides and honors exclusions', () => {
  const viewport = { w: 800, h: 600 };
  const content = { w: 200, h: 100 };
  const top = placeTooltip({ owner: { x: 300, y: 10, w: 100, h: 40 }, content, viewport });
  eq(top.placement.side, 'below', 'top control places below');
  const bottom = placeTooltip({ owner: { x: 300, y: 550, w: 100, h: 40 }, content, viewport });
  eq(bottom.placement.side, 'above', 'bottom control places above');
  const everything = [{ x: 0, y: 0, w: 800, h: 600 }];
  const blocked = placeTooltip({ owner: { x: 300, y: 10, w: 100, h: 40 }, content, viewport, exclusions: everything });
  assert(blocked.compactSummary, 'no zero-intersection candidate → compact accessible summary');
});

test('every input mode carries explicit open, dismiss, and focus-return rules', () => {
  eq(Object.keys(TOOLTIP_INPUT_RULES).sort(), ['controller', 'keyboard', 'pointer', 'touch'], 'four input modes');
  for (const [mode, rules] of Object.entries(TOOLTIP_INPUT_RULES)) {
    for (const field of ['open', 'dismiss', 'focusReturn']) {
      assert(typeof rules[field] === 'string' && rules[field].length > 0, `${mode}.${field} declared`);
    }
  }
});

test('requestAction: NONE skips dialogs; others confirm exactly once; cancel restores focus', async () => {
  const regs = fixtureRegistries();
  const log = [];
  const hooks = {
    preserveFocus: () => (log.push('preserve'), 'token'),
    restoreFocus: (t) => log.push(`restore:${t}`),
    openConfirmation: () => (log.push('open'), Promise.resolve('CONFIRM')),
  };
  const free = await requestAction(regs, { id: 'action.playCard', subject: {}, execute: () => log.push('exec') }, hooks);
  eq([free.executed, free.confirmations], [true, 0], 'NONE executes with zero dialogs');
  const destructive = await requestAction(regs, { id: 'action.abandonRun', subject: {}, execute: () => log.push('exec') }, hooks);
  eq([destructive.executed, destructive.confirmations, destructive.level], [true, 1, 'DESTRUCTIVE'], 'exactly one destructive confirmation');
  hooks.openConfirmation = () => Promise.resolve('CANCEL');
  const cancelled = await requestAction(regs, { id: 'action.deleteSave', subject: {}, execute: () => log.push('exec-cancelled') }, hooks);
  assert(!cancelled.executed && log.includes('restore:token'), 'cancel restores prior focus');
  assert(!log.includes('exec-cancelled'), 'cancel executes nothing');
  const stale = await requestAction(regs, { id: 'action.removeCard', subject: {}, revalidate: () => false, execute: () => log.push('exec-stale') }, { ...hooks, openConfirmation: () => Promise.resolve('CONFIRM') });
  assert(!stale.executed && stale.stale, 'stale revalidation blocks execution');
});

test('interactive components without accessible names refuse to build', () => {
  assertThrows(() => SharedMenu({ items: [{ text: 'Open' }] }), /accessible name/);
  assertThrows(() => SharedTooltip({ model: { lines: [] } }), /accessible fallback/);
});

// ---- known-bad corpus (Complete validation) ---------------------------------

function failuresOf(check, result) {
  return result.failures.filter((f) => f.check === check);
}

test('known-bad: duplicate stable ids are rejected', () => {
  const regs = fixtureRegistries({ entities: [namedEntity('card.dup', 'CARD', []), namedEntity('card.dup', 'CARD', [])] });
  assert(failuresOf('assertUniqueStableIds', validateAllContent(regs)).length, 'duplicate reported');
});

test('known-bad: an unknown property on an entity is rejected', () => {
  const regs = fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [{ propertyId: 'damage.vibes', source: 'AUTHORED' }])] });
  assert(failuresOf('assertNoUnknownTargetOrEffectType', validateAllContent(regs)).length, 'unknown property reported');
});

test('known-bad: a property parent cycle is rejected', () => {
  const regs = fixtureRegistries({ extraProperties: [
    { id: 'loop.a', parentId: 'loop.b', domain: 'INTERNAL', visibility: 'INTERNAL', priority: 0 },
    { id: 'loop.b', parentId: 'loop.a', domain: 'INTERNAL', visibility: 'INTERNAL', priority: 0 },
  ] });
  assert(failuresOf('assertNoPropertyCycles', validateAllContent(regs)).length, 'cycle reported');
});

test('known-bad: an unresolved Recall/Exhaust conflict is rejected', () => {
  // A relation set where the conflict is declared but nothing suppresses it.
  const regs = createFrameworkRegistries({
    properties: propertiesData.properties,
    relations: [{ sourcePropertyId: 'lifecycle.exhaust', relation: 'CONFLICTS_WITH', targetPropertyId: 'lifecycle.recall.afterUse', precedence: 10 }],
    terms: termsData.terms,
    assets: assetsData.assets,
    entities: [namedEntity('card.t', 'CARD', [
      { propertyId: 'lifecycle.exhaust', source: 'AUTHORED' },
      { propertyId: 'lifecycle.recall.afterUse', source: 'AUTHORED' },
      { propertyId: 'cost.action', source: 'AUTHORED' },
    ])],
    confirmation: confirmationPolicies,
    theme: themeData,
  });
  assert(failuresOf('assertNoUnresolvedPropertyConflicts', validateAllContent(regs)).length, 'unresolved conflict reported');
});

test('known-bad: broken asset references and dead paths are rejected', () => {
  const regs = fixtureRegistries({ extraAssets: [
    { id: 'asset.test.orphan', kind: 'ICON', sourcePath: 'assets/nope.png', fallbackAssetId: 'asset.test.gone' },
  ] });
  const result = validateAllContent(regs, { assetExists: (p) => p !== 'assets/nope.png' });
  const rows = failuresOf('assertEveryAssetHasValidFallbackPolicy', result);
  assert(rows.some((r) => /chain leaves the registry/.test(r.detail)), 'dangling fallback reported');
  assert(rows.some((r) => /does not exist/.test(r.detail)), 'dead path reported');
});

test('known-bad: a missing term reference is rejected', () => {
  const regs = fixtureRegistries({ entities: [{ id: 'card.t', kind: 'CARD', nameTermId: 'term.ghost', properties: [] }] });
  assert(failuresOf('assertEveryReferenceResolves', validateAllContent(regs)).length, 'missing term reported');
});

test('known-bad: an incomplete alternative cost is rejected', () => {
  const regs = fixtureRegistries({ entities: [namedEntity('card.t', 'CARD', [{ propertyId: 'cost.alternative', source: 'AUTHORED' }])] });
  assert(failuresOf('assertCostProfilesComplete', validateAllContent(regs)).length, 'incomplete alternative reported');
});

test('known-bad: duplicate card instances after composition are rejected', () => {
  const regs = fixtureRegistries();
  const result = validateAllContent(regs, { composedDecks: [{ cards: [{ instanceId: 'x' }, { instanceId: 'x' }] }] });
  assert(failuresOf('assertNoDuplicateCardInstancesAfterCompilation', result).length, 'duplicate instance reported');
});

test('known-bad: confirmation-count errors are rejected both ways', () => {
  const regs = fixtureRegistries({ confirmation: {
    policies: [{ id: 'policy.soft', level: 'REVERSIBLE' }, { id: 'policy.hard', level: 'DESTRUCTIVE' }],
    actions: [
      { id: 'action.nuke', policyId: 'policy.soft', destructive: true },
      { id: 'action.stroll', policyId: 'policy.hard', destructive: false },
    ],
  } });
  eq(failuresOf('assertEveryDestructiveActionHasExactlyOneConfirmationPolicy', validateAllContent(regs)).length, 2, 'both directions reported');
});

test('known-bad: unreadable text is rejected by measured contrast', () => {
  const badTheme = JSON.parse(JSON.stringify(themeData));
  badTheme.contrastPairs = [{ id: 'pair.bad', fg: 'muted', bg: 'panel', minimumRatio: 4.5 }];
  const regs = fixtureRegistries({ theme: badTheme });
  assert(failuresOf('assertReadableText', validateAllContent(regs)).length, 'low contrast reported');
  assert(contrastRatio('#ffffff', '#000000') > 20, 'ratio sanity');
});

test('known-bad: terminology drift is rejected by name', () => {
  const regs = fixtureRegistries();
  const result = validateAllContent(regs, { drift: [{ id: 'exhaust', reason: 'tooltip drift' }] });
  assert(failuresOf('assertNoTerminologyDrift', result).length, 'drift reported');
});

// ---- the real candidate -----------------------------------------------------

test('the real bundle imports completely and validates clean', () => {
  const { registries, imported } = createReplacementCandidate(contentBundle);
  const result = validateAllContent(registries, { drift: imported.drift });
  eq(result.failures, [], 'zero validation failures on real content');
  assert(registries.content.size >= 392 + 3, 'all legacy entities plus the unarmed package');
});

test('baseline equivalence: every legacy card round-trips through the compiler', () => {
  const { registries } = createReplacementCandidate(contentBundle);
  const baseline = captureCurrentBehavior(contentBundle);
  const compiledById = new Map();
  for (const entity of registries.content.all()) {
    if (entity.kind === 'CARD') compiledById.set(entity.id, compileEntity(registries, entity.id, {}));
  }
  const mismatches = compareBaseline(baseline, registries, compiledById);
  eq(mismatches, [], 'no behavior drift against the legacy bundle');
});

test('the cutover gate refuses cutover while legacy authority is reachable', () => {
  const result = buildReplacementCandidate(contentBundle, { regressionSuite: true, newMechanicsAccepted: true });
  eq(result.status, 'FAILURE', 'no cutover without the authority proof');
  const authority = result.gates.find((g) => g.name.includes('legacy runtime authority'));
  eq(authority.status, 'FAIL', 'authority gate reports honestly');
  for (const g of result.gates) {
    if (g.name !== authority.name) eq(g.status, 'PASS', `gate ${g.name}`);
  }
});

test('compiled tooltips resolve every word through TermRegistry', () => {
  const { registries } = createReplacementCandidate(contentBundle);
  const compiled = compileEntity(registries, 'card.gorefireSlash', {});
  const tooltip = compileTooltip(registries, compiled);
  eq(tooltip.title, 'Gorefire Slash', 'name from term');
  assert(tooltip.accessibleFallback.length > 0, 'accessible fallback always present');
  assert(tooltip.lines.some((l) => l.name === 'Mana'), 'mana cost surfaces canonically');
});

// ---- the runtime bridge (ported legacy consumers) ---------------------------

const { createRegistries, resolveCard } = await import('../src/model/registries.js');
const LEGACY_REG = createRegistries(contentBundle);

test('bridge decisions match the legacy keyword rules for every card, base and upgraded', () => {
  const bridge = LEGACY_REG.framework;
  let checked = 0;
  for (const card of contentBundle.cards) {
    for (const upgraded of card.upgrade ? [false, true] : [false]) {
      const def = resolveCard(LEGACY_REG, { cardId: card.id, upgraded });
      const kws = def.keywords || [];
      const where = `${card.id}${upgraded ? '+' : ''}`;
      eq(bridge.isInnate(def), kws.includes('innate'), `${where} innate`);
      eq(bridge.isUnplayable(def), kws.includes('unplayable'), `${where} unplayable`);
      const legacyFate = kws.includes('retain') ? 'keep' : kws.includes('ethereal') ? 'exhaust' : 'discard';
      eq(bridge.endTurnFate(def), legacyFate, `${where} end-turn fate`);
      const legacyDest = kws.includes('exhaust') ? 'EXHAUST_PILE'
        : def.type === 'power' ? 'REMOVED_FROM_PLAY' : 'DISCARD_PILE';
      eq(bridge.afterPlayDestination(def), legacyDest, `${where} after-play destination`);
      checked += 1;
    }
  }
  assert(checked >= contentBundle.cards.length, `swept ${checked} defs`);
});

test('bridge keyword display equals the legacy keyword registry, word for word', () => {
  const bridge = LEGACY_REG.framework;
  for (const kw of contentBundle.keywords) {
    const display = bridge.keywordDisplay(kw.id);
    eq(display, { name: kw.name, tooltip: kw.tooltip }, `keyword ${kw.id}`);
  }
  eq(bridge.keywordDisplay('notAKeyword'), null, 'unknown ids are skipped, not invented');
});

test('bridge cost profiles match the legacy cost fields for every card, base and upgraded', () => {
  const bridge = LEGACY_REG.framework;
  for (const card of contentBundle.cards) {
    for (const upgraded of card.upgrade ? [false, true] : [false]) {
      const def = resolveCard(LEGACY_REG, { cardId: card.id, upgraded });
      const where = `${card.id}${upgraded ? '+' : ''}`;
      const profile = bridge.costProfile(def);
      eq(profile.variable, def.cost === 'X', `${where} variable`);
      eq(profile.action, def.cost === 'X' ? 0 : def.cost, `${where} action`);
      eq(profile.mana, def.manaCost || 0, `${where} mana`);
      eq(profile.stamina, def.staminaCost || 0, `${where} stamina`);
    }
  }
});

test('the Power cost reduction applies only to Powers, clamped at zero', () => {
  const bridge = LEGACY_REG.framework;
  const power = contentBundle.cards.find((c) => c.type === 'power' && typeof c.cost === 'number' && c.cost > 0);
  const attack = contentBundle.cards.find((c) => c.type === 'attack' && typeof c.cost === 'number');
  const powerDef = resolveCard(LEGACY_REG, { cardId: power.id, upgraded: false });
  const attackDef = resolveCard(LEGACY_REG, { cardId: attack.id, upgraded: false });
  eq(bridge.costProfile(powerDef, { powerCostReduction: 1 }).action, Math.max(0, power.cost - 1), 'power reduced');
  eq(bridge.costProfile(powerDef, { powerCostReduction: 99 }).action, 0, 'clamped at zero');
  eq(bridge.costProfile(attackDef, { powerCostReduction: 99 }).action, attack.cost, 'non-power untouched');
});

test('confirmation tones resolve through the registry, destructive reads danger', () => {
  const bridge = LEGACY_REG.framework;
  eq(bridge.confirmationTone('action.loadSlot'), 'danger', 'loading over unsaved progress is destructive');
  eq(bridge.confirmationTone('action.quitWithoutSaving'), 'danger', 'quitting without saving is destructive');
  eq(bridge.confirmationTone('action.equip'), 'normal', 'reversible actions read normal');
  assertThrows(() => bridge.confirmationTone('action.ghost'), /unknown id/, 'unregistered actions refuse');
});

test('the bridge decides through the same mapping the importer uses', () => {
  const bridge = LEGACY_REG.framework;
  const upgradedGorefire = resolveCard(LEGACY_REG, { cardId: 'strike', upgraded: true });
  const view = bridge.viewFor(upgradedGorefire);
  assert(view.properties.some((p) => p.propertyId === 'classification.attack'), 'type maps to classification');
  assert(Object.isFrozen(view) && Object.isFrozen(view.properties), 'views are frozen');
  eq(bridge.viewFor(upgradedGorefire), view, 'views are cached by def identity');
});

// ---- the adopted implementations (owner rulings, 2026-09-01) ---------------

const compositionDoor = await import('../src/framework/deckComposition.js');
const loadoutHome = await import('../src/model/loadout.js');
const ruleDoor = await import('../src/framework/confirmationRule.js');
const consequenceHome = await import('../src/model/consequence.js');

test('the framework composition door serves the shipped composer, identically', () => {
  eq(compositionDoor.WeaponDeckCompositionService === loadoutHome.WeaponDeckCompositionService, true, 'one service, one home');
  eq(compositionDoor.buildEquippedWeaponCardPlan === loadoutHome.buildEquippedWeaponCardPlan, true, 'plan builder identical');
  eq(compositionDoor.applyEquippedWeaponCardPlan === loadoutHome.applyEquippedWeaponCardPlan, true, 'applier identical');
  eq(compositionDoor.stampDeck === loadoutHome.stampDeck, true, 'restamp identical');
});

test('the framework confirmation-rule door serves the fail-closed derivation, identically', () => {
  eq(ruleDoor.isBindingChoice === consequenceHome.isBindingChoice, true, 'one derivation, one home');
  eq(ruleDoor.SAFE_OPS === consequenceHome.SAFE_OPS, true, 'safe set identical');
  const unknownOp = ruleDoor.failClosedOps(['summonEldritchDebt']);
  assert(unknownOp.length === 1, 'an unruled op is still binding through the door');
});

test('the tooltip cost line renders identically through the framework for every card', () => {
  const bridge = LEGACY_REG.framework;
  for (const card of contentBundle.cards) {
    for (const upgraded of card.upgrade ? [false, true] : [false]) {
      const def = resolveCard(LEGACY_REG, { cardId: card.id, upgraded });
      const pools = bridge.costProfile(def);
      const rendered = `${pools.variable ? 'X' : pools.action} ${bridge.resourceWord('action')}`
        + (pools.mana ? ` + ${pools.mana} ${bridge.resourceWord('mana')}` : '')
        + (pools.stamina ? ` + ${pools.stamina} ${bridge.resourceWord('stamina')}` : '');
      const legacy = `${def.cost} Energy`
        + (def.manaCost ? ` + ${def.manaCost} Mana` : '')
        + (def.staminaCost ? ` + ${def.staminaCost} Stamina` : '');
      eq(rendered, legacy, `${card.id}${upgraded ? '+' : ''} cost line`);
    }
  }
});

// ---- per-bundle entity term authority (presentation tranche) ----------------

test('the term overlay serves every shipped status and stance word verbatim, and is probe-safe', () => {
  const overlay = LEGACY_REG.frameworkTerms;
  for (const status of contentBundle.statuses) {
    const shown = overlay.statusDisplay(status.id);
    eq(shown.name, status.name, `status ${status.id} name`);
    eq(shown.tooltip, status.tooltip || undefined, `status ${status.id} tooltip`);
  }
  for (const stance of contentBundle.stances) {
    const shown = overlay.stanceDisplay(stance.id);
    eq(shown.name, stance.name, `stance ${stance.id} name`);
    eq(shown.tooltip, stance.tooltip || undefined, `stance ${stance.id} tooltip`);
  }
  eq(overlay.statusDisplay('notAStatus'), null, 'unknown ids read null, callers skip');
  // Probe-safety: a fixture bundle's own statuses resolve through its overlay.
  const probeBundle = { ...contentBundle, statuses: [...contentBundle.statuses, { id: 'probeMeter', name: 'Probe Meter', tooltip: 'A fixture status.', stackMode: 'add', decay: 'none', icon: '?' }] };
  const probeReg = createRegistries(probeBundle);
  eq(probeReg.frameworkTerms.statusDisplay('probeMeter'), { name: 'Probe Meter', tooltip: 'A fixture status.' }, 'probe status served');
});

test('withStatusWords/withStanceWords overlay words verbatim and pass everything else through', () => {
  const overlay = LEGACY_REG.frameworkTerms;
  for (const status of contentBundle.statuses) {
    const def = LEGACY_REG.statuses.get(status.id);
    const wrapped = overlay.withStatusWords(def);
    eq(wrapped.name, def.name, `status ${status.id} word verbatim`);
    eq(wrapped.tooltip, def.tooltip, `status ${status.id} tooltip verbatim`);
    for (const key of Object.keys(def)) {
      if (key === 'name' || key === 'tooltip') continue;
      eq(wrapped[key] === def[key], true, `status ${status.id} mechanics field '${key}' untouched`);
    }
  }
  for (const stance of contentBundle.stances) {
    const def = LEGACY_REG.stances.get(stance.id);
    const wrapped = overlay.withStanceWords(def);
    eq(wrapped.name, def.name, `stance ${stance.id} word verbatim`);
    eq(wrapped.tooltip, def.tooltip, `stance ${stance.id} tooltip verbatim`);
  }
  eq(overlay.withStatusWords(undefined), undefined, 'no def passes through');
  const foreign = { id: 'notAStatus', name: 'X', proc: { burstMax: 1 } };
  eq(overlay.withStatusWords(foreign) === foreign, true, 'a def with no overlay row passes through by identity');
});

const routerDoor = await import('../src/framework/optionDecision.js');
const routerHome = await import('../src/ui/components/optionDecision.js');
const holdconfirmHome = await import('../src/ui/components/holdconfirm.js');

test('the option-decision router door serves the shipped router, identically', () => {
  eq(routerDoor.armOptionDecision === routerHome.armOptionDecision, true, 'one router, one home');
});

const semanticsDoor = await import('../src/framework/statusSemantics.js');
const semanticsHome = await import('../src/engine/statuses.js');

test('the status-semantics door serves the shipped engine semantics, identically', () => {
  for (const name of ['getStatusInstance', 'getStacks', 'hasStatus', 'applyStatus', 'removeStatus',
    'decayAtTurnEnd', 'getMult', 'getAdd', 'getFlag', 'getCap', 'anyCombatantFlag']) {
    eq(semanticsDoor[name] === semanticsHome[name], true, `${name}: one home`);
  }
  // The door covers the implementation's whole exported surface — a symbol
  // added to statuses.js without a door row would strand its consumers.
  for (const name of Object.keys(semanticsHome)) {
    eq(typeof semanticsDoor[name], 'function', `door serves ${name}`);
  }
});

test('the router door serves the whole routed-interaction surface, identically', () => {
  eq(routerDoor.armHold === holdconfirmHome.armHold, true, 'armHold: one home');
  eq(routerDoor.armInspect === holdconfirmHome.armInspect, true, 'armInspect: one home');
  eq(routerDoor.beatArmer === holdconfirmHome.beatArmer, true, 'beatArmer: one home');
  eq(routerDoor.holdMs === holdconfirmHome.holdMs, true, 'holdMs: one home');
  eq(routerDoor.HOLD_POINTER_SLOP === holdconfirmHome.HOLD_POINTER_SLOP, true, 'HOLD_POINTER_SLOP: one home');
});

// ---- contract-new composition outputs (dormant until authored) --------------

const { createRunState } = await import('../src/model/state.js');
const actionsHome = await import('../src/engine/actions.js');

function grantFixtureRegistries(packagesById) {
  const armaments = contentBundle.equipment.armaments.map((piece) => (packagesById[piece.id]
    ? { ...piece, weaponCardPackage: packagesById[piece.id] }
    : piece));
  return createRegistries({ ...contentBundle, equipment: { ...contentBundle.equipment, armaments } });
}

test('grantedCards + weaponArtDefaults: dormant on every shipped armament', () => {
  const { WeaponCardPackageModel } = compositionDoor;
  for (const piece of contentBundle.equipment.armaments) {
    const pkg = WeaponCardPackageModel.fromPiece(LEGACY_REG, piece);
    if (pkg) {
      eq(pkg.grantedCards.length, 0, `${piece.id} grants nothing`);
      eq(pkg.weaponArtDefaults.length, 0, `${piece.id} installs no arts`);
    }
  }
  // And no shipped run composes any: a fresh reaver deck has no granted or
  // weapon-art instances.
  const run = createRunState({ seed: 7, classId: 'reaver', registries: LEGACY_REG });
  eq(run.deck.filter((c) => c.equipmentRole === 'granted' || c.equipmentRole === 'weaponArt').length, 0, 'no shipped grants compose');
});

test('grants and weapon arts compose at creation and reconcile through equip transitions', () => {
  const { reconcileGrantedCards, stampDeck } = compositionDoor;
  const REG2 = grantFixtureRegistries({ straightSword: {
    compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack',
    grantedCards: [{ cardId: 'quickstep', count: 2 }], weaponArtDefaults: ['crimsonCleave'],
  } });
  const run = createRunState({ seed: 7, classId: 'reaver', registries: REG2 });
  const composed = () => run.deck.filter((c) => c.equipmentRole === 'granted' || c.equipmentRole === 'weaponArt')
    .map((c) => c.instanceId).sort();
  eq(composed(), [
    'granted:straightSword:quickstep:0', 'granted:straightSword:quickstep:1',
    'weaponArt:straightSword:crimsonCleave',
  ], 'creation composes grants and the default art with deterministic ids');
  const art = run.deck.find((c) => c.instanceId === 'weaponArt:straightSword:crimsonCleave');
  eq(art.damageSchool, 'physical', 'a composed instance is carrier-stamped by the same authoritative pass, not left raw');

  const before = composed();
  stampDeck(REG2, run);
  eq(composed(), before, 'restamp is idempotent');

  // Unequip the granting sword: its grants leave the deck with it.
  const savedSets = structuredClone(run.loadout.sets);
  run.loadout.sets.rightHand = run.loadout.sets.rightHand.map(() => null);
  reconcileGrantedCards(REG2, run);
  eq(composed(), [], 'unequip removes every granted instance');
  run.loadout.sets.rightHand = savedSets.rightHand;
  reconcileGrantedCards(REG2, run);
  eq(composed(), before, 're-equip restores them exactly');
});

test('dual-wield weapon arts reconcile through the RIGHT_THEN_LEFT split — a shared art installs once, on the right', () => {
  // Reaver starts straightSword (right) + roundShield (left): both author
  // crimsonCleave, the left adds quickstep. The framework split (quota
  // ceil/floor, unique preference RIGHT_THEN_LEFT) keeps the duplicate on the
  // right only — never one instance per authoring weapon.
  const REG3 = grantFixtureRegistries({
    straightSword: { compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack', weaponArtDefaults: ['crimsonCleave'] },
    roundShield: { compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack', weaponArtDefaults: ['crimsonCleave', 'quickstep'] },
  });
  const run = createRunState({ seed: 7, classId: 'reaver', registries: REG3 });
  const arts = run.deck.filter((c) => c.equipmentRole === 'weaponArt').map((c) => c.instanceId).sort();
  eq(arts, ['weaponArt:roundShield:quickstep', 'weaponArt:straightSword:crimsonCleave'],
    'the shared art survives on the right; the left contributes only its unique art');
});

test('a mid-combat swap reconciles granted instances across the combat piles', () => {
  const { reconcileGrantedCardsInCombat } = compositionDoor;
  const REG2 = grantFixtureRegistries({ straightSword: {
    compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack',
    grantedCards: [{ cardId: 'quickstep', count: 1 }], weaponArtDefaults: ['crimsonCleave'],
  } });
  const run = createRunState({ seed: 7, classId: 'reaver', registries: REG2 });
  // Combat holds the deck as piles: a stale grant from an unequipped weapon
  // sits in hand, one wanted grant is already in draw, the art is missing.
  const piles = {
    hand: [{ instanceId: 'granted:dagger:quickstep:0', cardId: 'quickstep', equipmentRole: 'granted', grantedBy: 'dagger' }],
    draw: [{ instanceId: 'i1', cardId: 'strikeBasic' },
      { instanceId: 'granted:straightSword:quickstep:0', cardId: 'quickstep', equipmentRole: 'granted', grantedBy: 'straightSword' }],
    discard: [], exhaust: [],
  };
  reconcileGrantedCardsInCombat(REG2, run, piles);
  eq(piles.hand.length, 0, 'the stale grant leaves the hand with its armament');
  eq(piles.draw.map((c) => c.instanceId), ['i1', 'granted:straightSword:quickstep:0'], 'a present wanted grant stays put, not duplicated');
  eq(piles.discard.map((c) => c.instanceId), ['weaponArt:straightSword:crimsonCleave'], 'the missing art lands in the discard pile');
  eq(piles.discard[0].upgraded, false, 'a reconciled instance carries the boolean upgraded field combat saves require');
  const snapshot = structuredClone(piles);
  reconcileGrantedCardsInCombat(REG2, run, piles);
  eq(piles, snapshot, 'the combat reconcile is idempotent');
  // The swap door reconciles BEFORE the pile stamps, so a landed instance is
  // carrier-stamped by the same pass as every other card.
  compositionDoor.stampDeck(REG2, run, piles.discard);
  eq(piles.discard[0].damageSchool, 'physical', 'the landed art is stamped by the following pile pass');
});

test('a granted instance is never a per-copy upgrade candidate', () => {
  const { executeAction } = actionsHome;
  const REG2 = grantFixtureRegistries({ straightSword: {
    compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack',
    grantedCards: [{ cardId: 'quickstep', count: 2 }],
  } });
  const run = createRunState({ seed: 7, classId: 'reaver', registries: REG2 });
  // Keep only the granted quickstep copies so they would be the sole
  // per-copy candidates if the exclusion were missing.
  run.deck = run.deck.filter((c) => c.grantedBy || c.cardId !== 'quickstep');
  executeAction({ registries: REG2, run, emit: () => {} }, { effect: { op: 'upgradeCard', card: 'quickstep' } });
  eq(run.deck.filter((c) => c.grantedBy).every((c) => c.upgraded === false), true,
    'an equipment-granted instance upgrades through its armament, never per copy — reconcile would silently drop the flag');
});

test('a granted instance is never a removal candidate', () => {
  const { executeAction } = actionsHome;
  const REG2 = grantFixtureRegistries({ straightSword: {
    compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack',
    grantedCards: [{ cardId: 'quickstep', count: 2 }],
  } });
  const run = createRunState({ seed: 7, classId: 'reaver', registries: REG2 });
  run.deck = run.deck.filter((c) => c.grantedBy || c.cardId !== 'quickstep');
  const grantedCount = () => run.deck.filter((c) => c.grantedBy).length;

  // Targeted by cardId: only the granted copies carry quickstep — nothing removable.
  executeAction({ registries: REG2, run, emit: () => {} }, { effect: { op: 'removeCardFromDeck', card: 'quickstep' } });
  eq(grantedCount(), 2, 'a targeted removal never takes an equipment-granted instance');

  // Random with an rng landing on the tail, where the granted instances sit:
  // the candidate pool excludes them, so an ordinary card leaves instead.
  const before = run.deck.length;
  executeAction({ registries: REG2, run, rng: { float: () => 0.999 }, emit: () => {} }, { effect: { op: 'removeCardFromDeck', random: true } });
  eq(grantedCount(), 2, 'a random removal never takes an equipment-granted instance');
  eq(run.deck.length, before - 1, 'the random removal still removes an ordinary card');
});

const { playerLoadReceipt } = await import('../src/model/statProjection.js');
const weightHome = await import('../src/framework/weight.js');

test('the bridge decides Weight Class through the framework service, with the TermRegistry word', () => {
  const attributes = { strength: 13, dexterity: 11, constitution: 11, wisdom: 8, intelligence: 10 };
  const weights = { mainHandWeight: 12, offHandWeight: 0, armorWeight: 8, otherCountedWeight: 0 };
  const decided = LEGACY_REG.framework.weightClass({ attributes, weights });
  const expected = weightHome.computeWeightClass({ constitution: 11, strength: 13, weights });
  eq(decided.capacity, expected.capacity, 'capacity is the service\'s');
  eq(decided.load, expected.load, 'load is the service\'s');
  eq(decided.weightClass.id, expected.weightClass.id, 'class row is the service\'s');
  eq(decided.word, 'Light', 'the class word comes from TermRegistry');
});

test('the Armoury equip-load receipt counts authored armament weights and the armour rule, and is a readout only', () => {
  const run = createRunState({ seed: 7, classId: 'reaver', registries: LEGACY_REG });
  const r = playerLoadReceipt(LEGACY_REG, run);
  // reaver start: straightSword 5 + roundShield 7 in hand, default armour poiseThreshold 8 (A-side rule)
  eq(r.hands, 12, 'hands weigh their authored weight');
  eq(r.armour, 8, 'armour weighs its poiseThreshold under the A-side rule');
  eq(r.load, 20, 'load sums both');
  eq(r.capacity, 50 + 2 * run.attributes.constitution + run.attributes.strength, 'capacity from mechanics.json and the run attributes');
  eq(r.classId, 'light', 'the reaver starts Light');
  eq(r.active, false, 'no combat rule consumes the class yet');
});

test('grant and weapon-art authoring is validated by name', () => {
  const { WeaponCardPackageModel } = compositionDoor;
  const bad = (extra) => () => WeaponCardPackageModel.fromPiece(LEGACY_REG, {
    ...contentBundle.equipment.armaments.find((p) => p.id === 'straightSword'),
    weaponCardPackage: { compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack', ...extra },
  });
  assertThrows(bad({ grantedCards: [{ cardId: 'notACard' }] }), /granted card 'notACard' is unknown/);
  assertThrows(bad({ grantedCards: [{ cardId: 'quickstep', count: 0 }] }), /count must be a positive integer/);
  assertThrows(bad({ grantedCards: [{ cardId: 'quickstep' }, 'quickstep'] }), /duplicate granted card/);
  assertThrows(bad({ weaponArtDefaults: ['notACard'] }), /weapon art 'notACard' is unknown/);
  assertThrows(bad({ weaponArtDefaults: ['crimsonCleave', 'crimsonCleave'] }), /duplicate weapon art/);
});

console.log(`\nframework: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
