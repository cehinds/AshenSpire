#!/usr/bin/env node
// Contract for class-authored starting gear and weapon-authored basic attacks.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { validateEquipment } from '../src/model/loadout.js';

let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const R = createRegistries(contentBundle);
const expected = {
  reaver: { rightHand: 'straightSword', leftHand: 'roundShield', signature: 'gorefireSlash' },
  starseer: { rightHand: 'ashStaff', leftHand: null, signature: 'starstonePebble' },
  herald: { rightHand: 'boneSceptre', leftHand: null, signature: 'urgentHeal' },
};

for (const [classId, want] of Object.entries(expected)) {
  const cls = R.classes.get(classId);
  const run = createRunState({ seed: 1, classId, registries: R });
  check(cls.startingLoadout != null, `${classId} declares startingLoadout`);
  check(run.loadout.sets.rightHand[0] === want.rightHand, `${classId} equips authored right hand`, JSON.stringify(run.loadout.sets.rightHand));
  check(run.loadout.sets.leftHand[0] === want.leftHand, `${classId} equips authored left hand`, JSON.stringify(run.loadout.sets.leftHand));
  check(run.deck.some((c) => c.cardId === want.signature), `${classId} preserves unique signature starter`);
}

const starseer = createRunState({ seed: 2, classId: 'starseer', registries: R });
const strike = starseer.deck.find((c) => c.cardId === 'strike');
const magic = resolveCard(R, strike);
check(magic.name !== 'Strike' && /staff/i.test(magic.name), 'Ash Staff names the basic attack as a staff attack', magic.name);
check(magic.icon !== R.cards.get('strike').icon, 'Ash Staff supplies a distinct basic-attack icon', magic.icon);
check(magic.damageSchool === 'magic', 'Ash Staff basic attack declares magic damageSchool', String(magic.damageSchool));
check((magic.effects.find((e) => e.op === 'damage')?.tags || []).includes('starstone'), 'Ash Staff attack executes with a magic/starstone damage tag', JSON.stringify(magic.effects));
check(Array.isArray(magic.cardTags) && magic.cardTags.includes('starstone'), 'Ash Staff attack presents its magic/starstone card tag', JSON.stringify(magic.cardTags));
check(R.cards.get('starstonePebble').name === 'Starstone Pebble', 'IP-safe Starstone Pebble public name remains authoritative');

function mutant({ classPatch, ashPatch }) {
  const classes = contentBundle.classes.map((c) => c.id === 'starseer' ? { ...c, ...classPatch } : { ...c });
  const armaments = contentBundle.equipment.armaments.map((a) => a.id === 'ashStaff' ? { ...a, ...ashPatch } : { ...a });
  return createRegistries({
    ...contentBundle,
    classes,
    equipment: { ...contentBundle.equipment, armaments },
  });
}

const badSlot = validateEquipment(mutant({ classPatch: { startingLoadout: { nowhere: 'ashStaff' } } })).join(' | ');
check(/nowhere/.test(badSlot), 'validator mutant: unknown starting slot is refused by name', badSlot);
const badPiece = validateEquipment(mutant({ classPatch: { startingLoadout: { rightHand: 'notAStaff' } } })).join(' | ');
check(/notAStaff/.test(badPiece), 'validator mutant: dangling starting piece is refused by name', badPiece);
const badSchool = validateEquipment(mutant({ ashPatch: {
  basicCardPresentation: { target: 'strike', name: 'Ash Staff Strike', icon: '✦', damageSchool: 'magick', effectTags: ['magic'], cardTags: ['magic'] },
} })).join(' | ');
check(/magick/.test(badSchool), 'validator mutant: unknown damage school is refused by name', badSchool);
const badTag = validateEquipment(mutant({ ashPatch: {
  basicCardPresentation: { target: 'strike', name: 'Ash Staff Strike', icon: '✦', damageSchool: 'magic', effectTags: ['notMagic'], cardTags: ['magic'] },
} })).join(' | ');
check(/notMagic/.test(badTag), 'validator mutant: unknown presentation tag is refused by name', badTag);

console.log(`\nclass-loadouts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
