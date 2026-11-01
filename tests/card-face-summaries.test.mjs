import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { applyCardTraits } from '../src/content/traitProjection.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
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

test('a summary that does not name a payment the face could not carry leaves the cue', () => {
  const lines = [{ kind: 'cost', html: 'Pay 2 HP. Discard 1. Offer 1 HP' }, { kind: 'damage', html: 'Inflict 9 Fire damage' }];
  assert.deepEqual(cardFaceProjection({}, { lines, faceHtml: ['Deal 9 Fire damage'] }).clauses.map(line => line.html), ['Inspect full effect']);
  // A summary that says the payments itself may stand in for the cue.
  const named = cardFaceProjection({}, { lines, faceHtml: ['Pay 2 HP, discard 1, offer 1 HP', 'Deal 9 Fire damage'] });
  assert.ok(named.clauses.every(line => line.kind !== 'detail'));
});

test('a summary reads uneven hit damage from the preview, not the base number', () => withKitDom(dom => {
  const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
  const proto = Object.getPrototypeOf(dom.document.body), descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML'), markup = new WeakMap();
  Object.defineProperty(proto, 'innerHTML', { configurable: true, set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
  try {
    const preview = { combatExpansionVersion: 2, tokens: {}, values: [], damageSequences: [{ amountToken: 'damage', hitsToken: 'hits', hitDamages: [1, 5], totalDamage: 6 }] };
    const el = renderCard(reg, { cardId: 'arrowVolley' }, { inspection: false, rules, preview });
    const text = (markup.get(el) || '').split('<span class="face-line"').slice(1).map(part => part.slice(part.indexOf('>') + 1).split('</div>')[0].replace(/<span data-face-fallback[\s\S]*/, '').replace(/<[^>]+>/g, '').trim()).join(' | ');
    assert.doesNotMatch(text, /Inspect full effect/);
    assert.match(text, /1 \+ 5/, text);
    assert.doesNotMatch(text, /\b2\b.*times|×/, text);
  } finally { delete proto.innerHTML; Object.defineProperty(proto, 'innerHTML', descriptor); }
}));

// Table: the summary never loses a qualifier the projected clauses carry (chance, payment, discard, uneven hits).
test('qualifier table: chance, payment, discard, hits and plain cards', () => withKitDom(dom => {
  const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
  const proto = Object.getPrototypeOf(dom.document.body), descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML'), markup = new WeakMap();
  Object.defineProperty(proto, 'innerHTML', { configurable: true, set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
  const face = (ref, preview) => {
    const el = renderCard(reg, ref, { inspection: false, rules, ...(preview ? { preview } : {}) });
    return (markup.get(el) || '').split('<span class="face-line"').slice(1).map(part => part.slice(part.indexOf('>') + 1).split('</div>')[0].replace(/<span data-face-fallback[\s\S]*/, '').replace(/<[^>]+>/g, '').trim()).join(' | ');
  };
  try {
    const live = cardId => ({ combatExpansionVersion: 2, cost: 1, manaCost: 0, tokens: {}, values: [],
      resolvedDefinition: applyCardTraits(applyCombatExpansionCard(resolveCard(reg, { cardId }))) });
    const table = [
      ['Silent Exchange rank 4 keeps its discard', () => face({ cardId: 'progression-silent-exchange', abilityRank: 4 }), /discard/i],
      ['Silent Exchange rank 5 keeps its discard', () => face({ cardId: 'progression-silent-exchange', abilityRank: 5 }), /discard/i],
      ['Arrow Volley reads uneven hits', () => face({ cardId: 'arrowVolley' }, { combatExpansionVersion: 2, tokens: {}, values: [], damageSequences: [{ amountToken: 'damage', hitsToken: 'hits', hitDamages: [1, 5], totalDamage: 6 }] }), /1 \+ 5/],
      ['a plain card still gets its summary', () => face({ cardId: 'base.foresight' }), /^Gain 3 Foresight\./],
      ['another plain card still gets its summary', () => face({ cardId: 'base.recover-exile' }), /^Return 1 exhausted card\.$/],
    ];
    // Hex names both its debuffs with their chance; a face that would drop either line falls back to the cue instead.
    const hex = face({ cardId: 'hex' }, live('hex'));
    assert.match(hex, /Weak/, hex); assert.match(hex, /Vulnerable/, hex); assert.match(hex, /50% chance/, hex);
    const dream = face({ cardId: 'restfulDream' });
    assert.match(dream, /Vulnerable/, dream); assert.match(dream, /capped/, dream);
    for (const [name, run, expected] of table) { const text = run(); assert.match(text, expected, `${name}: ${text}`); assert.doesNotMatch(text, /Inspect full effect/, name); }
  } finally { delete proto.innerHTML; Object.defineProperty(proto, 'innerHTML', descriptor); }
}));

// Census (owner review, 2026-11-01): a face that carries a summary keeps every cost, downside, consume, cap, chance,
// lock and "random" the full rules state, and never says "1 cards".
test('census: every summarized face keeps its qualifiers, in both profiles at every rank', async () => {
  const { QUALIFIERS, statusApplied, statusNamed } = await import('../src/model/cardFaceProjection.js');
  for (const { name, registries, rules } of await profiles()) withKitDom(dom => {
    const proto = Object.getPrototypeOf(dom.document.body), descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML'), markup = new WeakMap();
    Object.defineProperty(proto, 'innerHTML', { configurable: true, set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
    try {
      let summarized = 0;
      for (const card of registries.cards.all()) {
        const variants = [{}, { upgraded: true }, ...(card.gradeProfiles ? [0, 1, 2, 3, 4, 5].map(abilityRank => ({ abilityRank })) : [])];
        for (const extra of variants) {
          const ref = { cardId: card.id, ...extra }, label = `${name}: ${card.id} ${JSON.stringify(extra)}`;
          const el = renderCard(registries, ref, { inspection: false, rules });
          const face = (markup.get(el) || '').split('<span class="face-line"').slice(1).map(part => part.slice(part.indexOf('>') + 1).split('</div>')[0].replace(/<span data-face-fallback[\s\S]*/, '').replace(/<[^>]+>/g, '').trim()).join(' | ');
          assert.doesNotMatch(face, /\b1 cards\b/i, label);
          if (el.dataset.faceSummary !== 'true') continue;
          summarized++;
          const def = playingCardDefinition(registries, ref, { rules }), tokens = staticCardTokens(def);
          const full = (def.textTemplate || '').replace(tokenRe(), (m, k) => tokens[k] ?? m).replace(/<[^>]+>/g, '');
          const shown = `${face} ${(def.keywords || []).filter(word => ['exhaust', 'ethereal'].includes(word)).join(' ')}`;
          // A literal number on a summary can drift from the graded values: every digit must appear in the full text (a Barrier split into Block + Ward counts as its sum).
          const spelled = full.replace(/\b(?:a|an|one)\b/gi, '1').replace(/\b(?:twice|two)\b/gi, '2').replace(/\b(?:three)\b/gi, '3');
          const chances = (def.effects || []).filter(e => e.chance !== undefined && e.chance < 100).map(e => String(e.chance)); // a chance comes from the card's own effect data
          for (const n of face.replace(/(\d+) Block, (\d+) Ward/g, (m, x, y) => String(+x + +y)).match(/\d+/g) || []) if (!chances.includes(n)) assert.ok(new RegExp(`(^|\\D)${n}(\\D|$)`).test(spelled), `${label}: face "${face}" shows ${n}, absent from "${full}"`);
          for (const status of registries.statuses.all()) if (statusApplied(full, status.name)) assert.ok(statusNamed(status.name, shown), `${label}: face "${face}" never names ${status.name} from "${full}"`);
          for (const [kind, re, faceRe = re] of QUALIFIERS) if (re.test(full)) assert.ok(faceRe.test(shown), `${label}: face "${face}" lost its ${kind} qualifier from "${full}"`);
        }
      }
      assert.ok(summarized > 0, name);
    } finally { delete proto.innerHTML; Object.defineProperty(proto, 'innerHTML', descriptor); }
  });
});
