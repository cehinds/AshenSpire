import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { bindCardInspection, openBoundCardInspection } from '../src/ui/components/cardInspection.js';
import { cardDetailHtml, relicText } from '../src/ui/components/card.js';

const registries = createRegistries(contentBundle);
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
