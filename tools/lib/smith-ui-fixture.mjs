// The real current-profile reach door, projected through the production Smith
// plan/commit. This is deliberately independent of whichever profile is default.
import { contentBundle } from '../../src/content/index.js';
import { createRegistries, resolveCard } from '../../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../../src/model/gameProfile.js';
import { createRunState, createDeck, createIdGen } from '../../src/model/state.js';
import { smithingPlan, commitSmithing } from '../../src/model/smithing.js';
import { smithSelectionModel } from '../../src/ui/models/SmithSelectionModel.js';

export function smithUiFixture() {
  const profile = resolveGameProfile('current');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 211, gameProfile: profile });
  run.floor = 8;
  run.deck.push(...createDeck(registries.classes.get(run.class).cardPool.slice(0, 10), createIdGen('shot')));
  run.smithingStones = 1;
  const plan = smithingPlan(registries, run);
  const selected = smithSelectionModel(registries, plan, 'armament/straightSword').properties.selected;
  const receipt = commitSmithing(registries, run, selected.itemRef);
  const cards = receipt.affectedCards.map(row => {
    const inst = run.deck.find(card => card.instanceId === row.instanceId);
    if (!inst) throw new Error(`Missing committed Smith card ${row.instanceId}`);
    const card = resolveCard(registries, inst);
    return { instanceId: inst.instanceId, cardId: card.id, name: card.name,
      values: card.effects.filter(effect => ['damage', 'block'].includes(effect.op)).map(effect => ({ op: effect.op, value: effect.amount })) };
  });
  return { selected, receipt, cards };
}

const valueLabel = value => value.label || ({ damage: 'DAMAGE', block: 'GUARD' })[value.op] || value.op;
export function matchesSmithRows(rows, expected) {
  return rows.length === expected.length && expected.every(want => {
    const row = rows.find(item => item.title === want.name);
    return row && !row.open && row.unused === !want.used
      && row.role === `${want.role} · ${want.used ? `${want.activeCopies} active` : 'not in active deck'}`
      && (want.used || row.opacity < .6)
      && want.values.every(value => row.values.some(actual => actual.label === valueLabel(value)
        && actual.before === String(value.before) && actual.after === String(value.after)));
  });
}

// Use the actual text/number bounds, not only a potentially clipped row box.
// Vertical scrolling is allowed; clipping at a horizontal ancestor is not.
export function smithTextFits(samples) {
  return samples.length > 0 && samples.every(row => row.width > 0 && row.height > 0
    && row.left >= row.clipLeft - 1 && row.right <= row.clipRight + 1);
}

export function matchesCommittedCards(rows, expected) {
  return expected.length > 0 && expected.every(want => {
    const actual = rows.find(row => row.instanceId === want.instanceId);
    return actual && actual.cardId === want.cardId && actual.name === want.name
      && want.values.length > 0 && want.values.every(value => actual.values.some(line =>
        line.kind === (value.op === 'block' ? 'gain' : value.op) && line.values.includes(String(value.value))));
  });
}
