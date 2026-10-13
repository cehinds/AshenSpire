// The combat hand's range chip (owner, 2026-10-11): a card in the hand shows
// Melee / Reach / Ranged by the same rule the deck editor uses, and a plain
// skill shows none. Enemy intents never get one (they do not pass range: true).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { combatCardRange } from '../src/model/combatCardProfile.js';
import { renderCard } from '../src/ui/components/card.js';
import { cardRangeChipHtml } from '../src/ui/components/cardTagSymbols.js';
import { t } from '../src/ui/strings.js';
import { withModalDom as withDom } from './helpers/modal-dom.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const REG = createRegistries(contentBundle);
const ref = (cardId) => ({ cardId, upgraded: false });
// The combat definition the hand resolves: the v2 expansion applied to the authored card.
const combatDef = (cardId) => applyCombatExpansionCard(resolveCard(REG, ref(cardId)));

test('the chip label is the deck editor string, not a literal', () => {
  assert.equal(cardRangeChipHtml('melee'), `<span class="as-tag card-range-chip" data-range="melee">${t('deckEditor.range.melee')}</span>`);
  assert.equal(t('deckEditor.range.reach'), 'Reach');
  assert.equal(cardRangeChipHtml(null), '');
});

test('the rule itself: melee strike, projectile spell, plain skill', () => {
  assert.equal(combatCardRange(combatDef('strike')), 'melee');
  assert.equal(combatCardRange(combatDef('cometFragment')), 'ranged');
  assert.equal(combatCardRange(combatDef('warcry')), null);
});

test('hand: a melee strike shows a Melee chip', () => {
  withDom(() => {
    const face = renderCardFor('strike', { range: true });
    const chip = face.querySelector('.card-range-chip');
    assert.equal(chip?.dataset.range, 'melee');
    assert.equal(chip?.dataset.range, 'melee');
  });
});

test('hand: a staff strike (reach near) shows a Reach chip', () => {
  withDom(() => {
    // The staff's equipment profile resolves a Strike to reach near (combat expansion).
    const staff = applyCombatExpansionCard({ ...resolveCard(REG, ref('strike')), equipmentProfileId: 'staffMagicAttack' });
    const face = renderCardFor('strike', { range: true, definition: staff });
    assert.equal(face.querySelector('.card-range-chip')?.dataset.range, 'reach');
  });
});

test('hand: a spell projectile shows a Ranged chip', () => {
  withDom(() => {
    const face = renderCardFor('cometFragment', { range: true });
    assert.equal(face.querySelector('.card-range-chip')?.dataset.range, 'ranged');
  });
});

test('hand: a plain skill shows no chip, and a card without range:true shows none', () => {
  withDom(() => {
    assert.equal(renderCardFor('warcry', { range: true }).querySelector('.card-range-chip'), null);
    assert.equal(renderCardFor('strike', {}).querySelector('.card-range-chip'), null);
  });
});

// The rail's icons hug its right edge on every card. A centred column would move
// the symbols left whenever the wider range chip (Melee / Reach) is present.
test('the tag rail aligns its icons to the right edge, so a range chip never shifts them', () => {
  const css = readFileSync(resolve(ROOT, 'styles/illustrated-cards.css'), 'utf8').replace(/\r\n?/g, '\n');
  const rule = css.match(/:root \.illustrated-card-face \.card-tag-rail \{[^}]*\}/)?.[0] ?? '';
  assert.match(rule, /align-items:\s*flex-end/);
  assert.doesNotMatch(rule, /align-items:\s*center/);
  assert.match(rule, /right:\s*9%/);
});

// Renders one hand face. The combat definition is passed as the hand passes it
// (`definition`), so the chip reads the same resolved combat card.
function renderCardFor(cardId, opts) {
  return renderCard(REG, ref(cardId), { inspection: false, definition: combatDef(cardId), ...opts });
}
