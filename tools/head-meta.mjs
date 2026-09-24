// tools/head-meta.mjs — the web/share metadata the bundle carries (FINISH §13).
//
// index.html is the one source for these tags: the dev page serves them as
// written, and tools/bundle.mjs copies them into the single-file build's
// <head> through headMetaTags() below, so the copy cannot drift from the source.
// REQUIRED_HEAD_META lists only the tags that must exist; headMetaTags() also
// copies optional ones of the same kinds (og:type, other og:*, apple-touch-icon).
// Zero dependencies (Node core only); pure string work, safe to import in tests.

// Each required tag, as a name the error message can use and a pattern that
// matches one whole tag in index.html.
export const REQUIRED_HEAD_META = [
  ['meta description', /<meta\b[^>]*\bname=["']description["'][^>]*>/i],
  ['og:title', /<meta\b[^>]*\bproperty=["']og:title["'][^>]*>/i],
  ['og:description', /<meta\b[^>]*\bproperty=["']og:description["'][^>]*>/i],
  ['og:image', /<meta\b[^>]*\bproperty=["']og:image["'][^>]*>/i],
  ['icon link', /<link\b[^>]*\brel=["']icon["'][^>]*>/i],
  ['theme-color', /<meta\b[^>]*\bname=["']theme-color["'][^>]*>/i],
];

// Every description / og:* / theme-color meta and every icon link in `html`,
// in source order. Throws, naming the missing ones, when a required tag is absent.
export function headMetaTags(html) {
  const missing = REQUIRED_HEAD_META.filter(([, re]) => !re.test(html)).map(([name]) => name);
  if (missing.length) throw new Error('index.html is missing ' + missing.join(', '));
  const re = /<meta\b[^>]*\b(?:name=["'](?:description|theme-color)["']|property=["']og:[^"']+["'])[^>]*>|<link\b[^>]*\brel=["'](?:icon|apple-touch-icon)["'][^>]*>/gi;
  return html.match(re) || [];
}
