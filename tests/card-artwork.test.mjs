import assert from 'node:assert/strict';
import test from 'node:test';
import { playingCardArtwork, playingCardArt } from '../src/ui/cardArtwork.js';
import { DEFAULT_CARD_ART, defaultCardArtFallbacks } from '../src/ui/defaultCardArtwork.js';
import { contentBundle } from '../src/content/index.js';
import { existsSync } from 'node:fs';
import { manifestIds } from '../tools/art-source.mjs';

const SHIPPED = manifestIds();

test('equipment profile art wins over a shared base card identity', () => {
  assert.equal(playingCardArtwork({ cardId: 'strike', profileId: 'bladeAttack' }), 'assets/cards/slashing-strike-512.webp');
  assert.equal(playingCardArtwork({ cardId: 'defend', profileId: 'shieldGuard' }, { large: true }), 'assets/cards/shield-defend-1024.webp');
  assert.equal(playingCardArtwork({ cardId: 'technique', profileId: 'weaponTechnique' }), 'assets/cards/weapon-technique-512.webp');
  assert.equal(playingCardArtwork({ cardId: 'strike' }), null);
});

test('authored card art is matched by its own id', () => {
  assert.equal(playingCardArtwork({ cardId: 'gorefireSlash' }), 'assets/cards/gorefire-slash-512.webp');
  assert.equal(playingCardArtwork({ cardId: 'bloodletting' }), 'assets/cards/bloodletting-512.webp');
  assert.equal(playingCardArtwork({ cardId: 'ironResolve' }), 'assets/cards/iron-resolve-512.webp');
  assert.equal(playingCardArtwork({ cardId: 'lastStand' }, { large: true }), 'assets/cards/last-stand-1024.webp');
  assert.equal(playingCardArtwork({ cardId: 'unknown' }), null);
});

test('outline defaults never replace reviewed illustrations and follow profile identity', () => {
  const catalog = { profiles: { bladeAttack: 'assets/cards/defaults/blade.svg', bowAttack: 'assets/cards/defaults/bow.svg' },
    cards: { strike: 'assets/cards/defaults/strike.svg', bloodletting: 'assets/cards/defaults/blood.svg' } };
  assert.deepEqual(playingCardArt({ cardId: 'strike', profileId: 'bladeAttack' }, { catalog }),
    { path: 'assets/cards/slashing-strike-512.webp', kind: 'official' });
  assert.deepEqual(playingCardArt({ cardId: 'bloodletting' }, { catalog, large: true }),
    { path: 'assets/cards/bloodletting-1024.webp', kind: 'official' });
  assert.deepEqual(playingCardArt({ cardId: 'strike', profileId: 'bowAttack' }, { catalog }),
    { path: 'assets/cards/defaults/bow.svg', kind: 'outline' });
  assert.deepEqual(playingCardArt({ cardId: 'strike' }, { catalog }),
    { path: 'assets/cards/defaults/strike.svg', kind: 'outline' });
  assert.equal(playingCardArt({ cardId: 'unknown' }, { catalog }), null);
});

test('the installed outline catalogue covers current cards, profiles, and unknown content', () => {
  for (const card of contentBundle.cards) assert.ok(DEFAULT_CARD_ART.cards[card.id], card.id);
  for (const path of [...Object.values(DEFAULT_CARD_ART.cards), ...Object.values(DEFAULT_CARD_ART.profiles)]) {
    assert.ok(SHIPPED.has(path), path);
    assert.ok(existsSync(new URL('../' + path.replace('assets/', 'assets-mobile/'), import.meta.url)), path);
  }
  assert.equal(playingCardArt({cardId:'unknown'}).path, DEFAULT_CARD_ART.default);
  const candidates = defaultCardArtFallbacks({cardId:'strike'});
  assert.ok(candidates[0].endsWith('sword.svg'));
  assert.ok(candidates[1].endsWith('default.svg'));
  assert.ok(candidates[2].startsWith('data:image/svg+xml;base64,'));
});
