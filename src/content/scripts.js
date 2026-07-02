// src/content/scripts.js — budgeted escape hatch (SPEC §3.1(6))
//
// Registry of named custom behaviors for what the DSL cannot express.
// Budget: < 5% of content objects may reference a script, and every entry
// needs a comment justifying why the DSL couldn't do it. If a script pattern
// appears twice, promote it to a DSL primitive (engine PR).
//
// M1 ships with ZERO scripts — everything is expressible in the DSL.

export const scripts = {};
