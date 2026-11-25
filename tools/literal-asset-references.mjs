// Optional art is a presentation contract, not a blanket missing-file exemption.
// Only the generated recipient atlas's exact asset properties can opt out.
function optionalRecipientOffsets(source, config) {
  const atlas = config?.behavior?.atlas || {};
  for (const [shape, entry] of Object.entries(atlas)) {
    if (entry.optional !== true) continue;
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(shape)
      || !['v5', 'v6'].includes(config.behavior.atlasId)
      || !['v5', config.behavior.atlasId].some(generation => entry.asset === `assets/recipient-effects/${generation}/${shape}.png`)
      || entry.columns !== 3 || entry.rows !== 1 || entry.row !== 0) {
      throw new Error(`Invalid optional recipient atlas entry: ${shape}`);
    }
  }
  const marker = 'export const uiConfig = deepFreeze(';
  const start = source.indexOf(marker) + marker.length;
  if (start < marker.length) return new Set();
  const json = source.slice(start, source.lastIndexOf(');'));
  let root;
  try { root = JSON.parse(json); } catch { return new Set(); }
  // config-build emits canonical compact JSON. Fail closed on other source forms.
  if (JSON.stringify(root) !== json) return new Set();
  const child = (node, key) => {
    let offset = node.offset + 1;
    for (const [name, value] of Object.entries(node.value || {})) {
      offset += JSON.stringify(name).length + 1;
      if (name === key) return { value, offset };
      offset += JSON.stringify(value).length + 1;
    }
    return { value: null, offset: -1 };
  };
  let node = { value: root, offset: start };
  for (const key of ['presentation', 'recipientEffects', 'behavior', 'atlas']) node = child(node, key);
  const offsets = new Set();
  for (const [shape, entry] of Object.entries(atlas)) {
    if (entry.optional !== true) continue;
    const generated = child(node, shape);
    if (JSON.stringify(generated.value) !== JSON.stringify(entry)) continue;
    offsets.add(child(generated, 'asset').offset);
  }
  return offsets;
}

/** Return missing literal refs; only explicitly optional generated atlas rows are exempt. */
export function danglingLiteralAssets(sources, manifestIds, recipientConfig) {
  const literal = /['"`](assets\/[A-Za-z0-9_\-./]+\.[a-z0-9]{2,5})['"`]/g;
  const dangling = [];
  for (const [id, source] of sources) {
    const optional = id === 'src/config/generated/ui.js'
      ? optionalRecipientOffsets(source, recipientConfig) : new Set();
    let offset = 0;
    for (const line of source.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) {
        literal.lastIndex = 0;
        let match;
        while ((match = literal.exec(line)) !== null) {
          if (!manifestIds.has(match[1]) && !optional.has(offset + match.index)) {
            dangling.push(`${id} → ${match[1]}`);
          }
        }
      }
      offset += line.length + 1;
    }
  }
  return dangling;
}
