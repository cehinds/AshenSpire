#!/usr/bin/env node
// Observed-red contract: equipment-bound core roles plus one class signature.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { validateEquipment, stampDeck } from '../src/model/loadout.js';
import { createCombat, previewCard, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { validateContent } from '../src/model/validate.js';
import { createMemoryStorage, createSaveManager } from '../src/engine/save.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';

// DOOR. The real input is the content bundle and the model/engine modules,
// entered by IMPORT — the same graph the game boots. The `mutant:`/`schema:`
// rows below are in-memory bundle patches handed to the validators: that is
// the validator's own door and right for those clauses, but nothing in this
// file ever walked the AUTHORED-CONTENT road. `--selftest` closes that: each
// plant is written INTO A COPY of the real content/model file on disk and
// this whole tool re-runs against the copy.
// (Vira's doors audit 2026-08-14 listed this tool NO-KNOWN-BAD.)
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'class-loadouts.mjs',
    plants: [
      {
        name: 'the authored role copies stop summing to the starting deck size',
        file: 'src/content/balance.js',
        find: 'roleCopies: { attack: 4, guard: 4, technique: 1, signature: 1 }',
        replace: 'roleCopies: { attack: 5, guard: 4, technique: 1, signature: 1 }',
        expectRed: /FAIL default roleCopies are 4\/4\/1\/1/,
      },
      {
        name: 'a class loses its authored signature card',
        file: 'src/content/classes.js',
        find: "startingSignatureCard: 'gorefireSlash',",
        replace: "startingSignatureCard: 'starstonePebble',",
        expectRed: /FAIL reaver declares exactly one signature/,
      },
      {
        name: 'the Ash Staff attack profile stops declaring magic damage school',
        file: 'src/content/generated/basicCardProfiles.js',
        find: '"id": "staffMagicAttack",\n    "role": "attack",\n    "baseCardId": "strike",\n    "displayName": "Staff Magic Strike",\n    "icon": "✦",\n    "damageSchool": "magic",',
        replace: '"id": "staffMagicAttack",\n    "role": "attack",\n    "baseCardId": "strike",\n    "displayName": "Staff Magic Strike",\n    "icon": "✦",\n    "damageSchool": "physical",',
        expectRed: /FAIL Ash Staff attack declares magic damageSchool/,
      },
      {
        name: 'a silent state-loss profile swap is allowed through (the compatibility refusal dropped)',
        file: 'src/model/loadout.js',
        find: 'if (prior && prior.compatibility !== nextCompatibility) throw new Error(`Incompatible',
        replace: 'if (false && prior && prior.compatibility !== nextCompatibility) throw new Error(`Incompatible',
        expectRed: /FAIL compatibility is consumed to refuse silent state-loss swaps/,
      },
    ],
  }));
}

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
  check(Array.isArray(cls.eligibleStartingKitIds) && cls.eligibleStartingKitIds.length > 0,
    `${classId} declares eligible starting kits`, JSON.stringify(cls.eligibleStartingKitIds));
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

function mutant({ classPatch, equipmentPatch, piecePatch, profilePatch, balancePatch, kitPatch }) {
  const classes = contentBundle.classes.map((c) => c.id === 'starseer' ? { ...c, ...classPatch } : { ...c });
  const armaments = contentBundle.equipment.armaments.map((a) => a.id === 'ashStaff' ? { ...a, ...piecePatch } : { ...a });
  const profiles = (contentBundle.equipment.basicCardProfiles || []).map((p) => p.id === 'staffMagicAttack' ? { ...p, ...profilePatch } : { ...p });
  const startingKits = (contentBundle.equipment.startingKits || []).map((k) => k.id === 'starseerBaseline' ? { ...k, ...kitPatch } : { ...k });
  return createRegistries({
    ...contentBundle,
    balance: { ...contentBundle.balance, ...balancePatch },
    classes,
    equipment: { ...contentBundle.equipment, armaments, basicCardProfiles: profiles, startingKits, ...equipmentPatch },
  });
}
function refuses(label, pattern, patches) {
  const said = validateEquipment(mutant(patches)).join(' | ');
  check(pattern.test(said), label, said);
}
refuses('mutant: dangling baseline piece is refused by name', /notAStaff/, { kitPatch: { rightHand: 'notAStaff' } });
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

// Host-resolved equipment scaling must be snapshotted, not recomputed from
// whatever profile CSV happens to ship when a save resumes.
let layered;
let layeredError = '';
try {
  layered = createRunState({
    seed: 3, classId: 'starseer', registries: R,
    derivedStatOptions: {
      modeModifiers: { equipmentProfiles: { staffMagicAttack: { gainPerTier: 2 } } },
      runModifiers: [{ equipmentProfiles: { staffMagicAttack: { gainPerTier: 3 } } }],
      explicitOverride: { equipmentProfiles: { staffMagicAttack: { gainPerTier: 4 } } },
    },
  });
} catch (error) { layeredError = error.message; layered = createRunState({ seed: 3, classId: 'starseer', registries: R }); }
const layeredAttack = layered.deck.find((c) => c.equipmentRole === 'attack');
check(layeredAttack?.profileReceipt?.gainPerTier === 4 && layeredAttack.profileReceipt.value === 10,
  'mode/run/explicit equipment scaling resolves once with explicit precedence', layeredError || JSON.stringify(layeredAttack?.profileReceipt));
check(layered.equipmentProfileRuleSnapshot?.profiles?.staffMagicAttack?.gainPerTier === 4,
  'run persists the host-resolved equipment profile snapshot', JSON.stringify(layered.equipmentProfileRuleSnapshot));

const cloneBundle = () => ({
  ...contentBundle,
  equipment: {
    ...contentBundle.equipment,
    basicCardProfiles: (contentBundle.equipment.basicCardProfiles || []).map((p) => ({ ...p, tags: [...p.tags], mods: [...p.mods] })),
  },
});
const driftBundle = cloneBundle();
driftBundle.equipment.basicCardProfiles.find((p) => p.id === 'staffMagicAttack').gainPerTier = 99;
const driftR = createRegistries(driftBundle);
const beforeDrift = layeredAttack.profileReceipt.value;
let driftError = '';
try { stampDeck(driftR, layered); } catch (error) { driftError = error.message; }
check(layeredAttack.profileReceipt.value === beforeDrift,
  're-stamp after live content drift consumes the saved profile snapshot', driftError || JSON.stringify(layeredAttack.profileReceipt));

function contentRefuses(label, pattern, mutate) {
  const bundle = cloneBundle();
  mutate(bundle);
  const said = validateContent(bundle).errors.map((e) => `${e.path}: ${e.msg}`).join(' | ');
  check(pattern.test(said), label, said);
}
contentRefuses('schema: missing basic-card profile table fails closed', /basicCardProfiles/i,
  (b) => { delete b.equipment.basicCardProfiles; });
contentRefuses('schema: unknown profile field is refused by path', /basicCardProfiles.*surprise/i,
  (b) => { b.equipment.basicCardProfiles[0].surprise = true; });
contentRefuses('schema: negative finite cap is refused', /cap.*negative|non-negative/i,
  (b) => { b.equipment.basicCardProfiles[0].cap = -1; });
contentRefuses('schema: compatibility vocabulary is role-bound', /compatibility/i,
  (b) => { b.equipment.basicCardProfiles[0].compatibility = 'guard-v1'; });
for (const field of ['id', 'role', 'baseCardId', 'displayName', 'icon', 'damageSchool', 'baseValue', 'scalingStat', 'pointsPerTier', 'rounding', 'gainPerTier', 'cap', 'tags', 'flavor', 'mods', 'compatibility']) {
  contentRefuses(`schema completeness: missing ${field} is refused`, new RegExp(`basicCardProfiles.*${field}`, 'i'),
    (b) => { delete b.equipment.basicCardProfiles[0][field]; });
}
contentRefuses('schema product: zero pointsPerTier is refused', /pointsPerTier.*> 0/i,
  (b) => { b.equipment.basicCardProfiles[0].pointsPerTier = 0; });
contentRefuses('schema product: negative baseValue is refused', /baseValue.*non-negative/i,
  (b) => { b.equipment.basicCardProfiles[0].baseValue = -1; });
contentRefuses('schema product: unknown scaling stat is refused', /scalingStat.*Dangling|unknown attributes/i,
  (b) => { b.equipment.basicCardProfiles[0].scalingStat = 'luck'; });
contentRefuses('schema product: duplicate profile id is refused', /Duplicate profile id/i,
  (b) => { b.equipment.basicCardProfiles.push({ ...b.equipment.basicCardProfiles[0] }); });

const incompatible = createRunState({ seed: 33, classId: 'starseer', registries: R });
const incompatibleAttack = incompatible.deck.find((c) => c.equipmentRole === 'attack');
incompatibleAttack.profileId = 'shieldGuard';
incompatible.loadout.sets.rightHand[0] = 'starstoneStaff';
let incompatibleSaid = '';
try { stampDeck(R, incompatible); } catch (error) { incompatibleSaid = error.message; }
check(/Incompatible attack profile swap/.test(incompatibleSaid),
  'compatibility is consumed to refuse silent state-loss swaps', incompatibleSaid);

const persisted = createRunState({ seed: 4, classId: 'starseer', registries: R });
const saveStorage = createMemoryStorage();
const save = createSaveManager(saveStorage);
save.saveRun(persisted);
const resumed = save.loadRun(R);
const savedRole = persisted.deck.find((c) => c.equipmentRole === 'attack');
const resumedRole = resumed?.deck.find((c) => c.equipmentRole === 'attack');
check(JSON.stringify({ role: resumedRole?.equipmentRole, profile: resumedRole?.profileId, receipt: resumedRole?.profileReceipt })
  === JSON.stringify({ role: savedRole?.equipmentRole, profile: savedRole?.profileId, receipt: savedRole?.profileReceipt }),
  'save round-trip preserves role/profile/receipt identity', JSON.stringify(resumedRole));

const coop = createCoopCombat({
  registries: R, rng: createRng(9), enemyIds: [R.enemies.ids()[0]],
  players: [{
    id: 'p1', classId: persisted.class, maxHp: persisted.maxHp, hp: persisted.hp,
    maxMana: persisted.maxMana, mana: persisted.mana, maxStamina: persisted.maxStamina, stamina: persisted.stamina,
    deck: persisted.deck, relicIds: persisted.relics, flasks: persisted.flasks,
    // STANDING RED, FOUND BY BUILDING THIS TOOL'S OWN KNOWN-BAD (Rune,
    // 2026-08-15). This seat was UNSTAMPED, and createPlayerCombatEntity has
    // refused an unstamped seat since the derived-authority slice — so this
    // file THREW at pristine dev = 5244543 and had been exiting 1 for however
    // long, with 60+ PASS lines printed above the stack trace. Vira's doors
    // audit rated it NO-KNOWN-BAD at `pattern` depth, which is a claim about
    // what the file says; nobody had run it. The stamp is passed here because
    // every other transport in the tree passes it — the refusal is correct and
    // the CALLER was wrong, which is exactly the invariant
    // tools/derived-runtime-authority.mjs asserts and this tool was violating.
    energyMax: persisted.energyMax, drawPerTurn: persisted.drawPerTurn,
  }],
});
const coopRole = [...coop.players.get('p1').piles.hand, ...coop.players.get('p1').piles.draw]
  .find((c) => c.instanceId === savedRole.instanceId);
check(JSON.stringify({ role: coopRole?.equipmentRole, profile: coopRole?.profileId, receipt: coopRole?.profileReceipt })
  === JSON.stringify({ role: savedRole.equipmentRole, profile: savedRole.profileId, receipt: savedRole.profileReceipt }),
  'co-op transport preserves role/profile/receipt identity', JSON.stringify(coopRole));

console.log(`\nclass-loadouts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
