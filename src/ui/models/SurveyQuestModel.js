import { surveyQuestLore } from '../../content/surveyQuestLore.js';

// Only presentation is projected. The original row and saved journey are never
// changed; the quest action still owns availability, payment and completion.
export function surveyQuestPresentation(quest, journey, lore = surveyQuestLore) {
  const writing = lore[quest.questId];
  const reported = journey?.questStates?.[quest.questId] === 'claimed';
  return {
    title: writing?.title ?? quest.displayName,
    text: (reported ? writing?.report : writing?.description) ?? quest.description,
  };
}
