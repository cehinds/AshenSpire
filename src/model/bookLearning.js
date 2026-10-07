// Books teach across class pools. Reading is atomic: cancel spends nothing;
// confirming rechecks the selected lesson and awards XP and one lesson together.
import { skillTracks, skillLevel, rarityUnlockedAt } from './skills.js';

/** The lesson preview: the card as it joins, plain — a level no longer upgrades cards (SPEC §13.4o). */
export function bookLessonCard(registries, run, def, skillId, cardId) {
  return { cardId, upgraded: false };
}

export function bookTracks(registries, def) {
  return skillTracks(registries).filter((track) => def.skill === '*' || track.id === def.skill);
}

/** Legacy books derive schools from content, independent of held equipment. */
export function bookTags(registries, def, skillId = def.skill) {
  if (Array.isArray(def.learnTags)) return def.learnTags;
  if (def.learnAny || def.learnClass) return [];
  const schools = new Set((registries.nodes || []).filter((node) => node.parentId === 'card').map((node) => node.id));
  const pieces = (registries.equipment?.armaments || []).filter((piece) =>
    skillId === 'dualWield' ? (piece.weaponCardPackage?.handsRequired ?? piece.handsRequired ?? 1) === 1 : (piece.itemTypeTags || []).includes(skillId));
  return [...new Set(pieces.flatMap((piece) => (piece.tags || []).filter((tag) => schools.has(tag))))];
}

/** Current class and equipped weapons never restrict a book's lesson pool. */
export function bookLessons(registries, run, def, skillId = def.skill) {
  registries = registries.masterySource || registries;
  if (!bookTracks(registries, def).some((track) => track.id === skillId)) return [];
  const choices = [];
  if (def.learnClass || def.learnAny) {
    const known = new Set([run.class, ...Object.keys(run.classCards || {})]);
    for (const cls of registries.classes.all()) {
      if (def.learnClass === cls.id || (def.learnAny && !known.has(cls.id))) {
        choices.push({ kind: 'class', id: cls.id, name: cls.name });
      }
    }
    if (def.learnClass) return choices;
  }
  const tags = bookTags(registries, def, skillId);
  const rarities = new Set(rarityUnlockedAt(registries, Math.max(1, skillLevel(run, skillId))));
  // The union of authored reward pools excludes equipment-only and internal cards.
  const ids = new Set(registries.classes.all().flatMap((cls) => cls.cardPool));
  for (const id of ids) {
    const card = registries.cards.get(id);
    if (!card || !rarities.has(card.rarity)) continue;
    if (!def.learnAny && !(card.tags || []).some((tag) => tags.includes(tag))) continue;
    choices.push({ kind: 'card', id, name: card.name });
  }
  return choices;
}
