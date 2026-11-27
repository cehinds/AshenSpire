// Encode repeated JSON string tokens, not JavaScript. Author JSON stays readable.
export function catalogJSONExpression(value) {
  const text = JSON.stringify(value);
  // Existing marker-shaped data uses the ordinary literal, without escaping or
  // interpreting player/authored strings as transport instructions.
  if (/~\d+~/.test(text)) return { expression: text, encoded: false };
  const token = /"(?:[^"\\]|\\.)*"/g;
  const counts = new Map();
  for (const [string] of text.matchAll(token)) counts.set(string, (counts.get(string) || 0) + 1);
  // Frequent tokens get the shortest indices. Measure the escaping inside the
  // payload's text string as well as each dictionary entry: even short keys
  // such as "id" can profit because their quotes otherwise need escaping.
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const strings = [];
  for (const [string, count] of ranked) {
    const dictionaryCost = JSON.stringify(string).length;
    const markerCost = String(strings.length).length + 2;
    if ((dictionaryCost - 2 - markerCost) * count > dictionaryCost + 1) strings.push(string);
  }
  const indices = new Map(strings.map((string, index) => [string, index]));
  const packed = text.replace(token, string => indices.has(string) ? `~${indices.get(string)}~` : string);
  const expression = `decodeCatalogJSON(${JSON.stringify({ text: packed, strings })})`;
  return expression.length < text.length ? { expression, encoded: true } : { expression: text, encoded: false };
}
