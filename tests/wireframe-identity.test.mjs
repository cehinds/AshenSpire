import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataFooter, artworkAnchor, IDENTITY_PARTS } from '../src/ui/models/IdentityModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

test('rarity starts the metadata band and the owned count ends it', () => {
  const band = metadataFooter({ rarity: 'common', owned: 1 });
  assert.deepEqual({ ...band.start }, { kind: 'rarity', value: 'common' });
  assert.deepEqual({ ...band.end }, { kind: 'owned', value: 1 });
  assert.ok(Object.isFrozen(band) && Object.isFrozen(band.start));
});

test('a fact the owner cannot state is absent, not blank or invented', () => {
  assert.equal(metadataFooter({ rarity: '  ' }).start, null);
  assert.equal(metadataFooter({ rarity: 'rare' }).end, null);
  for (const owned of [undefined, null, -1, 1.5, '2']) {
    assert.equal(metadataFooter({ rarity: 'rare', owned }).end, null, `owned ${String(owned)}`);
  }
  // Owning none of a card on offer is a fact worth stating.
  assert.deepEqual({ ...metadataFooter({ owned: 0 }).end }, { kind: 'owned', value: 0 });
});

test('slots follow config and refuse an unknown or doubled kind', () => {
  const swapped = { ...wireframeUi.identity, metadataSlots: { start: 'owned', end: 'rarity' } };
  const band = metadataFooter({ rarity: 'uncommon', owned: 2 }, swapped);
  assert.equal(band.start.kind, 'owned');
  assert.equal(band.end.kind, 'rarity');
  const bad = (metadataSlots) => ({ ...wireframeUi.identity, metadataSlots });
  assert.throws(() => metadataFooter({}, bad({ start: 'rarity', end: 'price' })), /slot 'end'/);
  assert.throws(() => metadataFooter({}, bad({ start: 'owned', end: 'owned' })), /cannot both/);
});

test('artwork is centred on cards and inspector previews and stands on its baseline in combat', () => {
  assert.equal(artworkAnchor('card'), 'center');
  assert.equal(artworkAnchor('inspector'), 'center');
  assert.equal(artworkAnchor('combatant'), 'bottom');
  assert.throws(() => artworkAnchor('banner'), /Unknown artwork host/);
  const tilted = { ...wireframeUi.identity, artworkAnchorByHost: { card: 'left' } };
  assert.throws(() => artworkAnchor('card', tilted), /center, bottom/);
  assert.deepEqual([...IDENTITY_PARTS], ['name', 'artwork', 'metadata']);
});
