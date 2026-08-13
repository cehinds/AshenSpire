#!/usr/bin/env node
// Observed-red contract: equipment-bound core roles plus one class signature.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { validateEquipment, stampDeck } from '../src/model/loadout.js';
import { createCombat, previewCard, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

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
const wantedCounts = { attack: 4, guard: 4, technique: 1 };

check(R.balance.startingDeckSize === 10, 'global startingDeckSize is 10', String(R.balance.startingDeckSize));
check(JSON.stringify(R.balance.equipment?.roleCopies) === JSON.stringify({ ...wantedCounts, signature: 1 }),
  'default roleCopies are 4/4/1/1', JSON.stringify(R.balance.equipment?.roleCopies));

for (const [classId, want] of Object.entries(expected)) {
  const cls = R.classes.get(classId);
  const run = createRunState({ seed: 1, classId, registries: R });
  check(cls.startingSignatureCard === want.signature, `${classId} declares exactly one signature`, String(cls.startingSignatureCard));
  check(cls.startingLoadout != null, `${classId} declares startingLoadout`);
  check(run.loadout.sets.rightHand[0] === want.rightHand, `${classId} equips authored right hand`, JSON.stringify(run.loadout.sets.rightHand));
  check(run.loadout.sets.leftHand[0] === want.leftHand, `${classId} equips authored left hand`, JSON.stringify(run.loadout.sets.leftHand));
  check(run.deck.length === 10, `${classId} starts with exactly 10 cards`, String(run.deck.length));
  for (const [role, count] of Object.entries(wantedCounts)) {
    check(run.deck.filter((c) => c.equipmentRole === role).length === count,
      `${classId} starts with ${count} ${role} instances`, JSON.stringify(run.deck));
  }
  const signatures = run.deck.filter((c) => !c.equipmentRole);
  check(signatures.length === 1 && signatures[0].cardId === want.signature,
    `${classId} preserves one fixed signature instance`, JSON.stringify(signatures));
}

const starseer = createRunState({ seed: 2, classId: 'starseer', registries: R });
const attack = starseer.deck.find((c) => c.equipmentRole === 'attack');
const magic = attack && resolveCard(R, attack);
check(magic && /staff/i.test(magic.name) && /magic/i.test(magic.name), 'Ash Staff names its role attack as staff magic', magic?.name);
check(magic && magic.icon !== R.cards.get('strike').icon, 'Ash Staff supplies a distinct attack icon', magic?.icon);
check(magic?.damageSchool === 'magic', 'Ash Staff attack declares magic damageSchool', String(magic?.damageSchool));
check((magic?.effects.find((e) => e.op === 'damage')?.tags || []).includes('starstone'),
  'Ash Staff attack executes with an explicit magic/starstone tag', JSON.stringify(magic?.effects));
check(Array.isArray(magic?.cardTags) && magic.cardTags.includes('starstone'),
  'Ash Staff attack presents its explicit magic/starstone tag', JSON.stringify(magic?.cardTags));
check(R.cards.get('starstonePebble').name === 'Starstone Pebble', 'IP-safe Starstone Pebble remains authoritative');
check(attack?.profileReceipt?.base === 2 && attack.profileReceipt.tier === 2
  && attack.profileReceipt.rarityBonus === 0 && attack.profileReceipt.value === 4,
  'Ash Staff INT receipt is exactly 2 + 2 + 0 = 4', JSON.stringify(attack?.profileReceipt));
check(magic?.effects.find((e) => e.op === 'damage')?.amount === 4,
  'resolved Ash Staff execution definition uses receipt value 4', JSON.stringify(magic?.effects));

const C = createCombat({
  registries: R,
  rng: createRng(71),
  player: {
    classId: 'starseer', attributes: starseer.attributes, maxHp: starseer.maxHp, hp: starseer.hp,
    maxMana: starseer.maxMana, mana: starseer.mana, maxStamina: starseer.maxStamina, stamina: starseer.stamina,
    energyMax: starseer.energyMax, drawPerTurn: starseer.drawPerTurn, deck: starseer.deck,
    relicIds: [], flasks: [], loadout: starseer.loadout,
  },
  enemyIds: [R.enemies.ids()[0]],
});
let liveAttack = [...C.piles.hand, ...C.piles.draw].find((c) => c.equipmentRole === 'attack');
if (!C.piles.hand.includes(liveAttack)) {
  C.piles.draw.splice(C.piles.draw.indexOf(liveAttack), 1);
  C.piles.hand.push(liveAttack);
}
const previewDamage = previewCard(C, liveAttack.instanceId, 'e1').values.find((v) => v.op === 'damage').value;
const hpBefore = C.enemies[0].hp;
dispatch(C, { type: 'playCard', cardInstanceId: liveAttack.instanceId, targetId: 'e1' });
check(previewDamage === 4 && hpBefore - C.enemies[0].hp === previewDamage,
  'Ash Staff magic preview and execution share exact value 4', `${previewDamage}/${hpBefore - C.enemies[0].hp}`);

// Stable role identity: a profile swap may change what the card resolves to,
// never its instance id, upgrade flag, or signature card.
if (attack) {
  const before = { instanceId: attack.instanceId, upgraded: attack.upgraded, signature: starseer.deck.find((c) => !c.equipmentRole)?.cardId };
  starseer.loadout.sets.rightHand[0] = 'starstoneStaff';
  stampDeck(R, starseer);
  check(attack.instanceId === before.instanceId && attack.upgraded === before.upgraded,
    'active weapon re-resolution preserves role instance identity and upgrade');
  check(starseer.deck.find((c) => !c.equipmentRole)?.cardId === before.signature,
    'active weapon re-resolution leaves signature untouched');
  check(attack.profileId != null, 'active weapon stamps an explicit profile id', String(attack.profileId));
}

function mutant({ classPatch, equipmentPatch, piecePatch, profilePatch, balancePatch }) {
  const classes = contentBundle.classes.map((c) => c.id === 'starseer' ? { ...c, ...classPatch } : { ...c });
  const armaments = contentBundle.equipment.armaments.map((a) => a.id === 'ashStaff' ? { ...a, ...piecePatch } : { ...a });
  const profiles = (contentBundle.equipment.basicCardProfiles || []).map((p) => p.id === 'staffMagicAttack' ? { ...p, ...profilePatch } : { ...p });
  return createRegistries({
    ...contentBundle,
    balance: { ...contentBundle.balance, ...balancePatch },
    classes,
    equipment: { ...contentBundle.equipment, armaments, basicCardProfiles: profiles, ...equipmentPatch },
  });
}
function refuses(label, pattern, patches) {
  const said = validateEquipment(mutant(patches)).join(' | ');
  check(pattern.test(said), label, said);
}
refuses('mutant: unknown starting slot is refused by name', /nowhere/, { classPatch: { startingLoadout: { nowhere: 'ashStaff' } } });
refuses('mutant: dangling starting piece is refused by name', /notAStaff/, { classPatch: { startingLoadout: { rightHand: 'notAStaff' } } });
refuses('mutant: unknown profile ref is refused by name', /notAProfile/, { piecePatch: { attackProfile: 'notAProfile' } });
refuses('mutant: wrong-target profile is refused by name', /wrong|guard|attack/i, { profilePatch: { role: 'guard' } });
refuses('mutant: unknown damage school is refused by name', /magick/, { profilePatch: { damageSchool: 'magick' } });
refuses('mutant: unknown profile tag is refused by name', /notMagic/, { profilePatch: { tags: ['notMagic'] } });
refuses('mutant: duplicate precedence slot is refused by name', /rightHand|duplicate/i, {
  balancePatch: { equipment: { ...contentBundle.balance.equipment, roleSources: { attack: [{ slot: 'rightHand' }, { slot: 'rightHand' }], guard: [{ slot: 'leftHand', kinds: ['shield'] }, { slot: 'rightHand' }], technique: [{ slot: 'rightHand' }] } } },
});
refuses('mutant: role counts must sum to startingDeckSize', /10|sum|startingDeckSize/i, {
  balancePatch: { startingDeckSize: 10, equipment: { ...contentBundle.balance.equipment, roleCopies: { attack: 5, guard: 4, technique: 1, signature: 1 } } },
});

console.log(`\nclass-loadouts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
