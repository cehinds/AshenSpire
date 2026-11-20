// SPEC §13.4q: the identity of a mastery unlock row. The rows themselves
// (content classMastery) gate which class cards an ability offer can draw.
export const masteryRowId = row => `${row.classId}:${row.level}:${row.kind}:${row.ref}`;
