// tests/coop-card-choice-preview.test.mjs — a co-op card-zone choice carries the same live preview a hand card does.
//
// The host builds each seat's pendingCardChoice by cloning engine state; before this, only hand cards got a
// combatPreview, so a client priced a pile card by its authored effects (the wrong variant, no green or red).
// The snapshot now attaches the preview to each candidate (snapshot only, never engine state), other seats'
// views drop it as they do for hands, and the tile shows the previewed number.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { createSession } from '../tools/session.mjs';
import { projectLanSnapshot } from '../tools/lan-state.mjs';
import { classifyPreviewCandidates } from '../src/engine/coopCombat.js';
import { summarizeCardOption } from '../src/ui/models/CardOptionSummaryModel.js';

// Bashing Blow is rewired to open a real card-zone choice from the draw pile (a custom id would need its own
// classification row; tests/card-zones.test.mjs rewires an existing card the same way).
const PICK = { ...contentBundle.cards.find(card => card.id === 'bashingBlow'), costRule: 'fixed', cost: 0, manaCost: 0, upgrade: {},
  effects: [{ op: 'moveCards', from: 'draw', to: 'hand', amount: 1, selection: 'choose' }], textTemplate: 'Choose a card.' };
const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => (card.id === 'bashingBlow' ? PICK : card)) });
function fixture() {
  const host = createSession({ registries, seedString: 'CHOICE1', combatExpansionVersion: 2, saveSession: () => true });
  host.addMember({ id: 'p1', name: 'One', classId: 'rogue', playInDeckOrder: true });
  host.addMember({ id: 'p2', name: 'Two', classId: 'reaver', playInDeckOrder: true });
  host.start();
  for (const member of host.session.members.values()) while (member.run.classMasteryState?.initialTreeTiers.length) {
    const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
    assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
  }
  for (const id of ['p1', 'p2']) { const r = host.chooseNode(id, host.session.mapGraph.startIds[0]); assert.equal(r.ok, true, JSON.stringify(r)); }
  return host;
}
const VARIANT = 'base.current-stance-variant';
// `variants` draw-pile cards are swapped for a variant card (its numbers depend on live state), the rest stay plain.
function withDrawChoice(host, variants = 1) {
  const combat = host.live.combat, seat = combat.players.get('p2');
  assert.ok(registries.cards.get(VARIANT)?.effectVariants?.length, 'the variant card exists');
  while (seat.piles.draw.length < variants + 2) seat.piles.draw.push({ ...seat.piles.draw[0], instanceId: `pad${seat.piles.draw.length}` });
  seat.piles.draw.slice(0, variants).forEach(row => { row.cardId = VARIANT; });
  const pick = seat.piles.hand.find(row => row.cardId === 'bashingBlow');
  assert.ok(pick, 'the seat holds the rewired card');
  const played = host.combatPlay('p2', pick.instanceId, 'p2');
  assert.equal(played.ok, true, JSON.stringify(played));
  assert.ok(combat.pendingCardChoice, 'a real card-zone choice is pending');
  return { combat };
}

test('a card-zone candidate carries the live preview and the tile reads its number', () => {
  const host = fixture(), { combat } = withDrawChoice(host);
  const candidate = host.snapshot().scene.players.find(player => player.id === 'p2').pendingCardChoice.candidates.find(row => row.cardId === VARIANT);
  assert.ok(combat.pendingCardChoice.candidateIds.includes(candidate.instanceId));
  assert.ok(candidate.combatPreview, 'the candidate carries the preview a hand card gets');
  assert.ok(Array.isArray(candidate.combatPreview.values));
  assert.equal(combat.pendingCardChoice.candidates[0].combatPreview, undefined, 'the preview is snapshot-only, not written to engine state');
  const def = candidate.combatPreview.resolvedDefinition;
  const summary = summarizeCardOption(registries, null, { id: candidate.instanceId, name: def.name }, { defOf: () => def, previewOf: () => candidate.combatPreview });
  assert.ok(summary.line.length || summary.html, 'the tile has an effect row');
  assert.ok(summary.line.every(row => Number.isFinite(row.value)), 'the tile shows previewed numbers');
});

test("another seat's view drops the candidate preview, as it does for a hand", () => {
  const host = fixture(); withDrawChoice(host);
  const wire = projectLanSnapshot(host.snapshot(), ['p1']);
  const candidate = wire.scene.players.find(player => player.id === 'p2').pendingCardChoice.candidates.find(row => row.cardId === VARIANT);
  assert.equal(candidate.combatPreview, undefined);
  const own = projectLanSnapshot(host.snapshot(), ['p2']).scene.players.find(player => player.id === 'p2').pendingCardChoice.candidates.find(row => row.cardId === VARIANT);
  assert.ok(own.combatPreview, "the owner's own view keeps it");
});

test('state-dependent cards take the eight full previews first, plain cards fill the rest, the overflow gets the cheap definition', () => {
  const host = fixture(); withDrawChoice(host, 6);
  const rows = host.snapshot().scene.players.find(player => player.id === 'p2').pendingCardChoice.candidates;
  const variant = rows.filter(row => row.cardId === VARIANT), plain = rows.filter(row => row.cardId !== VARIANT);
  assert.equal(variant.length, 6);
  assert.ok(variant.every(row => row.combatPreview.values.length), 'every state-dependent card has the full preview');
  assert.equal(plain.filter(row => row.combatPreview?.values.length).length, Math.min(plain.length, 2), 'plain cards fill the two slots left');
  assert.ok(plain.length <= 2 || plain.slice(2).every(row => row.combatPreview?.textOnly));
});

test('past eight, a variant card gets no preview and its tile reads the card text', () => {
  const host = fixture(); withDrawChoice(host, 12);
  const rows = host.snapshot().scene.players.find(player => player.id === 'p2').pendingCardChoice.candidates;
  const variant = rows.filter(row => row.cardId === VARIANT), plain = rows.filter(row => row.cardId !== VARIANT);
  assert.equal(variant.filter(row => row.combatPreview?.values.length).length, 8, 'the first eight carry the full preview');
  const overflow = variant.filter(row => !row.combatPreview?.values.length);
  assert.equal(overflow.length, 4);
  assert.ok(overflow.every(row => row.combatPreview.textOnly && !row.combatPreview.resolvedDefinition), 'a variant card past the cap gets no guessed branch');
  const tile = summarizeCardOption(registries, null, { id: overflow[0].instanceId, name: 'x' }, { defOf: () => registries.cards.get(VARIANT), previewOf: () => null });
  assert.ok(tile.html && !tile.line.length, 'its tile reads the card text, not a branch number');
  assert.ok(plain.every(row => row.combatPreview?.textOnly), 'plain cards past the cap read card text');
});

test('a held ability charge makes only the cards it matches state-dependent, so unrelated cards do not eat the slots', () => {
  const host = fixture(), combat = host.live.combat, seat = combat.players.get('p2');
  const row = (cardId, n) => ({ instanceId: `t${n}`, cardId });
  const cards = [...Array.from({ length: 9 }, (_, n) => row('defend', n)), row('strike', 9)];
  const ctx = { ...combat, registries: combat.registriesForPlayer('p2'), player: seat.entity, combatExpansionVersion: combat.combatExpansionVersion };
  const entity = { ...seat.entity, abilityRiders: { charges: { attackOnly: { cardType: 'attack', damage: 3 } } } };
  const { liveIds, plainIds } = classifyPreviewCandidates(ctx, entity, cards);
  assert.deepEqual(liveIds, ['t9'], 'only the attack the charge matches is state-dependent');
  assert.equal(plainIds.length, 9);
  assert.deepEqual(classifyPreviewCandidates(ctx, { ...seat.entity, abilityRiders: { charges: {} } }, cards).liveIds, [], 'no charge: nothing is state-dependent');
});

test('twelve plain candidates: the first eight are previewed, the last four read card text', () => {
  // Pad the draw pile to plain cards before the choice is built.
  const fresh = fixture(), seat = fresh.live.combat.players.get('p2');
  while (seat.piles.draw.length < 14) seat.piles.draw.push({ ...seat.piles.draw[0], instanceId: `pad${seat.piles.draw.length}` });
  seat.piles.draw.forEach(row => { row.cardId = 'strike'; });
  const pick = seat.piles.hand.find(row => row.cardId === 'bashingBlow');
  assert.equal(fresh.combatPlay('p2', pick.instanceId, 'p2').ok, true);
  const rows = fresh.snapshot().scene.players.find(player => player.id === 'p2').pendingCardChoice.candidates;
  assert.ok(rows.length >= 12);
  assert.equal(rows.filter(row => row.combatPreview?.values.length).length, 8);
  assert.equal(rows.filter(row => row.combatPreview?.textOnly).length, rows.length - 8);
});
