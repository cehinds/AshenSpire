// @ts-check
// src/ui/keyedPatch.js — redraw a screen's DOM by changing only what changed (owner, 2026-11-18:
// "limit the redrawing that happens when upgrading a card, editing a deck, or anything else that
// influences small changes").
//
// A screen that rebuilds its whole tree on every click flashes, drops its scroll position and loses
// focus. `patchChildren(parent, nextNodes, { keyOf, isContainer })` takes the freshly built nodes and
// reconciles them against the children `parent` already holds:
//   - a node whose key matches an old node and whose markup is identical keeps the OLD node (the new
//     one is dropped), so it is neither removed nor re-inserted: scroll, focus and hover stay;
//   - a keyed container (a list, a pane) whose markup differs keeps the old element, takes the new
//     one's attributes and is patched recursively, so only its changed rows are replaced;
//   - anything else is replaced by the new node.
// Identical markup means identical listeners' meaning: a node reused here must have been built from
// the same data, so its closures still say the right thing. Keys name the node's identity (a card
// row's id), never its position.

/** @param {any} node */
function attributeNames(node) {
  if (typeof node.getAttributeNames === 'function') return node.getAttributeNames();
  return node.attributes && typeof node.attributes.keys === 'function' ? [...node.attributes.keys()] : [];
}

/**
 * A canonical string of a node's markup: attribute order does not matter and `ignore`d attributes are left out
 * (an art loader stamps and clears placeholder markers after insertion, so a built node and the live one differ
 * in those only). Falls back to outerHTML where the node has no attribute list (the test fixture's DOM).
 * @param {any} node
 * @param {Set<string>} ignore
 * @param {Set<string>} [opaque] a node carrying any of these attributes compares as its tag alone (its own loader owns its content)
 * @returns {string}
 */
export function markupSignature(node, ignore, opaque = new Set()) {
  if (node.nodeType === 3) return node.nodeValue || '';
  if (typeof node.getAttributeNames !== 'function') return String(node.outerHTML);
  if (opaque.size && attributeNames(node).some((name) => opaque.has(name))) return `<${node.tagName} opaque>`;
  const attrs = attributeNames(node).filter((name) => !ignore.has(name)).sort().map((name) => `${name}=${node.getAttribute(name)}`).join(' ');
  const kids = [...node.childNodes].map((child) => markupSignature(child, ignore, opaque)).join('');
  return `<${node.tagName} ${attrs}>${kids}</${node.tagName}>`;
}

/**
 * Makes `target`'s attributes those of `source`.
 * @param {any} target
 * @param {any} source
 */
export function syncAttributes(target, source) {
  const wanted = new Set(attributeNames(source));
  for (const name of attributeNames(target)) if (!wanted.has(name)) target.removeAttribute(name);
  for (const name of wanted) {
    const value = source.getAttribute(name);
    if (target.getAttribute(name) !== value) target.setAttribute(name, value);
  }
}

/**
 * @typedef {{ keyOf: (node: any) => string | null, isContainer?: (key: string) => boolean, ignoreAttributes?: string[], opaqueAttributes?: string[] }} PatchOptions
 */

/**
 * Reconciles `parent`'s element children to `nextNodes` (see the file header).
 * @param {any} parent
 * @param {any[]} nextNodes
 * @param {PatchOptions} options
 * @returns {{ kept: number, replaced: number, inserted: number }} counts, for tests and the probe
 */
export function patchChildren(parent, nextNodes, options) {
  const { keyOf, isContainer = () => false } = options;
  const ignore = new Set(options.ignoreAttributes || []);
  const opaque = new Set(options.opaqueAttributes || []);
  const old = [...parent.children];
  const byKey = new Map();
  for (const node of old) {
    const key = keyOf(node);
    if (key && !byKey.has(key)) byKey.set(key, node);
  }
  const taken = new Set();
  const stats = { kept: 0, replaced: 0, inserted: 0 };
  const result = [];
  nextNodes.forEach((next, index) => {
    const key = keyOf(next);
    let match = null;
    if (key) match = byKey.get(key) || null;
    else if (old[index] && !keyOf(old[index])) match = old[index];
    if (match && !taken.has(match)) {
      taken.add(match);
      if (markupSignature(match, ignore, opaque) === markupSignature(next, ignore, opaque)) { stats.kept += 1; result.push(match); return; }
      if (key && isContainer(key) && match.tagName === next.tagName) {
        syncAttributes(match, next);
        patchChildren(match, [...next.children], options);
        stats.kept += 1;
        result.push(match);
        return;
      }
      stats.replaced += 1;
    } else stats.inserted += 1;
    result.push(next);
  });
  // Old nodes the result does not keep go first, so a kept node is never shifted by a stale neighbour.
  const kept = new Set(result);
  for (const node of old) if (!kept.has(node)) node.remove();
  result.forEach((node, index) => {
    if (parent.children[index] !== node) parent.insertBefore(node, parent.children[index] || null);
  });
  return stats;
}
