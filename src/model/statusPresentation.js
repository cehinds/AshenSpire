import { fixCoreStatusDefinition } from './fixCoreMechanics.js';

// UI wording is separate from the versioned mechanic source: changing a label
// must not invalidate saved rules. Keep all configured numeric prose intact.
export function statusPresentationDefinition(ctx, id, definition, holder = null) {
  const resolved = fixCoreStatusDefinition(ctx, id, definition, holder);
  if (id !== 'evade' || resolved === definition) return resolved;
  const display = text => typeof text === 'string' ? text.replace(/\bfixed Evasion\b/g, 'Evasion') : text;
  return { ...resolved, tooltip: display(resolved.tooltip), description: display(resolved.description) };
}
