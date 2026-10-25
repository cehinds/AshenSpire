// src/content/progression/feats.js — the feat rows and their unlock gates are authored in
// content/source/progressionFeatRows.json and content/source/progressionFeatUnlocks.json;
// content-build compiles them to src/content/generated/. Edit the JSON, not the rows here.
// Fifty class feats. Their descriptions and effects share normalized balance bindings.
// Stays JS: each feat's description is derived (getFeatDescription) from the
// balance, property rules, tagging and variable bindings, so it is computed
// here from the generated rows rather than written as text in the JSON.
import { balance } from '../balance.js';
import { PROPERTY_RULES } from '../propertyRules.js';
import { TAGGING } from '../tags.js';
import { nodeVariables } from '../generated/nodeVariables.js';
import { variableBindings } from '../generated/variableBindings.js';
import { progressionFeatRows as featRows } from '../generated/progressionFeatRows.js';
import { progressionFeatUnlocks as featUnlockRows } from '../generated/progressionFeatUnlocks.js';
import { getFeatDescription } from '../../model/classSkillFeatDescription.js';

const authored = { balance, propertyRules: PROPERTY_RULES, tagging: TAGGING, nodeVariables, variableBindings };
export const progressionFeats = Object.freeze(featRows.map(feat => ({
  ...feat, description: getFeatDescription(authored, feat),
})));

export const progressionFeatUnlocks = Object.freeze(featUnlockRows);
