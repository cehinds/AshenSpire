import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { creationEquipmentSectionViews, selectStartingHand } from '../src/model/characterCreation.js';
import { startingEquipmentPreview } from '../src/model/startingEquipmentPreview.js';

const r = createRegistries(contentBundle);
let cases = 0;
for (const cls of r.classes.all()) {
  const base = createRunState({ seed: 7, classId: cls.id, registries: r });
  const before = JSON.stringify(base);
  const sections = creationEquipmentSectionViews(r, cls.id).filter(row => row.kind === 'hand');
  for (const section of sections) assert.equal(section.choices.filter(c => c.emptyHand).length, 1);
  const right = sections.find(s => s.slot === 'rightHand').choices;
  const left = sections.find(s => s.slot === 'leftHand').choices;
  for (const a of right) for (const b of left) {
    if (a.id && a.id === b.id) continue;
    const hands = { rightHand: a.id, leftHand: b.id };
    let actual;
    try { actual = createRunState({ seed: 7, classId: cls.id, registries: r, startingHands: hands }); }
    catch (e) { if (/requires/.test(e.message)) continue; throw e; }
    const available = actual.deck.map(ref => JSON.stringify(resolveCard(r, ref)));
    for (const slot of ['rightHand', 'leftHand']) {
      const preview = startingEquipmentPreview(r, base, hands, slot);
      assert.equal(preview.total, preview.cards.reduce((sum, row) => sum + row.count, 0));
      const id = hands[slot], side = slot === 'leftHand' ? 'left' : 'right';
      const expected = actual.deck.filter(ref => id
        ? ref.sourceArmamentId === id || ref.weaponId === id || ref.grantedBy === id
        : ref.grantedBy === `unarmed:${side}` || (['attack', 'guard', 'technique'].includes(ref.equipmentRole) && !ref.sourceArmamentId && !ref.weaponId && !ref.grantedBy));
      assert.equal(preview.total, expected.length, `${cls.id}/${slot}: every contributed card must appear`);
      for (const { ref, count } of preview.cards) {
        const card = JSON.stringify(resolveCard(r, ref));
        assert.equal(available.filter(value => value === card).length >= count, true,
          `${cls.id}/${a.name}/${b.name}/${slot}: ${ref.cardId} preview must match actual starting cards`);
      }
      cases++;
    }
  }
  assert.equal(JSON.stringify(base), before, 'preview must never change its base run');
  const bare = startingEquipmentPreview(r, base, { leftHand: null, rightHand: null }, 'rightHand');
  assert.ok(bare.cards.some(row => row.ref.equipmentRole === 'attack'));
  assert.ok(bare.cards.some(row => row.ref.equipmentRole === 'guard'));
}
assert.deepEqual(selectStartingHand({ leftHand: 'straightSword', rightHand: 'roundShield' }, 'rightHand', 'straightSword'), { leftHand: null, rightHand: 'straightSword' });
assert.deepEqual(selectStartingHand({ leftHand: null, rightHand: 'straightSword' }, 'rightHand', null), { leftHand: null, rightHand: null });
console.log(`PASS starting equipment previews: ${cases} hand/loadout cases match actual run cards; inputs remain unchanged`);
