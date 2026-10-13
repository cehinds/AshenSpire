import {cardSideTags, cardTagRailHtml} from '../src/ui/components/cardTagSymbols.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTION_SIGILS, SCHOOL_SIGILS, cardSigilIdentity } from '../src/content/combatSigils.js';
import { compactCardRules, cardSigilsHtml, sigilExplanationHtml, sigilHtml } from '../src/ui/components/combatSigilView.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { playingCardModel, combatCardType, staticCardTokens } from '../src/model/playingCard.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { INTENT_ICON_SHAPES } from '../src/ui/components/intentIcon.js';

test('all requested identities have unique monochrome geometry', () => {
  assert.deepEqual(Object.keys(ACTION_SIGILS), ['attack','defend','counter','sweep','ranged','smash','spell','power','skill','status']);
  assert.deepEqual(Object.keys(SCHOOL_SIGILS), ['frost','fire','lightning','force','alteration','illusion','divine','decay']);
  const marks = [...Object.values(ACTION_SIGILS), ...Object.values(SCHOOL_SIGILS)];
  assert.equal(new Set(marks.map(m => m.shape)).size, 18);
  for (const m of marks) { assert.ok(m.label && m.help); assert.doesNotMatch(m.shape, /fill=|style=|#[0-9a-f]/i); }
});

test('identity follows authored action and school rather than damage or card name', () => {
  assert.deepEqual(cardSigilIdentity('Smash', {camp:'physical',maneuver:'smash',damageType:'fire'}), {action:'smash',school:null});
  assert.deepEqual(cardSigilIdentity('Spell', {camp:'spell',maneuver:'ranged',school:'alteration'}), {action:'spell',school:'alteration'});
  assert.deepEqual(cardSigilIdentity('Power', {camp:'spell',school:'divine'}), {action:'power',school:'divine'});
  assert.equal(cardSigilIdentity('Skill', {}).action, 'skill');
  assert.equal(cardSigilIdentity('Status', {}).action, 'status');
  assert.throws(() => cardSigilIdentity('Unknown', {}), /Unknown primary card type/);
  assert.throws(() => cardSigilIdentity('Constructor', {}), /Unknown primary card type/);
  assert.throws(() => cardSigilIdentity('Spell', {school:'unknown'}), /Unknown card school/);
});

test('Power explanations remain truthful for historical and expanded lifecycles', () => {
  const reg=createRegistries(contentBundle), legacy=reg.cards.get('rallyingStandard'), expanded=applyCombatExpansionCard(legacy);
  assert.ok(!legacy.keywords.includes('exhaust'));
  assert.ok(expanded.keywords.includes('exhaust'));
  assert.match(ACTION_SIGILS.power.help,/Cast once/);
  assert.match(ACTION_SIGILS.power.help,/lasts for this combat/);
  assert.doesNotMatch(ACTION_SIGILS.power.help,/then Exhaust/);
});

test('marks preserve readable accessible names and inspection explanations', () => {
  const identity = {action:'spell', school:'alteration'};
  const html = cardSigilsHtml(identity);
  assert.match(html, /data-primary-sigil="spell"/);
  assert.match(html, /role="img" aria-label="Spell"/);
  assert.match(html, /class="card-type-name" data-card-layer="8">Spell<\/span>/);
  assert.doesNotMatch(html, /combat-sigil-school|card-damage-types/);
  assert.match(html, /focusable="false"/);
  assert.doesNotMatch(html, /tabindex=/);
  assert.doesNotMatch(html, /title=/);
  assert.equal(sigilHtml('constructor'), '');
  assert.match(sigilExplanationHtml(identity), /earth and grounding/);
  assert.match(sigilExplanationHtml(identity), /role="img" aria-label="Alteration"/);
});

test('card footer icons and corresponding intents use the same approved geometry', () => {
  for (const [intent,card] of [['attack','attack'],['defend','defend'],['counter','counter'],['smash','smash'],['cast','spell'],['buff','power']]) {
    assert.equal(INTENT_ICON_SHAPES[intent], ACTION_SIGILS[card].shape);
    const html=cardSigilsHtml({action:card});
    assert.ok(html.includes(ACTION_SIGILS[card].shape));
    assert.ok(html.includes(`class="card-type-name" data-card-layer="8">${ACTION_SIGILS[card].label}</span>`));
  }
});

test('Spell identity uses the outlined four-point diamond while Fire, Burn and Gorefire retain flames', () => {
  const diamond = '<path d="m16 2 5 9 9 5-9 5-5 9-5-9-9-5 9-5Zm0 9-5 5 5 5 5-5Z"/>';
  assert.equal(ACTION_SIGILS.spell.shape, diamond);
  assert.ok(cardSigilsHtml({ action: 'spell' }).includes(diamond));
  for (const id of ['camp:spell', 'source:spell']) {
    assert.ok(cardTagRailHtml([{ id, label: 'Spell' }]).includes(diamond));
  }
  for (const id of ['school:fire', 'damage:fire', 'status:burn', 'gorefire']) {
    const html = cardTagRailHtml([{ id, label: 'Fire' }]);
    assert.ok(html.includes('M18 1c4 9-5 11-1 16'), id);
    assert.ok(!html.includes(diamond), id);
  }
  assert.ok(SCHOOL_SIGILS.fire.shape.includes('M17 3c3 8'));
  for (const id of ['camp:spell', 'source:spell', 'maneuver:casting']) {
    assert.equal(contentBundle.tags.find(tag => tag.id === id).glyph, '✧');
  }
  assert.equal(contentBundle.tags.find(tag => tag.id === 'school:fire').glyph, '🔥');
});

test('short damage wording retains numbers, types, timing, targets and conditions', () => {
  const original = 'Deal <span class="val">9</span> Piercing damage to all enemies.\nGain 4 Guard until next turn. If Guard breaks, deal 3 Cold damage.';
  assert.equal(compactCardRules(original), '<span class="val">9</span> Piercing damage to all enemies. Gain 4 Guard until next turn. If Guard breaks, deal 3 Cold damage.');
});

test('compact authored rules keep family limits, charge expiry, stacking and HP floors', () => {
  assert.equal(compactCardRules('Deal 7 damage to the selected enemy. If you previously played at least 1 guile card(s) this turn and If you previously played at least 1 guard card(s) this turn: Deal 4 damage to the selected enemy. Gain 2 Block, once per turn from this family.'), '7 damage to target. If 1+ guile cards played this turn and 1+ guard cards played this turn: 4 damage to target. Gain 2 Block, once per turn per family.');
  assert.equal(compactCardRules('Your next spell this turn costs 1 less Mana (minimum zero); this charge cannot stack with itself.'), 'Next spell this turn costs 1 less Mana (min 0); cannot stack with itself.');
  assert.equal(compactCardRules('Offer 3 HP; the payment must leave at least one HP. Deal 17 damage to every living enemy.'), 'Offer 3 HP (leave at least 1 HP). 17 damage to all enemies.');
});

test('every base, upgrade, authored rank and equipment profile uses the shared identity', () => {
  const reg = createRegistries(contentBundle), actions = new Set(), schools = new Set();
  const refs = contentBundle.cards.flatMap(card => [{cardId:card.id}, {cardId:card.id,upgraded:true}, ...(card.gradeProfiles || []).map((_,abilityRank)=>({cardId:card.id,abilityRank}))]);
  for (const profile of reg.equipment.basicCardProfiles || []) refs.push({cardId:profile.role === 'defend' ? 'defend' : 'strike',profileId:profile.id});
  for (const ref of refs) for (const expanded of [false, true]) {
    const def = expanded ? applyCombatExpansionCard(resolveCard(reg, ref)) : resolveCard(reg, ref);
    const model = playingCardModel(reg, ref, {preview: expanded ? {resolvedDefinition:def} : null});
    assert.deepEqual(model.sigils, cardSigilIdentity(combatCardType(def), combatProfileFor(def)), JSON.stringify(ref));
    assert.ok(Object.isFrozen(model.sigils));
    actions.add(model.sigils.action); if(model.sigils.school)schools.add(model.sigils.school);
  }
  assert.equal(actions.size, 10); assert.equal(schools.size, 8);
});

test('approved solid footer symbols stay distinct and have a visible action name', () => {
  for(const id of ['smash','attack','counter','ranged','spell','defend']) {
    assert.equal(ACTION_SIGILS[id].solid,true);
    assert.match(sigilHtml(id),/fill="currentColor"/);
    assert.match(cardSigilsHtml({action:id}),new RegExp('card-type-name" data-card-layer="8">'+ACTION_SIGILS[id].label));
  }
  assert.notEqual(ACTION_SIGILS.counter.shape,ACTION_SIGILS.defend.shape);
});

test('long rank effects keep their Starstone condition, values and draw limit', () => {
  const reg=createRegistries(contentBundle),def=resolveCard(reg,{cardId:'radiantSpray',abilityRank:5});
  assert.equal(staticCardTokens(def).starstoneCharge,1);
  assert.deepEqual(staticCardTokens({effects:[{op:'damage',amount:{f:'add',args:[2,{f:'add',args:[3,4]}]}}]}),{damage:9});
  assert.deepEqual(staticCardTokens({effects:[{op:'damage',amount:{f:'add',args:[2,{f:'stat',key:'strength'}]}}]}),{});
  assert.equal(compactCardRules('Apply 1 vulnerable to every living enemy. Apply 1 starstoneCharge to yourself.'), 'Apply 1 vulnerable to all enemies. Gain 1 Starstone.');
  assert.equal(compactCardRules('If you have starstoneCharge: Deal 4 damage to every living enemy. Apply <span class="val">1</span> starstoneCharge to yourself. Draw <span class="val">1</span> card(s), once per turn from this family.'), 'With Starstone: 4 damage to all enemies. Gain <span class="val">1</span> Starstone. Draw <span class="val">1</span>, once per turn per family.');
});

test('Ritual Ward keeps Defend below and category followed by effect type on the right', () => {
  const reg=createRegistries(contentBundle),ref={cardId:'defend',profileId:'sceptreGuard'};
  const model=playingCardModel(reg,ref),def=resolveCard(reg,ref);
  assert.equal(model.sigils.action,'defend');
  assert.deepEqual(cardSideTags(model,def,reg).map(t=>t.label),['Spell','Divine']);
});

test('five primary symbols prioritize category, damage and statuses without mutating full tags', () => {
  const reg=createRegistries(contentBundle),ref={cardId:'gorefireSlash'};
  const model=playingCardModel(reg,ref),def=resolveCard(reg,ref),before=JSON.stringify(model.tags);
  const chosen=cardSideTags(model,def,reg);
  assert.ok(chosen.some(t=>t.id==='status:bleed'));
  assert.ok(chosen.length<=5);
  assert.match(chosen[0].id,/^camp:/);
  assert.ok(chosen.every(t=>/^(camp|damage|school|status):/.test(t.id)));
  assert.equal(JSON.stringify(model.tags),before);
  const html=cardTagRailHtml(chosen);
  assert.equal((html.match(/class="card-tag-symbol"/g)||[]).length,chosen.length);
  // Each symbol is a tab stop that shows its own tooltip (data-tip); no native title.
  assert.equal((html.match(/tabindex="0"/g)||[]).length,chosen.length);
  assert.doesNotMatch(html,/ title=/);
  for(const tag of chosen)assert.ok(html.includes('aria-label="'+tag.label+(tag.count===undefined?'':' '+tag.count)+'"'));
  assert.equal(cardTagRailHtml([]),'');
});

test('Flux, Impact, Reaction and Counterstrike each get one symbol, Flux shares the Force glyph', async () => {
  const { cardTagRailHtml: rail } = await import('../src/ui/components/cardTagSymbols.js');
  const tag = (key, label) => ({ id: `trait:${key}`, label, blurb: label });
  const html = rail([tag('flux', 'Flux 1'), tag('impact', 'Impact 2'), tag('reaction', 'Reaction'), tag('counterstrike', 'Counterstrike')]);
  assert.equal((html.match(/class="card-tag-symbol"/g) || []).length, 4);
  assert.ok(html.includes('aria-label="Flux 1"'));
  assert.ok(html.includes('aria-label="Impact 2"'));
  const force = html.split('data-tag-id="trait:flux"')[1].split('</span>')[0];
  assert.ok(force.includes('<circle cx="16" cy="16" r="4"/>'), 'Flux shows the diamond with a centre dot');
});

test('the rail shows each trait once with its value, and a trait without a symbol stays off the rail', async () => {
  const { cardSideTags: sides, cardTagRailHtml: rail } = await import('../src/ui/components/cardTagSymbols.js');
  const model = { sigils: { action: 'attack' }, tags: [
    { id: 'trait:flux', label: 'Flux 1', blurb: 'On hit: N Ward damage.' },
    { id: 'trait:flux', label: 'Flux 1', blurb: 'On hit: N Ward damage.' },
    { id: 'trait:impact', label: 'Impact 2', blurb: 'On hit: N Poise damage.' },
    { id: 'trait:grounded', label: 'Grounded', blurb: 'Grounded.' },
  ] };
  const chosen = sides(model, { traitValues: { flux: 1, impact: 2 } }, null);
  assert.equal(chosen.filter(t => t.id === 'trait:flux').length, 1);
  assert.equal(chosen.find(t => t.id === 'trait:flux').count, 1);
  assert.equal(chosen.find(t => t.id === 'trait:impact').count, 2);
  assert.ok(!chosen.some(t => t.id === 'trait:grounded'), 'a trait without a symbol stays in the inspection list');
  const html = rail(chosen);
  assert.equal((html.match(/data-tag-id="trait:flux"/g) || []).length, 1);
  assert.ok(html.includes('aria-label="Flux 1"'));
  assert.ok(html.includes('<span class="card-tag-count" aria-hidden="true">1</span>'));
});

test('a selected tag symbol explains itself with its name, count and blurb from uiStrings', async () => {
  const { cardTagRailHtml: rail } = await import('../src/ui/components/cardTagSymbols.js');
  const html = rail([{ id: 'trait:flux', label: 'Flux', count: 1, blurb: 'On hit: N Ward damage, or double the Ward damage the card already deals.' }]);
  assert.ok(html.includes('data-tip="Flux 1 — On hit: 1 Ward damage, or double the Ward damage the card already deals."'), html);
  const tooltip = (await import('node:fs')).readFileSync(new URL('../src/ui/components/tooltip.js', import.meta.url), 'utf8');
  assert.match(tooltip, /\.card-tag-symbol\[data-tip\]/, 'the shared explain handler takes tag symbols');
});
