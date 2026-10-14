import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';

const reg = createRegistries(contentBundle);
const card = id => applyCombatExpansionCard(reg.cards.get(id));
const lines = (id, preview = null) => cardFaceLines(card(id), preview, reg);
const text = (id, preview = null) => (lines(id, preview) || []).map(line => line.html.replace(/<[^>]+>/g, ''));

test('a mixed damage and poise card reads one damage line with the poise joined', () => {
  const [first] = text('bashingBlow');
  assert.match(first, /^Inflict 7 (\w+ )?damage, 4 Poise damage$/);
});

test('a cleanse card lists its removals, its Ward gain, and the usable-while detail last', () => {
  const all = text('sanctuaryCleanse');
  assert.ok(all.includes('Remove 1 Sleep, 1 Paralysis, 1 Dazed'), all.join(' | '));
  assert.ok(all.includes('Gain 1 Block, 2 Ward'), all.join(' | '));
  assert.match(all.at(-1), /^Usable through Sleep, Paralysis, Dazed$/);
});

test('a conditional card groups its effects under the status that gates them', () => {
  // The authored data: Weak buildup 4 gated on the card's own Starstone Charge, and a self Charge gain of 1.
  const all = text('starSpark');
  assert.ok(all.includes('Starstone Charge: Inflict Weak 4'), all.join(' | '));
  assert.ok(all.includes('Gain Starstone Charge 1'), all.join(' | '));
});

test('a consumed prerequisite reads after the conditional payoff that uses it', () => {
  const all = lines('ambush');
  const payoff = all.findIndex(line => line.html.startsWith('Prepared:'));
  const consume = all.findIndex(line => line.html === 'Remove all Prepared');
  assert.ok(payoff >= 0 && consume > payoff, JSON.stringify(all));
});

test('an area damage card names its area on the damage line', () => {
  const [first] = text('cleavingBlow');
  assert.match(first, /to all enemies$/);
});

test('a preview above the static base marks the number up, below it marks down', () => {
  const up = lines('bashingBlow', { values: [{ op: 'damage', value: 9, hits: 1 }, { op: 'poiseDamage', value: 4 }] });
  assert.match(up[0].html, /class="val up">9</);
  const down = lines('bashingBlow', { values: [{ op: 'damage', value: 3, hits: 1 }, { op: 'poiseDamage', value: 4 }] });
  assert.match(down[0].html, /class="val down">3</);
});

test('without a preview no number is marked up or down', () => {
  for (const line of lines('bashingBlow')) assert.doesNotMatch(line.html, /val (up|down)/);
});

test('a Defend card labels its per-play restore separately from its Entry clause', () => {
  const all = text('crystalBarrier');
  const summary = all.find(line => line.startsWith('Restore ') && line.includes('. Entry: '));
  assert.ok(summary, JSON.stringify(all));
  assert.match(summary, /^Restore \\d+ Poise\\/Ward\\. Entry: /);
  assert.doesNotMatch(summary, /Entry: .*Restore/);
});

test('a conditional Evade is shown with version-two entry bonuses without duplication', () => {
  const all = text('crawlingShot');
  const evade = all.filter(line => /Prepare one Evade with Advantage/.test(line));
  assert.deepEqual(evade, ['While Prone: Prepare one Evade with Advantage']);
  assert.ok(all.some(line => line.startsWith('Entry: ')), JSON.stringify(all));
});

test('a card with an effect it cannot phrase returns null', () => {
  assert.equal(cardFaceLines({ type: 'attack', effects: [{ op: 'noSuchOp', target: 'enemy', amount: 1 }] }, null, reg), null);
});

test('a partial buildup chance keeps a detail line so the face never reads as certain', () => {
  const all = lines('cinderSigil');
  assert.ok(all, 'cinderSigil phrases');
  const detail = all.filter(line => line.kind === 'detail').map(line => line.html.replace(/<[^>]+>/g, ''));
  assert.ok(detail.some(line => /\d+% chance$/.test(line)), `chance detail line: ${JSON.stringify(detail)}`);
});

test('a card with nothing to phrase returns null so the authored text stays', () => {
  assert.equal(cardFaceLines({ type: 'status', effects: [] }, null, reg), null);
});

test('cards whose face would drop meaning keep their authored text', () => {
  // A generated card's cost and keywords live only in the authored text.
  assert.equal(lines('shieldGuardian'), null);
  // A formula described in words is not a number.
  assert.equal(lines('bloodhuntersStrike'), null);
});

test('a stack threshold reaches the condition label', () => {
  assert.ok(text('septicBlade').some(line => /^If the target has 3\+ Venom: /.test(line)), JSON.stringify(text('septicBlade')));
});

test('Unplayable leads the keywords instead of being dropped', () => {
  assert.ok(text('dazed').some(line => /^Unplayable, Ethereal$/.test(line)), JSON.stringify(text('dazed')));
});

test('a boosted split hit colours both parts', () => {
  const id = 'cometFragment';
  assert.match(text(id)[0], /^Inflict \d+ \w+, \d+ \w+ damage/, 'Comet Fragment splits its hit');
  const def = card(id), index = def.effects.findIndex(e => e.op === 'damage');
  const values = []; values[index] = { op: 'damage', value: def.effects[index].amount * 3, hits: 1 };
  const [first] = cardFaceLines(def, { values }, reg);
  assert.equal((first.html.match(/val up/g) || []).length, 2, first.html);
});

test('an unequal formula-hit total compares with per-hit base times the resolved hit count', () => {
  const def = { id: 'formulaHits', type: 'attack', combatProfile: { camp: 'physical', damageType: 'slashing' },
    effects: [{ op: 'damage', target: 'enemy', amount: 6, hits: { f: 'someFormula' } }] };
  const [first] = cardFaceLines(def, { values: [{ op: 'damage', value: 6, hits: 3,
    hitDamages: [1, 6, 6], totalDamage: 13 }] }, reg);
  assert.equal((first.html.match(/val down/g) || []).length, 2, first.html);
  assert.match(first.html, />13<\/span> total across 3 hits/);
});

test('cards whose automatic damage rider is only in authored rules keep that text', () => {
  for (const id of ['aspDart', 'mindSpike', 'stoneSling', 'rockfall']) assert.equal(lines(id), null, id);
});

test('a Power keeps its authored text: its status alone does not explain the mechanic', () => {
  assert.equal(lines('rallyingStandard'), null);
  assert.equal(lines('goreblood'), null);
});

test('a missing self status reads as "No <status>:"', () => {
  assert.ok(text('starlance').some(line => /^No Starstone Charge: /.test(line)), JSON.stringify(text('starlance')));
});

test('a combat counter reads as prepared, naming its mode and Smash bonus', () => {
  const x = id => (cardFaceLines(applyCombatExpansionCard(card(id)), null, reg) || []).map(line => line.html.replace(/<[^>]+>/g, ''));
  assert.match(x('shieldBash')[0], /^Return \d+ Poise damage, \+\d+ Poise against Smash$/);
  assert.match(x('nockAndWait')[0], /^Return /);
});

test('mechanic statuses add their own line; curse triggers and Blight prices keep the authored text', () => {
  assert.ok(text('stoneskin').some(line => /Block is not removed/.test(line)), JSON.stringify(text('stoneskin')));
  assert.equal(lines('guilt'), null);
  assert.equal(lines('blightedTransmute'), null);
});

test('a Sleep rider that deals no damage says it does not wake the sleeper', () => {
  assert.ok(text('dreamHarvest').some(line => /\(does not wake it\)$/.test(line)), JSON.stringify(text('dreamHarvest')));
});

test('a boosted split guard colours both its Block and Ward parts', () => {
  const def = { id: 'probeGuard', name: 'Probe', type: 'skill', magicShare: 0.4,
    effects: [{ op: 'block', target: 'self', amount: 5 }], cardTags: ['camp:physical', 'maneuver:defend'] };
  const [line] = cardFaceLines(def, { values: [{ op: 'block', value: 10 }] }, reg);
  assert.equal((line.html.match(/val up/g) || []).length, 2, line.html);
});

test('equal repeated hits that split name both parts and the hit count', () => {
  assert.match(text('starShower')[0], /^Inflict \d+ \w+, \d+ \w+ damage ×3$/);
});

test('a charge-added buildup row from the live preview reaches the face, aligned with its value', () => {
  const def = card('bashingBlow');
  const chargedEffects = [def.effects[0], { op: 'buildup', target: 'enemy', status: 'frost', amount: 0 }, ...def.effects.slice(1)];
  const values = [{ op: 'damage', value: 7, hits: 1 }, { op: 'buildup', value: 3 }, { op: 'poiseDamage', value: 4 }];
  const all = cardFaceLines(def, { values, chargedEffects }, reg).map(line => line.html.replace(/<[^>]+>/g, ''));
  assert.ok(all.some(line => /Frost 3/.test(line)), JSON.stringify(all));
  assert.match(all[0], /4 Poise damage/);
});

test('a nested before-play status check says "before this card"', () => {
  assert.ok(text('progression-eclipse-lance').some(line => /^If .* before this card: /.test(line)), JSON.stringify(text('progression-eclipse-lance')));
});

test('an up-front HP payment leads the face, as it runs first', () => {
  assert.match(text('bloodPact')[0], /^Pay \d+ HP/);
  assert.match(text('flagellation')[0], /^Pay \d+ HP/);
});

test('a before-play HP check says "before this card"', () => {
  assert.ok(text('progression-carrion-cut').some(line => /HP is at most \d+% before this card: /.test(line)), JSON.stringify(text('progression-carrion-cut')));
});

test('custom spell Counter coverage uses compact return and protection lines', () => {
  for (const id of ['frostCounter', 'forceCounter', 'barrageCounter']) {
    const all = lines(id);
    assert.ok(all, id + ' uses compact lines');
    const wording = all.map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
    assert.match(wording, /Return/);
    assert.match(wording, /Block.*Ward/);
    assert.doesNotMatch(wording, /after all covered damage/);

  }
});

test('an authored Grounded effect on a version-two Counter retains its stacks and duration', () => {
  const base = card('forceCounter');
  const def = { ...base, effects: [...base.effects,
    { op: 'applyStatus', target: 'self', status: 'grounded', stacks: 1, duration: 2 }] };
  const wording = cardFaceLines(def, null, reg).map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
  assert.match(wording, /Grounded 1.*2 turns/);
});
