// Registry-free validation keeps save shape checks independent of mutations.
export function learnedClassIds(run) {
  return [...new Set([run.class, ...Object.keys(run.classCards || {})])];
}

export function learnClassCard(registries, run, classId) {
  if (!registries.classes.has(classId)) throw new Error('Unknown class card.');
  if (learnedClassIds(run).includes(classId)) throw new Error('This class is already learned.');
  run.classCards = { ...run.classCards, [classId]: { coreTags: [] } };
}

export function classLibraryProblems(run) {
  const out = [];
  if (run.classUnequipped !== undefined && typeof run.classUnequipped !== 'boolean') out.push('classUnequipped must be a boolean');
  if (run.bookReadRevision !== undefined && (!Number.isSafeInteger(run.bookReadRevision) || run.bookReadRevision < 0)) out.push('bookReadRevision must be a non-negative integer');
  if (run.classCards === undefined) return out;
  if (!run.classCards || typeof run.classCards !== 'object' || Array.isArray(run.classCards)) return [...out, 'classCards must be an object'];
  for (const [id, row] of Object.entries(run.classCards)) {
    const at = `classCards.${id}`;
    if (!id || !row || typeof row !== 'object' || Array.isArray(row)) { out.push(`${at} must be a class card`); continue; }
    if (!Array.isArray(row.coreTags) || row.coreTags.some((tag) => typeof tag !== 'string' || !tag) || new Set(row.coreTags).size !== row.coreTags.length) out.push(`${at}.coreTags must be unique node ids`);
    if (row.armour !== undefined && (!Array.isArray(row.armour) || row.armour.some((value) => value !== null && (typeof value !== 'string' || !value)))) out.push(`${at}.armour must be armour ids or null`);
    if (row.activeArmour !== undefined && (!Number.isSafeInteger(row.activeArmour) || row.activeArmour < 0 || !row.armour || row.activeArmour >= row.armour.length)) out.push(`${at}.activeArmour must index its armour sets`);
    for (const key of Object.keys(row)) if (!['coreTags', 'armour', 'activeArmour'].includes(key)) out.push(`${at}.${key} is not a class card field`);
  }
  return out;
}
