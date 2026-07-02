// src/content/scripts.js — budgeted escape hatch (SPEC §3.1(6))
//
// Registry of named custom behaviors for what the DSL cannot express.
// Budget: < 5% of content objects may reference a script, and every entry
// needs a comment justifying why the DSL couldn't do it. If a script pattern
// appears twice, promote it to a DSL primitive (engine PR).

export const scripts = {
  /**
   * Wondrous Physick: "Gain the effects of two DIFFERENT random flasks."
   * Why a script: the DSL has no way to reference another entity's effect
   * list dynamically ("a random flask's effects") — that's meta-content
   * selection, not effect composition. Everything the picked flasks DO still
   * runs through the ordinary DSL/queue.
   */
  wondrousPhysick(ctx, action) {
    const pool = ctx.registries.flasks
      .all()
      .filter((f) => f.id !== 'wondrousPhysick' && !usesScript(f));
    if (pool.length === 0) return;
    const first = ctx.rng.pick('misc', pool);
    const rest = pool.filter((f) => f.id !== first.id);
    const picks = rest.length ? [first, ctx.rng.pick('misc', rest)] : [first];
    for (const flask of picks) {
      for (const eff of flask.effects || []) {
        ctx.enqueue({ effect: eff, source: action.source, owner: action.owner, target: action.target, meta: action.meta || {} });
      }
    }
  },
};

function usesScript(def) {
  return (def.effects || []).some((e) => typeof e.script === 'string');
}
