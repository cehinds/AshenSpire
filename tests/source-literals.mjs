// tests/source-literals.mjs — "what numbers does this SOURCE FILE write down?"
//
// Used by tests/config-migration.test.mjs to hold the config shims to their
// promise that every value they serve comes from content/config.
//
// Written out as a scanner rather than a regex over the whole file because a
// regex cannot tell a quote inside a comment from one that opens a string. Get
// that wrong and the guard does not fail — it goes QUIET, on exactly the files
// it exists for, which is the invisible failure rather than the loud one.

const BACKSLASH = String.fromCharCode(92);
const BACKTICK = String.fromCharCode(96);

/**
 * `src` with comment bodies and string bodies removed.
 *
 * Template INTERPOLATIONS are kept and scanned, because `${gap * 2}` is code
 * with a literal in it; a stripper that dropped whole template literals would
 * miss every number the shims interpolate into a style or a class name.
 */
export function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i += 1;
      while (i < n && src[i] !== quote) i += src[i] === BACKSLASH ? 2 : 1;
      i += 1;
      out += '""';
      continue;
    }
    if (c === BACKTICK) {
      i += 1;
      while (i < n) {
        if (src[i] === BACKSLASH) { i += 2; continue; }
        if (src[i] === BACKTICK) { i += 1; break; }
        if (src[i] === '$' && src[i + 1] === '{') {
          i += 2;
          let depth = 1;
          const start = i;
          while (i < n && depth) {
            if (src[i] === '{') depth += 1;
            else if (src[i] === '}') depth -= 1;
            if (depth) i += 1;
          }
          out += ` ${stripCommentsAndStrings(src.slice(start, i))} `;
          i += 1;
          continue;
        }
        i += 1;
      }
      out += '``';
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

// A number that is not part of an identifier or a property name.
const NUMBER = /(?<![A-Za-z0-9_$.])(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/**
 * numericLiterals(source, { allow }) → [{ line, value, text }]
 *
 * `allow` is the set of literals that are NOT configuration. It defaults to
 * 0 and 1: the zero and unit of the arithmetic a shim still does — `slice(1)`,
 * `at(-1)`, `(n - 1) % p + 1`, `?? 0` — and the two endpoints of an opacity,
 * which are the whole range of the property rather than a chosen value. Moving
 * those into JSON would hide the arithmetic without relocating a decision.
 * Every other number IS a decision, and belongs in content/config.
 */
export function numericLiterals(source, { allow = ['0', '1'] } = {}) {
  const allowed = new Set(allow);
  const found = [];
  stripCommentsAndStrings(source).split('\n').forEach((line, index) => {
    for (const match of line.matchAll(NUMBER)) {
      if (!allowed.has(match[1])) found.push({ line: index + 1, value: match[1], text: line.trim() });
    }
  });
  return found;
}
