// src/content/itemProperties.js — the Blacksmith's item-upgrade numbers and the property pool, as data
// (content/source/itemProperties.json, generated into ./generated/itemProperties.js). The model code in
// src/model/smithUpgrade.js and src/model/itemProperties.js only interprets these rows; it invents no number.
import { itemProperties as source } from './generated/itemProperties.js';

export const ITEM_SMITH = Object.freeze(source.smith);
export const ITEM_STAT_OPTIONS = Object.freeze(source.statOptions);
export const ITEM_SMITH_BEFORE_STAT_POINTS = Object.freeze(source.smithBeforeStatPoints);
export const ITEM_STAT_OPTIONS_BEFORE_STAT_POINTS = Object.freeze(source.statOptionsBeforeStatPoints);
export const ITEM_WEAPON_CATEGORIES = Object.freeze(source.weaponCategories);
export const ITEM_PROPERTIES = Object.freeze(source.properties);
export const ITEM_CATEGORY_CHANGE = Object.freeze(source.categoryChange || {});
