// src/model/validate/classTree.js — the class tree (plan phase 5b) and the class card leaning.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

export function classTreeProblems(b, err, ctx) {
  const { ids, flaskCapacity } = ctx;
  // THE CLASS TREE (plan phase 5b, content/source/classTree.csv): every row
  // names a class and a property node, sits in a tier the balance rows open,
  // a node sits in one class, and the top tier's nodes exclude one another
  // by a relation row — the subclass is a choice, never a stack.
  {
    const rows = Array.isArray(b.classTree) ? b.classTree : [];
    const classIds = new Set((Array.isArray(b.classes) ? b.classes : []).map((c) => c && c.id));
    const nodesById = new Map((Array.isArray(b.nodes) ? b.nodes : []).map((n) => [n && n.id, n]));
    const rootOf = (id) => { let n = nodesById.get(id); let guard = 0; while (n && n.parentId && guard++ < 64) n = nodesById.get(n.parentId); return n ? n.id : null; };
    const tiers = ((((b.balance || {}).skill || {}).class || {}).tierAt) || [];
    const tierCount = Array.isArray(tiers) ? tiers.length : 0;
    const relations = Array.isArray(b.nodeRelations) ? b.nodeRelations : [];
    const conflicts = (x, y) => relations.some((r) => r && r.relation === 'CONFLICTS_WITH' && ((r.sourceId === x && r.targetId === y) || (r.sourceId === y && r.targetId === x)));
    const seenNode = new Map();
    const byClassTier = new Map();
    rows.forEach((row, i) => {
      const path = `classTree[${i}]`;
      if (!row || typeof row !== 'object') { err(path, 'must be { classId, nodeId, tier }'); return; }
      if (!classIds.has(row.classId)) err(`${path}.classId`, `unknown class '${row.classId}'`);
      const node = nodesById.get(row.nodeId);
      if (!node) err(`${path}.nodeId`, `'${row.nodeId}' is not a node`);
      else if (rootOf(row.nodeId) !== 'property') err(`${path}.nodeId`, `'${row.nodeId}' is not a property node — a tree node confers behaviour`);
      const tier = Number(row.tier);
      if (!Number.isInteger(tier) || tier < 1 || (tierCount && tier > tierCount)) err(`${path}.tier`, `must be a tier 1..${tierCount || '?'} (balance.skill.class.tierAt names one level per tier), got ${JSON.stringify(row.tier)}`);
      if (seenNode.has(row.nodeId)) err(`${path}.nodeId`, `'${row.nodeId}' already sits in class '${seenNode.get(row.nodeId)}' — a node sits in one class`);
      else seenNode.set(row.nodeId, row.classId);
      const key = `${row.classId}\u0000${tier}`;
      if (!byClassTier.has(key)) byClassTier.set(key, []);
      byClassTier.get(key).push(row.nodeId);
    });
    if (tierCount) {
      for (const [key, ids] of byClassTier) {
        const [classId, tier] = key.split('\u0000');
        if (Number(tier) !== tierCount) continue;
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          if (!conflicts(ids[i], ids[j])) err(`classTree.${classId}`, `tier ${tier} nodes '${ids[i]}' and '${ids[j]}' do not exclude one another — the subclass is a choice: add a CONFLICTS_WITH row in nodeRelations.csv`);
        }
      }
    }
  }
  // The class card's leaning (plan phase 5a): a class carrying `favored`
  // names at least one item type in the class domain, else the property
  // multiplies nothing and the row is decoration.
  {
    const itemTypeIds = new Set((Array.isArray(b.nodes) ? b.nodes : []).filter((n) => n && n.parentId === 'itemType').map((n) => n.id));
    const rows = Array.isArray(b.tagging) ? b.tagging : [];
    for (const cls of Array.isArray(b.classes) ? b.classes : []) {
      if (!cls || !cls.id) continue;
      const tags = rows.filter((r) => r && r.family === 'class' && r.objectId === cls.id).map((r) => r.tagId);
      if (tags.includes('favored') && !tags.some((t) => itemTypeIds.has(t))) {
        err(`tagging.class.${cls.id}`, "carries 'favored' but names no item type — the leaning has no group to favour");
      }
    }
    // Only a class carries the leaning: on any other carrier its scope is
    // empty and it multiplies nothing, silently.
    for (const r of rows) {
      if (r && r.tagId === 'favored' && r.family !== 'class') err(`tagging.${r.family}.${r.objectId}`, "'favored' is the class card's leaning — no other carrier scopes it");
    }
  }
  for (const cls of Array.isArray(b.classes) ? b.classes : []) {
    // The kit relic rides beside the starting relic (plan phase 5a); naming
    // the same relic twice would drop silently to one.
    if (cls && cls.kitRelic && cls.kitRelic === cls.startingRelic) err(`classes.${cls.id}.kitRelic`, `'${cls.kitRelic}' is already the starting relic — the kit relic is a second relic`);
    const a = cls && cls.startingFlaskAllocation;
    if (!a || !Number.isInteger(a.hp) || a.hp < 0 || !Number.isInteger(a.mana) || a.mana < 0
      || a.hp + a.mana !== flaskCapacity) {
      err(`classes.${cls && cls.id || '?'}.startingFlaskAllocation`, `must satisfy hp + mana = flaskCapacity ${flaskCapacity}`);
    }
  }
}
