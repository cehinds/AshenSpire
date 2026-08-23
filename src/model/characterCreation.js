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
  const rawClasses = source && source.classes;
  const classes = rawClasses && typeof rawClasses.ids === 'function'
    ? source.classes.ids().map((id) => source.classes.get(id))
    : (Array.isArray(rawClasses) ? rawClasses : []);
  const equipment = (source && source.equipment) || {};
  const rawRelics = source && source.relics;
  const relics = rawRelics && typeof rawRelics.ids === 'function'
    ? source.relics.ids()
    : (Array.isArray(rawRelics) ? rawRelics : []).filter((row) => row && typeof row === 'object').map((row) => row.id);
  const classIds = new Set(classes.filter((row) => row && typeof row === 'object').map((row) => row.id));
  const relicIds = new Set(relics);
  const armaments = Array.isArray(equipment.armaments) ? equipment.armaments : [];
  const armour = Array.isArray(equipment.armour) ? equipment.armour : [];
  const armamentIds = new Set(armaments
    .filter((row) => row && typeof row === 'object')
    .map((row) => row.id));
  for (const [classId, row] of Object.entries(cfg.classes)) {
    const path = `characterCreation.classes.${classId}`;
    if (!classIds.has(classId)) problems.push(`${path}: unknown class`);
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      problems.push(`${path}: must be an object`);
      continue;
    }
    for (const key of Object.keys(row)) if (!CLASS_FIELDS.includes(key)) problems.push(`${path}.${key}: Unknown field`);
    for (const field of CLASS_FIELDS) {
      const values = row[field];
      if (!Array.isArray(values) || values.length < 2) {
        problems.push(`${path}.${field}: must contain at least two choices`);
        continue;
      }
      if (new Set(values).size !== values.length) problems.push(`${path}.${field}: contains duplicate ids`);
    }
    const armourIds = Array.isArray(row.armourIds) ? row.armourIds : [];
    const handIds = Array.isArray(row.handIds) ? row.handIds : [];
    const configuredRelicIds = Array.isArray(row.relicIds) ? row.relicIds : [];
    for (const id of armourIds) {
      if (!armour.some((piece) => piece && piece.classId === classId && piece.id === id)) {
        problems.push(`${path}.armourIds: unknown armour '${id}' for '${classId}'`);
      }
    }
    for (const id of handIds) if (!armamentIds.has(id)) problems.push(`${path}.handIds: unknown armament '${id}'`);
    for (const id of configuredRelicIds) if (!relicIds.has(id)) problems.push(`${path}.relicIds: unknown relic '${id}'`);
    const baselineKit = (Array.isArray(equipment.startingKits) ? equipment.startingKits : [])
      .find((candidate) => candidate && candidate.classId === classId && candidate.baseline === true);
    for (const slotId of ['leftHand', 'rightHand']) {
      const id = baselineKit && baselineKit[slotId];
      if (id && !handIds.includes(id)) problems.push(`${path}.handIds: must include baseline ${slotId} armament '${id}'`);
    }
    const cls = classes.find((candidate) => candidate && candidate.id === classId);
    if (cls && !configuredRelicIds.includes(cls.startingRelic)) problems.push(`${path}.relicIds: must include class starting relic '${cls.startingRelic}'`);
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

function fitsCreationHandSlot(registries, slotId, piece) {
  if (!slotId) return true;
  const slot = (registries.equipment.slots || []).find((row) => row.id === slotId);
  if (!slot || !piece || !(slot.kinds || []).includes(piece.kind)) return false;
  return !piece.hand || piece.hand === 'either' || piece.hand === slot.hand;
}

export function creationHandChoices(registries, classId, slotId = null) {
  const ids = classCreationConfig(registries, classId).handIds;
  return ids
    .map((id) => (registries.equipment.armaments || []).find((row) => row.id === id))
    .filter((piece) => fitsCreationHandSlot(registries, slotId, piece));
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
  for (const [hand, id] of Object.entries(result)) {
    if (!id) continue;
    if (!allowed.has(id)) throw new Error(`${hand}: starting armament '${id}' is unavailable to class '${classId}'`);
    const piece = (registries.equipment.armaments || []).find((row) => row.id === id);
    if (!fitsCreationHandSlot(registries, hand, piece)) throw new Error(`${hand}: starting armament '${id}' does not fit this hand`);
  }
  return result;
}

export function resolveCreationRelic(registries, classId, requestedId) {
  const cls = registries.classes.get(classId);
  const id = requestedId || cls.startingRelic;
  if (!classCreationConfig(registries, classId).relicIds.includes(id)) throw new Error(`starting relic '${id}' is unavailable to class '${classId}'`);
  return registries.relics.get(id);
}
