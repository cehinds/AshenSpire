import { openCardChoiceModal } from './cardChoiceModal.js';
import { upcastOptions } from '../../model/upcasting.js';

export function upcastChoicePlan(definition) {
  const base = definition.upcast?.baseTier ?? 0;
  return { kind: 'upcast', options: [
    { id: String(base), name: `Base tier ${base}`, tooltip: 'Use the printed card and its normal cost.' },
    ...upcastOptions(definition).map(option => ({ id: String(option.tier), name: `Upcast tier ${option.tier} (+${option.tier - base})`,
      tooltip: `Costs +${option.stamina} SP and +${option.mana} Mana. Bonuses apply only to this play.` })),
  ] };
}
export function openUpcastChoice({ definition, opener, onChoose, onClosed }) {
  return openCardChoiceModal({ cardName: definition.name, opener, onClosed,
    plan: upcastChoicePlan(definition), onChoose: id => onChoose(Number(id)) });
}
