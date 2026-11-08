// tools/dynamic-imports.mjs — find dynamic import() calls in module source, in
// code only. One home, shared by tools/bundle.mjs and tools/bundle-cycles.mjs.
//
// A small scanner, not a regex: the word `import(` inside a comment, a string
// or a template's text is prose, not a call, and must neither fail the build nor
// create a graph edge. Only code positions are examined.
//
// scanDynamicImports(src) -> [{ start, end, spec }]
//   spec is the string for import('<literal>') / import("<literal>"), or null
//   for any other argument form (variable, template, concatenation, spread...).

const ID = /[\w$]/;

export function scanDynamicImports(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  let prev = ''; // last significant code char, to tell a regex `/` from division
  let prevWord = '';
  const parenStack = []; // true when the ( closes an if/while/for/with head: a / after it is a regex
  const braceStack = []; // template-literal ${ nesting: true when the { opened a ${
  const regexAfterWord = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do', 'yield', 'await']);

  function skipString(q) {
    i++;
    // An unescaped newline ends a '…' or "…" string (it is a syntax error in
    // real code), so a stray quote can never swallow the lines after it.
    while (i < n && src[i] !== q && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
    if (src[i] === q) i++;
  }
  // Scan template text from just after the opening backtick or after a closing }
  // of a ${…}; returns when the template ends (true) or a ${ opens (false).
  function templateText() {
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return true; }
      if (c === '$' && src[i + 1] === '{') { i += 2; braceStack.push(true); return false; }
      i++;
    }
    return true;
  }

  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") { skipString(c); prev = 'a'; prevWord = ''; continue; }
    if (c === '`') { i++; templateText(); prev = 'a'; prevWord = ''; continue; }
    if (c === '/') {
      const regexOk = prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || regexAfterWord.has(prevWord);
      if (regexOk) {
        i++;
        let inClass = false;
        while (i < n && src[i] !== '\n' && (inClass || src[i] !== '/')) {
          if (src[i] === '\\') i++;
          else if (src[i] === '[') inClass = true;
          else if (src[i] === ']') inClass = false;
          i++;
        }
        i++;
        prev = 'a'; prevWord = '';
        continue;
      }
      prev = '/'; prevWord = ''; i++; continue;
    }
    if (c === '(') { parenStack.push(['if', 'while', 'for', 'with'].includes(prevWord)); prev = '('; prevWord = ''; i++; continue; }
    if (c === ')') { prev = parenStack.pop() ? '(' : ')'; prevWord = ''; i++; continue; }
    if ((c === '+' || c === '-') && src[i + 1] === c) { prev = 'a'; prevWord = ''; i += 2; continue; }
    if (c === '{') { braceStack.push(false); prev = '{'; prevWord = ''; i++; continue; }
    if (c === '}') {
      const wasTemplate = braceStack.pop();
      i++;
      if (wasTemplate) { templateText(); prev = 'a'; prevWord = ''; } else { prev = '}'; prevWord = ''; }
      continue;
    }
    if (ID.test(c)) {
      const start = i;
      while (i < n && ID.test(src[i])) i++;
      const word = src.slice(start, i);
      const before = src[start - 1];
      if (word === 'import' && before !== '.') {
        let j = i;
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === '(') {
          j++;
          while (j < n && /\s/.test(src[j])) j++;
          let spec = null;
          let end = j;
          const q = src[j];
          if (q === '"' || q === "'") {
            let k = j + 1;
            while (k < n && src[k] !== q && src[k] !== '\n' && src[k] !== '\\') k++;
            if (src[k] === q) {
              let m = k + 1;
              while (m < n && /\s/.test(src[m])) m++;
              if (src[m] === ')') { spec = src.slice(j + 1, k); end = m + 1; }
            }
          }
          if (spec === null) {
            // Not a plain literal call: span to the matching ) so the caller can name it.
            let depth = 1, k = j;
            while (k < n && depth > 0) { if (src[k] === '(') depth++; else if (src[k] === ')') depth--; k++; }
            end = k;
          }
          out.push({ start, end, spec });
          // Resume after the call; its argument was consumed (a literal one holds no code).
          if (spec !== null) { i = end; prev = ')'; prevWord = ''; continue; }
        }
      }
      prev = 'a'; prevWord = word;
      continue;
    }
    if (!/\s/.test(c)) { prev = c; prevWord = ''; }
    i++;
  }
  return out;
}
