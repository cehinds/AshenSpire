// Dodge Roll and Evasive Guard as they shipped before W25-EvadeCards: Dodge Roll a flat 3 Block / 3 Poise / 3 Ward priced by Weight Class,
// Evasive Guard 1 Block plus the `dodgeRoll` roll op. The flat-guard and dodge-roll engine paths still exist; their tests run against this explicit fixture.
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';

const strip = card => { const out = { ...card }; for (const key of ['choiceModes', 'upgrade', 'singleBreak', 'gradeProfiles']) delete out[key]; return out; };
export const legacyDodgeRoll = () => ({
  ...strip(contentBundle.cards.find(card => card.id === 'dodgeRoll')), weightClassPriced: true,
  effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'gainPoise', target: 'self', amount: 3 }, { op: 'gainWard', target: 'self', amount: 3 }],
  textTemplate: 'Gain {block} Block, {gainPoise} Poise and {gainWard} Ward. Light: 1 Stamina. Medium: 1 Stamina. Heavy: 2 Stamina.',
  singleBreak: { effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'gainPoise', target: 'self', amount: 3 }],
    textTemplate: 'Gain {block} Block and {gainPoise} Poise guard. Light: 1 Stamina. Medium: 1 Stamina. Heavy: 2 Stamina.' },
});
export const legacyEvasiveGuard = () => ({
  ...strip(contentBundle.cards.find(card => card.id === 'evasiveGuard')),
  effects: [{ op: 'block', target: 'self', amount: 1 }, { op: 'dodgeRoll', target: 'self' }],
  textTemplate: 'Gain {block} Block, then roll to evade: on a success, gain Block equal to the dodge.',
  upgrade: { effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'dodgeRoll', target: 'self' }] },
});
export const legacyDodgeBundle = () => ({ ...contentBundle, cards: contentBundle.cards.map(card =>
  card.id === 'dodgeRoll' ? legacyDodgeRoll() : card.id === 'evasiveGuard' ? legacyEvasiveGuard() : card) });
export const legacyDodgeRegistries = () => createRegistries(legacyDodgeBundle());
