import { RetreatRulesActive } from './fixCoreMechanics.js';

/** Re-select authored face fields before upgrades; both faces survive registry binding. */
export function ProjectRetreatRuleFace(definition, context) {
  const faces = definition?.retreatRuleFaces;
  if (!faces) return definition;
  return { ...definition, ...faces[RetreatRulesActive(context) ? 'current' : 'legacy'] };
}
