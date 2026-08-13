// One read model for character stats on every non-combat comparison surface.
// It exposes calculation receipts; screens choose layout, never redo formulas.

import { deriveStat } from './derivedStats.js';

const LABELS = Object.freeze({
  hp: 'HP',
  mana: 'Mana',
  stamina: 'Stamina',
  energy: 'Energy / turn',
  draw: 'Draw / turn and opening hand',
});

export function statProjection(registries, run) {
  const snapshot = run && run.derivedStatRuleSnapshot;
  if (!snapshot || !snapshot.rules) throw new Error('statProjection requires a run with a derived-stat rules snapshot');
  const classDef = registries.classes.get(run.class);
  const attributes = registries.attributes.all()
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((def) => ({ ...def, value: run.attributes[def.id] }));
  const derived = ['hp', 'mana', 'stamina', 'energy', 'draw'].map((id) => {
    const receipt = deriveStat(snapshot.rules, id, { attributes: run.attributes, classDef });
    const equipmentBonus = id === 'hp' ? Math.max(0, run.maxHp - receipt.value) : 0;
    const value = receipt.value + equipmentBonus;
    return {
      ...receipt,
      label: LABELS[id],
      value,
      equipmentBonus,
      formula: `${receipt.base} + ${receipt.tier} tier × ${receipt.gainPerTier}`
        + `${equipmentBonus ? ` + ${equipmentBonus} gear` : ''} = ${value}`,
      note: id === 'stamina' ? 'No current consumer' : id === 'draw' ? 'The current engine uses this for turn 1 and every later turn.' : '',
    };
  });
  return { classId: run.class, rulesetVersion: snapshot.rulesetVersion, attributes, derived };
}
