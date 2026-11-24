import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { MountRewards } from '../src/ui/screens/reward.js';
import { createRunState } from '../src/model/state.js';
import { MountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { bindCardInspection, openBoundCardInspection } from '../src/ui/components/cardInspection.js';
import { cardDetailHtml, relicText } from '../src/ui/components/card.js';

const registries = createRegistries(contentBundle);
const legacyRegistries = createRegistries(contentBundle);
const weapon = registries.equipment.armaments[0];
const armor = registries.equipment.armour.find(item => item.classId === 'reaver');
const relic = registries.relics.all()[0];
const potion = registries.flasks.all()[0];
const cardCases = [['combatCards', 'frostNova'], ['weaponArts', 'guardCounter']];
// Owner 2026-11-18: a door of only cards is the multi-pick door (no Inspect button; the (i), right-click and long-press read);
// the Inspect button stays on the doors that mix in an item, a relic or a flask.
const cases = [
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
  Object.defineProperty(proto, 'innerHTML', { configurable: true,
    set(value) { this.inspectionMarkup = value; original.set.call(this, value); },
  });
  const cleanup = () => {
    clearSelection();
    Object.defineProperty(proto, 'innerHTML', original);
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
// The (i) badge is gone (owner, 2026-11-03): a right-click on the face opens the same shared reading.
// A touch long-press never inspects a card that has the (i) badge (owner, 2026-11-04), so the right-click is a mouse one.
const rightClick = node => (node.matches?.('.card-inspection-target') ? node : node.querySelector('.card-inspection-target'))
  .dispatchEvent(new Event('contextmenu', { cancelable: true }));
const mouseRightClick = node => {
  const target = node.matches?.('.card-inspection-target') ? node : node.querySelector('.card-inspection-target');
  target.dispatchEvent(new Event('pointerdown', { pointerType: 'mouse', bubbles: true }));
  rightClick(node);
};
const reading = node => [node.textContent, node.inspectionMarkup, ...node.children.map(reading)].filter(Boolean).join(' ');

function mount(kind, id, extra = {}) {
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 17, xp: 21, skills: { blade: { level: 2, xp: 9 } } };
  const offer = { id: `${kind}-inspection`, options: [{ kind, id }, { kind: 'combatCards', id: 'scholarsInsight' }], taken: [], claimed: null, takeCount: 1 };
  const calls = [];
  MountGameProfileOffers(app, { registries, run, offer, title: 'Victory rewards',
    onTake() { calls.push('take'); throw new Error('save refused'); },
    onContinue() { calls.push('continue'); }, ...extra,
  });
  return { app, run, offer, calls };
}

for (const [kind, id] of cardCases) test(`${kind} on the card door: a tap selects, the (i) and a right-click read, never claimed by reading`, () => {
  withInspectionDom(() => {
    const { app, run, offer, calls } = mount(kind, id);
    const before = structuredClone({ run, offer });
    assert.equal(app.querySelector('#reward-inspect'), null, 'a card door has no Inspect button');
    const face = app.querySelector('.reward-choice-face');
    face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true }));
    face.click();
    // Owner 2026-11-20: a tap selects (never inspects) and the selected card shows its (i).
    assert.equal(document.querySelector('.card-inspection-modal'), null, 'a tap does not open inspection');
    const chosen = app.querySelector('.reward-selected');
    assert.equal(chosen, face, 'the tap chose the face');
    chosen.querySelector('.card-info-button').click();
    assert.ok(document.querySelector('.card-inspection-modal'), 'the (i) opens inspection');
    document.querySelector('.card-inspection-back').click();
    mouseRightClick(chosen);
    const dialog = document.querySelector('.card-inspection-modal');
    assert.ok(dialog, 'right-click opens the reading door');
    // Owner 2026-11-20: the card modal's own answers are Add to deck and Send to library; opening it claims nothing.
    assert.deepEqual([...dialog.querySelectorAll('.card-inspection-act')].map(node => node.dataset.act).sort(), ['addToDeck', 'addToLibrary'], 'the door offers the two destinations');
    assert.equal(dialog.querySelector('.playing-card-details').inspectionMarkup, cardDetailHtml(registries, { cardId: id, instanceId: 'offer:0', upgraded: false }, { rules: run }));
    dialog.querySelector('.modal-close').click();
    assert.equal(app.querySelector('.reward-selected'), chosen, 'inspection preserves the selected face');
    assert.deepEqual({ run, offer }, before, 'reading cannot change XP, decks, claims, or offers');
    assert.deepEqual(calls, []);
  });
});

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
    // A relic or flask has no review stage (Confirm takes it, W2-E: two clicks from choice to what follows); cards and equipment keep it.
    const reviewed = !['relics', 'potions'].includes(kind);
    for (const stage of reviewed ? ['selection', 'review'] : ['selection']) {
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
      mouseRightClick(chosen);
      const information = document.querySelector('.card-inspection-modal');
      assert.ok(information, `${stage} also keeps the face's shared Information door usable`);
      assert.equal(information.querySelector('.card-inspection-act'), null);
      information.querySelector('.modal-close').click();
      assert.equal(app.querySelector('.reward-selected'), chosen, 'inspection preserves the selected face');
      assert.deepEqual([...app.querySelector('.modal-foot-actions').children].map(button => button.textContent), labels, 'closing preserves the stage and actions');
      assert.deepEqual({ run, offer }, before, 'reading cannot change XP, decks, claims, or offers');
      assert.deepEqual(calls, []);
    }
    if (reviewed) {
      assert.equal(confirm.textContent, 'Continue');
      assert.equal(app.querySelector('.reward-pick').disabled, true, 'review choices stay locked');
    } else assert.equal(confirm.textContent, 'Confirm', 'a relic or flask is taken by Confirm itself');
    confirm.click();
    assert.deepEqual(calls, ['take']);
    assert.equal(app.querySelector('.reward-confirm-status').textContent, 'save refused');
    assert.equal(inspect.disabled, false, 'a refused save keeps inspection available');
    inspect.click(); document.querySelector('.card-inspection-modal .modal-close').click();
    assert.deepEqual(calls, ['take'], 'reading after a refusal does not retry the claim');
    assert.deepEqual({ run, offer }, before);
    if (reviewed) {
      app.querySelector('#reward-continue').click();
      assert.equal(confirm.textContent, 'Confirm');
      assert.equal(app.querySelector('.reward-pick').disabled, false);
    }
  });
});

test('Right-click reads an unchosen or already taken reward without choosing it', () => {
  withInspectionDom(() => {
    const { app, run, offer, calls } = mount('weapons', weapon.id);
    const before = structuredClone({ run, offer });
    const faces = app.querySelectorAll('.reward-choice-face');
    rightClick(faces[0]);
    document.querySelector('.card-inspection-modal .modal-close').click();
    assert.equal(app.querySelector('#reward-card-confirm').disabled, true);
    app.querySelectorAll('.reward-pick')[1].click();
    rightClick(faces[0]);
    document.querySelector('.card-inspection-modal .modal-close').click();
    assert.equal(app.querySelectorAll('.reward-pick')[1].getAttribute('aria-checked'), 'true');
    assert.deepEqual({ run, offer }, before); assert.deepEqual(calls, []);
    app.remove();
    const taken = mount('weapons', weapon.id);
    taken.offer.taken.push(0);
    // Rebuild against the taken option using the same production renderer.
    MountGameProfileOffers(taken.app, { registries, run: taken.run, offer: taken.offer, title: 'Rewards', onTake() { throw new Error('must not claim'); }, onContinue() {} });
    assert.equal(taken.app.querySelector('.reward-pick').disabled, true);
    rightClick(taken.app);
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

test('pending claims lock the strip and failed saves and exits leave the door ready to retry', async () => {
  await withInspectionDom(async () => {
    globalThis.HTMLElement ??= class HTMLElement {};
    let rejectClaim, resolveClaim, takes = 0, exits = 0;
    const { app, run, offer } = mount('combatCards', 'frostNova', {
      onTake() {
        takes++;
        return new Promise((resolve, reject) => { resolveClaim = resolve; rejectClaim = reject; });
      },
      onContinue() { exits++; if (exits === 1) throw new Error('exit refused'); },
    });
    const before = structuredClone({ run, offer });
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    const strip = () => app.querySelector('.reward-row');
    app.querySelector('.reward-pick').click();
    app.querySelector('#reward-card-confirm').click();
    document.querySelector('.confirmation-confirm').click();
    assert.equal(takes, 1); assert.equal(strip().inert, true, 'the strip is locked while saving');
    assert.equal(app.querySelector('#reward-card-confirm').disabled, true);
    rejectClaim(new Error('save refused'));
    await tick();
    assert.equal(takes, 1); assert.equal(exits, 0);
    assert.equal(app.querySelector('.reward-confirm-status').textContent, 'save refused');
    assert.notEqual(strip().inert, true, 'a refused save frees the door');
    assert.equal(app.querySelector('#reward-card-confirm').disabled, false);
    assert.deepEqual({ run, offer }, before);
    app.querySelector('.reward-pick').click();
    app.querySelector('#reward-card-confirm').click();
    document.querySelector('.confirmation-confirm').click();
    assert.equal(takes, 2);
    offer.taken.push(0); offer.claimed = 0; resolveClaim(offer);
    await tick();
    assert.equal(exits, 1);
    assert.equal(app.querySelector('.reward-confirm-status').textContent, 'exit refused');
    assert.notEqual(strip().inert, true, 'an exit save refusal frees the door');
    app.querySelector('#reward-card-confirm').click();
    await tick();
    assert.equal(document.querySelector('.confirmation-modal'), null, 'the exit retry asks nothing again');
    assert.equal(takes, 2, 'exit retry must not repeat the claim'); assert.equal(exits, 2);
    assert.equal(strip().inert, true, 'a finished door stays locked');
    await new Promise(resolve => setTimeout(resolve, 800));
  });
});

// A skill rank-up opens the shared card-upgrade picker (playtest 2026-11-17 item 45a; its old review stage is gone, item
// 36). Its save door still holds: a refused save raises nothing and leaves the row open, and the retry lands once.
test('a skill rank-up from the card-upgrade picker survives a refused save and lands once on retry', () => {
  withInspectionDom(() => {
    document.body.classList.add('reduced-motion');
    const run = createRunState({ seed: 21, classId: 'reaver', registries: legacyRegistries });
    run.skills['item:blade'] = { level: 2, xp: 0, pendingDrafts: 0, pendingRankUps: 1 };
    run.deck = [{ instanceId: 'inspect-rend', cardId: 'gorefireSlash', upgraded: false }];
    const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
    const checkpoint = { states: {} };
    let refuse = true, writes = 0;
    MountRewards(app, { registries: legacyRegistries, run, checkpoint, onDone() {},
      rewards: { skillRankUps: [{ skillId: 'item:blade', level: 2, claimOrdinal: 0 }] },
      onPersist() { writes++; return !refuse; } });
    const pickAndConfirm = () => {
      app.querySelector('[data-kind="skillRankUp"]').click();
      document.querySelector('.card-upgrade-row[data-instance-id="inspect-rend"]').click();
      assert.ok(document.querySelector('.card-upgrade-faces'), 'the before and after faces show under the chosen card');
      document.querySelector('.card-upgrade-confirm').click();
    };
    pickAndConfirm();
    assert.equal(writes, 1);
    assert.equal(run.deck[0].rank, undefined, 'a refused save raises nothing');
    assert.equal(app.querySelector('[data-kind="skillRankUp"]').dataset.state, 'pending', 'and the row stays open');
    refuse = false;
    pickAndConfirm();
    assert.equal(writes, 2);
    assert.equal(run.deck[0].rank, 1); // an unranked card rises to Rank 1 (owner 2026-11-23)
    assert.equal(Object.values(checkpoint.states).filter(state => state === 'taken').length, 1);
    assert.equal(document.querySelector('.card-upgrade-modal'), null, 'the picker closed on the commit');
  });
});


test('shared reward DOM replaces only the frame when outerHTML repaints a face', () => {
  withInspectionDom(() => {
    const card = document.createElement('div');
    const before = document.createElement('span'); before.id = 'before';
    const frame = document.createElement('span'); frame.id = 'frame';
    const info = document.createElement('button'); info.id = 'information';
    let opens = 0; info.addEventListener('click', () => { opens++; });
    card.append(before, frame, info); document.body.append(card);
    frame.outerHTML = '<span id="replacement"><b id="detail"></b></span><span id="extra"></span>';
    assert.deepEqual(card.children.map(node => node.id), ['before', 'replacement', 'extra', 'information']);
    assert.equal(frame.parentNode, null); assert.equal(frame.isConnected, false);
    const replacement = card.querySelector('#replacement');
    assert.equal(replacement.parentNode, card);
    assert.equal(replacement.querySelector('#detail').parentNode, replacement);
    assert.equal(card.querySelector('#information'), info); info.click(); assert.equal(opens, 1);
    frame.outerHTML = '<span id="detached"></span>';
    assert.equal(card.querySelector('#detached'), null, 'setting outerHTML on a detached node is a no-op');
  });
});
