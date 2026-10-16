import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { cardManaCategory, applyBaseManaPolicy, validateCardManaPolicy } from '../src/model/cardManaPolicy.js';
import { cardManaPolicy } from '../src/content/generated/cardManaPolicy.js';
import { applyActionCosts } from '../src/model/actionCosts.js';
import { applyAbilityGrade } from '../src/model/abilityGrades.js';
const registries = createRegistries(contentBundle);

test('every authored weapon-package art and actual non-power spell has at least the printed Mana minimum', () => {
  const ids = [...new Set(registries.equipment.armaments.flatMap(piece => piece.weaponCardPackage?.weaponArtDefaults || []))];
  assert.ok(ids.length > 20);
  for (const id of ids) {
    const card = resolveCard(registries, { cardId: id });
    assert.equal(cardManaCategory(registries, card), 'weaponArt', id);
    assert.ok(card.manaCost >= 1, id);
  }
  for (const card of registries.cards.all()) {
    const ranks = card.gradeProfiles ? [0, 1, 2, 3, 4, 5] : [null];
    for (const rank of ranks) {
      const ref = { cardId: card.id, ...(rank === null ? {} : { abilityRank: rank }) };
      const face = resolveCard(registries, ref);
      if (!cardManaCategory(registries, face)) continue;
      const grade = card.gradeProfiles ? applyAbilityGrade(card, rank) : card;
      const before = applyActionCosts(grade, card, { rank: rank || 0 });
      assert.equal(face.manaCost, Math.max(1, before.manaCost || 0), `${card.id}@${rank}: higher prices remain`);
      assert.equal(face.cost, before.cost, `${card.id}@${rank}: no additional Stamina tax`);
    }
  }
});

test('physical basics, class powers and magic-focus equipment basics retain their prior price', () => {
  for (const id of ['strike', 'defend', 'executioner', 'stargazerCard']) {
    const def = registries.cards.get(id);
    const before = applyActionCosts(def);
    const actual = resolveCard(registries, { cardId: id });
    assert.equal(cardManaCategory(registries, actual), null, id);
    assert.equal(actual.manaCost || 0, before.manaCost || 0, id);
  }
  const magicBasic = { id: 'strike', type: 'attack', manaCost: 0, equipmentProfileId: 'staffMagicAttack', equipmentRole: 'attack', cardTags: ['camp:spell'] };
  assert.equal(applyBaseManaPolicy(registries, magicBasic), magicBasic);
  const powerArt = { id: 'guardCounter', type: 'power', manaCost: 0, tags: [] };
  assert.equal(applyBaseManaPolicy(registries, powerArt).manaCost, 1, 'real weapon-art identity takes precedence over card type');
});

test('the JSON minimum is configurable and disabled configured MP is never reintroduced', () => {
  const spell = { id: 'policy-fixture', type: 'skill', manaCost: 0, tags: ['camp:spell'] };
  assert.equal(applyBaseManaPolicy(registries, spell, { ...cardManaPolicy, minimumMana: 2 }).manaCost, 2);
  assert.throws(() => validateCardManaPolicy({ ...cardManaPolicy, minimumMana: -1 }), /minimumMana/);
  const noMana = { ...registries, gameProfile: { foundation: { mode: 'configured' }, modules: { resources: { include: ['hp', 'sp'] } } } };
  assert.equal(applyBaseManaPolicy(noMana, spell), spell);
});
