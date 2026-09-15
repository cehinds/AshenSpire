import test from 'node:test';
import assert from 'node:assert/strict';
import { runHudLayers, FOOTER_HUD_PLACES } from '../src/ui/models/RunHudLayerModel.js';
import { potionContents, potionCountStringId } from '../src/ui/models/PotionContentsModel.js';
import { runHudViewModel } from '../src/ui/viewModels/RunHudViewModel.js';
import { childModel, optionalChildModel, descendantModel } from '../src/ui/models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../src/ui/models/UiComponentId.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { t, tFull } from '../src/ui/strings.js';

const hudConfig = (layers = {}, potions = {}) => ({
  layers: { ...wireframeUi.hud.layers, ...layers },
  potions: { ...wireframeUi.hud.potions, ...potions },
});
const sample = (place, layers) => runHudViewModel({
  place, cinders: 120, act: 1, seat: 'The Pale Marches', actTotal: 3, floor: 4, floorTotal: 15, seed: 'S',
  identity: { className: 'Warden' }, controls: { armouryId: 'a', menuId: 'm', menuHint: 'Esc' },
  quickSettings: {}, ...(layers ? { layers } : {}),
});
const kids = (model) => model.children.map((child) => child.component);

test('WGH0 defaults draw every layer; only combat, which has a footer HUD, loses the potion tray', () => {
  assert.deepEqual(FOOTER_HUD_PLACES, ['combat']);
  const combat = runHudLayers('combat');
  for (const key of ['header', 'class', 'cinders', 'position', 'primary', 'vitality', 'controls', 'armoury', 'menu', 'rail', 'relics']) {
    assert.equal(combat[key], true, key);
  }
  assert.equal(combat.potions, false);
  for (const place of ['map', 'shop', 'rest', 'event']) assert.equal(runHudLayers(place).potions, true, place);
  assert.ok(Object.isFrozen(combat));
  assert.ok(Object.isFrozen(wireframeUi.hud.layers) && Object.isFrozen(wireframeUi.hud.potions));
});

test('the footer-only rule reaches the rooms through one config value', () => {
  for (const place of ['map', 'shop', 'rest', 'event', 'combat']) {
    assert.equal(runHudLayers(place, hudConfig({}, { roomRail: false })).potions, false, place);
  }
  assert.equal(runHudLayers('shop', hudConfig({}, { chargeFlasks: false, carried: false })).potions, false);
  assert.equal(runHudLayers('shop', hudConfig({}, { chargeFlasks: false })).potions, true);
});

test('group switches turn their whole row off', () => {
  const noHeader = runHudLayers('combat', hudConfig({ header: false }));
  assert.deepEqual([noHeader.header, noHeader.class, noHeader.cinders, noHeader.position], [false, false, false, false]);
  const noRail = runHudLayers('shop', hudConfig({ rail: false }));
  assert.deepEqual([noRail.rail, noRail.relics, noRail.potions], [false, false, false]);
  const noControls = runHudLayers('combat', hudConfig({ armoury: false, menu: false }));
  assert.deepEqual([noControls.controls, noControls.primary], [false, true]);
});

test('WGS2 one view model: combat has no potion tray, a room has one, and neither has flask siblings of Armoury/Menu', () => {
  const combat = sample('combat');
  const shop = sample('shop');
  assert.deepEqual(kids(combat), [UI.runHeaderStrip, UI.primaryHudRow, UI.inventoryBelt]);
  assert.deepEqual(kids(childModel(combat, UI.inventoryBelt)), [UI.relicTray]);
  assert.deepEqual(kids(childModel(shop, UI.inventoryBelt)), [UI.relicTray, UI.potionTray]);
  for (const model of [combat, shop]) {
    const quick = descendantModel(model, UI.quickAccessPanel);
    assert.deepEqual(kids(quick).filter((id) => id !== UI.panel), [UI.armouryControl, UI.quickMenuControl]);
  }
});

test('a layer that is off leaves no child, so no row, track or gap is reserved', () => {
  const layers = runHudLayers('combat', hudConfig({ header: false, armoury: false, relics: false }));
  const model = sample('combat', layers);
  assert.equal(optionalChildModel(model, UI.runHeaderStrip), null);
  assert.equal(optionalChildModel(model, UI.inventoryBelt), null);
  const quick = descendantModel(model, UI.quickAccessPanel);
  assert.equal(optionalChildModel(quick, UI.armouryControl), null);
  assert.ok(optionalChildModel(quick, UI.quickMenuControl));
  const positionOnly = sample('combat', runHudLayers('combat', hudConfig({ class: false, cinders: false })));
  assert.deepEqual(kids(childModel(positionOnly, UI.runHeaderStrip)), [UI.buildMetadataTrail]);
});

test('WGH7 / WGS3 header: labels are uiStrings rows, the seat is its own field', () => {
  const header = childModel(sample('shop'), UI.runHeaderStrip);
  assert.equal(childModel(header, UI.identityCluster).properties.label, t('hud.class'));
  const cinders = childModel(header, UI.cindersCounter);
  assert.equal(cinders.properties.label, t('hud.cinders'));
  assert.equal(cinders.accessibility.label, tFull('hud.cinders', { amount: 120 }));
  const trail = childModel(header, UI.buildMetadataTrail);
  const act = childModel(trail, UI.metadataField, 'act').properties;
  assert.deepEqual([act.label, act.value, act.detail], [t('hud.act'), 1, 'The Pale Marches']);
  assert.equal(childModel(trail, UI.metadataField, 'floor').properties.label, t('hud.floor'));
  assert.equal(trail.properties.label, t('hud.position'));
});

test('WGH8 one projection: charge flasks by kind, carried consumables grouped with counts', () => {
  const contents = potionContents({
    chargeKinds: ['hp', 'mana'],
    flaskCharges: { hpCurrent: 3, manaCurrent: 1 },
    carried: [{ flaskId: 'smoke' }, { flaskId: 'crimsonFlask' }, { flaskId: 'smoke' }],
  });
  assert.deepEqual(contents.entries.map((e) => [e.key, e.count, e.slots, e.useActionId]), [
    ['charge:hp', 3, [], 'flask1'],
    ['charge:mana', 1, [], 'flask2'],
    ['carried:smoke', 2, [0, 2], 'flask3'],
    ['carried:crimsonFlask', 1, [1], null],
  ]);
  assert.equal(contents.empty, false);
  assert.ok(Object.isFrozen(contents) && Object.isFrozen(contents.entries) && Object.isFrozen(contents.entries[2].slots));
});

test('WGH8 counts never invent a charge, and config hides a category without changing the other', () => {
  const dry = potionContents({ chargeKinds: ['hp', 'mana'], flaskCharges: { hpCurrent: -2, manaCurrent: Number.NaN }, carried: [] });
  assert.deepEqual(dry.entries.map((e) => e.count), [0, 0]);
  assert.equal(dry.empty, true);
  assert.deepEqual(potionContents({ chargeKinds: ['hp'], flaskCharges: null }).entries.map((e) => e.count), [0]);
  const snapshot = { chargeKinds: ['hp', 'mana'], flaskCharges: { hpCurrent: 2, manaCurrent: 1 }, carried: [{ flaskId: 'smoke' }] };
  assert.deepEqual(potionContents(snapshot, { chargeFlasks: false, carried: true }).entries.map((e) => e.key), ['carried:smoke']);
  assert.deepEqual(potionContents(snapshot, { chargeFlasks: true, carried: false }).entries.map((e) => e.key), ['charge:hp', 'charge:mana']);
  assert.deepEqual(potionContents({ carried: [null, { flaskId: '' }, { flaskId: 'smoke' }] }).entries.map((e) => e.slots), [[2]]);
});

test('WGH8 count copy agrees in number', () => {
  const [one, three] = [{ category: 'charge', count: 1 }, { category: 'charge', count: 3 }];
  assert.equal(t(potionCountStringId(one), { count: 1 }), '1 charge');
  assert.equal(t(potionCountStringId(three), { count: 3 }), '3 charges');
  assert.equal(t(potionCountStringId({ category: 'carried', count: 1 }), { count: 1 }), '1 carried potion');
  assert.equal(t(potionCountStringId({ category: 'carried', count: 2 }), { count: 2 }), '2 carried potions');
  assert.equal(tFull(potionCountStringId(three), { count: 3 }), '3 charges remaining');
});
