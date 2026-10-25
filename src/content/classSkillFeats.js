// SPEC §13.4q class feats. Authored in content/source/classSkillFeats.json (notes
// in content/source/CONTENT-NOTES.md, "Class skill feats"); content-build compiles
// it to src/content/generated/classSkillFeats.js. Edit the JSON, not this file.
import { classSkillFeats as authoredClassSkillFeats } from './generated/classSkillFeats.js';
export const classSkillFeats = Object.freeze(authoredClassSkillFeats);
