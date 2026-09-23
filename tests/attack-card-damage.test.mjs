import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { configuredContentBundle, advancedConfigRows } from '../src/model/advancedConfig.js';
import { attackCardBaseDamage, attackCardDamageConfigProblems, cardIsMagical } from '../src/model/attackCardDamage.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { evaluate } from '../src/model/formulas.js';

const defaults = contentBundle.balance.damage.attackCards;

test('cost-derived damage matches the configured formula and counts a status type once', () => {
  const bloodySlash = {
    cost: 2,
    manaCost: 1,
    staminaCost: 1,
    effects: [
      { op: 'applyStatus', status: 'bleed', stacks: 1 },
      { op: 'applyStatus', status: 'bleed', stacks: 3 },
    ],
  };
  assert.equal(attackCardBaseDamage(bloodySlash, defaults), 4);
});

test('every status has a configurable non-negative multiplier', () => {
  assert.deepEqual(attackCardDamageConfigProblems(contentBundle), []);
  const rowKeys = new Set(advancedConfigRows(contentBundle).map((row) => row.key));
  for (const configName of ['attackCards', 'defenseCards', 'potencyCards', 'poiseCards', 'wardCards']) {
    assert.deepEqual(
      Object.keys(contentBundle.balance.damage[configName].statusMultipliers).sort(),
      contentBundle.statuses.map((status) => status.id).sort(),
    );
    for (const status of contentBundle.statuses) {
      assert(rowKeys.has(`gameConfig.balance.damage.${configName}.statusMultipliers.${status.id}`), `${configName}/${status.id}`);
    }
  }
  for (const [configName, config] of Object.entries(contentBundle.balance.damage)) {
    for (const cardId of Object.keys(config.cardBonuses)) {
      assert(rowKeys.has(`gameConfig.balance.damage.${configName}.cardBonuses.${cardId}`), `${configName}/${cardId}`);
    }
  }
});

test('registry projection recalculates every fixed-cost attack and both card faces', () => {
  const registries = createRegistries(contentBundle);
  for (const authored of contentBundle.cards.filter((card) => card.type === 'attack' && card.cost !== 'X')) {
    for (const upgraded of [false, true]) {
      if (upgraded && !authored.upgrade) continue;
      const face = resolveCard(registries, { cardId: authored.id, upgraded });
      const config = cardIsMagical(face)
        ? registries.balance.damage.potencyCards
        : registries.balance.damage.attackCards;
      const expected = attackCardBaseDamage(face, config);
      const primary = face.effects.find((effect) => effect.op === 'damage' && !effect.if);
      const conditional = face.effects.filter((effect) => effect.op === 'damage' && typeof effect.amount === 'number');
      const baseAmounts = authored.effects
        .filter((effect) => effect.op === 'damage' && typeof effect.amount === 'number');
      const authoredBase = baseAmounts.find((effect) => !effect.if)?.amount
        ?? (baseAmounts.length ? Math.min(...baseAmounts.map((effect) => effect.amount)) : null);
      const authoredEffects = upgraded ? authored.upgrade.effects ?? authored.effects : authored.effects;
      const faceAmounts = authoredEffects
        .filter((effect) => effect.op === 'damage' && typeof effect.amount === 'number');
      const authoredFace = faceAmounts.find((effect) => !effect.if)?.amount
        ?? (faceAmounts.length ? Math.min(...faceAmounts.map((effect) => effect.amount)) : null);
      const expectedWithAuthoredDelta = expected
        + (authoredBase !== null && authoredFace !== null ? authoredFace - authoredBase : 0);
      assert(primary || conditional.length, `${authored.id}: projected base damage`);
      if (primary) assert.deepEqual(primary.amount, expectedWithAuthoredDelta, `${authored.id}${upgraded ? '+' : ''}`);
      else assert.equal(Math.min(...conditional.map((effect) => effect.amount)), expectedWithAuthoredDelta, `${authored.id}${upgraded ? '+' : ''}`);
    }
  }
});

test('default formulas preserve authored numeric card values and upgrade-only effects', () => {
  const registries = createRegistries(contentBundle);
  const amounts = (effects, op) => (effects || [])
    .filter((effect) => effect.op === op && typeof effect.amount === 'number')
    .map((effect) => effect.amount);
  for (const authored of contentBundle.cards) {
    for (const upgraded of [false, true]) {
      if (upgraded && !authored.upgrade) continue;
      const projected = resolveCard(registries, { cardId: authored.id, upgraded });
      const authoredEffects = upgraded ? authored.upgrade.effects ?? authored.effects : authored.effects;
      for (const op of [
        ...(authored.type === 'attack' ? ['damage', 'poiseDamage'] : []),
        'block',
      ]) {
        const authoredAmounts = amounts(authoredEffects, op);
        if (authoredAmounts.length) {
          assert.deepEqual(amounts(projected.effects, op), authoredAmounts,
            `${authored.id}${upgraded ? '+' : ''}/${op}`);
        }
      }
    }
  }
});

test('advanced settings deterministically change costs and per-status reductions', () => {
  const configured = configuredContentBundle(contentBundle, {
    'gameConfig.balance.damage.attackCards.globalMultiplier': 2,
    'gameConfig.balance.damage.attackCards.actionCostMultiplier': 3,
    'gameConfig.balance.damage.attackCards.manaCostMultiplier': 4,
    'gameConfig.balance.damage.attackCards.staminaCostMultiplier': 5,
    'gameConfig.balance.damage.attackCards.statusEffectReductionMultiplier': 2,
    'gameConfig.balance.damage.attackCards.statusMultipliers.bleed': 3,
    'gameConfig.balance.damage.attackCards.cardBonuses.gorefireSlash': 7,
  });
  const registries = createRegistries(configured);
  const slash = registries.cards.get('gorefireSlash');
  assert.equal(slash.effects.find((effect) => effect.op === 'damage').amount, 25);
  assert.equal(createRegistries(configured).cards.get('gorefireSlash').effects[0].amount, 25);
});

test('X-cost attacks use one Action of value per repeated hit', () => {
  const registries = createRegistries(contentBundle);
  const supernova = registries.cards.get('supernova');
  const damage = supernova.effects.find((effect) => effect.op === 'damage');
  assert.deepEqual(damage.hits, { f: 'energySpent' });
  assert.equal(evaluate(damage.hits, { energySpent: 3 }), 3);
  assert.equal(damage.amount, attackCardBaseDamage(supernova, registries.balance.damage.potencyCards));
});

test('DR and PR calculate physical and magical Block from card costs', () => {
  const registries = createRegistries(contentBundle);
  const physical = registries.cards.get('defend');
  const magical = registries.cards.get('crystalBarrier');
  assert.equal(
    physical.effects.find((effect) => effect.op === 'block').amount,
    attackCardBaseDamage(physical, registries.balance.damage.defenseCards),
  );
  assert.equal(
    magical.effects.find((effect) => effect.op === 'block').amount,
    attackCardBaseDamage(magical, registries.balance.damage.potencyCards),
  );
  assert(cardIsMagical(registries.cards.get('vesperWard')));
  assert('vesperWard' in registries.balance.damage.potencyCards.cardBonuses);
  assert(!('vesperWard' in registries.balance.damage.defenseCards.cardBonuses));
});

test('Poise and Ward card values drive physical and magical impact', async () => {
  const { attackImpact } = await import('../src/model/combatRatings.js');
  const registries = createRegistries(contentBundle);
  const ctx = { registries, ratingsRules: { attackImpact: {}, impact: {} } };
  const physical = registries.cards.get('strike');
  const magical = registries.cards.get('supernova');
  assert.equal(
    attackImpact(ctx, null, { cardId: physical.id, upgraded: false }),
    physical.cardRatingValues.poise,
  );
  assert.equal(
    attackImpact(ctx, null, { cardId: magical.id, upgraded: false, energySpent: 3 }),
    evaluate(magical.cardRatingValues.ward, { energySpent: 3 }),
  );
});

// A FORMULA-ONLY EFFECT GETS A BASE, AND THE CARD SAYS SO (#1247 review).
// SPEC §3.4 keeps formula-valued effects as bonuses on top of the
// cost-derived base, so projection puts a numeric base in front of them.
// Blight Nova's text was rewritten to name it; Last Stand's was not, and its
// card said "Gain Block equal to your missing HP" while it gained 2 more.
// Every face that gets an invented base must print it.
test('a formula-only effect gets a cost-derived base, and the card text names it', async () => {
  const { computeTokenBindings } = await import('../src/model/validate.js');
  const registries = createRegistries(contentBundle);
  const seen = [];
  for (const authored of contentBundle.cards) {
    for (const upgraded of [false, true]) {
      if (upgraded && !authored.upgrade) continue;
      const authoredEffects = upgraded ? authored.upgrade.effects ?? authored.effects : authored.effects;
      for (const op of ['damage', 'block', 'poiseDamage']) {
        const matching = (authoredEffects || []).filter((effect) => effect.op === op);
        if (!matching.length || matching.some((effect) => typeof effect.amount === 'number')) continue;
        const face = resolveCard(registries, { cardId: authored.id, upgraded });
        const label = `${authored.id}${upgraded ? '+' : ''}/${op}`;
        const base = face.effects.findIndex((effect) => effect.op === op);
        assert.equal(typeof face.effects[base].amount, 'number', `${label}: a numeric base leads`);
        const binding = computeTokenBindings(face.effects).find((row) => row.index === base && row.field === 'amount');
        assert.ok(binding && face.textTemplate.includes(`{${binding.token}}`),
          `${label}: "${face.textTemplate}" must print the base it gains`);
        seen.push(label);
      }
    }
  }
  // Named, so a content change that removes them is noticed rather than
  // quietly making this test vacuous.
  for (const label of ['lastStand/block', 'lastStand+/block', 'blightNova/damage', 'blightNova+/damage']) {
    assert.ok(seen.includes(label), `${label} is still formula-only`);
  }
});

// A PROFILE THAT CROSSES THE PHYSICAL/MAGICAL LINE RESOLVES THROUGH THE OTHER
// FORMULAS (#1247 review). A staff's Strike is magical: its impact is Ward's,
// and a staff's technique Block is PR's. The projection used to run before the
// profile was applied, so a staff hit carried a Poise value and no Ward, and
// the configured Ward formula never reached it.
test('a staff resolves its cards through PR and Ward, a sword through AR/DR and Poise', () => {
  const profiles = contentBundle.equipment.basicCardProfiles;
  const staffAttack = profiles.find((row) => row.id === 'staffMagicAttack');
  const staffTechnique = profiles.find((row) => row.id === 'staffTechnique');
  const registries = createRegistries(contentBundle);
  const damage = registries.balance.damage;

  const plain = resolveCard(registries, { cardId: staffAttack.baseCardId });
  const staff = resolveCard(registries, { cardId: staffAttack.baseCardId, profileId: staffAttack.id });
  assert.equal(cardIsMagical(plain), false);
  assert.equal(cardIsMagical(staff), true);
  assert.deepEqual(Object.keys(plain.cardRatingValues), ['poise']);
  assert.deepEqual(Object.keys(staff.cardRatingValues), ['ward']);
  assert.equal(staff.cardRatingValues.ward, attackCardBaseDamage(staff, damage.wardCards));
  // The upgraded face comes from the same side.
  const staffUp = resolveCard(registries, { cardId: staffAttack.baseCardId, profileId: staffAttack.id, upgraded: true });
  assert.deepEqual(Object.keys(staffUp.cardRatingValues), ['ward']);
  // A carrier-only school (a saved instance whose profile was re-stamped)
  // resolves the same way as the profile.
  const carried = resolveCard(registries, { cardId: staffAttack.baseCardId, damageSchool: 'magic', exposureBuildupPerHit: 0 });
  assert.deepEqual(carried.cardRatingValues, staff.cardRatingValues);

  // The staff Strike and the staff technique are rows on the magical side.
  assert.ok(staffAttack.baseCardId in damage.wardCards.cardBonuses);
  assert.ok(staffAttack.baseCardId in damage.potencyCards.cardBonuses);
  assert.ok(staffTechnique.baseCardId in damage.potencyCards.cardBonuses);

  // Untouched defaults change no authored number on either side.
  const block = (card) => card.effects.find((effect) => effect.op === 'block').amount;
  const technique = resolveCard(registries, { cardId: staffTechnique.baseCardId });
  const staffBlock = resolveCard(registries, { cardId: staffTechnique.baseCardId, profileId: staffTechnique.id });
  const authoredBlock = contentBundle.cards.find((card) => card.id === staffTechnique.baseCardId)
    .effects.find((effect) => effect.op === 'block').amount;
  assert.equal(block(technique), authoredBlock);
  assert.equal(block(staffBlock), authoredBlock);

  // The PR formula moves the staff's Block and not the sword's; DR the reverse.
  const tuned = (key, value) => createRegistries(configuredContentBundle(contentBundle, { [`gameConfig.balance.damage.${key}`]: value }));
  const potency = tuned('potencyCards.globalMultiplier', 5);
  assert.notEqual(block(resolveCard(potency, { cardId: staffTechnique.baseCardId, profileId: staffTechnique.id })), authoredBlock);
  assert.equal(block(resolveCard(potency, { cardId: staffTechnique.baseCardId })), authoredBlock);
  const defense = tuned('defenseCards.globalMultiplier', 5);
  assert.equal(block(resolveCard(defense, { cardId: staffTechnique.baseCardId, profileId: staffTechnique.id })), authoredBlock);
  assert.notEqual(block(resolveCard(defense, { cardId: staffTechnique.baseCardId })), authoredBlock);
});

// THE SAME, IN A FIGHT: the engine's action carrier is built from the
// instance, so it has to carry the resolved face's values — the registry def
// only knows the physical Strike.
test('a staff Strike played in combat lands its configured Ward impact', async () => {
  const { createCombat, dispatch } = await import('../src/engine/combat.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { resolveCombatRatings } = await import('../src/model/combatRatings.js');
  const impactOf = (settings, instance) => {
    const configured = configuredContentBundle(contentBundle, settings);
    const registries = createRegistries(configured);
    const c = createCombat({
      registries, rng: createRng(998), ratingsRules: resolveCombatRatings(settings, contentBundle),
      player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, energyMax: 3, drawPerTurn: 3,
        attributes: { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 },
        deck: Array.from({ length: 5 }, (_, i) => ({ instanceId: `s${i}`, upgraded: false, ...instance })), relicIds: [] },
      enemyIds: ['wanderingSoldier'],
    });
    const enemy = c.enemies[0];
    enemy.poiseMeter = { value: 0, max: 999 };
    enemy.wardMeter = { value: 0, max: 999 };
    const seen = [];
    const emit = c.emit;
    c.emit = (type, payload) => { if (type === 'ratingImpact') seen.push(payload); return emit(type, payload); };
    dispatch(c, { type: 'playCard', cardInstanceId: c.piles.hand[0].instanceId, targetId: enemy.id });
    return { seen, face: resolveCard(registries, c.piles.discard[0] || instance) };
  };
  const staffStrike = { cardId: 'strike', profileId: 'staffMagicAttack', damageSchool: 'magic', exposureBuildupPerHit: 0 };
  for (const multiplier of [1, 3]) {
    const { seen, face } = impactOf({ 'gameConfig.balance.damage.wardCards.globalMultiplier': multiplier }, staffStrike);
    assert.equal(seen.length, 1, 'one impact');
    assert.equal(seen[0].meter, 'ward');
    assert.equal(seen[0].amount, face.cardRatingValues.ward, `Ward ×${multiplier} is the hit's impact`);
  }
  const low = impactOf({ 'gameConfig.balance.damage.wardCards.globalMultiplier': 1 }, staffStrike).seen[0].amount;
  const high = impactOf({ 'gameConfig.balance.damage.wardCards.globalMultiplier': 3 }, staffStrike).seen[0].amount;
  assert.ok(high > low, 'the Ward formula reaches the staff hit');
});

// THE PER-CARD BONUS IS SIGNED (SPEC §3.4), so its settings row must accept a
// negative number: read off a shipped value of 0 or more, a generated row
// floors at 0, and a card could never be made weaker than its cost says.
test('a card-value bonus row accepts a negative bonus, and the card obeys it', () => {
  const rows = advancedConfigRows(contentBundle).filter((row) => row.key.includes('.cardBonuses.'));
  assert.ok(rows.length > 100, 'every applicable card has a bonus row');
  for (const row of rows) assert.ok(row.min < 0, `${row.key} opens below zero (min ${row.min})`);
  const key = 'gameConfig.balance.damage.attackCards.cardBonuses.strike';
  const damage = (settings) => createRegistries(configuredContentBundle(contentBundle, settings))
    .cards.get('strike').effects.find((effect) => effect.op === 'damage').amount;
  assert.ok(damage({ [key]: -1 }) < damage({ [key]: 0 }), 'a negative bonus lowers the card');
});

// A MALFORMED CONTAINER IS NAMED, NOT MASKED. Materializing spreads the
// containers over their defaults, which turned an array into a harmless-
// looking object and made a null throw from inside the validator.
test('a malformed status or bonus container is reported by name', () => {
  for (const [key, value] of [['statusMultipliers', []], ['statusMultipliers', null], ['cardBonuses', []], ['cardBonuses', 7]]) {
    const damage = contentBundle.balance.damage;
    const bad = { ...contentBundle, balance: { ...contentBundle.balance,
      damage: { ...damage, attackCards: { ...damage.attackCards, [key]: value } } } };
    const problems = attackCardDamageConfigProblems(bad).map((problem) => problem.path);
    assert.ok(problems.includes(`balance.damage.attackCards.${key}`), `${key} = ${JSON.stringify(value)}: ${problems.join(', ') || 'none'}`);
  }
  assert.deepEqual(attackCardDamageConfigProblems(contentBundle), []);
});
