// Owner ruling 2026-10-19: every Core card tagged maneuver:smash says the Smash-vs-defensive rule, from one shared row
// (model/smashClause.js), on its face, its summary and its Smash tag help. Other profiles keep the legacy wording.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { combatCardSummary, playingCardModel } from '../src/model/playingCard.js';
import { cardTagExplanation } from '../src/model/cardTagExplanation.js';
import { cardPlainText, cardDetailHtml, renderCard } from '../src/ui/components/card.js';
import { cardSideTags, cardTagRailHtml } from '../src/ui/components/cardTagSymbols.js';
import { cardEffectHtml, summarizeCardOption } from '../src/ui/models/CardOptionSummaryModel.js';
import { withKitDom } from './helpers/dom.mjs';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { coreSmashClause, coreSmashHelp, withCoreSmashBlurb } from '../src/model/smashClause.js';
import { uiStrings } from '../src/content/generated/uiStrings.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const current = createRegistries(contentBundle);
const plain = lines => lines.map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
const RULE = /Against Defend: 1\.5× damage\. Against Prepared: 1\.25× damage\. It breaks Poise for half of the total/;

test('the shared Core Smash sentence states the owner rule', () => {
  assert.match(coreSmashClause(core.cards.get('core.reaverSpecial'), core), RULE);
  assert.match(coreSmashHelp(core.cards.get('core.reaverSpecial'), core), RULE);
  for (const id of ['card.smash.coreClause', 'tag.smash.coreHelp']) assert.match(uiStrings.find(r => r.id === id).full, /\{matchups\}.*\{poise\}/);
  assert.match(uiStrings.find(r => r.id === 'card.smash.matchupClause').full, /\{stances\}.*\{mult\}/);
});

test('every Core card tagged maneuver:smash shows the line, not only core.smash', () => {
  const smashes = core.cards.all().filter(def => def.tags?.includes('maneuver:smash'));
  assert.ok(smashes.some(def => def.id === 'core.reaverSpecial') && smashes.some(def => def.id === 'core.smash'));
  for (const def of smashes) {
    const lines = cardFaceLines(def, null, core);
    const text = lines ? plain(lines) : cardPlainText(core, { cardId: def.id }, { rules: { combatExpansionVersion: 2 } });
    assert.match(text, RULE, `${def.id} face`);
    const summary = combatCardSummary(def, null, core);
    if (summary) assert.match(summary, RULE, `${def.id} summary`);
  }
});

test('non-Smash cards and the legacy profile keep their old text', () => {
  const reaver = core.cards.get('core.reaverSpecial'), attack = core.cards.get('core.strike') || core.cards.get('core.attack');
  assert.equal(coreSmashClause(reaver, current), '');
  assert.doesNotMatch(plain(cardFaceLines(reaver, null, current) || []), RULE);
  if (attack) assert.equal(coreSmashClause(attack, core), '');
});

test('Smash tag help: Core states the rule, legacy keeps the node blurb', () => {
  const reaver = core.cards.get('core.reaverSpecial'), tag = { id: 'maneuver:smash', blurb: 'legacy blurb' };
  assert.match(cardTagExplanation(reaver, tag, core), RULE);
  assert.equal(cardTagExplanation(reaver, tag, current), 'legacy blurb');
  assert.equal(cardTagExplanation(reaver, tag), 'legacy blurb');
  assert.equal(coreSmashHelp(core.cards.get('core.defend'), core), null);
});

test('enemy Smash moves (blightHound.lunge): Core help states the rule, legacy keeps the node blurb', async () => {
  const { enemyMoveCards } = await import('../src/model/enemyMoveCards.js');
  const { combatProfileTags } = await import('../src/model/combatCardProfile.js');
  const detail = reg => enemyMoveCards(reg.enemies.get('blightHound'), { registries: reg }).find(card => card.moveId === 'lunge');
  const coreCard = detail(core), legacyCard = detail(current);
  assert.ok(coreCard.combatTags.some(tag => tag.id === 'maneuver:smash'), 'lunge is a Smash');
  assert.match(coreCard.detail, RULE);
  assert.doesNotMatch(legacyCard.detail, RULE);
  assert.match(legacyCard.detail, /Smash: Heavy strike\. Deals extra damage against physical Guard/);
  // combatantOverhead's intent tooltip reads the same rows
  const smashTag = reg => combatProfileTags({ camp: 'physical', maneuver: 'smash', range: 'melee' }, reg).find(tag => tag.id === 'maneuver:smash');
  assert.match(smashTag(core).blurb, RULE);
  assert.doesNotMatch(smashTag(current).blurb, RULE);
});

test('the text follows the active rules: a profile with a 3x multiplier, 30% Block and 40% Poise says so', () => {
  const rules = { ...shipped, smashVsDefensive: { damageMultiplier: 3, blockFraction: 0.3, poiseFraction: 0.4 } };
  const ctx = { gameProfile: core.gameProfile, fixCoreRules: rules };
  const reaver = core.cards.get('core.reaverSpecial');
  // A saved blockFraction is ignored (owner, 2026-11-20): Smash breaks a flat amount of Block from its card instead.
  assert.equal(coreSmashClause(reaver, ctx), 'Against Defend or Prepared: 3× damage. It breaks Poise for 40% of the total.');
  assert.match(coreSmashHelp(reaver, ctx), /3× damage\. It breaks Poise for 40% of the total/);
  assert.match(withCoreSmashBlurb({ id: 'maneuver:smash', blurb: 'x' }, ctx).blurb, /3× damage/);
  assert.doesNotMatch(coreSmashClause(reaver, core), /3×/);
});

test('Reframe-projected Smash (combatProfile.maneuver, tag still maneuver:attack) shows the Core Smash clause', () => {
  const attack = core.cards.all().find(def => def.tags?.includes('maneuver:attack') && !def.tags.includes('maneuver:smash') && cardFaceLines(def, null, core));
  assert.ok(attack, 'a Core Attack card exists');
  assert.equal(coreSmashClause(attack, core), '');
  const projected = { ...attack, combatProfile: { ...attack.combatProfile, maneuver: 'smash' } };
  assert.match(coreSmashClause(projected, core), RULE);
  assert.match(coreSmashHelp(projected, core), RULE);
  assert.match(plain(cardFaceLines(projected, null, core)), RULE);
  assert.equal(coreSmashClause(projected, current), '');
});

test('the stance list is read from the active smash matchup table', () => {
  const reaver = core.cards.get('core.reaverSpecial');
  assert.match(coreSmashClause(reaver, core), /Against Defend: 1\.5× damage\. Against Prepared: 1\.25× damage\./);
  const withMatchup = smash => {
    const stances = { ...core.gameProfile.modules.stances, matchups: { ...core.gameProfile.modules.stances.matchups, smash } };
    return { ...core, gameProfile: { ...core.gameProfile, modules: { ...core.gameProfile.modules, stances } } };
  };
  assert.match(coreSmashClause(reaver, withMatchup(['counter'])), /Against Counter:/);
  assert.match(coreSmashHelp(reaver, withMatchup(['counter', 'evade', 'sweep'])), /Against Counter, Evade or Sweep:/);
  assert.equal(coreSmashClause(reaver, withMatchup([])), '', 'a Smash that beats nothing says nothing');
});

test('a Core Smash tag with an empty smash matchup keeps its blurb (no stance-bonus text)', () => {
  const stances = { ...core.gameProfile.modules.stances, matchups: { ...core.gameProfile.modules.stances.matchups, smash: [] } };
  const empty = { ...core, gameProfile: { ...core.gameProfile, modules: { ...core.gameProfile.modules, stances } } };
  const tag = { id: 'maneuver:smash', blurb: 'X' };
  const out = withCoreSmashBlurb(tag, empty);
  assert.equal(out, tag);
  assert.equal(out.blurb, 'X');
});

test('Reframe turning a non-damaging card (core.defend) into Smash gets no Smash clause or help; a damaging Attack still does', () => {
  const defend = core.cards.get('core.defend');
  assert.ok(defend && !defend.effects.some(effect => effect.op === 'damage'), 'core.defend deals no damage');
  const asSmash = def => ({ ...def, combatProfile: { ...def.combatProfile, maneuver: 'smash' } });
  assert.equal(coreSmashClause(asSmash(defend), core), '');
  assert.equal(coreSmashHelp(asSmash(defend), core), null);
  const attack = core.cards.all().find(def => def.tags?.includes('maneuver:attack') && def.effects?.some(effect => effect.op === 'damage'));
  assert.match(coreSmashClause(asSmash(attack), core), RULE);
});

const commonTail = 'It breaks Poise for half of the total.';
const contexts = () => {
  const saved = (smashVsDefensive) => {
    const fixCoreRules = structuredClone(shipped);
    if (smashVsDefensive === null) delete fixCoreRules.smashVsDefensive;
    else fixCoreRules.smashVsDefensive = smashVsDefensive;
    return { combatExpansionVersion: 2, gameProfile: profile, fixCoreRules };
  };
  const old = multiplier => ({ damageMultiplier: multiplier, blockFraction: 0.25, poiseFraction: 0.5 });
  return [
    ['current', saved({ ...shipped.smashVsDefensive }), `Against Defend: 1.5× damage. Against Prepared: 1.25× damage. ${commonTail}`],
    ['missing block', saved(null), `Against Defend or Prepared: 1.25× damage. ${commonTail}`],
    ['old custom 1.6', saved(old(1.6)), `Against Defend or Prepared: 1.6× damage. ${commonTail}`],
    ['old custom 2', saved(old(2)), `Against Defend or Prepared: double damage. ${commonTail}`],
    ['custom override', saved({ ...old(1.6), defendDamageMultiplier: 2 }), `Against Defend: double damage. Against Prepared: 1.6× damage. ${commonTail}`],
    ['override boundary 1', saved({ ...old(1.25), defendDamageMultiplier: 1 }), `Against Defend: 1× damage. Against Prepared: 1.25× damage. ${commonTail}`],
  ];
};

test('saved rules drive actual compact faces, plain/template text, summaries, Information and picker fallbacks', () => {
  for (const [name, context, expected] of contexts()) {
    const before = JSON.stringify(context);
    for (const id of ['core.smash', 'core.reaverSpecial']) {
      const ref = { cardId: id }, def = core.cards.get(id);
      const model = playingCardModel(core, ref, { rules: context });
      const strings = [
        plain(cardFaceLines(def, null, core, context)),
        combatCardSummary(def, null, core, context),
        cardPlainText(core, ref, { rules: context }),
        cardDetailHtml(core, ref, { rules: context }),
        cardEffectHtml(def, null, core, context),
        summarizeCardOption(core, context, { id }, { defOf: () => def, previewOf: () => ({ textOnly: true }) }).html,
      ];
      for (const value of strings) {
        assert.ok(value.includes(expected), `${name}/${id}: ${value}`);
        assert.doesNotMatch(value, /defendDamageMultiplier|\{matchups\}/, `${name}/${id}: no internal configuration keys`);
        if (name !== 'current') assert.doesNotMatch(value, /Against Defend: 1\.5× damage\./, `${name}/${id}: no shipped-rule leak`);
      }
      const information = strings[3];
      assert.ok([...information.matchAll(/data-tip="([^"]*)"/g)].some(match => match[1].includes(expected)), `${name}/${id}: Information tag help`);
      const tag = cardSideTags(model, def, core, null, context).find(row => row.id === 'maneuver:smash');
      assert.ok(tag.blurb.includes(expected), `${name}/${id}: side tag help`);
      const rail = cardTagRailHtml([tag]);
      for (const attribute of ['aria-description', 'data-tip']) {
        const value = rail.match(new RegExp(`${attribute}="([^"]*)"`))[1];
        assert.ok(value.includes(expected), `${name}/${id}: ${attribute}`);
      }
    }
    assert.equal(JSON.stringify(context), before, `${name}: rendering never rewrites saved rules`);
  }
});

test('rendered cards use the saved context in their real accessible tag rail', () => {
  withKitDom(({ document }) => {
    const proto = Object.getPrototypeOf(document.body), original = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
    const markup = new WeakMap();
    Object.defineProperty(proto, 'innerHTML', { configurable: true,
      get() { return original.get.call(this); }, set(value) { markup.set(this, value); original.set.call(this, value); } });
    try {
      for (const [name, context, expected] of contexts()) {
        for (const opts of [{ surface: 'combat' }, { level: 'inspect', inspection: false }]) {
          const card = renderCard(core, { cardId: 'core.smash' }, { ...opts, rules: context });
          const html = markup.get(card);
          assert.ok(html.includes(expected), `${name}: real rendered card`);
          if (name !== 'current') assert.doesNotMatch(html, /Against Defend: 1\.5× damage\./, `${name}: real card has no current-rule leak`);
        }
      }
    } finally { Object.defineProperty(proto, 'innerHTML', original); }
  });
});

test('per-target clauses respect reordered, custom, equal and empty active matchup groups', () => {
  const def = core.cards.get('core.smash');
  const customize = (matchups, override = 1.5) => ({
    combatExpansionVersion: 2,
    gameProfile: { ...profile, modules: { ...profile.modules, stances: { ...profile.modules.stances,
      matchups: { ...profile.modules.stances.matchups, smash: matchups } } } },
    fixCoreRules: { ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, defendDamageMultiplier: override } },
  });
  assert.equal(coreSmashClause(def, core, customize(['prepared', 'defend'])), `Against Prepared: 1.25× damage. Against Defend: 1.5× damage. ${commonTail}`);
  assert.equal(coreSmashClause(def, core, customize(['counter', 'prepared', 'defend'])), `Against Counter or Prepared: 1.25× damage. Against Defend: 1.5× damage. ${commonTail}`);
  assert.equal(coreSmashClause(def, core, customize(['prepared', 'defend'], 1.25)), `Against Prepared or Defend: 1.25× damage. ${commonTail}`);
  assert.equal(coreSmashClause(def, core, customize([])), '');
  assert.equal(coreSmashHelp(def, core, customize([])), null);
  assert.equal(coreSmashClause(def, core, { combatExpansionVersion: 1, gameProfile: profile }), '', 'explicit legacy combat remains legacy');
  const huge = coreSmashClause(def, core, customize(['defend'], Number.MAX_VALUE));
  assert.ok(huge.includes(String(Number.MAX_VALUE)));
  assert.doesNotMatch(huge, /Infinity|defendDamageMultiplier/);
});
