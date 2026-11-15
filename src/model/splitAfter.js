// A split that keeps the first character of each separator on the left piece,
// for what `text.split(/(?<=[.!?])\s+/)` says. RegExp lookbehind is a parse-time
// SyntaxError before Safari 16.4 (iOS 15 stops loading the whole module), so
// the game never writes one: give this the separator WITHOUT the lookbehind,
// starting at the character the lookbehind would have asserted (docs/qa/IOS15-COMPAT.md).
//   SplitAfter('A. B', /[.!?]\s+/)   // ['A.', 'B']
export function SplitAfter(text, separator) {
  const source = String(text);
  const re = new RegExp(separator.source, separator.flags.includes('g') ? separator.flags : `${separator.flags}g`);
  const pieces = [];
  let start = 0;
  for (const match of source.matchAll(re)) {
    if (!match[0].length) continue;
    pieces.push(source.slice(start, match.index + 1));
    start = match.index + match[0].length;
  }
  pieces.push(source.slice(start));
  return pieces;
}
