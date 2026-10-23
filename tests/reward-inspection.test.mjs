import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { createRunState } from '../src/model/state.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { bindCardInspection, openBoundCardInspection } from '../src/ui/components/cardInspection.js';
import { cardDetailHtml, relicText } from '../src/ui/components/card.js';

const registries = createRegistries(contentBundle);
const legacyRegistries = createRegistries(legacyContentBundle);
const weapon = registries.equipment.armaments[0];
const armor = registries.equipment.armour.find(item => item.classId === 'reaver');
const relic = registries.relics.all()[0];
const potion = registries.flasks.all()[0];
const cases = [
  ['combatCards', 'frostNova'], ['weaponArts', 'guardCounter'],
  ['weapons', weapon.id], ['armor', armor.id], ['relics', relic.id], ['potions', potion.id],
];

// Keep the markup fed to the production DOM as well as its parsed structure:
// rewardDom intentionally omits HTML text nodes. This makes full detail text
// testable without pretending the fixture measures browser layout or gestures.
function withInspectionDom(fn) {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  const proto = Object.getPrototypeOf(dom.document.body);
  const original = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  const outer = Object.getOwnPropertyDescriptor(proto, 'outerHTML');
  Object.defineProperty(proto, 'outerHTML', { ...outer,
    set(value) {
      const holder = dom.document.createElement('div'); holder.innerHTML = value;
      for (const node of [...holder.children]) this.before(node);
      this.remove();
    },
  });
  Object.defineProperty(proto, 'innerHTML', { configurable: true,
    set(value) { this.inspectionMarkup = value; original.set.call(this, value); },
  });
  const cleanup = () => {
    clearSelection();
    Object.defineProperty(proto, 'innerHTML', original);
    Object.defineProperty(proto, 'outerHTML', outer);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  };
  try {
    const result = fn(dom);
    if (result?.then) return result.finally(cleanup);
    cleanup(); return result;
  } catch (error) { cleanup(); throw error; }
}
const reading = node => [node.textContent, node.inspectionMarkup, ...node.children.map(reading)].filter(Boolean).join(' ');

function mount(kind, id, extra = {}) {
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 17, xp: 21, skills: { blade: { level: 2, xp: 9 } } };
  const offer = { id: `${kind}-inspection`, options: [{ kind, id }, { kind: 'combatCards', id: 'scholarsInsight' }], taken: [], claimed: null, takeCount: 1 };
  const calls = [];
  mountGameProfileOffers(app, { registries, run, offer, title: 'Victory rewards',
    onTake() { calls.push('take'); throw new Error('save refused'); },
    onContinue() { calls.push('continue'); }, ...extra,
  });
  return { app, run, offer, calls };
}

for (const [kind, id] of cases) test(`${kind} can be fully inspected in selection and review without advancing`, () => {
  withInspectionDom(() => {
    const { app, run, offer, calls } = mount(kind, id);
    const before = structuredClone({ run, offer });
    const inspect = app.querySelector('#reward-inspect');
    const confirm = app.querySelector('#reward-card-confirm');
    assert.equal(inspect.disabled, true);
    const face = app.querySelector('.reward-choice-face');
    face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true }));
    face.click();
    assert.equal(inspect.disabled, false, 'the first touch face tap still selects a reward');
    assert.match(inspect.getAttribute('aria-label'), /^Inspect /);
    const chosen = app.querySelector('.reward-selected');
    for (const stage of ['selection', 'review']) {
      if (stage === 'review') confirm.click();
      assert.notEqual(app.querySelector('.reward-row').inert, true, 'review does not block Information');
      const labels = [...app.querySelector('.modal-foot-actions').children].map(button => button.textContent);
      inspect.click();
      const dialog = document.querySelector('.card-inspection-modal');
      assert.ok(dialog, `${stage} has a reading door`);
      assert.equal(dialog.querySelector('.card-inspection-act'), null, 'reading has no choose or claim action');
      if (kind === 'combatCards' || kind === 'weaponArts') {
        const detail = dialog.querySelector('.playing-card-details');
        assert.equal(detail.inspectionMarkup, cardDetailHtml(registries, { cardId: id, instanceId: 'offer:0', upgraded: false }, { rules: run }));
        assert.ok(dialog.querySelector('.card[data-level="inspect"]'), 'the full playing card is rendered');
      } else {
        assert.ok(dialog.querySelector('.equipment-poker-card[data-level="inspect"]'), 'the full possession face is rendered');
        const text = reading(dialog);
        const expected = kind === 'weapons' ? weapon.blurb : kind === 'armor' ? armor.blurb : kind === 'relics' ? relicText(relic, registries) : potion.textTemplate;
        assert.ok(text.includes(expected), `the full authored reading reaches ${stage}`);
        assert.ok(dialog.querySelector('.card-inspection-details'), 'the shared explanations pane is present');
      }
      dialog.querySelector('.modal-close').click();
      assert.equal(document.querySelector('.card-inspection-modal'), null);
      assert.equal(document.activeElement, inspect, 'closing restores focus to Inspect');
      chosen.querySelector('.card-info-button').click();
      const information = document.querySelector('.card-inspection-modal');
      assert.ok(information, `${stage} also keeps the face's shared Information door usable`);
      assert.equal(information.querySelector('.card-inspection-act'), null);
      information.querySelector('.modal-close').click();
      assert.equal(app.querySelector('.reward-selected'), chosen, 'inspection preserves the selected face');
      assert.deepEqual([...app.querySelector('.modal-foot-actions').children].map(button => button.textContent), labels, 'closing preserves the stage and actions');
      assert.deepEqual({ run, offer }, before, 'reading cannot change XP, decks, claims, or offers');
      assert.deepEqual(calls, []);
    }
    assert.equal(confirm.textContent, 'Continue');
    assert.equal(app.querySelector('.reward-pick').disabled, true, 'review choices stay locked');
    confirm.click();
    assert.deepEqual(calls, ['take']);
    assert.equal(app.querySelector('.reward-confirm-status').textContent, 'save refused');
    assert.equal(inspect.disabled, false, 'a refused save keeps inspection available');
    inspect.click(); document.querySelector('.card-inspection-modal .modal-close').click();
    assert.deepEqual(calls, ['take'], 'reading after a refusal does not retry the claim');
    assert.deepEqual({ run, offer }, before);
    app.querySelector('#reward-continue').click();
    assert.equal(confirm.textContent, 'Confirm');
    assert.equal(app.querySelector('.reward-pick').disabled, false);
  });
});

test('Information reads an unchosen or already taken reward without choosing it', () => {
  withInspectionDom(() => {
    const { app, run, offer, calls } = mount('weapons', weapon.id);
    const before = structuredClone({ run, offer });
    const faces = app.querySelectorAll('.reward-choice-face');
    faces[0].querySelector('.card-info-button').click();
    document.querySelector('.card-inspection-modal .modal-close').click();
    assert.equal(app.querySelector('#reward-card-confirm').disabled, true);
    app.querySelectorAll('.reward-pick')[1].click();
    faces[0].querySelector('.card-info-button').click();
    document.querySelector('.card-inspection-modal .modal-close').click();
    assert.equal(app.querySelectorAll('.reward-pick')[1].getAttribute('aria-checked'), 'true');
    assert.deepEqual({ run, offer }, before); assert.deepEqual(calls, []);
    app.remove();
    const taken = mount('weapons', weapon.id);
    taken.offer.taken.push(0);
    // Rebuild against the taken option using the same production renderer.
    mountGameProfileOffers(taken.app, { registries, run: taken.run, offer: taken.offer, title: 'Rewards', onTake() { throw new Error('must not claim'); }, onContinue() {} });
    assert.equal(taken.app.querySelector('.reward-pick').disabled, true);
    taken.app.querySelector('.card-info-button').click();
    assert.ok(document.querySelector('.card-inspection-modal'));
    document.querySelector('.card-inspection-modal .modal-close').click();
    assert.deepEqual(taken.offer.taken, [0]); assert.equal(taken.offer.claimed, null);
  });
});

test('bound inspection API refuses detached and unbound nodes without invoking a callback', () => {
  withInspectionDom(() => {
    const card = document.createElement('div');
    let opens = 0;
    bindCardInspection(card, { title: 'Test', open: () => { opens++; return 'opened'; } });
    assert.equal(openBoundCardInspection(card), false);
    assert.equal(openBoundCardInspection(null), false);
    document.body.append(card);
    const unbound = document.createElement('div'); document.body.append(unbound);
    assert.equal(openBoundCardInspection(unbound), false);
    assert.equal(opens, 0);
    assert.equal(openBoundCardInspection(card), 'opened'); assert.equal(opens, 1);
    card.remove(); assert.equal(openBoundCardInspection(card), false); assert.equal(opens, 1);
  });
});

test('pending claims block inspection and failed saves and exits restore the review for retry', async () => {
  await withInspectionDom(async () => {
    let rejectClaim, resolveClaim, takes = 0, exits = 0;
    const { app, run, offer } = mount('combatCards', 'frostNova', {
      onTake() {
        takes++;
        return new Promise((resolve, reject) => { resolveClaim = resolve; rejectClaim = reject; });
      },
      onContinue() { exits++; if (exits === 1) throw new Error('exit refused'); },
    });
    const before = structuredClone({ run, offer });
    app.querySelector('.reward-pick').click();
    const chosen = app.querySelector('.reward-selected');
    const inspect = app.querySelector('#reward-inspect');
    const confirm = app.querySelector('#reward-card-confirm');
    const strip = app.querySelector('.reward-row');
    confirm.click(); confirm.click();
    assert.equal(takes, 1); assert.equal(inspect.disabled, true);
    assert.equal(strip.inert, true, 'face Information is unavailable while saving');
    // Dispatch directly as well as pressing the disabled button: the handler
    // guards stale queued activation independently of disabled presentation.
    inspect.click(); inspect.dispatchEvent(new Event('click', { bubbles: true }));
    assert.equal(document.querySelector('.card-inspection-modal'), null);
    rejectClaim(new Error('save refused'));
    await Promise.resolve(); await Promise.resolve();
    assert.equal(inspect.disabled, false); assert.equal(strip.inert, false);
    assert.equal(confirm.textContent, 'Continue');
    assert.deepEqual({ run, offer }, before);
    inspect.click(); document.querySelector('.card-inspection-modal .modal-close').click();
    assert.equal(document.activeElement, inspect);
    assert.equal(app.querySelector('.reward-selected'), chosen);
    assert.equal(takes, 1); assert.equal(exits, 0);
    confirm.click(); assert.equal(takes, 2); assert.equal(inspect.disabled, true);
    offer.taken.push(0); offer.claimed = 0; resolveClaim(offer);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(exits, 1); assert.equal(inspect.disabled, false);
    assert.equal(strip.inert, false, 'an exit save refusal restores Information');
    inspect.click(); document.querySelector('.card-inspection-modal .modal-close').click();
    assert.equal(document.activeElement, inspect);
    assert.equal(app.querySelector('.reward-selected'), chosen);
    assert.equal(confirm.textContent, 'Continue');
    assert.deepEqual(run, before.run); assert.deepEqual(offer.taken, [0]);
    confirm.click();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(takes, 2, 'exit retry must not repeat the claim'); assert.equal(exits, 2);
    assert.equal(inspect.disabled, true); assert.equal(strip.inert, true);
    inspect.dispatchEvent(new Event('click', { bubbles: true }));
    assert.equal(document.querySelector('.card-inspection-modal'), null, 'completed reviews cannot reopen inspection');
  });
});

// The regular game uses a separate chooser from configured profiles; both
// stages must reach the same reading without crossing its save door.
const normalRun = () => ({ class: 'reaver', attributes: {}, cinders: 19, xp: 27, deck: [], sideboard: [], flasks: [], relics: [], feats: [], coreTags: [], loadout: { storage: [] }, skills: {} });
const normalCases = [
  { kind: 'card', rewards: { cardIds: ['frostNova', 'scholarsInsight'] }, pick: 0 },
  { kind: 'relic', rewards: { relicChoices: [relic.id, registries.relics.all()[1].id] }, pick: 0 },
  { kind: 'skillDraft', rewards: { skillDrafts: [{ skillId: 'item:blade', offerId: 'inspection:grades', level: 1,
    cardIds: ['progression-ember-hew', 'progression-ember-hew'], abilityRanks: [0, 5], choiceIds: ['progression-ember-hew@0', 'progression-ember-hew@5'] }] }, pick: 1 },
  { kind: 'skillRankUp', legacy: true, rewards: { skillRankUps: [{ skillId: 'item:blade', level: 2, claimOrdinal: 0 }] }, pick: 0 },
];

for (const sample of normalCases) test(`normal ${sample.kind} inspection survives review, Back and a refused save`, () => {
  withInspectionDom(() => {
    document.body.classList.add('reduced-motion');
    const source = sample.legacy ? legacyRegistries : registries;
    const run = sample.legacy ? createRunState({ seed: 21, classId: 'reaver', registries: source }) : normalRun();
    if (sample.legacy) {
      run.skills['item:blade'] = { level: 2, xp: 0, pendingDrafts: 0, pendingRankUps: 1 };
      run.deck = [{ instanceId: 'inspect-rend', cardId: 'rend', upgraded: false }];
    } else if (sample.kind === 'skillDraft') run.skills['item:blade'] = { level: 1, xp: 0, pendingDrafts: 1 };
    const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
    const checkpoint = { states: {} };
    let inspect, strip, refuse = true, writes = 0, dones = 0;
    mountRewards(app, { registries: source, run, rewards: sample.rewards, checkpoint, onDone() { dones++; },
      onPersist() {
        writes++;
        assert.equal(inspect.disabled, true, 'commit blocks Inspect');
        assert.equal(strip.inert, true, 'commit blocks face Information');
        inspect.dispatchEvent(new Event('click', { bubbles: true }));
        assert.equal(document.querySelector('.card-inspection-modal'), null);
        return !refuse;
      },
    });
    app.querySelector(`[data-kind="${sample.kind}"]`).click();
    inspect = app.querySelector('#reward-inspect');
    strip = app.querySelector('.reward-row');
    assert.ok(inspect); assert.equal(inspect.disabled, true);
    app.querySelectorAll('.reward-pick')[sample.pick].click();
    const selectedId = app.querySelector('.reward-selected').dataset.pickId;
    const before = structuredClone({ run, checkpoint });
    const inspectAndReturn = () => {
      assert.equal(inspect.disabled, false);
      const label = app.querySelector('#reward-card-confirm').textContent;
      inspect.click();
      const dialog = document.querySelector('.card-inspection-modal');
      assert.ok(dialog);
      assert.equal(dialog.querySelector('.card-inspection-act'), null, 'reading offers no Choose or claim action');
      assert.ok(dialog.querySelector('[data-level="inspect"]'), 'the full authoritative face is rendered');
      if (sample.kind === 'relic') assert.ok(reading(dialog).includes(relicText(relic, source)));
      else {
        assert.ok(dialog.querySelector('.playing-card-details').inspectionMarkup.length > 100);
        if (sample.kind === 'skillRankUp') assert.match(dialog.querySelector('.card').getAttribute('aria-label'), /rank 2$/);
        if (sample.kind === 'skillDraft') assert.match(dialog.querySelector('.card').getAttribute('aria-label'), /rank 5$/);
      }
      dialog.querySelector('.modal-close').click();
      assert.equal(document.activeElement, inspect);
      assert.equal(app.querySelector('#reward-card-confirm').textContent, label);
      assert.equal(app.querySelector('.reward-selected').dataset.pickId, selectedId);
      app.querySelector('.reward-selected .card-info-button').click();
      const information = document.querySelector('.card-inspection-modal');
      assert.ok(information, 'shared Information also stays available during review');
      assert.equal(information.querySelector('.card-inspection-act'), null);
      information.querySelector('.modal-close').click();
      assert.equal(app.querySelector('#reward-card-confirm').textContent, label);
      assert.equal(app.querySelector('.reward-selected').dataset.pickId, selectedId);
      assert.deepEqual({ run, checkpoint }, before, 'reading preserves XP, skill ledgers, decks and claims');
      assert.equal(dones, 0);
    };
    inspectAndReturn();
    let confirm = app.querySelector('#reward-card-confirm');
    confirm.click();
    assert.equal(confirm.textContent, 'Continue');
    for (const radio of strip.querySelectorAll('button.reward-pick')) assert.equal(radio.disabled, true);
    inspectAndReturn();
    // A queued click on another face cannot change the reviewed selection.
    const otherFace = [...strip.querySelectorAll('.reward-choice-face')].find(face => face.dataset.pickId !== selectedId);
    otherFace?.click();
    assert.equal(app.querySelector('.reward-selected').dataset.pickId, selectedId);
    confirm.click();
    assert.equal(writes, 1); assert.equal(confirm.disabled, false);
    assert.equal(strip.inert, false);
    inspectAndReturn();
    app.querySelector('#reward-back').click();
    inspect = app.querySelector('#reward-inspect'); strip = app.querySelector('.reward-row');
    confirm = app.querySelector('#reward-card-confirm');
    assert.equal(confirm.textContent, 'Confirm');
    inspectAndReturn();
    confirm.click(); refuse = false; confirm.click();
    assert.equal(writes, 2);
    assert.equal(Object.values(checkpoint.states).filter(state => state === 'taken').length, 1);
    assert.equal(document.querySelector('.card-inspection-modal'), null, 'successful claim leaves no orphan inspection');
  });
});

test('normal node choices hide Inspect instead of offering a missing face', () => {
  withInspectionDom(() => {
    const app = document.createElement('main'); document.body.append(app);
    const run = normalRun();
    mountRewards(app, { registries, run, rewards: { classDrafts: [{ classId: 'reaver', level: 1, nodeIds: ['ironFooting', 'bloodTempo'] }] }, onDone() {} });
    app.querySelector('[data-kind="classDraft"]').click();
    assert.equal(app.querySelector('#reward-inspect'), null);
    app.querySelector('.reward-pick').click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(app.querySelector('#reward-inspect'), null);
    assert.equal(document.querySelector('.card-inspection-modal'), null);
  });
});


for (const rewardKind of ['armory', 'relic']) test(`normal ${rewardKind} milestone keeps its complete reading visible during review`, () => {
  withInspectionDom(() => {
    const definitions = rewardKind === 'armory' ? registries.equipment.armaments.slice(0, 2) : registries.relics.all().slice(0, 2);
    const options = definitions.map(item => rewardKind === 'armory' ? `armament/${item.id}` : item.id);
    const app = document.createElement('main'); document.body.append(app);
    const run = normalRun(), checkpoint = { states: {} };
    let writes = 0, claims = 0;
    mountRewards(app, { registries, run, checkpoint, onDone() {}, onPersist() { writes++; }, onClaimClassReward() { claims++; },
      rewards: { classMilestoneRewards: [{ receiptId: `inspection:${rewardKind}`, classId: 'reaver', skillId: 'class:reaver', level: 1, rewardKind, options }] },
    });
    app.querySelector('[data-kind="classMilestone"]').click();
    const before = structuredClone({ run, checkpoint });
    const readings = () => app.querySelectorAll('.equipment-poker-inspection');
    assert.equal(readings().length, 2);
    for (const [index, inspection] of readings().entries()) {
      assert.equal(inspection.hidden, false);
      assert.equal(inspection.dataset.pickId, options[index]);
      assert.ok(inspection.querySelector('[data-level="inspect"]'));
      assert.ok(inspection.querySelector('.card-inspection-details'));
    }
    app.querySelectorAll('.reward-pick')[1].click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(app.querySelector('#reward-card-confirm').textContent, 'Continue');
    assert.deepEqual(readings().map(inspection => inspection.hidden), [true, false], 'only the selected full reading remains visible');
    const text = rewardKind === 'armory' ? definitions[1].blurb : relicText(definitions[1], registries);
    assert.ok(reading(readings()[1]).includes(text), 'the full authored reading remains available in review');
    assert.equal(app.querySelector('#reward-inspect'), null, 'the existing inline full reading needs no second door');
    assert.deepEqual({ run, checkpoint }, before); assert.equal(claims, 0); assert.equal(writes, 0);
    app.querySelector('#reward-back').click();
    assert.equal(app.querySelector('.reward-selected').dataset.pickId, options[1]);
    assert.equal(app.querySelector('#reward-card-confirm').textContent, 'Confirm');
    assert.deepEqual(readings().map(inspection => inspection.hidden), [false, false]);
    assert.deepEqual({ run, checkpoint }, before); assert.equal(claims, 0); assert.equal(writes, 0);
  });
});
