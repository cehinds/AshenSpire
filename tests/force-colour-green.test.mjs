// Owner ruling 2026-11-18 section 20: Force is green, the Alteration family, not lilac. It keeps its own sigil and motif.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_ART_ELEMENTS } from '../src/ui/cardArtComposition.js';
import { tags } from '../src/content/generated/tags.js';

test('Force card art uses the Alteration green family but its own motif', () => {
  assert.equal(CARD_ART_ELEMENTS.force.color, CARD_ART_ELEMENTS.alteration.color);
  assert.equal(CARD_ART_ELEMENTS.force.glow, CARD_ART_ELEMENTS.alteration.glow);
  assert.notEqual(CARD_ART_ELEMENTS.force.motif, CARD_ART_ELEMENTS.alteration.motif, 'its own motif');
});

test('the Force tags are the Alteration tag green, no longer lilac', () => {
  const colour = id => tags.find(tag => tag.id === id)?.color;
  assert.equal(colour('school:force'), colour('school:alteration'));
  assert.equal(colour('damage:arcane'), colour('school:alteration'), 'the damage tag labelled Force');
  assert.notEqual(colour('school:force'), 'B99DEC');
});
