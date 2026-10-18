// Encode repeated JSON string tokens, not JavaScript. Author JSON stays readable.
export function catalogJSONExpression(value) {
  const text = JSON.stringify(value);
  // Existing marker-shaped data uses the ordinary literal, without escaping or
  // interpreting player/authored strings as transport instructions.
  if (/~\d+~/.test(text)) return { expression: text, encoded: false };
  const token = /"(?:[^"\\]|\\.)*"/g;
  const counts = new Map();
  for (const [string] of text.matchAll(token)) counts.set(string, (counts.get(string) || 0) + 1);
  const strings = [...counts].filter(([string, count]) => (string.length - 5) * count > string.length + 4).map(([string]) => string);
  const indices = new Map(strings.map((string, index) => [string, index]));
  const packed = text.replace(token, string => indices.has(string) ? `~${indices.get(string)}~` : string);
  const expression = `decodeCatalogJSON(${JSON.stringify({ text: packed, strings })})`;
  return expression.length < text.length ? { expression, encoded: true } : { expression: text, encoded: false };
}
