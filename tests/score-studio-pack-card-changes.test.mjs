// A Studio Save sends only the authored keys an edit changed, so untouched keys keep their form,
// and the baseline follows each Save so a revert is a real change.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CreatePackCardBaseline,
  StudioCardChange,
  StudioCardChanges,
} from '../tools/score-studio/packCardChanges.js';
import { MergePackCards } from '../tools/score-studio-pack-cards.mjs';

const editedId = 'core.qaEdited';
const untouchedId = 'core.qaUntouched';
const newId = 'custom.qaNew';
const baselineCard = Object.freeze({
  id: editedId,
  name: 'QA Strike',
  cost: 1,
  flavor: 'Old flavor',
  effects: [
    {
      op: 'damage',
      amount: 6,
    },
  ],
  kindIds: ['classification.attack'],
  cardRatingValues: {
    poise: 2,
  },
});

function editedCard(overrides)
{
  return {
    ...structuredClone(baselineCard),
    _edited: true,
    ...overrides,
  };
}

test('pack card change: only the changed authored keys are set; Studio fields are dropped', () =>
{
  const card = editedCard({
    name: 'QA Heavy Strike',
    kindIds: ['classification.skill'],
    face: {
      rank: 3,
    },
  });
  assert.deepEqual(StudioCardChange(card, baselineCard), {
    id: editedId,
    set: {
      name: 'QA Heavy Strike',
    },
    unset: [],
  });
});

test('pack card change: a removed key is unset and a nested change sets the whole value', () =>
{
  const card = editedCard({
    effects: [
      {
        op: 'damage',
        amount: 8,
      },
    ],
  });
  delete card.flavor;
  const change = StudioCardChange(card, baselineCard);
  assert.deepEqual(change.set, {
    effects: card.effects,
  });
  assert.deepEqual(change.unset, ['flavor']);
});

test('pack card change: a new card sets every authored key but its id', () =>
{
  const card = {
    id: newId,
    name: 'QA New',
    effects: [],
    _custom: true,
    kindIds: ['classification.skill'],
  };
  assert.deepEqual(StudioCardChange(card, null), {
    id: newId,
    set: {
      name: 'QA New',
      effects: [],
    },
    unset: [],
  });
});

test('pack card changes: a card equal to its baseline is left out', () =>
{
  const baselines = new Map([
    [editedId, baselineCard],
    [untouchedId, {
      ...baselineCard,
      id: untouchedId,
    }],
  ]);
  const cards = [
    editedCard({ cost: 2 }),
    {
      ...structuredClone(baselineCard),
      id: untouchedId,
      _edited: true,
    },
  ];
  const changes = StudioCardChanges(cards, (id) => baselines.get(id) ?? null);
  assert.deepEqual(changes.map((change) => change.id), [editedId]);
  assert.deepEqual(changes[0].set, {
    cost: 2,
  });
});

// A Save round trip through the server's merge, with the baseline following each Save.
function saveInto(pack, baseline, studioCards, removedIds = [])
{
  const isEdited = (card) => Boolean(card._edited);
  const sent = baseline.snapshot(studioCards, isEdited, removedIds);
  const data = {
    cards: baseline.changes(studioCards, isEdited),
    removedCardIds: removedIds,
  };
  baseline.markSaved(sent);
  return MergePackCards(pack, data);
}

test('pack card baseline: edit, save, revert, save leaves the game card as it was', () =>
{
  const original = structuredClone(baselineCard);
  let pack = [structuredClone(original)];
  const loaded = new Map([[editedId, structuredClone(original)]]);
  const baseline = CreatePackCardBaseline((id) => loaded.get(id) ?? null);
  pack = saveInto(pack, baseline, [editedCard({ name: 'QA Renamed' })]);
  assert.equal(pack[0].name, 'QA Renamed');
  const reverted = structuredClone(original);
  pack = saveInto(pack, baseline, [reverted]);
  assert.deepEqual(pack, [original], 'Undo to the loaded card reaches the game');
});

test('pack card baseline: undoing a saved removal puts the card back in the game', () =>
{
  const original = structuredClone(baselineCard);
  let pack = [structuredClone(original)];
  const loaded = new Map([[editedId, structuredClone(original)]]);
  const baseline = CreatePackCardBaseline((id) => loaded.get(id) ?? null);
  pack = saveInto(pack, baseline, [], [editedId]);
  assert.deepEqual(pack, []);
  pack = saveInto(pack, baseline, [structuredClone(original)]);
  assert.deepEqual(pack.map((card) => card.id), [editedId]);
  assert.equal(pack[0].name, original.name);
});
