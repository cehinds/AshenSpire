// src/framework/index.js — the data-driven property framework, one door.
//
// Replacement-candidate layer (framework contract): registries, deterministic
// compiler, gameplay services, shared presentation, importer, validation, and
// the cutover gate. Until buildReplacementCandidate returns SUCCESS and one
// atomic cutover is recorded, the legacy runtime (src/content + src/engine +
// src/ui) remains the sole production authority and nothing here is consulted
// by the running game.

export * from './schema.js';
export * from './registries.js';
export * from './compiler.js';
export * from './lifecycle.js';
export * from './costs.js';
export * from './deck.js';
export * from './resources.js';
export * from './weight.js';
export * from './inheritance.js';
export * from './importer.js';
export * from './validate.js';
export * from './candidate.js';
export * from './presentation/components.js';
export * from './presentation/tooltip.js';
export * from './presentation/confirmation.js';
export * from './presentation/fitText.js';
