// workbench/lib/line-diff.mjs — line diff for the Workbench, in the browser and in node.
//
// Pure: no imports, so the published static Workbench (workbench/static/static-api.mjs)
// can load this file unchanged. Used by core/files.mjs (save preview) and the static API.

// Line diff: common prefix/suffix trimmed, then Myers' O(ND) on the middle.
// Past MAX_EDITS the middle is shown as one replacement (documented fallback).
const MAX_EDITS = 2000;
const splitLines = (text) => (text === '' ? [] : (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n'));

function myers(a, b) {
  const n = a.length, m = b.length, max = n + m;
  if (max === 0) return [];
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  for (let d = 0; d <= Math.min(max, MAX_EDITS); d++) {
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, n, m);
    }
  }
  return null;
}

function backtrack(trace, a, b, n, m) {
  const out = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const s = trace[d];
    const get = (k) => s[k + d + 1]; // s holds k in [-d-1, d+1]
    const k = x - y;
    const prevK = (k === -d || (k !== d && get(k - 1) < get(k + 1))) ? k + 1 : k - 1;
    const prevX = get(prevK), prevY = prevX - prevK;
    while (x > prevX && y > prevY) { out.push({ op: ' ', text: a[x - 1] }); x--; y--; }
    if (d > 0) {
      if (x === prevX) out.push({ op: '+', text: b[prevY] }); else out.push({ op: '-', text: a[prevX] });
    }
    x = prevX; y = prevY;
  }
  return out.reverse();
}

/** Line diff of two texts as unified-style hunks with `context` lines around each change. */
export function lineDiff(oldText, newText, { context = 3 } = {}) {
  const a = splitLines(oldText), b = splitLines(newText);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const midA = a.slice(pre, a.length - suf), midB = b.slice(pre, b.length - suf);
  let middle = myers(midA, midB);
  if (!middle) middle = [...midA.map((text) => ({ op: '-', text })), ...midB.map((text) => ({ op: '+', text }))];
  const script = [
    ...a.slice(0, pre).map((text) => ({ op: ' ', text })),
    ...middle,
    ...a.slice(a.length - suf).map((text) => ({ op: ' ', text })),
  ];
  // Position of each entry: lines of old and new consumed before it.
  let o = 0, nn = 0;
  const ops = script.map((e) => {
    const at = { ...e, o, n: nn };
    if (e.op !== '+') o++;
    if (e.op !== '-') nn++;
    return at;
  });
  const changed = ops.map((e, i) => (e.op !== ' ' ? i : -1)).filter((i) => i >= 0);
  const hunks = [];
  let i = 0;
  while (i < changed.length) {
    let last = changed[i];
    let j = i;
    while (j + 1 < changed.length && changed[j + 1] - last <= 2 * context) { j++; last = changed[j]; }
    const start = Math.max(0, changed[i] - context), end = Math.min(ops.length - 1, last + context);
    const lines = ops.slice(start, end + 1);
    const oldLines = lines.filter((e) => e.op !== '+').length;
    const newLines = lines.filter((e) => e.op !== '-').length;
    hunks.push({
      oldStart: oldLines ? lines[0].o + 1 : lines[0].o,
      oldLines,
      newStart: newLines ? lines[0].n + 1 : lines[0].n,
      newLines,
      lines: lines.map(({ op, text }) => ({ op, text })),
    });
    i = j + 1;
  }
  return {
    hunks,
    added: script.filter((e) => e.op === '+').length,
    removed: script.filter((e) => e.op === '-').length,
  };
}
