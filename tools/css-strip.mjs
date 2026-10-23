// tools/css-strip.mjs — drop /* … */ comments from CSS the bundle inlines.
// String-aware (a "/*" inside a quoted string or url('…') stays), pure, no
// dependencies. Run on the SOURCE css, before data: URIs are inserted. The
// stylesheets under styles/ are unchanged; only the inlined copy is smaller.
export function stripCssComments(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) { if (css[j] === '\\') j++; j++; }
      out += css.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
