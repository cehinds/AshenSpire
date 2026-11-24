// src/content/gearTypes.js — the equipment type table (content/source/equipmentTypes.json, compiled to ./generated/equipmentTypes.js).
// Types, armour groups, selectors and conditions are data; src/model/gearEffects.js only interprets them.
import { equipmentTypes as source } from './generated/equipmentTypes.js';

export const GEAR_TYPES = Object.freeze(source);
