// A reward door with no card on it (Core's Elite spoils: two relics) must not use the card door's copy.
// Found in a real browser on #2750: the relic door read "Add the card to your deck or keep it in your collection."
// The fake DOM cannot mount relic faces, so this tests the copy chooser; the door itself was driven in Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RewardDoorCopy } from '../src/ui/components/gameProfileOffers.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { t } from '../src/ui/strings.js';

const run = { class: 'reaver', gameProfile: structuredClone(resolveGameProfile('default')) };
const copy = options => RewardDoorCopy({ options, takeCount: 1 }, run, {});

test('a relic-only door says "Choose 1." and is not labelled as card rewards', () => {
  const keys = copy([{ kind: 'relics', id: 'cinderPouch' }, { kind: 'relics', id: 'crackedTear' }]);
  const note = t(keys.note, { count: 1 });
  assert.equal(note, 'Choose 1.');
  assert.doesNotMatch(note, /card|deck/i);
  assert.equal(t(keys.aria), 'Reward choices');
});

test('a door with a card on it keeps the card copy, also when it mixes in other kinds', () => {
  for (const options of [[{ kind: 'combatCards', id: 'core.smash' }], [{ kind: 'relics', id: 'cinderPouch' }, { kind: 'weaponArts', id: 'core.smash' }]]) {
    const keys = copy(options);
    assert.match(t(keys.note, { count: 1 }), /card/i);
    assert.equal(t(keys.aria), 'Card rewards');
  }
});
