// src/content/statuses.js — the authored rows are content/source/statuses.json
// (content-build compiles them to src/content/generated/statuses.js); the
// expansion rows are derived in combatStatusRules.js and joined here.
import { statuses as authored } from './generated/statuses.js';
import { expansionStatuses } from './combatStatusRules.js';
export const statuses = [...authored, ...expansionStatuses];
