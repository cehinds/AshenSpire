// src/content/attributes.js — authoritative Phase 1 creation-stat data, authored in
// content/source/attributes.json, creationModes.json and attributeRules.json; content-build
// compiles them to src/content/generated/. Edit the JSON, not this file. The comments that
// lived here are in content/source/CONTENT-NOTES.md, under "Attributes and character creation".
import { attributes } from './generated/attributes.js';
import { creationModes } from './generated/creationModes.js';
import { attributeRules } from './generated/attributeRules.js';
export { attributes, creationModes, attributeRules };
