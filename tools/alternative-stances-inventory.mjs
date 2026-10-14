import { ARMOUR } from '../src/content/equipment.js';
import { contentBundle } from '../src/content/index.js';
import { ENEMY_POSES } from '../src/content/enemyArt.js';
import { alternativeArtCatalog } from '../src/ui/alternativeArtCatalog.js';

export function stanceInventory() {
  const players = ARMOUR.map(piece => ({
    id: `${piece.classId}-${piece.id}`, classId: piece.classId, armourId: piece.id,
    name: `${piece.name} · ${piece.classId}`, canonicalId: `armor/${piece.classId}/${piece.id}`,
    legacyAlias: `${piece.artClassId || piece.classId}-${piece.artKey || piece.id}`,
  }));
  const enemies = contentBundle.enemies.map(enemy => ({ id: enemy.id, name: enemy.name,
    canonicalId: `enemy/${enemy.id}`, hasPoseSource: ENEMY_POSES.includes(enemy.id),
    hasAlternativeIdle: !!alternativeArtCatalog.sprites[enemy.id] }));
  return { players, enemies };
}
if (process.argv[1]?.endsWith('alternative-stances-inventory.mjs')) console.log(JSON.stringify(stanceInventory(), null, 2));
