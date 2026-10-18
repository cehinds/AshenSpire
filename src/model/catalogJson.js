// Lossless transport for generated JSON. Decode text before parsing so objects
// retain JSON.parse's independent identities, key order and own-property rules.
export function decodeCatalogJSONText(payload) {
  if (!payload || Object.keys(payload).sort().join(',') !== 'strings,text'
    || typeof payload.text !== 'string' || !Array.isArray(payload.strings)) throw new Error('Invalid catalog JSON payload');
  for (const token of payload.strings) {
    if (typeof token !== 'string' || typeof JSON.parse(token) !== 'string') throw new Error('Invalid catalog JSON string token');
  }
  const used = new Set();
  const text = payload.text.replace(/~(\d+)~/g, (_, index) => {
    if (String(Number(index)) !== index || Number(index) >= payload.strings.length) throw new Error('Unknown catalog JSON token');
    used.add(Number(index));
    return payload.strings[Number(index)];
  });
  if (used.size !== payload.strings.length) throw new Error('Unused catalog JSON string token');
  return text;
}

export function decodeCatalogJSON(payload) {
  return JSON.parse(decodeCatalogJSONText(payload));
}
