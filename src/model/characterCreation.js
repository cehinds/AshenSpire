// Pure character-creation configuration reads and validation.

const SIDES = Object.freeze(['left', 'right']);
const CLASS_FIELDS = Object.freeze(['armourIds', 'handIds', 'relicIds']);

function config(source) {
  return (source && source.characterCreation) || source || {};
}

export function characterCreationProblems(source) {
  const cfg = config(source);
  const problems = [];
  const allowedRoot = new Set(['spritePreviewSide', 'classes', 'keepsakes']);
  for (const key of Object.keys(cfg || {})) if (!allowedRoot.has(key)) problems.push(`characterCreation.${key}: Unknown field`);
  if (!SIDES.includes(cfg.spritePreviewSide)) problems.push(`characterCreation.spritePreviewSide: must be ${SIDES.join('|')}`);
  if (!cfg.classes || typeof cfg.classes !== 'object' || Array.isArray(cfg.classes)) {
    problems.push('characterCreation.classes: must be an object keyed by class id');
    return problems;
  }
  const classes = source && source.classes && typeof source.classes.ids === 'function'
    ? source.classes.ids().map((id) => source.classes.get(id))
    : (source && source.classes) || [];
  const equipment = (source && source.equipment) || {};
  const relics = source && source.relics && typeof source.relics.ids === 'function'
    ? source.relics.ids()
    : ((source && source.relics) || []).map((row) => row.id);
  const classIds = new Set(classes.map((row) => row.id));
  const relicIds = new Set(relics);
  const armamentIds = new Set((equipment.armaments || []).map((row) => row.id));
  for (const [classId, row] of Object.entries(cfg.classes)) {
    const path = `characterCreation.classes.${classId}`;
    if (!classIds.has(classId)) problems.push(`${path}: unknown class`);
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      problems.push(`${path}: must be an object`);
      continue;
    }
    for (const key of Object.keys(row)) if (!CLASS_FIELDS.includes(key)) problems.push(`${path}.${key}: Unknown field`);
    for (const field of CLASS_FIELDS) {
      const values = row && row[field];
      if (!Array.isArray(values) || values.length < 2) {
        problems.push(`${path}.${field}: must contain at least two choices`);
        continue;
      }
      if (new Set(values).size !== values.length) problems.push(`${path}.${field}: contains duplicate ids`);
    }
    for (const id of (row && row.armourIds) || []) {
      if (!(equipment.armour || []).some((piece) => piece.classId === classId && piece.id === id)) {
        problems.push(`${path}.armourIds: unknown armour '${id}' for '${classId}'`);
      }
    }
    for (const id of (row && row.handIds) || []) if (!armamentIds.has(id)) problems.push(`${path}.handIds: unknown armament '${id}'`);
    for (const id of (row && row.relicIds) || []) if (!relicIds.has(id)) problems.push(`${path}.relicIds: unknown relic '${id}'`);
    const cls = classes.find((candidate) => candidate.id === classId);
    if (cls && !(row.relicIds || []).includes(cls.startingRelic)) problems.push(`${path}.relicIds: must include class starting relic '${cls.startingRelic}'`);
  }
  for (const classId of classIds) if (!cfg.classes[classId]) problems.push(`characterCreation.classes: missing class '${classId}'`);
  const keepsakes = cfg.keepsakes;
  if (!Array.isArray(keepsakes) || keepsakes.length < 2) problems.push('characterCreation.keepsakes: must contain at least two choices');
  const seen = new Set();
  for (const row of Array.isArray(keepsakes) ? keepsakes : []) {
    const path = `characterCreation.keepsakes.${(row && row.id) || '?'}`;
    for (const key of Object.keys(row || {})) if (!['id', 'name', 'icon', 'desc', 'effects'].includes(key)) problems.push(`${path}.${key}: Unknown field`);
    if (!row || typeof row.id !== 'string' || !row.id) problems.push(`${path}.id: must be non-empty`);
    else if (seen.has(row.id)) problems.push(`${path}.id: duplicate keepsake id`);
    else seen.add(row.id);
    for (const key of ['name', 'icon', 'desc']) if (!row || typeof row[key] !== 'string' || !row[key]) problems.push(`${path}.${key}: must be non-empty`);
    if (!row || !Array.isArray(row.effects)) problems.push(`${path}.effects: must be an array`);
  }
  return problems;
}

export function classCreationConfig(registries, classId) {
  const row = config(registries).classes && config(registries).classes[classId];
  if (!row) throw new Error(`character creation has no configuration for class '${classId}'`);
  return row;
}

export function creationArmourChoices(registries, classId) {
  const ids = classCreationConfig(registries, classId).armourIds;
  return ids.map((id) => (registries.equipment.armour || []).find((row) => row.classId === classId && row.id === id));
}

export function creationHandChoices(registries, classId) {
  const ids = classCreationConfig(registries, classId).handIds;
  return ids.map((id) => (registries.equipment.armaments || []).find((row) => row.id === id));
}

export function creationRelicChoices(registries, classId) {
  return classCreationConfig(registries, classId).relicIds.map((id) => registries.relics.get(id));
}

export function selectStartingHand(current, targetHand, itemId) {
  if (!['leftHand', 'rightHand'].includes(targetHand)) throw new Error(`unknown starting hand '${targetHand}'`);
  const next = { leftHand: current.leftHand || null, rightHand: current.rightHand || null };
  const other = targetHand === 'leftHand' ? 'rightHand' : 'leftHand';
  if (itemId && next[other] === itemId) next[other] = null;
  next[targetHand] = itemId || null;
  return next;
}

export function resolveCreationHands(registries, classId, requested, fallback) {
  if (!requested) return { leftHand: fallback.leftHand || null, rightHand: fallback.rightHand || null };
  const allowed = new Set(classCreationConfig(registries, classId).handIds);
  const result = { leftHand: requested.leftHand || null, rightHand: requested.rightHand || null };
  if (result.leftHand && result.leftHand === result.rightHand) throw new Error(`starting armament '${result.leftHand}' cannot occupy both hands`);
  for (const [hand, id] of Object.entries(result)) if (id && !allowed.has(id)) throw new Error(`${hand}: starting armament '${id}' is unavailable to class '${classId}'`);
  return result;
}

export function resolveCreationRelic(registries, classId, requestedId) {
  const cls = registries.classes.get(classId);
  const id = requestedId || cls.startingRelic;
  if (!classCreationConfig(registries, classId).relicIds.includes(id)) throw new Error(`starting relic '${id}' is unavailable to class '${classId}'`);
  return registries.relics.get(id);
}
