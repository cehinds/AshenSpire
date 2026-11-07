import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { previewCard } from '../src/engine/combat.js';
import { applyStatus, decayAtTurnStart, decayAtTurnEnd, advanceStatusClock, statusDefinition } from '../src/engine/statuses.js';
import { cardDetailHtml } from '../src/ui/components/card.js';
import { statusTooltipText, statusInstancePresentation } from '../src/ui/uiContent.js';
import { createFoundation } from '../src/engine/combatRules.js';
import { combatRules } from '../src/content/combatRules.js';
import { combatStatusPresentationRegistries } from '../src/ui/models/CombatStatusPresentationModel.js';
import { activeCombatAbilities } from '../src/ui/components/combatAbilities.js';
import { coreStatusPresentation, statusPresentationDefinition } from '../src/model/statusPresentation.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture({ amount = 1, mode = 'add', stacking = null } = {}) {
  const reg = stacking ? { ...core, statuses: { ...core.statuses,
    get: id => id === 'weak' ? { ...core.statuses.get(id), stacking } : core.statuses.get(id) } } : core;
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 5,
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(5), enemyIds: ['wanderingSoldier'] });
  combat.fixCoreRules = structuredClone(combat.fixCoreRules);
  combat.fixCoreRules.statuses.decayAmount = amount;
  combat.fixCoreRules.statuses.weakARMultiplier = 0.6;
  combat.fixCoreRules.statuses.overrides.weak.stackMode = mode;
  combat.player.energy = combat.player.mana = 20;
  const inst = combat.piles.hand[0]; inst.cardId = 'sap';
  return { combat, reg, inst };
}
const weakInfo = (reg, inst, preview) => {
  const html = cardDetailHtml(reg, inst, { preview });
  const row = html.match(/data-inspection-status="weak">([\s\S]*?)<\/div>/);
  assert.ok(row, 'Sap Information shows Weak visibly');
  return row[1];
};

test('real Core 2 Sap preview explains the actual uncapped owner-turn-start status', () => {
  const { combat, reg, inst } = fixture();
  applyStatus(combat, combat.player, 'weak', 5);
  assert.equal(combat.player.statuses.weak.stacks, 5);
  const preview = previewCard(combat, inst.instanceId);
  assert.deepEqual(preview.coreStatusAuthority.definitions.weak, statusDefinition(combat, 'weak'));
  const text = weakInfo(reg, inst, preview);
  assert.match(text, /Attack rating ×0.6/);
  assert.match(text, /decreases by 1 at the start of the owner's turn/);
  assert.doesNotMatch(text, /up to 3|at the cap|end of (?:its|the) owner's turn/);
  decayAtTurnEnd(combat, combat.player);
  assert.equal(combat.player.statuses.weak.stacks, 5);
  combat.turn++; decayAtTurnStart(combat, combat.player);
  assert.equal(combat.player.statuses.weak.stacks, 4);
  preview.coreStatusAuthority.definitions.weak.modifiers.planted = 1;
  preview.coreStatusAuthority.overrideIds.length = 0;
  assert.equal(statusDefinition(combat, 'weak').modifiers.planted, undefined, 'preview metadata is detached');
});

test('saved Core overrides retain their stack mode, multiplier and custom decay amount', () => {
  const { combat, reg, inst } = fixture({ amount: 2, mode: 'refresh' });
  applyStatus(combat, combat.player, 'weak', 5); applyStatus(combat, combat.player, 'weak', 2);
  assert.equal(combat.player.statuses.weak.stacks, 5);
  const text = weakInfo(reg, inst, previewCard(combat, inst.instanceId));
  assert.match(text, /keeps the higher stack total/);
  assert.match(text, /decreases by 2 at the start/);
  assert.doesNotMatch(text, /Applications add stacks|up to 3|Reapplying adds/);
  combat.turn++; decayAtTurnStart(combat, combat.player);
  assert.equal(combat.player.statuses.weak.stacks, 3);
});

test('Burn tooltip keeps its damage rule and describes the actual custom, default Core and legacy decay', () => {
  for (const { amount, enabled, clock } of [
    { amount: 2, enabled: true, clock: 'start' },
    { amount: 1, enabled: true, clock: 'start' },
    { amount: 1, enabled: false, clock: 'end' },
  ]) {
    const { combat, reg } = fixture({ amount });
    combat.fixCoreRules.enabled = enabled;
    if (!enabled) combat.combatExpansionVersion = 1;
    applyStatus(combat, combat.player, 'burn', 3);
    assert.equal(combat.player.statuses.burn.stacks, 3);
    const text = statusTooltipText(reg.statuses.get('burn'), combat);
    assert.match(text, /loses HP equal to Burn stacks \(ignores Block\)/);
    if (enabled) assert.doesNotMatch(text, /One stack burns out each turn/);
    else assert.match(text, /One stack burns out each turn/, 'legacy source prose remains unchanged');
    assert.match(text, new RegExp(`decreases by ${amount} at the ${clock} of ${enabled ? 'the' : 'its'} owner's turn`));
    if (enabled) {
      decayAtTurnEnd(combat, combat.player);
      assert.equal(combat.player.statuses.burn.stacks, 3, 'Core Burn waits for owner turn start');
      combat.turn++; decayAtTurnStart(combat, combat.player);
    } else {
      combat.turn++; decayAtTurnStart(combat, combat.player);
      assert.equal(combat.player.statuses.burn.stacks, 3, 'legacy Burn waits for owner turn end');
      decayAtTurnEnd(combat, combat.player);
    }
    assert.equal(combat.player.statuses.burn.stacks, 3 - amount);
  }
});

test('Core-only status wording adapts custom timers without changing versioned definitions or custom tooltips', () => {
  const { combat, reg } = fixture({ amount: 2 });
  const original = reg.statuses.get('crimsonBlight');
  const custom = { ...original, decay: { ...original.decay, duration: 5 } };
  const before = structuredClone(custom);
  combat.registries = { ...reg, statuses: { ...reg.statuses,
    get: id => id === 'crimsonBlight' ? custom : reg.statuses.get(id) } };
  applyStatus(combat, combat.player, 'crimsonBlight', 2);
  assert.equal(combat.player.statuses.crimsonBlight.duration, 5);
  const text = statusTooltipText(custom, combat);
  assert.match(text, /expires entirely after 5 turns/);
  assert.match(text, /5 ticks at the start/);
  assert.doesNotMatch(text, /after 3 turns|Re-applying adds stacks and refreshes/);
  combat.turn++; decayAtTurnStart(combat, combat.player);
  assert.equal(combat.player.statuses.crimsonBlight.duration, 4);
  assert.deepEqual(custom, before, 'presentation never edits the versioned definition');
  const authored = { ...custom, tooltip: 'Custom 3-turn wording and a bespoke application rule.',
    description: 'Independent custom description: three turns, with authored stacking.' };
  assert.equal(statusPresentationDefinition(combat, 'crimsonBlight', authored).tooltip, authored.tooltip);
  assert.equal(statusPresentationDefinition(combat, 'crimsonBlight', authored).description, authored.description);
  assert.equal(statusPresentationDefinition(combat, 'crimsonBlight', { ...custom, description: authored.description }).description,
    authored.description, 'normalizing a known tooltip does not replace a custom description');
  const customBurn = { ...reg.statuses.get('burn'), tooltip: 'Burn from a custom source lasts three turns.' };
  assert.equal(statusPresentationDefinition(combat, 'burn', customBurn).tooltip, customBurn.tooltip);
  for (const id of ['burn', 'crimsonBlight']) {
    const source = reg.statuses.get(id);
    const extended = { ...source, tooltip: `Custom amount 17. ${source.tooltip} Custom rate 23.`,
      description: `Custom amount 17. ${source.tooltip} Custom rate 23.` };
    for (const context of [combat, { ...combat, fixCoreRules: { ...combat.fixCoreRules, enabled: false } }]) {
      const display = statusPresentationDefinition(context, id, extended);
      assert.equal(display.tooltip, extended.tooltip, `${id}: a custom field containing legacy wording stays verbatim`);
      assert.equal(display.description, extended.description, `${id}: its independent custom description stays verbatim`);
    }
  }
  const projected = statusPresentationDefinition(combat, 'crimsonBlight', custom);
  assert.equal(statusTooltipText(projected, { coreStatusAuthority: { enabled: false } }), statusTooltipText(custom),
    'explicit off restores the original legacy definition before presentation');
  const expandedOff = statusTooltipText(projected, { combatExpansionVersion: 2, coreStatusAuthority: { enabled: false } });
  assert.match(expandedOff, /expires entirely after 5 turns/);
  assert.match(expandedOff, /at the cap leaves the timer unchanged/);
  assert.doesNotMatch(expandedOff, /Re-applying adds stacks and refreshes|at the start of the owner's turn/);
  const off = { ...combat, fixCoreRules: { ...combat.fixCoreRules, enabled: false } };
  assert.doesNotMatch(statusPresentationDefinition(off, 'crimsonBlight', custom).tooltip, /Re-applying adds stacks and refreshes/);
  assert.strictEqual(statusPresentationDefinition({ ...off, combatExpansionVersion: 1 }, 'crimsonBlight', custom), custom);
  assert.strictEqual(statusPresentationDefinition(off, 'burn', reg.statuses.get('burn')), reg.statuses.get('burn'));
  assert.match(original.tooltip, /after 3 turns\. Re-applying adds stacks and refreshes/);
});

test('Core foundation stacking keeps its application cap/clock together with Core decay', () => {
  const { combat, reg, inst } = fixture({ amount: 2, mode: 'unique',
    stacking: { mode: 'add', cap: 7, duration: 2, clock: 'ownerTurnEnd' } });
  combat.foundation = createFoundation(combatRules);
  applyStatus(combat, combat.player, 'weak', 5); applyStatus(combat, combat.player, 'weak', 5);
  assert.equal(combat.player.statuses.weak.stacks, 7);
  const text = weakInfo(reg, inst, previewCard(combat, inst.instanceId));
  assert.match(text, /adds to the stack total up to 7/);
  assert.match(text, /Application timer: 2 ticks at the end/);
  assert.match(text, /decreases by 2 at the start/);
  assert.doesNotMatch(text, /up to 3|Does not stack/);
  combat.turn++; decayAtTurnStart(combat, combat.player);
  assert.equal(combat.player.statuses.weak.stacks, 5);
  advanceStatusClock(combat, combat.player, 'ownerTurnEnd');
  advanceStatusClock(combat, combat.player, 'ownerTurnEnd');
  assert.equal(combat.player.statuses.weak, undefined);
});

test('Core duration clocks tick once at owner turn start and retain non-overridden expansion caps', () => {
  const { combat } = fixture({ amount: 2 });
  applyStatus(combat, combat.player, 'crimsonBlight', 5);
  assert.equal(combat.player.statuses.crimsonBlight.stacks, 3);
  const text = statusTooltipText(core.statuses.get('crimsonBlight'), combat);
  assert.match(text, /stack total up to 3/);
  assert.match(text, /3 ticks at the start/);
  assert.doesNotMatch(text, /owner turn ends/);
  combat.turn++; decayAtTurnStart(combat, combat.player);
  assert.equal(combat.player.statuses.crimsonBlight.duration, 2, 'duration ignores the two-stack decay amount');
});

// Rule (owner, 2026-10-31): Precision loses a stack at owner turn start; Persistent stacks are exempt; the badge shows the accuracy.precisionTooltip text.
test('Core Precision loses a stack at owner turn start, preserves Persistent grants, and shows the accuracy tooltip', () => {
  const { combat } = fixture();
  delete combat.player.statuses.precision;
  applyStatus(combat, combat.player, 'precision', 2, combat.player, { tags: ['trait:persistent'] });
  applyStatus(combat, combat.player, 'precision', 3);
  const text = statusTooltipText(core.statuses.get('precision'), combat);
  assert.match(text, /^Each stack adds 1 Precision\. Loses 3 stacks at the start of your turn\./);
  assert.match(text, /Temporary stacks lose 3 at the start of the owner's turn; Persistent stacks remain\./);
  assert.doesNotMatch(text, /decreases by 1/);
  assert.doesNotMatch(text, /expire at the end of the owner's turn|multiple of your Precision/);
  decayAtTurnEnd(combat, combat.player);
  assert.equal(combat.player.statuses.precision.stacks, 5, 'turn end does not clear Precision');
  for (let i = 0; i < 4; i++) { combat.turn++; decayAtTurnStart(combat, combat.player); }
  assert.equal(combat.player.statuses.precision.stacks, 2, 'only the 3 temporary stacks decay; the 2 persistent remain');
});

test('PIPs and inspector abilities retain actual Core clocks after terminology without explicit caller context', () => {
  const { combat, reg } = fixture({ amount: 2, mode: 'refresh' });
  applyStatus(combat, combat.player, 'weak', 5);
  const view = combatStatusPresentationRegistries(reg, combat);
  const def = view.frameworkTerms.withStatusWords(view.statuses.get('weak', combat.player));
  const pip = statusInstancePresentation(def, combat.player.statuses.weak).tooltip;
  const ability = activeCombatAbilities(view, combat.player).find(row => row.id === 'weak').detail;
  for (const text of [pip, ability]) {
    assert.match(text, /keeps the higher stack total/);
    assert.match(text, /decreases by 2 at the start/);
    assert.doesNotMatch(text, /up to 3|Applications add stacks|end of (?:its|the) owner's turn/);
  }
});

test('Core preview authority collects nested status sources without copying the combat snapshot', () => {
  const { combat } = fixture();
  const grant = status => ({ op: 'applyStatus', status });
  const receipt = coreStatusPresentation(combat, {
    effects: [grant('weak')], counterPayload: { effects: [grant('precision')] },
    upcast: { effects: [grant('crimsonBlight')] }, schoolEffect: grant('evade'),
  }, [grant('vulnerable')]);
  assert.deepEqual(Object.keys(receipt.definitions).sort(), ['crimsonBlight', 'evade', 'precision', 'vulnerable', 'weak']);
  assert.deepEqual(Object.keys(receipt).sort(), ['clocks', 'decayAmount', 'definitions', 'enabled', 'overrideIds']);
  assert.equal(receipt.clocks.precision, 'precisionOwnerTurnStart'); // Rule: Precision loses accuracy.precisionDecayPerTurn temporary stacks at owner turn start (owner, 2026-11-01)
  assert.equal(receipt.clocks.evade, 'stackOwnerTurnStart');
});

test('a real disabled Core v2 preview uses expansion caps and owner-turn-end decay instead of its Core registry profile', () => {
  const { combat, reg, inst } = fixture();
  combat.fixCoreRules.enabled = false;
  applyStatus(combat, combat.player, 'weak', 5);
  assert.equal(combat.player.statuses.weak.stacks, 3);
  const preview = previewCard(combat, inst.instanceId);
  assert.deepEqual(preview.coreStatusAuthority, { enabled: false });
  const text = weakInfo(reg, inst, preview);
  assert.match(text, /25% less attack damage/);
  assert.match(text, /stack total up to 3/);
  assert.match(text, /decreases by 1 at the end/);
  assert.doesNotMatch(text, /Attack rating ×|at the start/);
  decayAtTurnEnd(combat, combat.player);
  assert.equal(combat.player.statuses.weak.stacks, 2);
});

test('disabled Core retains a custom expansion cap and explicit off overrides remembered Core tooltip context', () => {
  const { combat, reg, inst } = fixture();
  const view = combatStatusPresentationRegistries(reg, combat);
  const rememberedCore = view.frameworkTerms.withStatusWords(view.statuses.get('weak'));
  combat.fixCoreRules.enabled = false;
  combat.combatStatusRules = structuredClone(combat.combatExpansionRules.statuses);
  combat.combatStatusRules.statuses.weak.cap = 5;
  applyStatus(combat, combat.player, 'weak', 9);
  assert.equal(combat.player.statuses.weak.stacks, 5);
  const preview = previewCard(combat, inst.instanceId), text = weakInfo(reg, inst, preview);
  assert.match(text, /stack total up to 5/);
  assert.doesNotMatch(text, /Attack rating ×|at the start/);
  const tooltip = statusTooltipText(rememberedCore, preview);
  assert.match(tooltip, /stack total up to 5/);
  assert.match(tooltip, /decreases by 1 at the end/);
  assert.doesNotMatch(tooltip, /Attack rating ×|at the start/);
});

test('no-preview inspection still uses a known Core profile or actual supplied run rules', () => {
  const { combat, reg, inst } = fixture();
  const actual = cardDetailHtml(reg, inst, { rules: combat });
  assert.match(actual, /Attack rating ×0.6/);
  assert.match(actual, /decreases by 1 at the start/);
  const knownProfile = cardDetailHtml(reg, inst, { rules: { combatExpansionVersion: 2 } });
  assert.match(knownProfile, /Attack rating ×0.75/);
  assert.match(knownProfile, /decreases by 1 at the start/);
});
