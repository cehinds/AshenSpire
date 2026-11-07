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
    assert.ok(projection.clauses.length >= 1, card.id);
    // Owner 2026-11-02: a clause too long for the face keeps its real words (the fitter shrinks them); never an Inspect cue.
    const text = projection.clauses.map(line => plain(line.html)).join('; ');
    assert.doesNotMatch(text, /Inspect/, card.id);
    if (longFormulaReadings.has(card.id)) {
      assert.ok(text.length > 0, 'a long formula keeps its real words on the face');
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
  assert.deepEqual(projection.clauses.map(line => line.html), ['Pay 2 HP. Discard 1. Offer 1 HP', 'Deal 9 Fire damage'], 'the real rules text, no Inspect cue');
});

test('authored fallback clauses over five words move whole to Information; downsides always show', () => {
  // Owner 2026-10-31: no clause is cut mid-condition; one that cannot be said in five words is the Inspect cue.
  assert.deepEqual(project(defOf('rallyingStandard')).clauses.map(line => plain(line.html)), ['Turn start: +1 Strength', 'Turn start: take 1 damage'],
    'the trigger splits so the downside is never lost');
  // blightBloom's long clause shows whole (owner 2026-11-02: no Inspect cue), after its Exhaust downside.
  assert.deepEqual(project(defOf('blightBloom')).clauses.map(line => plain(line.html)), ['Exhaust', 'Double target Blight (Crimson, Necrotic). Expanded: cap 3 stacks each']);
  assert.match(cardDetailHtml(reg, { cardId: 'blightBloom' }, { rules }), /3 stacks each/);
  const guardian = project(defOf('shieldGuardian')).clauses.map(line => line.html).join('; ');
  assert.doesNotMatch(guardian, /Add a temporary/);
  assert.match(guardian, /Gain.*Block/);
});

test('conditionals and status lists are never cut at a comma', () => {
  const faces = id => project(defOf(id)).clauses.map(line => plain(line.html));
  // A trigger reads whole ("On HP loss: +3 Block") or shows whole; never "When you lose HP" / "gain 3 Block".
  for (const id of ['ironVowCard', 'stigmataCard', 'lifeTitheCard', 'emberTideCard', 'azureCoilCard', 'moonlitShieldCard', 'lucidRecovery', 'groundedResolve', 'crimsonRite']) {
    for (const clause of faces(id).filter(clause => !/, then /.test(clause))) assert.doesNotMatch(clause, /^(?:When|If|Unless|While|After|Before) [^:]*$|^(?:gain|then|heal|deal) /i, `${id}: ${clause}`);
  }
  assert.deepEqual(faces('ironVowCard'), ['On HP loss: +3 Block']);
  assert.deepEqual(faces('crimsonRite'), ['Deal 5 damage, scaling with Stamina spent, then heal 2 per Stamina'], 'the whole rule shows, never split at "then"');
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
    if (COST.test(authored)) assert.match(face, COST, `${card.id}: ${authored} => ${face}`);
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
    for (const clause of projection.clauses) {
      assert.doesNotMatch(plain(clause.html), /Inspect/, label);
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

test('a split-type hit keeps its hit count and area: never split into unqualified fragments', () => {
  const faces = id => project(defOf(id)).clauses.map(line => plain(line.html));
  // Both types belong to every one of the three hits.
  assert.equal(faces('starShower')[0], '2 Blunt + 1 Force ×3');
  // The area qualifier cannot be said in five words: the cue names the effect instead of a lone fragment.
  assert.ok(!faces('meteorSwarm').some(clause => /^(?:Deal )?\d+ Blunt;|^\d+ Force damage/.test(clause)), faces('meteorSwarm').join(' | '));
  assert.ok(faces('meteorSwarm').every(clause => !/Inspect/.test(clause)), 'the real rules text, no Inspect cue');
});

test('no registry card face contains Inspect replacement text', () => {
  for (const card of reg.cards.all()) for (const extra of [{}, { upgraded: true }, { abilityRank: 1 }, { abilityRank: 5 }]) {
    const text = project(defOf(card.id, extra)).clauses.map(line => plain(line.html)).join('; ');
    assert.doesNotMatch(text, /Inspect/, card.id);
  }
});

test('an unfamiliar rule of many long sentences still fills at most the face clause budget', async () => {
  // Review on #2501: the real-text fallback once pushed every overlong sentence onto the face.
  const { cardFaceProjection, FACE_EFFECT_CLAUSES } = await import('../src/model/cardFaceProjection.js');
  const s = [1, 2, 3, 4].map(n => `Sentence ${n} describes a long new mechanic that has no authored face summary yet and keeps going for a while longer.`);
  const def = { id: 'probe', type: 'skill', name: 'Probe', cost: 1, tags: [], keywords: [], effects: [], textTemplate: s.join(' '), text: s.join(' ') };
  const face = cardFaceProjection(def, { lines: null, authoredHtml: s.join(' '), registries: null, effects: [] });
  assert.ok(face.clauses.length >= 1 && face.clauses.length <= FACE_EFFECT_CLAUSES, `clauses: ${face.clauses.length}`);
  assert.ok(face.clauses.every(clause => !/Inspect/.test(clause.html)));
});

import { FACE_BUDGET } from '../src/model/cardFaceBudget.js';
const projectRoomy = (def) => {
  const tokens = staticCardTokens(def);
  const authoredHtml = def.textTemplate.replace(tokenRe(), (match, key) => tokens[key] ?? match);
  return cardFaceProjection(def, { lines: cardFaceLines(def, null, reg), authoredHtml, registries: reg, effects: def.effects, roomy: FACE_BUDGET });
};

test('the roomy budget is data: five lines, seven words a line, a 70% floor, never under 10 px', () => {
  assert.deepEqual([FACE_BUDGET.lines, FACE_BUDGET.wordsPerLine, FACE_BUDGET.minScale, FACE_BUDGET.minPx], [5, 7, 0.7, 10]);
  assert.equal(FACE_BUDGET.clauses, 5);
});

test('a long-rules card carries a roomy projection with its conditional rider; a one-liner is unchanged', () => {
  const long = projectRoomy(defOf('serratedBlade')), plainText = projection => projection.clauses.map(line => plain(line.html)).join('; ');
  assert.ok(long.roomy, 'serratedBlade has a roomy reading');
  assert.match(plainText(long.roomy), /If the target has Bleed/);
  assert.doesNotMatch(plainText(long), /If the target has Bleed/, 'the compact face is untouched');
  assert.ok(long.roomy.clauses.length <= FACE_BUDGET.lines);
  const one = projectRoomy(defOf('guardCounter'));
  assert.equal(one.roomy, undefined, 'a card that already says everything has no roomy reading');
});

test('every roomy reading stays inside the budget, never names an Inspect cue, and keeps every compact downside', () => {
  let roomy = 0;
  for (const card of reg.cards.all()) for (const extra of [{}, { upgraded: true }]) {
    const def = defOf(card.id, extra), projection = projectRoomy(def);
    if (!projection.roomy) continue;
    roomy++;
    const text = projection.roomy.clauses.map(line => plain(line.html)).join('; ');
    assert.ok(projection.roomy.clauses.length <= FACE_BUDGET.clauses, card.id);
    assert.ok(text.length <= FACE_BUDGET.characters + 4 * FACE_BUDGET.clauses || projection.roomy.clauses.some(c => c.kind === 'detail'), `${card.id}: ${text}`);
    assert.doesNotMatch(text, /Inspect|\{/, card.id);
  }
  assert.ok(roomy > 100, `expected many roomy faces, got ${roomy}`);
});

import { roomyBudgetFor } from '../src/model/cardFaceBudget.js';
test('a profile that cuts the face below the module defaults also caps the roomy reading', () => {
  assert.equal(roomyBudgetFor({ faceMaxEffects: 2, faceMaxLines: 3 }), FACE_BUDGET, 'the module defaults are lifted by the roomy budget');
  assert.equal(roomyBudgetFor(null), FACE_BUDGET);
  assert.equal(roomyBudgetFor({ faceMaxEffects: 1, faceMaxLines: 3 }).clauses, 1);
  assert.equal(roomyBudgetFor({ faceMaxEffects: 4, faceMaxLines: 2 }).clauses, 2);
  const capped = roomyBudgetFor({ faceMaxEffects: 1 });
  let roomy = 0;
  for (const card of reg.cards.all()) {
    const def = defOf(card.id), tokens = staticCardTokens(def);
    const projection = cardFaceProjection(def, { lines: cardFaceLines(def, null, reg), registries: reg, effects: def.effects, roomy: capped,
      authoredHtml: def.textTemplate.replace(tokenRe(), (match, key) => tokens[key] ?? match) });
    if (projection.roomy) { roomy++; assert.ok(projection.roomy.clauses.length <= 1, card.id); }
  }
  assert.ok(roomy > 0, 'a one-clause roomy reading still exists for cards whose single clause was trimmed');
});

test('every downside the compact face prints survives on the roomy reading, powers with Exhaust included', () => {
  const COST = /\b(?:take \d+ damage|lose \d+ HP|exhaust|one play per combat|discard|ethereal|cannot|unplayable)\b/gi;
  let both = 0;
  for (const card of reg.cards.all()) for (const extra of [{}, { upgraded: true }]) {
    const def = defOf(card.id, extra), projection = projectRoomy(def);
    if (!projection.roomy) continue;
    both++;
    const wide = projection.roomy.clauses.map(line => plain(line.html)).join('; ').toLowerCase();
    for (const clause of projection.clauses.filter(line => line.downside || line.kind === 'cost')) {
      for (const part of plain(clause.html).toLowerCase().match(COST) || []) assert.ok(wide.includes(part), `${card.id}: "${part}" lost from the roomy reading: ${wide}`);
    }
    for (const keyword of ['exhaust', 'ethereal']) if ((def.keywords || []).includes(keyword) && projection.clauses.some(line => /exhaust|ethereal/i.test(plain(line.html))))
      assert.ok(wide.includes(keyword), `${card.id}: ${keyword} keyword lost from the roomy reading`);
  }
  assert.ok(both > 100);
  for (const id of ['goreblood', 'unbreakable', 'sanguinePactCard']) {
    const card = reg.cards.all().find(c => c.id === id || c.id.endsWith('.' + id));
    if (!card) continue;
    const def = defOf(card.id), projection = projectRoomy(def), compact = projection.clauses.map(l => plain(l.html)).join(' ');
    assert.ok(projection.roomy, `${id} has a roomy reading`);
    assert.ok(compact.length > 0);
    assert.match(projection.roomy.clauses.map(l => plain(l.html)).join(' '), /exhaust/i, id);
  }
});
