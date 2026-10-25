// Player-facing survey writing. Authored in content/source/surveyQuestLore.json
// (notes in content/source/CONTENT-NOTES.md, "Survey quest lore"); content-build
// compiles it to src/content/generated/surveyQuestLore.js. Edit the JSON.
import { surveyQuestLore as authoredSurveyQuestLore } from './generated/surveyQuestLore.js';

// Frozen at both depths, as it was authored: the table and each quest entry.
export const surveyQuestLore = Object.freeze(Object.fromEntries(
  Object.entries(authoredSurveyQuestLore).map(([id, lore]) => [id, Object.freeze(lore)]),
));
