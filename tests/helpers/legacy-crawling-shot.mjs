// Crawling Shot as it shipped before W25-EvadeCards: a 4-damage shot that, while Prone, prepares one Evade with Advantage.
// The conditional-Advantage rules it exercised still exist in the engine; their tests run against this explicit fixture.
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';

export const legacyCrawlingShot = () => {
  const now = contentBundle.cards.find(card => card.id === 'crawlingShot');
  return { ...now, effects: [{ op: 'damage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage at Reach range. While Prone, prepare one Evade with Advantage.',
    evade: { charges: 1, bonus: 0, advantage: true, whileStatus: 'prone' } };
};
export const legacyCrawlingBundle = () => ({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'crawlingShot' ? legacyCrawlingShot() : card) });
export const legacyCrawlingRegistries = () => createRegistries(legacyCrawlingBundle());
