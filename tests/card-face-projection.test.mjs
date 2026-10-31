import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardDefinition, staticCardTokens } from '../src/model/playingCard.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardFaceProjection, FACE_EFFECT_CHARACTERS } from '../src/model/cardFaceProjection.js';
import { cardDetailHtml, cardPlainText } from '../src/ui/components/card.js';
import { tokenRe } from '../src/model/validate.js';

const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
const plain = html => html.replace(/<[^>]*>/g, '');
const defOf = (cardId, extra = {}) => playingCardDefinition(reg, { cardId, ...extra }, { rules });
const project = (def, preview = null) => {
  const tokens = { ...staticCardTokens(def), ...preview?.tokens };
  const authoredHtml = def.textTemplate.replace(tokenRe(), (match, key) => tokens[key] ?? match);
  return cardFaceProjection(def, { lines: cardFaceLines(def, preview, reg), authoredHtml, registries: reg,
    effects: preview?.chargedEffects || def.effects });
};

test('every authored base, upgrade and rank projects whole short clauses without changing definitions', () => {
  let checked = 0;
  const longFormulaReadings = new Map([
    ['base.scale-damage-taken', 'half of HP lost this turn'],
    ['base.growth-per-type', 'per distinct card type played this turn'],
    ['base.damage-per-use', 'per play of this card this combat'],
  ]);
  for (const card of reg.cards.all()) for (const extra of [{}, { upgraded: true }, { abilityRank: 1 }, { abilityRank: 5 }]) {
    const def = defOf(card.id, extra), before = JSON.stringify(def), projection = project(def);
    assert.equal(projection.maxLines, 3);
    assert.ok(projection.clauses.length >= 1 && projection.clauses.length <= 3, card.id);
    // Owner 2026-10-31: every clause is at most five words, else the face says the Inspect cue.
    const inspectCue = projection.clauses.length === 1 && plain(projection.clauses[0].html) === 'Inspect full effect';
    assert.ok(inspectCue || projection.clauses.every(line => plain(line.html).split(/\s+/).filter(Boolean).length <= 5), `${card.id}: ${plain(projection.clauses.map(line => line.html).join('; '))}`);
    const text = projection.clauses.map(line => plain(line.html)).join('; ');
    assert.ok(text.length <= FACE_EFFECT_CHARACTERS, `${card.id}: ${text}`);
    if (longFormulaReadings.has(card.id)) {
      assert.equal(text, 'Inspect full effect', 'a long formula moves whole to Information');
      const detail = plain(cardDetailHtml(reg, { cardId: card.id, ...extra }, { rules }));
      assert.ok(detail.includes(longFormulaReadings.get(card.id)), `${card.id}: full formula remains in Information`);
    } else assert.doesNotMatch(text, /\{|\.\.\.|…/, card.id);
    assert.equal(JSON.stringify(def), before);
    checked++;
  }
  assert.equal(checked, reg.cards.all().length * 4);
});

test('live primary numbers and up/down marks survive the bounded projection', () => {
  const def = defOf('bashingBlow');
  const preview = { values: [{ op: 'damage', value: 19, hits: 1 }, { op: 'poiseDamage', value: 2 }] };
  const text = project(def, preview).clauses.map(line => line.html).join(' ');
  assert.match(text, /val up">19</);
  assert.match(text, /val down">2</);
});

test('all equipment basic profiles share the bounded projection at every authored rank', () => {
  for (const profile of reg.equipment.basicCardProfiles) for (const abilityRank of [0, 1, 5]) {
    const def = playingCardDefinition(reg, { cardId: profile.baseCardId, profileId: profile.id, abilityRank }, { rules });
    const projection = project(def), text = projection.clauses.map(line => plain(line.html)).join('; ');
    assert.ok(projection.clauses.length <= 3, profile.id);
    assert.ok(text.length <= FACE_EFFECT_CHARACTERS, `${profile.id}: ${text}`);
    assert.doesNotMatch(text, /Inspect full effect|\{/, profile.id);
  }
});

test('a chosen conditional status keeps its probability attached', () => {
  const def = { type: 'skill', effects: [{ op: 'buildup', status: 'burn', chance: 40 }] };
  const projection = cardFaceProjection(def, { lines: [
    { kind: 'status', html: 'Inflict Burn 4' },
    { kind: 'detail', html: 'Burn: 40% chance' },
  ], registries: reg });
  assert.equal(projection.clauses[0].html, 'Apply Burn 4 (40% chance)');
});

test('a standalone once-per-turn qualifier stays with Clear Head’s conditional bonus', () => {
  const projection = project(defOf('clearHead'));
  const text = projection.clauses.map(line => plain(line.html)).join('; ');
  assert.match(text, /Clear 1 Dazed/);
  if (/Advantage/.test(text)) assert.match(text, /Advantage\. Once per turn/);
  assert.match(cardDetailHtml(reg, { cardId: 'clearHead' }, { rules }), /Once per turn/);
});

test('Waking Nightmare’s chance qualifies Sleep only; Confused remains guaranteed', () => {
  const text = project(defOf('wakingNightmare')).clauses.map(line => plain(line.html)).join('; ');
  // Each status is its own clause now (five words at most): Confused stays guaranteed, only Sleep carries the chance.
  assert.match(text, /Confused 3; Sleep 4 \(50% chance\)/);
  assert.doesNotMatch(text, /Confused 3 \(50%/);
});

test('a chance-bearing live charged effect keeps its own probability', () => {
  const def = defOf('strike');
  const added = { op: 'buildup', target: 'enemy', status: 'sleep', amount: 4, chance: 50 };
  const projection = project(def, { chargedEffects: [...def.effects, added] });
  const text = projection.clauses.map(line => plain(line.html)).join('; ');
  assert.match(text, /Sleep 4 \(50% chance\)/);
});

test('payments lead their payoff and long qualified riders move whole to Information', () => {
  const projection = cardFaceProjection({}, { lines: [
    { kind: 'cost', html: 'Offer 3 HP (leave at least 1 HP)' },
    { kind: 'damage', html: 'Inflict 9 Fire damage' },
    { kind: 'condition', html: 'If you played another distinct starstone card before this card: Gain 4 Ward once per turn per family' },
  ] });
  assert.deepEqual(projection.clauses.map(line => line.kind), ['cost', 'damage']);
  assert.equal(projection.omitted, true);
  const blighted = project(defOf('blightedTransmute')).clauses.map(line => plain(line.html)).join('; ');
  assert.match(blighted, /^Pay 12 Ashen Blight;/);
});

test('a payment requiring more than two clauses never leaves a free-looking payoff', () => {
  const projection = cardFaceProjection({}, { lines: [
    { kind: 'cost', html: 'Pay 2 HP. Discard 1. Offer 1 HP' },
    { kind: 'damage', html: 'Inflict 9 Fire damage' },
  ] });
  assert.deepEqual(projection.clauses.map(line => line.html), ['Inspect full effect']);
});

test('authored fallback clauses over five words move whole to Information; downsides always show', () => {
  // Owner 2026-10-31: no clause is cut mid-condition; one that cannot be said in five words is the Inspect cue.
  assert.deepEqual(project(defOf('rallyingStandard')).clauses.map(line => plain(line.html)), ['Turn start: +1 Strength', 'Turn start: take 1 damage'],
    'the trigger splits so the downside is never lost');
  // blightBloom's long clause goes to the cue, but its Exhaust downside still shows.
  assert.deepEqual(project(defOf('blightBloom')).clauses.map(line => plain(line.html)), ['Exhaust', 'Inspect full effect']);
  assert.match(cardDetailHtml(reg, { cardId: 'blightBloom' }, { rules }), /3 stacks each/);
  const guardian = project(defOf('shieldGuardian')).clauses.map(line => line.html).join('; ');
  assert.doesNotMatch(guardian, /Add a temporary/);
  assert.match(guardian, /Gain.*Block|Inspect full effect/);
});

test('conditionals and status lists are never cut at a comma', () => {
  const faces = id => project(defOf(id)).clauses.map(line => plain(line.html));
  // A trigger reads whole ("On HP loss: +3 Block") or goes to the cue; never "When you lose HP" / "gain 3 Block".
  for (const id of ['ironVowCard', 'stigmataCard', 'lifeTitheCard', 'emberTideCard', 'azureCoilCard', 'moonlitShieldCard', 'lucidRecovery', 'groundedResolve', 'crimsonRite']) {
    for (const clause of faces(id)) assert.doesNotMatch(clause, /^(?:When|If|Unless|While|After|Before) [^:]*$|^(?:gain|then|heal|deal) /i, `${id}: ${clause}`);
  }
  assert.deepEqual(faces('ironVowCard'), ['On HP loss: +3 Block']);
  assert.deepEqual(faces('crimsonRite'), ['Inspect full effect'], '"then" clauses are not split');
  assert.deepEqual(faces('base.divine-cleanse'), ['Remove Weak, Bind, Restrained'], 'a status list stays one clause');
  assert.deepEqual(faces('lucidRecovery'), ['Break 1 Sleep'], 'the conditional rider stays whole in Information');
});

test('a face never hides a cost clause', () => {
  const faces = id => project(defOf(id)).clauses.map(line => plain(line.html));
  assert.ok(faces('guilt').some(clause => /lose 1 HP/.test(clause)), 'a curse shows its HP loss');
  assert.ok(faces('base.one-use-scroll').some(clause => /One play per combat/.test(clause)));
  assert.ok(faces('base.one-use-scroll').some(clause => /exhaust/i.test(clause)));
  assert.ok(faces('rallyingStandard').some(clause => /take 1 damage/.test(clause)));
  // Whatever the card, its authored downside is on the face or the face is the explicit cue; never a free-looking payoff.
  const COST = /take \d+ damage|lose \d+ HP|pay \d+ HP|offer \d+ HP|exhaust|one play per combat|ethereal|unplayable/i;
  for (const card of reg.cards.all()) {
    const def = defOf(card.id), tokens = staticCardTokens(def);
    const authored = plain(def.textTemplate.replace(tokenRe(), (match, key) => tokens[key] ?? match));
    const face = faces(card.id).join(' ');
    if (COST.test(authored) && face !== 'Inspect full effect') assert.match(face, COST, `${card.id}: ${authored} => ${face}`);
  }
});

test('stance entry details do not spend the ordinary effect budget', () => {
  const projection = cardFaceProjection({}, { lines: [
    { kind: 'damage', html: 'Inflict 8 damage' },
    { kind: 'bonus', html: 'Draw 1, Entry: +2 Precision' },
  ] });
  assert.deepEqual(projection.clauses.map(line => line.html), ['Deal 8 damage', 'Draw 1']);
});

test('full plain reading and Information preserve facts omitted from the face', () => {
  const def = defOf('sanctuaryCleanse'), face = project(def).clauses.map(line => plain(line.html)).join('; ');
  assert.doesNotMatch(face, /Usable through/);
  assert.match(cardPlainText(reg, { cardId: def.id }, { rules }), /Usable through/);
  assert.match(cardDetailHtml(reg, { cardId: 'shieldGuardian' }, { rules }), /costs 1 Stamina and Exhausts/);
  assert.match(cardDetailHtml(reg, { cardId: 'blightBloom' }, { rules }), /3 stacks each/);
});

test('tag riders (Smash, Prone, Entry) and long lists stay off the face; Core faces are 1-3 clauses of at most 5 words', async () => {
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const profile = resolveGameProfile('core');
  const coreReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const coreRules = { combatExpansionVersion: 2, gameProfile: profile };
  const cards = profile.content.cards.filter(card => card.id.startsWith('core.'));
  assert.ok(cards.length >= 62, 'every Core card is checked');
  for (const card of cards) for (const upgraded of [false, true]) {
    const def = playingCardDefinition(coreReg, { cardId: card.id, upgraded }, { rules: coreRules });
    const tokens = staticCardTokens(def);
    const authoredHtml = def.textTemplate.replace(tokenRe(), (match, key) => tokens[key] ?? match);
    const lines = cardFaceLines(def, null, coreReg, coreRules, { stanceEntry: false });
    const projection = cardFaceProjection(def, { lines, authoredHtml, registries: coreReg, effects: def.effects });
    const label = `${card.id}${upgraded ? '+' : ''}`;
    assert.ok(projection.clauses.length >= 1 && projection.clauses.length <= 3, label);
    const cue = projection.clauses.length === 1 && plain(projection.clauses[0].html) === 'Inspect full effect';
    for (const clause of projection.clauses) {
      assert.ok(cue || plain(clause.html).split(/\s+/).filter(Boolean).length <= 5, `${label}: ${plain(clause.html)}`);
      assert.ok(clause.kind !== 'detail', label);
      assert.doesNotMatch(plain(clause.html), /Smash|while Prone|Entry:|Usable through/, label);
    }
  }
  // Whirlwind's two area figures are two short clauses; the long readings stay in Information.
  const whirl = playingCardDefinition(coreReg, { cardId: 'core.whirlwind' }, { rules: coreRules });
  const tokens = staticCardTokens(whirl);
  const face = cardFaceProjection(whirl, { lines: cardFaceLines(whirl, null, coreReg, coreRules, { stanceEntry: false }),
    authoredHtml: whirl.textTemplate.replace(tokenRe(), (match, key) => tokens[key] ?? match), registries: coreReg, effects: whirl.effects });
  assert.deepEqual(face.clauses.map(line => plain(line.html)), ['8 damage to all', '3 Poise to all']);
  const backstep = playingCardDefinition(coreReg, { cardId: 'core.backstep' }, { rules: coreRules });
  const backFace = cardFaceProjection(backstep, { lines: cardFaceLines(backstep, null, coreReg, coreRules, { stanceEntry: false }), registries: coreReg, effects: backstep.effects });
  assert.ok(backFace.clauses.some(line => plain(line.html) === 'Retreat 1 band'));
});

test('a line with a tag rider reads its faceHtml on the face and drops when that is empty', () => {
  const projection = cardFaceProjection({}, { lines: [
    { kind: 'damage', html: 'Inflict 8 damage', },
    { kind: 'bonus', html: 'Smash: +2 Poise, Entry: +1 Precision', faceHtml: '' },
    { kind: 'bonus', html: 'Draw 1, Entry: +1 Precision', faceHtml: 'Draw 1' },
  ] });
  assert.deepEqual(projection.clauses.map(line => line.html), ['Deal 8 damage', 'Draw 1']);
});
