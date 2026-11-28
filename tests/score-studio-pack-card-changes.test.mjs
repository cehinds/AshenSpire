// A Studio Save sends only the authored keys an edit changed, so untouched keys keep their form.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StudioCardChange,
  StudioCardChanges,
} from '../tools/score-studio/packCardChanges.js';

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
