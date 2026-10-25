// src/content/skillFeats.js — the feats a skill track's every-2nd level offers
// (SPEC §13.4o). Authored in content/source/skillFeats.json (notes in
// content/source/CONTENT-NOTES.md, "Skill feats"); content-build compiles it to
// src/content/generated/skillFeats.js. Edit the JSON, not this file.
import { skillFeats as authoredSkillFeats } from './generated/skillFeats.js';
export const skillFeats = Object.freeze(authoredSkillFeats);
