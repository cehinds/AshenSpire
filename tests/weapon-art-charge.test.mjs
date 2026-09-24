// tests/weapon-art-charge.test.mjs — SPEC §12.2.1, the Weapon Art charge
// meter: accrual, cap, stagger credit, unleash and its spend, per-weapon
// swap behaviour, snapshot round-trip and old-snapshot load, and the content
// door that refuses a malformed unleashed form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRunState } from '../src/model/state.js';
import { startingDeckRefs, stampDeck } from '../src/model/loadout.js';
import { artChargeMax, artChargeView, artUnleashFor, shortStatusName, unleashedTemplate, advanceArtChargeDisplay, newlyFullIds } from '../src/model/artCharge.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { assertCombatSnapshot } from '../src/model/combatSnapshot.js';
import { executeAction } from '../src/engine/actions.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';

const registries = createRegistries(contentBundle);
const rules = contentBundle.balance.weaponArtCharge;

function fight({ right = 'greatsword', rightSets = null, left = null, seed = 812, classId = 'reaver', ratingsRules = null } = {}) {
  const run = createRunState({ seed, classId, registries });
  run.loadout.active.rightHand = 0;
  run.loadout.sets.rightHand = rightSets ? [...rightSets] : [right, null, null];
  run.loadout.active.leftHand = 0;
  run.loadout.sets.leftHand[0] = left;
  run.deck = startingDeckRefs(registries, run.loadout, classId).map((ref, i) => ({ ...ref, instanceId: `art-charge:${i}`, upgraded: false }));
  run.equipmentAttackSlotCount = run.deck.filter((c) => c.equipmentRole === 'attack').length;
  stampDeck(registries, run);
  const combat = createCombat({ registries, rng: createRng(seed), ...(ratingsRules ? { ratingsRules } : {}), enemyIds: ['wanderingSoldier'], player: {
    ...structuredClone(run), classId: run.class, relicIds: run.relics, loadout: run.loadout,
  } });
  // Tough, unstaggerable-by-default targets so a test controls every fill.
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 999; if (enemy.poiseMeter) enemy.poiseMeter.max = 999; }
  return combat;
}

const everyCard = (combat) => Object.values(combat.piles).flat();

function play(combat, pred) {
  const ref = everyCard(combat).find(pred);
  assert.ok(ref, 'the card to play is somewhere in the fight');
  for (const pile of Object.values(combat.piles)) { const i = pile.indexOf(ref); if (i >= 0) pile.splice(i, 1); }
  combat.piles.hand.push(ref);
  combat.player.energy = 20;
  combat.player.stamina = combat.player.maxStamina;
  combat.player.mana = combat.player.maxMana;
  const { events } = dispatch(combat, { type: 'playCard', cardInstanceId: ref.instanceId, targetId: combat.enemies[0].id });
  return { ref, events };
}

const kitAttack = (weaponId) => (c) => c.kitRole === 'attack' && c.grantedBy === weaponId;
const artOf = (weaponId) => (c) => c.equipmentRole === 'weaponArt' && c.grantedBy === weaponId;

test('a fight starts with every meter empty, sized from balance data', () => {
  const combat = fight();
  assert.deepEqual(combat.artCharge, {});
  assert.equal(artChargeMax(registries, 'greatsword'), rules.maxByWeapon.greatsword);
  assert.equal(artChargeMax(registries, 'katana'), rules.defaultMax);
  const [row] = artChargeView(combat);
  assert.equal(row.weaponId, 'greatsword');
  assert.equal(row.value, 0);
  assert.equal(row.full, false);
});

test('each hit with the weapon\'s own cards charges its meter, the Art itself never does, and the cap holds', () => {
  const combat = fight();
  const max = artChargeMax(registries, 'greatsword');
  const { events } = play(combat, kitAttack('greatsword'));
  const changed = events.filter((e) => e.type === 'artChargeChanged');
  assert.deepEqual(changed.map((e) => [e.weaponId, e.value, e.reason]), [['greatsword', rules.gainPerHit, 'hit']]);
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit);
  // The Art below full is a plain play: no charge, no unleash.
  const art = play(combat, artOf('greatsword'));
  assert.ok(!art.events.some((e) => e.type === 'artChargeChanged' || e.type === 'artUnleashed'));
  assert.equal(art.events.find((e) => e.type === 'cardPlayed').unleashed, undefined);
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit);
  for (let i = 0; i < max + 3; i++) play(combat, kitAttack('greatsword'));
  assert.equal(combat.artCharge.greatsword, max, 'overflow is dropped at the cap');
  assert.equal(artChargeView(combat)[0].full, true);
});

test('a stagger caused by the weapon\'s hit adds its bonus charge', () => {
  const combat = fight();
  const enemy = combat.enemies[0];
  enemy.poiseMeter.max = 1; // the kit attack's own impact fills it
  const { events } = play(combat, kitAttack('greatsword'));
  if (events.some((e) => e.type === 'enemyStaggered')) {
    const reasons = events.filter((e) => e.type === 'artChargeChanged').map((e) => e.reason);
    assert.ok(reasons.includes('stagger'), `stagger credited: ${reasons}`);
    const staggers = events.filter((e) => e.type === 'enemyStaggered').length;
    assert.equal(combat.artCharge.greatsword, Math.min(artChargeMax(registries, 'greatsword'), rules.gainPerHit + staggers * rules.gainOnStagger));
  } else {
    // No impact on this card in this ruleset: prove the credit through the
    // listener with the same events the engine would emit.
    combat.emit('cardPlayed', { cardInstanceId: 'x' });
    combat.emit('damageDealt', { sourceId: 'player', targetId: enemy.id, amount: 3, blocked: 0, cardInstanceId: 'x', grantedBy: 'greatsword', equipmentRole: 'granted', isAttack: true });
    const before = combat.artCharge.greatsword;
    combat.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId });
    assert.equal(combat.artCharge.greatsword, before + rules.gainOnStagger);
  }
  // A new card announcement forgets the last hit: a later stagger credits nobody.
  combat.emit('cardPlayed', { cardInstanceId: 'y' });
  const settled = combat.artCharge.greatsword;
  combat.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId });
  assert.equal(combat.artCharge.greatsword, settled);
});

test('a build-up burst caused by the weapon\'s hit adds its bonus charge; the Poise fill does not count twice', () => {
  const combat = fight();
  const enemy = combat.enemies[0];
  combat.emit('cardPlayed', { cardInstanceId: 'k' });
  combat.emit('damageDealt', { sourceId: 'player', targetId: enemy.id, amount: 4, blocked: 0, cardInstanceId: 'k', grantedBy: 'greatsword', equipmentRole: 'granted', isAttack: true });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit);
  combat.emit('procBurst', { targetId: enemy.id, status: 'bleed', amount: 5, threshold: 10 });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit + rules.gainOnBurst);
  combat.emit('meterFilled', { targetId: enemy.id, meter: 'poise', threshold: 10 });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit + rules.gainOnBurst, 'the Poise fill is counted by its stagger, not here');
  // A burst on the player, or after the turn ends, credits nobody.
  combat.emit('procBurst', { targetId: 'player', status: 'bleed', amount: 5, threshold: 10 });
  combat.emit('playerTurnEnd', { turn: 1 });
  combat.emit('procBurst', { targetId: enemy.id, status: 'bleed', amount: 5, threshold: 10 });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit + rules.gainOnBurst);
});

test('the last weapon hit is forgotten by an unlent hit, a flask, a swap and the end of its card', () => {
  const combat = fight();
  const enemy = combat.enemies[0];
  // Card 'k' is announced, then lands the weapon's hit.
  const hit = () => {
    combat.emit('cardPlayed', { cardInstanceId: 'k' });
    combat.emit('damageDealt', { sourceId: 'player', targetId: enemy.id, amount: 3, blocked: 0, cardInstanceId: 'k', grantedBy: 'greatsword', equipmentRole: 'granted', isAttack: true });
  };
  const staggerCredits = () => {
    const before = combat.artCharge.greatsword || 0;
    combat.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId });
    return (combat.artCharge.greatsword || 0) - before;
  };
  hit();
  assert.equal(staggerCredits(), rules.gainOnStagger, 'straight after the weapon\'s hit, the stagger is the weapon\'s');
  // A relic / status tick hit with no lender after the weapon's hit.
  hit();
  combat.emit('damageDealt', { sourceId: 'player', targetId: enemy.id, amount: 2, blocked: 0, isAttack: false });
  assert.equal(staggerCredits(), 0, 'an unlent hit takes the stagger away from the weapon');
  hit();
  combat.emit('flaskUsed', { flaskId: 'x', slot: 0, targetId: enemy.id });
  assert.equal(staggerCredits(), 0, 'a flask forgets the last hit');
  hit();
  combat.emit('armamentSwapped', { slotId: 'rightHand', setIndex: 0, cost: 0, rule: 'x' });
  assert.equal(staggerCredits(), 0, 'a swap forgets the last hit');
  // A real play: once the card has resolved, a later stagger is nobody's.
  combat.artCharge = {};
  play(combat, kitAttack('greatsword'));
  assert.equal(combat._artChargeLastHit, null, 'the card\'s resolution ended and the last hit with it');
  assert.equal(staggerCredits(), 0);
});

test('a full meter unleashes the Art: its extra effects resolve and the meter empties', () => {
  const plain = fight();
  const plainHp = plain.enemies[0].hp;
  play(plain, artOf('greatsword'));
  const plainDealt = plainHp - plain.enemies[0].hp;

  const combat = fight();
  const max = artChargeMax(registries, 'greatsword');
  for (let i = 0; i < max; i++) play(combat, kitAttack('greatsword'));
  const art = everyCard(combat).find(artOf('greatsword'));
  const pv = previewCard(combat, art.instanceId);
  assert.equal(pv.artCharge.unleashed, true);
  assert.deepEqual([pv.artCharge.value, pv.artCharge.max], [max, max]);
  // The printed card text gains the unleashed line, its numbers bound as
  // ordinary template tokens (SPEC §3.13).
  assert.equal(pv.artCharge.textTemplate, '★ +{unleashed.0} Poise, +{unleashed.1} Vulnerable');
  // The phone hand's wording keeps the same tokens in fewer letters.
  assert.equal(pv.artCharge.shortTemplate, '★ +{unleashed.0} Poise, +{unleashed.1} Vuln.');
  assert.deepEqual([pv.tokens['unleashed.0'], pv.tokens['unleashed.1']], [4, 1]);
  const enemy = combat.enemies[0];
  const poiseBefore = enemy.poiseMeter.value;
  const hpBefore = enemy.hp;
  const energyBefore = 20;
  const { events } = play(combat, artOf('greatsword'));
  assert.ok(events.some((e) => e.type === 'artUnleashed' && e.weaponId === 'greatsword' && e.cardId === art.cardId));
  assert.ok(events.some((e) => e.type === 'artChargeChanged' && e.reason === 'unleash' && e.value === 0));
  assert.equal(events.find((e) => e.type === 'cardPlayed').unleashed, true);
  assert.equal(combat.artCharge.greatsword, 0, 'consuming the Art spends the charge');
  // Sundering Hew unleashed: +Poise and Vulnerable, same payment.
  assert.ok(enemy.statuses.vulnerable, 'the unleashed form applied its status');
  assert.ok(enemy.poiseMeter.value > poiseBefore || events.some((e) => e.type === 'enemyStaggered'), 'the unleashed form dealt extra Poise');
  assert.equal(hpBefore - enemy.hp, plainDealt, 'the Art\'s own damage is unchanged');
  assert.equal(events.find((e) => e.type === 'energySpent').amount, energyBefore - combat.player.energy, 'payment is the plain payment');
  assert.equal(artUnleashFor(combat, art).ready, false);
});

test('a loose copy of the same card is not the weapon\'s Art and never unleashes', () => {
  const combat = fight();
  const max = artChargeMax(registries, 'greatsword');
  combat.artCharge.greatsword = max;
  const art = everyCard(combat).find(artOf('greatsword'));
  combat.piles.hand.push({ instanceId: 'loose-copy', cardId: art.cardId, upgraded: false });
  assert.equal(previewCard(combat, 'loose-copy').artCharge, undefined);
  const { events } = play(combat, (c) => c.instanceId === 'loose-copy');
  assert.ok(!events.some((e) => e.type === 'artUnleashed'));
  assert.equal(combat.artCharge.greatsword, max);
});

test('the meter belongs to the weapon: a swap keeps each weapon\'s charge apart', () => {
  const combat = fight({ rightSets: ['greatsword', 'katana', null] });
  play(combat, kitAttack('greatsword'));
  play(combat, kitAttack('greatsword'));
  assert.equal(combat.artCharge.greatsword, 2 * rules.gainPerHit);
  combat.player.energy = 99;
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
  assert.deepEqual(artChargeView(combat).map((r) => [r.weaponId, r.value]), [['katana', 0]], 'the swapped-in weapon starts from its own value');
  // The swapped-out weapon neither gains nor shows while stowed.
  combat.emit('cardPlayed', { cardInstanceId: 'x' });
  combat.emit('damageDealt', { sourceId: 'player', targetId: combat.enemies[0].id, amount: 3, blocked: 0, cardInstanceId: 'x', grantedBy: 'greatsword', equipmentRole: 'granted', isAttack: true });
  assert.equal(combat.artCharge.greatsword, 2 * rules.gainPerHit);
  play(combat, kitAttack('katana'));
  assert.equal(combat.artCharge.katana, rules.gainPerHit);
  combat.player.energy = 99;
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 });
  assert.deepEqual(artChargeView(combat).map((r) => [r.weaponId, r.value]), [['greatsword', 2 * rules.gainPerHit]], 'swapping back resumes the stored value');
  assert.equal(combat.artCharge.katana, rules.gainPerHit);
});

test('two armed hands keep two meters, each charged only by its own cards', () => {
  const combat = fight({ right: 'greatsword', left: 'kiteShield' });
  assert.deepEqual(artChargeView(combat).map((r) => r.weaponId), ['greatsword', 'kiteShield']);
  play(combat, kitAttack('kiteShield'));
  assert.equal(combat.artCharge.kiteShield, rules.gainPerHit);
  assert.equal(combat.artCharge.greatsword, undefined);
});

test('a mid-combat save carries the meters; a snapshot from before them loads at zero', () => {
  const combat = fight();
  play(combat, kitAttack('greatsword'));
  const saved = serializeCombatSnapshot(combat);
  assert.deepEqual(saved.artCharge, { greatsword: rules.gainPerHit });
  const restored = restoreCombatSnapshot({ registries, rng: createRng(812), snapshot: saved });
  assert.equal(restored.artCharge.greatsword, rules.gainPerHit);
  for (const enemy of restored.enemies) { enemy.hp = enemy.maxHp = 999; }
  play(restored, kitAttack('greatsword'));
  assert.equal(restored.artCharge.greatsword, 2 * rules.gainPerHit, 'the restored fight keeps charging');

  const legacy = structuredClone(saved);
  delete legacy.artCharge;
  assert.doesNotThrow(() => assertCombatSnapshot(legacy));
  const old = restoreCombatSnapshot({ registries, rng: createRng(812), snapshot: legacy });
  assert.deepEqual(old.artCharge, {});
  assert.equal(artChargeView(old)[0].value, 0);

  const broken = structuredClone(saved);
  broken.artCharge = { greatsword: -1 };
  assert.throws(() => assertCombatSnapshot(broken), /artCharge\.greatsword/);
});

test('content validation refuses malformed meter rules and unleashed forms', () => {
  const problems = (bundle) => validateContent(bundle).errors.map((p) => `${p.path}: ${p.msg || p.message || ''}`).join('\n');
  assert.equal(problems(contentBundle), '');
  const missing = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed } };
  delete missing.weaponArtUnleashed.greatswordSunderingHew;
  assert.match(problems(missing), /weaponArtUnleashed\.greatswordSunderingHew/);
  const selfTargeted = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed, quickstep: { effects: [{ op: 'damage', target: 'enemy', amount: 3 }] } } };
  assert.match(problems(selfTargeted), /quickstep\.effects\[0\]\.target/);
  // An omitted target on an untargeted Art resolves to the play's source —
  // the player — so a hostile op there is refused; a targeted Art may omit it
  // (it resolves to the aimed enemy), and a self-only op never needs one.
  const untargeted = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed, quickstep: { effects: [{ op: 'damage', amount: 5 }] } } };
  assert.match(problems(untargeted), /quickstep\.effects\[0\]\.target: .*lands on the player/);
  const aimed = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed, katanaDrawCut: { effects: [{ op: 'damage', amount: 5 }] }, quickstep: { effects: [{ op: 'draw', amount: 1 }] } } };
  assert.equal(problems(aimed), '');
  const badOp = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed, twinFang: { effects: [{ op: 'notAnOpcode' }] } } };
  assert.match(problems(badOp), /weaponArtUnleashed\.twinFang\.effects/);
  const badRule = { ...contentBundle, balance: { ...contentBundle.balance, weaponArtCharge: { ...rules, maxByWeapon: { noSuchWeapon: 3 } } } };
  assert.match(problems(badRule), /maxByWeapon\.noSuchWeapon/);
  // The whole table missing is refused by name, not skipped.
  const noTable = { ...contentBundle };
  delete noTable.weaponArtUnleashed;
  assert.match(problems(noTable), /weaponArtUnleashed: .*missing.*balance\.weaponArtCharge is set/);
  const noTableNoRules = { ...noTable, balance: { ...contentBundle.balance } };
  delete noTableNoRules.balance.weaponArtCharge;
  assert.match(problems(noTableNoRules), /weaponArtUnleashed: .*missing.*combat-kit Art of/);
});

test('the unleashed line is compact enough for a resting card, with a phone form', () => {
  assert.equal(shortStatusName('Bleed'), 'Bleed');
  assert.equal(shortStatusName('Crimson Blight'), 'Blight');
  assert.equal(shortStatusName('Vulnerable'), 'Vuln.');
  const r = createRegistries(contentBundle);
  const name = (id) => r.statuses.get(id).name;
  // Every authored unleashed form prints a line a resting desktop card holds
  // in at most two strip lines, and a phone line no longer than it.
  for (const [cardId, form] of Object.entries(contentBundle.weaponArtUnleashed)) {
    const long = unleashedTemplate(form, name).replace(/\{unleashed\.\d+\}/g, '9');
    const short = unleashedTemplate(form, name, { short: true }).replace(/\{unleashed\.\d+\}/g, '9');
    assert.ok(long.startsWith('★ '), cardId);
    assert.ok(long.length <= 34, `${cardId}: '${long}' is too long for the strip`);
    assert.ok(short.length <= long.length, cardId);
  }
});

test('paced playback: the shown charge advances beat by beat and lands on the live value', () => {
  const combat = fight();
  const max = artChargeMax(registries, 'greatsword');
  for (let i = 0; i < max - 1; i++) play(combat, kitAttack('greatsword'));
  // The screen's pre-dispatch snapshot (combat.js takeSnapshot).
  const shown = { ...combat.artCharge };
  const { events } = play(combat, kitAttack('greatsword'));
  assert.equal(combat.artCharge.greatsword, max, 'the engine is already full');
  const art = everyCard(combat).find(artOf('greatsword'));
  // Before any beat plays, nothing the player sees is full yet.
  assert.equal(artChargeView(combat, shown)[0].full, false);
  assert.equal(artUnleashFor(combat, art, shown).ready, false);
  // Beat by beat: nothing moves until the artChargeChanged beat, which is
  // after the hit that earned it.
  const fill = events.findIndex((e) => e.type === 'artChargeChanged');
  assert.ok(fill > events.findIndex((e) => e.type === 'damageDealt'), 'the charge follows its hit');
  for (const e of events.slice(0, fill)) advanceArtChargeDisplay(shown, [e]);
  assert.equal(artChargeView(combat, shown)[0].value, max - 1);
  for (const e of events.slice(fill)) advanceArtChargeDisplay(shown, [e]);
  assert.deepEqual(shown, combat.artCharge, 'the last beat lands on the live value');
  assert.equal(artUnleashFor(combat, art, shown).ready, true);

  // The unleash beat empties the shown meter the same way.
  const before = { ...combat.artCharge };
  const unleash = play(combat, artOf('greatsword'));
  advanceArtChargeDisplay(before, unleash.events);
  assert.deepEqual(before, combat.artCharge);
  assert.equal(before.greatsword, 0);
  // An artUnleashed beat alone (no change event) still empties it.
  assert.deepEqual(advanceArtChargeDisplay({ greatsword: max }, [{ type: 'artUnleashed', weaponId: 'greatsword' }]), { greatsword: 0 });
});

// On a phone (portrait or landscape) the next card covers all but the Art
// card's left step, so a full meter's bonus rides a one-line tab above the
// card's top edge instead of the in-card strip; wider hands keep the strip.
test('phone hands show the unleashed bonus as a tab above the Art card', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.hand \.card \.art-charge-card \.art-charge-bonus \{ display: none; \}/, 'the bonus copy is phone-only');
  const at = css.indexOf("@media (max-width: 600px), (max-height: 500px) {\n  .hand .card[data-art-charge='full'] .art .cd-unleashed { display: none; }");
  assert.ok(at >= 0, 'the phone block (portrait and landscape) swaps the in-card strip for the tab');
  const block = css.slice(at, css.indexOf('\n}\n', at));
  assert.match(block, /bottom: calc\(100% \+/, 'the tab sits above the card top, the band no neighbour covers');
  assert.match(block, /\.art-charge-card > \.art-charge-bonus \{\s*display: inline;/, 'the tab prints the bonus words');
  const js = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(js, /class: 'art-charge-bonus', text: strip\.textContent/, "the tab copies the card strip's own words");

test('a full meter or Art card flashes once: a repaint that rebuilds it while full does not flash again', async () => {
  // The hand rebuilds every card node when the hand's size changes, so the
  // "already flashed" memory lives in the screen, keyed by id (item 9).
  let before = new Set();
  const paint = (ids) => { const { fresh, next } = newlyFullIds(before, ids); before = next; return [...fresh]; };
  assert.deepEqual(paint(['art:1']), ['art:1'], 'the fill flashes');
  assert.deepEqual(paint(['art:1']), [], 'a repaint while still full does not');
  assert.deepEqual(paint(['art:1', 'art:2']), ['art:2'], 'only the newcomer flashes');
  assert.deepEqual(paint(['art:2']), [], 'the unleash empties one; the other stays quiet');
  assert.deepEqual(paint(['art:1', 'art:2']), ['art:1'], 'refilled, it flashes again');
  const { readFile } = await import('node:fs/promises');
  const screen = await readFile(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.ok(!/wasFull\s*=\s*node\.dataset/.test(screen), 'the hand card no longer reads its own (rebuilt) node for the flash');
  assert.ok(/newlyFullIds\(artCardsFullBefore/.test(screen), 'the hand card flash reads the screen-held memory');
});

test('a status that remembers the weapon\'s card and strikes back later charges nothing', () => {
  // Under Combat Ratings a self-status applied by a magical card keeps that
  // card (`ratingCard`) and its hooks fire WITH it — lender tags and all.
  // Zealotry strikes back when its owner loses HP, on the enemy's turn: that
  // is not the card's own resolution, so no meter moves.
  const ratingsRules = resolveCombatRatings({ 'gameConfig.combatRatings.enabled': true }, contentBundle);
  assert.ok(ratingsRules.enabled);
  const combat = fight({ right: 'ashStaff', classId: 'starseer', ratingsRules });
  const kit = everyCard(combat).find((c) => c.grantedBy === 'ashStaff' && c.equipmentRole !== 'weaponArt');
  const card = { sourceArmamentId: kit.sourceArmamentId, equipmentRole: kit.equipmentRole, instanceId: kit.instanceId, cardId: kit.cardId, grantedBy: kit.grantedBy, damageSchool: 'magic' };
  executeAction(combat, { effect: { op: 'applyStatus', target: 'self', status: 'zealotry', stacks: 1 }, source: combat.player, owner: combat.player, target: combat.player, card, meta: {} });
  assert.ok(combat.player.statuses.zealotry.ratingCard, 'the status remembers the staff\'s card');
  let struckBack = 0;
  for (let turn = 0; turn < 4; turn++) {
    combat.player.block = 0;
    combat.player.hp = combat.player.maxHp = 500;
    const { events } = dispatch(combat, { type: 'endTurn' });
    struckBack += events.filter((e) => e.type === 'damageDealt' && e.sourceId === combat.player.id && e.sourceArmamentId === 'ashStaff').length;
    assert.deepEqual(events.filter((e) => e.type === 'artChargeChanged'), [], `turn ${turn}: no charge from a retaliation`);
  }
  assert.ok(struckBack > 0, 'the fixture really struck back with the staff\'s card');
  assert.equal(combat.artCharge.ashStaff || 0, 0);
});
