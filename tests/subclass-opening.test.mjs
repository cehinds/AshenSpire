import { subclassDeckPreview } from '../src/model/subclassDeck.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { subclassOptions, subclassSelectionProblem, effectiveSubclassId, subclassContentProblems } from '../src/model/subclasses.js';
import { startingAbilityPlan } from '../src/model/startingAbilities.js';
import { stampDeck } from '../src/model/loadout.js';
import { classDraftPool, pickClassNode } from '../src/model/classTree.js';
import { swapRunClass } from '../src/model/classSwap.js';
import { runClassIdentity } from '../src/model/classCard.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot, commitCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { runCombatPlayer } from '../src/engine/runCombat.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { serializeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';
import { applyCombatExpansionMartial } from '../src/content/combatExpansionMartial.js';
import { openRunClassMastery, registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { createClassRespecDraft, previewClassRespec, applyClassRespec, classRespecView } from '../src/model/classRespec.js';

const r = createRegistries(contentBundle);
const birth = (def, extra = {}) => createRunState({ seed: 42, registries: r, classId: def.classId, subclassId: def.id, enemyKnowledgeVersion: null, ...extra });
const encounter = r.encounters.all().find(row => row.pool === 'normal' && row.enemies?.length);
const groups = run => Object.fromEntries(['subclass','class','weaponArt','basic'].map(source => [source, run.deck.filter(card => card.openingSource === source).length]));

for (const def of r.subclasses.all()) test(`${def.name} begins with five legal roles, one class, one art and four basics`, () => {
  const run = birth(def);
  assert.deepEqual(groups(run), { subclass: 5, class: 1, weaponArt: 1, basic: 4 });
  assert.equal(run.deck.length, 11);
  assert.equal(run.deck.filter(card => card.equipmentRole === 'attack').length, 2);
  assert.equal(run.deck.filter(card => card.openingRole === 'Defend').length, 2);
  assert.equal(run.deck.find(card => card.openingSource === 'class').cardId, r.classes.get(def.classId).abilityCard);
  assert.equal(run.deck.find(card => card.openingSource === 'weaponArt').equipmentRole, 'weaponArt');
  assert.ok(run.deck.find(card => card.openingSource === 'weaponArt').grantedBy);
  for (const inst of run.deck.filter(card => card.openingSource === 'subclass')) {
    const card = applyCombatExpansionMartial(resolveCard(r, inst)), profile = combatProfileFor(card);
    if (inst.openingRole === 'Power') assert.equal(card.type, 'power');
    if (inst.openingRole === 'Skill') assert.equal(card.type, 'skill');
    if (inst.openingRole === 'Spell') assert.equal(profile.camp, 'spell');
    if (['Smash','Counter','Sweep'].includes(inst.openingRole)) assert.equal(profile.maneuver, inst.openingRole.toLowerCase());
  }
  const before = structuredClone(run.deck);
  for (let n = 0; n < 3; n++) stampDeck(r, run);
  assert.deepEqual(run.deck, before);
  assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))), []);
  assert.deepEqual(runClassIdentity(r, run), { name: def.name, glyph: def.glyph });
});

test('all classes offer two validated identities and malformed selections fail before creation', () => {
  assert.deepEqual(subclassContentProblems(contentBundle), []);
  for (const cls of r.classes.all()) assert.equal(subclassOptions(r, cls.id).length, 2);
  assert.ok(subclassSelectionProblem(r, 'reaver', 'frostMonarch'));
  assert.throws(() => birth(r.subclasses.get('heavyKnight'), { subclassId: 'frostMonarch' }), /belongs/);
  assert.throws(() => birth(r.subclasses.get('heavyKnight'), { subclassId: 'missing' }), /Unknown/);
  assert.ok(subclassContentProblems({ ...contentBundle, subclasses: contentBundle.subclasses.slice(1) }).length);
  const bad = structuredClone(contentBundle.subclasses); bad[0].roles[0].cardIds = ['missing'];
  assert.ok(subclassContentProblems({ ...contentBundle, subclasses: bad }).some(row => row.includes('unknown card')));
});

test('empty, offhand-only, dual wield, focus and ranged starts keep eleven and legal ownership', () => {
  for (const def of r.subclasses.all()) {
    const ids = r.characterCreation.classes[def.classId].handIds;
    const options = [{ rightHand: null, leftHand: null }, ...ids.flatMap(id => [{ rightHand: id, leftHand: null }, { rightHand: null, leftHand: id }])];
    for (const hands of options) {
      let run;
      try { run = birth(def, { startingHands: hands }); }
      catch (error) { if (/requires|does not fit|two.hand|offhand|handed/.test(error.message)) continue; throw error; }
      assert.equal(run.deck.length, 11, `${def.id}/${JSON.stringify(hands)}`);
      const art = run.deck.find(card => card.openingSource === 'weaponArt');
      assert.ok([hands.rightHand, hands.leftHand, 'unarmed:right', 'unarmed:left', 'unarmed:body'].includes(art.grantedBy));
      stampDeck(r, run); assert.equal(run.deck.length, 11);
    }
  }
});

test('caster picks replace existing slots; Monk selects one spell without consuming its Sweep', () => {
  for (const id of ['battleMage','frostMonarch','cleric','monk']) {
    const def = r.subclasses.get(id), base = birth(def), plan = startingAbilityPlan(r, base);
    assert.equal(plan.count, id === 'monk' ? 1 : 2);
    const chosen = plan.choices.slice(0, plan.count).map(card => card.id);
    const run = birth(def, { startingAbilityIds: chosen });
    assert.equal(run.deck.length, 11);
    for (const cardId of chosen) assert.ok(run.deck.some(card => card.cardId === cardId && card.abilityRank === 1 && card.openingSource === 'subclass'));
    if (id === 'monk') assert.equal(run.deck.filter(card => card.openingRole === 'Sweep').length, 1);
    stampDeck(r, run); assert.equal(run.deck.length, 11);
  }
});

test('melee maneuver picks replace their matching role without losing another required role', () => {
  for (const id of ['heavyKnight','swordMaster','ranger','assassin']) {
    const def = r.subclasses.get(id), plan = startingAbilityPlan(r, birth(def));
    assert.equal(plan.count, 1); assert.ok(plan.choices.length);
    for (const choice of plan.choices) {
      const run = birth(def, { startingAbilityIds: [choice.id] });
      assert.equal(run.deck.length, 11);
      assert.ok(run.deck.some(card => card.cardId === choice.id && card.abilityRank === 1));
      assert.equal(new Set(run.deck.filter(card => card.openingSource === 'subclass').map(card => card.openingRole)).size, 5);
    }
  }
});

test('legacy saves keep earned names and decks; selected identity wins over old tier-three names', () => {
  const old = createRunState({ seed: 42, classId: 'starseer', registries: r, enemyKnowledgeVersion: null });
  old.coreTags.push('reservoir');
  const saved = serializeRun(old), restored = deserializeRun(saved), before = structuredClone(restored.deck);
  assert.equal(restored.subclassId, undefined);
  assert.equal(effectiveSubclassId(r, restored), 'reservoir');
  assert.equal(runClassIdentity(r, restored).name, 'Reservoir');
  stampDeck(r, restored); assert.deepEqual(restored.deck, before);
  const selected = birth(r.subclasses.get('frostMonarch')); selected.coreTags.push('reservoir');
  assert.equal(runClassIdentity(r, selected).name, 'FrostMonarch');
});

test('birth identity is inactive across class swaps and returns without default grant growth', () => {
  const run = birth(r.subclasses.get('frostMonarch'));
  swapRunClass(r, run, 'reaver');
  assert.equal(effectiveSubclassId(r, run), null);
  assert.equal(runClassIdentity(r, run).name, 'Reaver');
  assert.equal(run.subclassId, 'frostMonarch');
  assert.equal(run.deck.length, 11);
  swapRunClass(r, run, 'starseer');
  assert.equal(runClassIdentity(r, run).name, 'FrostMonarch');
  assert.equal(run.deck.length, 11);
});

test('opening identities constrain only mapped top-tier progression and survive respec', () => {
  for (const def of r.subclasses.all()) {
    const run = birth(def), all = classDraftPool(r, def.classId, [], 30, def.id);
    const top = r.classTree.filter(row => row.classId === def.classId && row.tier === 3).map(row => row.nodeId);
    assert.deepEqual(all.filter(id => top.includes(id)), def.progressionNodeIds);
    assert.equal(classDraftPool(r, def.classId, [], 30).filter(id => top.includes(id)).length, 2);
    const other = top.find(id => !def.progressionNodeIds.includes(id));
    assert.equal(pickClassNode(r, run, other, { levelOverride: 30 }), false);
  }
  const run = birth(r.subclasses.get('heavyKnight'));
  openRunClassMastery(r, run, {}, { receiptId: 'subclass-respec' });
  const reg = registriesForClassMastery(r, run), draft = createClassRespecDraft(reg, run);
  const preview = previewClassRespec(reg, run, draft);
  assert.equal(preview.ok, true, preview.problems?.join('\n'));
  assert.equal(applyClassRespec(reg, run, preview, { saveCandidate: candidate => serializeRun(candidate) }).ok, true);
  assert.equal(run.subclassId, 'heavyKnight'); assert.equal(run.deck.length, 11);
});

test('save manager and actual solo/coop combats retain selected identities and eleven-card piles', () => {
  const run = birth(r.subclasses.get('frostMonarch'));
  const combat = createRunCombat({ registries: r, rng: createRng(42), run, enemyIds: encounter.enemies });
  assert.equal(combat.player.subclassId, run.subclassId);
  const snapshot = serializeCombatSnapshot(combat);
  const resumed = restoreCombatSnapshot({ registries: r, rng: createRng(42), snapshot });
  assert.equal(resumed.player.subclassId, 'frostMonarch');
  assert.equal(Object.values(resumed.piles).flat().length, 11);
  commitCombatSnapshot({ run, combat, nodeId: 'subclass-test', encounterId: encounter.id });
  const save = createSaveManager(createMemoryStorage()); save.ensureProfile(); save.saveRun(run, createRng(42));
  const loaded = save.loadRun(r); assert.ok(loaded, JSON.stringify(save.runStatus?.()));
  assert.equal(loaded.subclassId, 'frostMonarch'); assert.equal(loaded.deck.length, 11);
  const second = birth(r.subclasses.get('battleMage'));
  const coop = createCoopCombat({ registries: r, rng: createRng(42), players: [{ ...runCombatPlayer(run), id: 'frost' }, { ...runCombatPlayer(second), id: 'battle' }], enemyIds: encounter.enemies });
  assert.equal(coop.players.get('frost').entity.subclassId, 'frostMonarch');
  assert.equal(coop.players.get('battle').entity.subclassId, 'battleMage');
});


test('legacy earned Assassin does not constrain respec to the opening Assassin path', () => {
  const run = createRunState({ seed: 42, registries: r, classId: 'rogue', enemyKnowledgeVersion: null });
  openRunClassMastery(r, run, { classMastery: { rogue: { xp: 0, level: 10, unlockedRows: [] } } }, { receiptId: 'legacy-assassin' });
  run.coreTags = ['assassin'];
  run.skills['class:rogue'].pendingDrafts = 0;
  const reg = registriesForClassMastery(r, run), draft = createClassRespecDraft(reg, run);
  const view = classRespecView(reg, run, draft);
  assert.ok(view.treeOptions.some(row => row.nodeId === 'shadow'));
  const preview = previewClassRespec(reg, run, draft, { treeNodes: ['shadow'] });
  assert.equal(preview.ok, true, preview.problems.join('; '));
});

test('draft previews accept empty and partial choices but final birth requires the complete count', () => {
  const def = r.subclasses.get('battleMage'), run = birth(def), plan = startingAbilityPlan(r, run);
  assert.equal(subclassDeckPreview(r, run, { startingAbilityIds: [] }).length, 11);
  const ids = plan.choices.slice(0, 2).map(card => card.id);
  const partial = subclassDeckPreview(r, run, { startingAbilityIds: ids.slice(0, 1) });
  assert.equal(partial.length, 11);
  assert.ok(partial.some(card => card.cardId === ids[0] && card.abilityRank === 1));
  assert.equal(subclassDeckPreview(r, run, { startingAbilityIds: ids }).length, 11);
  assert.throws(() => birth(def, { startingAbilityIds: [] }), /Choose 2/);
  assert.throws(() => birth(def, { startingAbilityIds: ids.slice(0, 1) }), /Choose 2/);
});

test('legacy schema migration leaves the opening identity absent and preserves existing deck behavior', () => {
  const old = createRunState({ seed: 42, classId: 'rogue', registries: r, enemyKnowledgeVersion: null });
  const saved = JSON.parse(serializeRun(old)); saved.schemaVersion = 23;
  const restored = deserializeRun(JSON.stringify(saved));
  assert.equal(restored.subclassId, undefined); assert.equal(restored.subclassDeckVersion, undefined);
  assert.deepEqual(restored.deck, old.deck);
});

test('save reference validation rejects unknown and wrong-birth-class opening identities by name', () => {
  for (const id of ['missing', 'frostMonarch']) {
    const storage = createMemoryStorage(), save = createSaveManager(storage); save.ensureProfile();
    const run = birth(r.subclasses.get('heavyKnight')); run.subclassId = id;
    save.saveRun(run, createRng(42));
    assert.equal(save.loadRun(r), null);
    assert.equal(save.runStatus().state, 'archived');
    assert.match(save.runStatus().reason, /subclass/i);
  }
});

test('equipment swaps replace the one owned art and preserve independently earned cards', () => {
  const run = birth(r.subclasses.get('heavyKnight'));
  const oldArt = run.deck.find(card => card.openingSource === 'weaponArt');
  run.deck.push({ instanceId: 'earned-rare', cardId: 'goreblood', upgraded: false });
  run.loadout.sets.leftHand[0] = null; run.loadout.sets.rightHand[0] = 'greatsword';
  stampDeck(r, run);
  const arts = run.deck.filter(card => card.equipmentRole === 'weaponArt');
  assert.equal(arts.length, 1); assert.equal(arts[0].grantedBy, 'greatsword');
  assert.notEqual(arts[0].instanceId, oldArt.instanceId);
  assert.ok(run.deck.some(card => card.instanceId === 'earned-rare'));
  assert.equal(run.deck.length, 12);
  stampDeck(r, run); assert.equal(run.deck.length, 12);
});

test('co-op session save/restore and combat snapshots preserve selected seat identities', () => {
  const session = createSession({ registries: r, seedString: 'SUBCLASS' });
  session.addMember({ id: 'a', name: 'A', classId: 'starseer', subclassId: 'frostMonarch' });
  session.addMember({ id: 'b', name: 'B', classId: 'rogue', subclassId: 'ranger' });
  session.start();
  const saved = session.serialize(), restored = restoreSession(r, saved);
  assert.deepEqual(restored.refusedMembers(), []);
  assert.equal(restored.session.members.get('a').run.subclassId, 'frostMonarch');
  assert.equal(restored.session.members.get('b').run.deck.length, 11);
  const players = [...restored.session.members.values()].map(member => ({ ...runCombatPlayer(member.run), id: member.id }));
  const combat = createCoopCombat({ registries: r, rng: createRng(42), players, enemyIds: encounter.enemies });
  const snapshot = serializeCoopCombatSnapshot(combat);
  const resumed = createCoopCombat({ registries: r, rng: createRng(42), players, enemyIds: [], snapshot });
  assert.equal(resumed.players.get('a').entity.subclassId, 'frostMonarch');
  assert.equal(Object.values(resumed.players.get('a').piles).flat().length, 11);
  const tamperedPlayers = players.map(player => ({ ...player, ...(player.id === 'a' ? { subclassId: 'battleMage' } : {}) }));
  assert.throws(() => createCoopCombat({ registries: r, rng: createRng(42), players: tamperedPlayers, enemyIds: [], snapshot }), /subclass does not match/);
  const bad = structuredClone(saved); bad.members[0].run.subclassId = 'missing';
  assert.equal(restoreSession(r, bad).refusedMembers().length, 1);
});
