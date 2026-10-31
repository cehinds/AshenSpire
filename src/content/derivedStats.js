// src/content/derivedStats.js — shipping authority for derived-stat rules, authored in
// content/source/derivedStatRules.json; content-build compiles it to
// src/content/generated/derivedStatRules.js. Edit the JSON, not this file. The comments that
// lived here are in content/source/CONTENT-NOTES.md, under "Derived stats".
//
// The content registry validates this table, and run creation snapshots its resolved rules so
// saves, sessions, and co-op keep the same derived values.
import { derivedStatRules } from './generated/derivedStatRules.js';
export { derivedStatRules };
