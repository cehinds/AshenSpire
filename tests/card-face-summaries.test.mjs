import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { renderCard } from '../src/ui/components/card.js';
import { playingCardDefinition, staticCardTokens } from '../src/model/playingCard.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardFaceProjection } from '../src/model/cardFaceProjection.js';
import { tokenRe } from '../src/model/validate.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Owner, 2026-11-01: "inspect full effect shouldn't be there all the time". A face that cannot say its
// effect in five-word clauses carries the card's authored `faceTemplate` instead of the Inspect cue.
const CUE = 'Inspect full effect';
const wordsIn = text => text.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

// Every face line the real card renderer prints, as plain text.
function facesOf(dom, registries, ref, rules) {
  const proto = Object.getPrototypeOf(dom.document.body), descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML'), markup = new WeakMap();
  Object.defineProperty(proto, 'innerHTML', { configurable: true, set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
  try {
    const el = renderCard(registries, ref, { inspection: false, rules });
    return (markup.get(el) || '').split('<span class="face-line"').slice(1)
      .map(part => part.slice(part.indexOf('>') + 1).split('</div>')[0].replace(/<span data-face-fallback[\s\S]*/, '').replace(/<[^>]+>/g, '').trim());
  } finally { delete proto.innerHTML; Object.defineProperty(proto, 'innerHTML', descriptor); }
}

const profiles = async () => {
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const core = resolveGameProfile('core');
  return [
    { name: 'default', registries: createRegistries(contentBundle), rules: { combatExpansionVersion: 2 } },
    { name: 'core', registries: bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core), rules: { combatExpansionVersion: 2, gameProfile: core } },
  ];
};

test('no card face in the registry shows the Inspect placeholder', async () => {
  for (const { name, registries, rules } of await profiles()) withKitDom(dom => {
    let checked = 0;
    for (const card of registries.cards.all()) for (const extra of [{}, { upgraded: true }, { abilityRank: 1 }, { abilityRank: 5 }]) {
      const lines = facesOf(dom, registries, { cardId: card.id, ...extra }, rules), label = `${name}: ${card.id} ${JSON.stringify(extra)}`;
      assert.ok(lines.length >= 1 && lines.length <= 3, `${label}: ${lines.join(' | ')}`);
      assert.ok(lines.every(line => !line.includes(CUE) && !/[{}]/.test(line)), `${label}: ${lines.join(' | ')}`);
      assert.ok(lines.every(line => wordsIn(line) <= 5), `${label}: more than five words in ${lines.join(' | ')}`);
      checked++;
    }
    assert.ok(checked >= registries.cards.all().length * 4);
  });
});

test('Foresight names its tag and Exile Recovery says what it returns', () => withKitDom(dom => {
  const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
  assert.deepEqual(facesOf(dom, reg, { cardId: 'base.foresight' }, rules), ['Gain 3 Foresight.', 'Draw 2.']);
  assert.deepEqual(facesOf(dom, reg, { cardId: 'base.recover-exile' }, rules), ['Return 1 exhausted card.']);
  assert.deepEqual(facesOf(dom, reg, { cardId: 'base.greased' }, rules), ['Apply Greased 3.']);
}));

test('an authored face keeps a downside the card pays and carries every rank', () => withKitDom(dom => {
  const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
  const lines = facesOf(dom, reg, { cardId: 'warSurgeon' }, rules);
  assert.ok(lines.some(line => /Exhaust/.test(line)), lines.join(' | '));
  assert.ok(lines.some(line => /Heal/.test(line)), lines.join(' | '));
  assert.ok(facesOf(dom, reg, { cardId: 'kickOff', abilityRank: 5 }, rules).every(line => !line.includes(CUE)));
}));

test('a summary that replaces the cue keeps every downside the computed face reserved', () => withKitDom(dom => {
  const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
  const silent = facesOf(dom, reg, { cardId: 'progression-silent-exchange', abilityRank: 4 }, rules);
  assert.ok(silent.some(line => /discard/i.test(line)), silent.join(' | '));
  const norm = text => text.replace(/<[^>]+>/g, '').replace(/[.\s]+$/g, '').trim();
  let kept = 0;
  for (const card of reg.cards.all()) for (const extra of [{}, { upgraded: true }, { abilityRank: 1 }, { abilityRank: 4 }, { abilityRank: 5 }]) {
    const def = playingCardDefinition(reg, { cardId: card.id, ...extra }, { rules });
    const tokens = staticCardTokens(def);
    const authoredHtml = def.textTemplate.replace(tokenRe(), (m, k) => tokens[k] ?? m);
    const computed = cardFaceProjection({ ...def, faceTemplate: undefined }, { lines: card.id.startsWith('base.') ? null : cardFaceLines(def, null, reg), authoredHtml, registries: reg, effects: def.effects });
    const reserved = computed.clauses.filter(clause => clause.downside && clause.kind !== 'detail');
    if (!reserved.length || !computed.clauses.some(clause => clause.kind === 'detail')) continue;
    const face = facesOf(dom, reg, { cardId: card.id, ...extra }, rules);
    for (const clause of reserved) {
      assert.ok(face.some(line => norm(line).includes(norm(clause.html).replace(/ card\(s\)/, ''))), `${card.id} ${JSON.stringify(extra)}: lost "${norm(clause.html)}" in ${face.join(' | ')}`);
      kept++;
    }
    assert.ok(face.length <= 3 && face.every(line => wordsIn(line) <= 5), `${card.id}: ${face.join(' | ')}`);
  }
  assert.ok(kept > 0);
}));

test('an upgraded card summary never states a base-only number', () => withKitDom(dom => {
  const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
  const up = id => facesOf(dom, reg, { cardId: id, upgraded: true }, rules).join(' | ');
  assert.match(up('crimsonRite'), /Heal 3 per SP spent/);
  assert.doesNotMatch(up('blightNova'), /twice|\b2\b/);
  assert.doesNotMatch(up('warSurgeon'), /per 4/);
  for (const abilityRank of [4, 5]) {
    const face = facesOf(dom, reg, { cardId: 'progression-silent-exchange', abilityRank }, rules);
    assert.ok(face.some(line => /discard/i.test(line)), `rank ${abilityRank}: ${face.join(' | ')}`);
  }
}));
