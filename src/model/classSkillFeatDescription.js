// Class feat text is projected from the same bindings its mounted rules read.
// Legacy critical-hit and passive feats retain their authored descriptions.
import { nodeTokens } from './tree.js';

export function getFeatDescription(registries, featOrId) {
  const feat = typeof featOrId === 'string'
    ? registries.classSkillFeats?.find(row => row.id === featOrId) : featOrId;
  if (!feat) return '';
  const tags = feat.propertyTags || (registries.tagging || []).filter(row => row.family === 'feat' && row.objectId === feat.id).map(row => row.tagId);
  const sentences = tags.map(tag => {
    const rules = registries.propertyRules;
    const rule = Array.isArray(rules) ? rules.find(row => row.tag === tag) : rules?.has(tag) ? rules.get(tag) : null;
    if (!rule?.textTemplate) return '';
    const values = nodeTokens(registries, tag);
    return rule.textTemplate.replace(/\{([\w.]+)\}/g, (token, key) => Number.isFinite(values[key]) ? String(values[key]) : token);
  }).filter(Boolean);
  return sentences.join(' ') || feat.description || '';
}
