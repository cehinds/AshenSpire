import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { playingCardDefinition, playingCardModel } from '../src/model/playingCard.js';
import { cardBonusTags } from '../src/model/cardBonusTags.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardSideTags, cardTagRailHtml } from '../src/ui/components/cardTagSymbols.js';
import { renderCard } from '../src/ui/components/card.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const legacy = createRegistries(contentBundle);
const definition = id => playingCardDefinition(core, { cardId: id });
const text = lines => lines?.map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
const faceWith = (def, tags, preview = null, reg = core) => cardFaceLines(def, preview, reg, null, {
  representedEffects: tags.flatMap(tag => tag.representedEffects || []),
  representedEntry: tags.flatMap(tag => tag.representedEntry || []), entryLabel: 'On stance change',
});

test('automatic Precision has an honest static formula, exact live count and complete rule tooltip', () => {
  const def = definition('core.strike');
  const [staticTag] = cardBonusTags(def, null, core);
  assert.equal(staticTag.count, 1);
  assert.equal(staticTag.countFormula, 'stat mix');
  assert.match(staticTag.blurb, /On changing stance, gain 1 \+ stat mix Precision/);
  assert.match(staticTag.blurb, /Repeating the same stance grants none/);
  assert.match(staticTag.blurb, /Expires at the end of the owner's turn unless.*Persistent/);
  assert.match(staticTag.blurb, /Does not increase damage/);
  const [live] = cardBonusTags(def, { entryPrecision: 8 }, core);
  assert.equal(live.count, 8);
  assert.equal(live.countFormula, undefined);
  assert.match(cardTagRailHtml([staticTag]), /aria-label="Precision 1 \+ stat mix"/);
  assert.match(cardTagRailHtml([live]), /Precision 8/);
  assert.doesNotMatch(text(faceWith(def, [live], { entryPrecision: 8 })), /Precision|Entry/);
});

test('Core Evade uses one badge for its authored formula and no second automatic grant', () => {
  const def = definition('core.evade');
  const [tag] = cardBonusTags(def, null, core);
  assert.equal(tag.count, 1);
  assert.equal(tag.countFormula, 'DEX');
  assert.match(tag.blurb, /Gain 1 \+ DEX Evade/);
  assert.doesNotMatch(tag.blurb, /On changing stance/);
  assert.deepEqual(faceWith(def, [tag]), [], 'a tag-only card does not fall back to duplicate authored prose');
  const preview = { values: [{ op: 'applyStatus', status: 'evade', value: 7 }] };
  assert.equal(cardBonusTags(def, preview, core)[0].count, 7);
  assert.equal(cardBonusTags(def, preview, core)[0].countFormula, undefined);
  assert.equal(cardBonusTags(def, { values: [{ op: 'applyStatus', status: 'weak', value: 99 }] }, core)[0].count, 1);
});

test('conditional, timed and targeted applications keep their body semantics', () => {
  for (const extra of [{ if: { p: 'hasStatus', of: 'self', status: 'prepared' } }, { duration: 2 }, { chance: 50 }, { target: 'ally' }]) {
    const def = { type: 'skill', effects: [{ op: 'applyStatus', target: 'self', status: 'precision', stacks: 2, ...extra }] };
    assert.deepEqual(cardBonusTags(def, null, legacy), []);
    const copy = text(faceWith(def, [], null, legacy));
    assert.match(copy, /Precision/);
    if (extra.if) assert.match(copy, /Prepared:/);
    if (extra.duration) assert.match(copy, /2 turns/);
    if (extra.chance) assert.match(copy, /50% chance/);
    if (extra.target === 'ally') assert.match(copy, /an ally/);
  }
});

test('distinct automatic and authored Precision applications are not added into a false count', () => {
  const def = { ...definition('core.strike'), effects: [{ op: 'applyStatus', target: 'self', status: 'precision', stacks: 2 }] };
  const [tag] = cardBonusTags(def, { entryPrecision: 8 }, core);
  assert.equal(tag.count, undefined);
  assert.deepEqual(tag.representedEffects, []);
  assert.match(tag.blurb, /Gain 2 Precision/);
  assert.match(tag.blurb, /On changing stance, gain 8 Precision/);
  assert.match(text(faceWith(def, [tag], { entryPrecision: 8 })), /Gain Precision 2/);
});

test('a conditional Core Evade application does not promise a second automatic grant', () => {
  const def = definition('core.evade');
  const conditional = { ...def, effects: def.effects.map(effect => ({ ...effect, stacks: 2, if: { p: 'hasStatus', of: 'self', status: 'prepared' } })) };
  const [tag] = cardBonusTags(conditional, null, core);
  assert.equal(tag.count, undefined);
  assert.match(tag.blurb, /only if this card has not already applied Evade/);
  assert.match(text(faceWith(conditional, [tag])), /Prepared:/);
  assert.deepEqual(tag.representedEffects, []);
});

test('uncertain effects and active Power prose still use the full authored fallback', () => {
  const def = { type: 'skill', effects: [{ op: 'unknownOp', target: 'self' }, { op: 'applyStatus', target: 'self', status: 'evade', stacks: 1 }] };
  assert.equal(faceWith(def, cardBonusTags(def, null, legacy), null, legacy), null);
  assert.equal(faceWith({ ...def, type: 'power' }, [], null, legacy), null);
  const persistent = { type: 'skill', effects: [{ op: 'applyStatus', target: 'self', status: 'precision', stacks: 2, tags: ['persistent'] }] };
  assert.deepEqual(cardBonusTags(persistent, null, legacy), []);
  assert.equal(faceWith(persistent, [], null, legacy), null, 'unmodelled authored grant qualifiers are not discarded');
});

test('only selected benefit tags may suppress body text when the rail is full', () => {
  const def = definition('core.strike');
  const tags = cardSideTags({ tags: ['physical', 'fire', 'cold', 'arcane', 'holy'].map(id => ({ id: id === 'physical' ? 'camp:physical' : 'damage:' + id, label: id })) }, def, core);
  assert.equal(tags.length, 5);
  assert.ok(!tags.some(tag => tag.id === 'status:precision'));
  assert.match(text(faceWith(def, tags)), /On stance change: .*Precision/);
});

test('hand, reward and complete printed faces share tags without Entry or duplicate Evade prose', () => {
  withKitDom(({ document }) => {
    const proto = Object.getPrototypeOf(document.body), original = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
    const markup = new WeakMap();
    Object.defineProperty(proto, 'innerHTML', { configurable: true,
      get() { return original.get.call(this); }, set(value) { markup.set(this, value); original.set.call(this, value); } });
    for (const opts of [{ surface: 'combat', faceLineLimit: 3 }, { surface: 'reward' }, { level: 'inspect', inspection: false }]) {
      for (const id of ['core.strike', 'core.evade']) {
        const card = renderCard(core, { cardId: id }, opts), html = markup.get(card);
        const body = html.replace(/(?:aria-label|aria-description|data-tip)="[^"]*"/g, '');
        assert.doesNotMatch(body, /Entry:|stat mix|Gain Evade/);
        assert.match(html, id === 'core.strike' ? /aria-label="Precision 1 \+ stat mix"/ : /aria-label="Evade 1 \+ DEX"/);
      }
    }
  });
});
