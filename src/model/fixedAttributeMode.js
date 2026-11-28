// The creation rules a configured (fixed-attribute) class is judged by on load: baseline and minimum at
// the class's configured attribute floor, the rest of its authored total as the bonus pool.
import { characterRule } from '../../engine/kernel/gameConfig.js';
import { gameContent, gameModule } from './gameProfile.js';

// Profiles saved before the characters module carried a floor started every attribute at 1.
const LEGACY_ATTRIBUTE_FLOOR = 1;
const CHARACTERS_MODULE = 'characters';

function classCharacterRow(subject, classId)
{
  const characters = gameContent(subject, 'characters') || [];
  return characters.find(row => row.id === classId) || null;
}

function configuredAttributeFloor(subject, classId)
{
  const settings = gameModule(subject, CHARACTERS_MODULE);
  const row = classCharacterRow(subject, classId);
  if (!settings || !row)
  {
    return LEGACY_ATTRIBUTE_FLOOR;
  }
  const tagFloor = characterRule(row, settings).attributeFloor;
  return tagFloor ?? settings.attributeFill?.floor ?? LEGACY_ATTRIBUTE_FLOOR;
}

export function FixedAttributeModeRules(subject, classId, fixedAttributes)
{
  const values = Object.values(fixedAttributes);
  const total = values.reduce((sum, value) => sum + value, 0);
  const floor = configuredAttributeFloor(subject, classId);
  return {
    baseline: floor,
    bonusPool: total - floor * values.length,
    minimum: floor,
    maximum: Math.max(...values),
  };
}
