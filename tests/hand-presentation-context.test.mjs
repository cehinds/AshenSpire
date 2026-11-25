import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { withModalDom } from './helpers/dom.mjs';
import { mountHand } from '../src/ui/components/hand.js';
import { clearSelection, resetSelection } from '../src/ui/components/cardSelection.js';

const modules = ['src/content/index.js', 'src/model/registries.js', 'src/model/gameProfile.js', 'src/model/state.js',
  'src/model/levelup.js', 'src/engine/runCombat.js', 'src/engine/rng.js', 'src/engine/combat.js',
  'src/model/playingCard.js', 'src/model/cardFaceText.js', 'src/model/smashClause.js'];
async function runtime(mode) {
  const require = mode === 'bundled' ? productionBundle({ additionalModules: modules }) : null;
  return Object.assign({}, ...await Promise.all(modules.map(id => require ? require(id) : import(new URL('../' + id, import.meta.url)))));
}
function fixture(api) {
  const author = JSON.parse(JSON.stringify({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
    effects: { spellTraditionsVersion: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1 },
  } }), (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.assign(Object.create(null), value) : value);
  const profile = api.resolveGameProfile(author);
  const registries = api.bindGameProfileRegistries(api.createRegistries(api.applyGameProfileToContent(api.contentBundle, profile)), profile);
  const run = api.createRunState({ registries, classId: 'starseer', seed: 31, runId: 'hand-presentation',
    profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.relics = [];
  // Keep the reference effective INT after the starting sceptre lost its two points.
  Object.assign(run.attributes, { intelligence: 10, wisdom: 2 });
  api.rederivePools(registries, run, 'hand presentation fixture');
  const combat = api.createRunCombat({ registries, run, rng: api.createRng(31), enemyIds: ['wanderingSoldier'] });
  api.dispatch(combat, { type: 'setReactions', enabled: false });
  delete combat.fixCoreRules.elements;
  delete combat.fixCoreRules.stanceBenefits;
  combat.stanceRules = { ...combat.stanceRules, offensiveRating: 0 };
  Object.assign(combat.enemies[0], { weaknesses: [], hp: 5000, maxHp: 5000, actorIntentRevealed: true });
  primeAccuracyRolls(combat, { count: 3 });
  return { registries, run, combat };
}
function quote(api, world, cardId = 'core.cinderDart', upgraded = false) {
  const inst = { instanceId: `context-${world.combat.piles.hand.length}`, cardId, upgraded };
  world.combat.piles.hand.push(inst);
  return { inst, preview: api.previewCard(world.combat, inst.instanceId, world.combat.enemies[0].id) };
}
for (const mode of ['native', 'bundled']) test(`live hand rules retain original, upgraded, selected and triggered baselines: ${mode}`, async () => {
  const api = await runtime(mode), world = fixture(api), { combat, registries } = world;
  for (const [upgraded, expected] of [[false, 12], [true, 13]]) {
    const { inst, preview } = quote(api, world, 'core.cinderDart', upgraded);
    assert.equal(api.playingCardModel(registries, inst, { preview, rules: combat }).baseTokens.damage, expected);
    const html = api.cardFaceLines(preview.resolvedDefinition, preview, registries, combat).find(row => row.kind === 'damage').html;
    assert.match(html, new RegExp(`class="val">${expected}</span>`));
    assert.doesNotMatch(html, /class="val (up|down)"/);
  }
  combat.player.combatStance = { maneuver: 'smash', camp: 'physical', range: 'melee' };
  const selected = quote(api, world, 'base.current-stance-variant', true);
  assert.equal(selected.preview.faceRules.faceDefinition.activeEffectVariant, 0);
  assert.equal(api.playingCardModel(registries, selected.inst, { preview: selected.preview, rules: combat }).baseTokens.damage,
    api.playingCardModel(registries, selected.inst, { preview: selected.preview }).baseTokens.damage, 'same upgraded selected branch');
  delete combat.player.combatStance;
  combat.player.itemProps.cardRules.push({ selector: 'spell', arg: null, conds: [{ name: 'first', arg: 'fight' }], stat: 'damage', amount: 8, mode: 'add', source: 'test:trigger' });
  const triggered = quote(api, world);
  assert.equal(api.playingCardModel(registries, triggered.inst, { preview: triggered.preview, rules: combat }).baseTokens.damage, 12);
  assert.match(api.cardFaceLines(triggered.preview.resolvedDefinition, triggered.preview, registries, combat).find(row => row.kind === 'damage').html, /class="val up"/);
  const incoming = triggered.preview.values.find(row => row.op === 'damage').perTarget[combat.enemies[0].id];
  const before = combat.enemies[0].hp;
  combat.player.mana = combat.player.energy = combat.player.stamina = 100;
  api.dispatch(combat, { type: 'playCard', cardInstanceId: triggered.inst.instanceId, targetId: combat.enemies[0].id });
  assert.equal(before - combat.enemies[0].hp, incoming);
});

test('mounted hand keeps black 12 while live saved rules override the earlier preview', async () => {
  const api = await runtime('native'), world = fixture(api), { combat, registries } = world;
  const calm = quote(api, world), smash = quote(api, world, 'core.smash');
  const before = JSON.stringify(calm.preview);
  withModalDom(() => {
    globalThis.NodeFilter ??= { SHOW_ELEMENT: 1 };
    document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
    document.getSelection = () => ({ removeAllRanges() {}, rangeCount: 0 });
    document.documentElement ??= { dataset: { handLayout: 'paging' }, getAttribute: () => null };
    resetSelection(); clearSelection();
    const handEl = document.createElement('div'); document.body.append(handEl);
    const hand = mountHand(handEl, { registries, reuseCards: true, liveWiring: true });
    try {
      hand.render({ cards: [{ ...calm, rules: combat, affordable: true, surface: 'combat' }] });
      assert.equal(api.playingCardModel(registries, calm.inst, { preview: calm.preview, rules: combat }).baseTokens.damage, 12);
      assert.equal(handEl.children[0].querySelector('[data-face-kind="damage"]').querySelector('.val').className, 'val', 'actual hand damage is black');
      combat.fixCoreRules.smashVsDefensive = { damageMultiplier: 1.6, blockFraction: 0.25, poiseFraction: 0.5 };
      delete combat.fixCoreRules.spellTraditionsVersion;
      const context = api.CardPresentationContext(calm.preview.resolvedDefinition, calm.preview, combat);
      assert.equal(context.fixCoreRules, combat.fixCoreRules);
      assert.equal(Object.hasOwn(context.fixCoreRules, 'spellTraditionsVersion'), false, 'absent saved policy remains absent');
      assert.equal(context.faceDefinition, calm.preview.faceRules.faceDefinition);
      assert.match(api.coreSmashClause(smash.preview.resolvedDefinition, registries, context), /Against Defend or Prepared: 1\.6× damage/);
      hand.render({ cards: [{ ...smash, rules: combat, affordable: true, surface: 'combat' }] });
      assert.match(handEl.children[0].querySelector('[data-tag-id="maneuver:smash"]').getAttribute('data-tip'), /Against Defend or Prepared: 1\.6× damage/, 'actual hand reads the changed live policy with its unchanged preview');
      combat.fixCoreRules.spellTraditionsVersion = 0;
      assert.equal(api.CardPresentationContext(calm.preview.resolvedDefinition, calm.preview, combat).fixCoreRules.spellTraditionsVersion, 0);
      assert.equal(api.CardPresentationContext({ id: 'different-card' }, calm.preview, combat), combat, 'unrelated preview supplies no metadata');
      assert.equal(JSON.stringify(calm.preview), before, 'context composition never edits the preview');
    } finally { hand.teardown(); }
  });
});
