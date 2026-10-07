import test from 'node:test';
import assert from 'node:assert/strict';
import { combatantMeterGeometry, meterRowSelectedOnly, METER_ROW_KINDS } from '../src/ui/models/CombatantMeterModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('rows keep their physical minimums at every UI zoom', () => {
  const config = wireframeUi.combatantMeters;
  for (const zoom of [0.67, 1, 1.5]) {
    const rem = 16 / zoom; // the reference rem: at least 16 physical px
    const m = combatantMeterGeometry({ zoom, rem });
    assert.ok(m.hp * zoom >= config.hpMinPx - 1e-9 && m.hp >= config.hpMinRem * rem - 1e-9, `hp at ${zoom}`);
    assert.ok(m.secondary >= m.hp * config.secondaryFraction - 1e-9, 'secondary is at least half HP');
    assert.ok(m.secondary >= config.secondaryMinRem * rem - 1e-9, 'secondary keeps its floor');
    assert.ok(m.stance >= m.hp - 1e-9, 'stance matches HP');
    assert.ok(near(m.valueText * zoom, config.valueTextPx), 'value text is 12 physical px');
  }
});

test('a larger root font grows the rows it is measured in', () => {
  const base = combatantMeterGeometry({ zoom: 1, rem: 16 });
  const large = combatantMeterGeometry({ zoom: 1, rem: 24 });
  assert.ok(large.hp > base.hp && large.secondary > base.secondary && near(large.stance, large.hp));
});

test('HP never waits for selection; the configured kinds do', () => {
  assert.equal(meterRowSelectedOnly('hp'), false);
  for (const kind of ['name', 'resource', 'buildup', 'stance']) assert.equal(meterRowSelectedOnly(kind), true, kind);
  const showAll = { ...wireframeUi.combatantMeters, selectedOnly: [] };
  assert.ok(METER_ROW_KINDS.every((kind) => meterRowSelectedOnly(kind, showAll) === false));
  assert.equal(meterRowSelectedOnly('hp', { ...showAll, selectedOnly: ['hp'] }), false, 'HP always shows');
  assert.throws(() => meterRowSelectedOnly('poise'), /Unknown meter row kind/);
});
