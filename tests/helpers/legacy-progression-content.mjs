// Historical fixtures explicitly replay the content and progression contract
// captured before the modular expansion. Expanded behavior has its own tests.
import { composeProgressionContent } from '../../src/model/progressionContent.js';
import { contentBundle } from '../../src/content/index.js';
const legacyBase = {
  ...contentBundle, ...contentBundle.legacyProgression,
  legacyProgression: undefined,
  balance: { ...contentBundle.balance, progression: undefined },
};
export const legacyContentBundle = { ...composeProgressionContent(legacyBase, [], {
  rules: undefined, unlocks: legacyBase.classMastery, knownModules: [],
}), legacyProgression: undefined };
