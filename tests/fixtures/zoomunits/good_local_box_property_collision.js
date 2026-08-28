// Known-good precision fixture for issue #14.
//
// `left` is genuinely tainted, but is not written to geometry here. The write
// reads the `left` PROPERTY of a box already converted into local
// coordinates. A binding-aware scanner must not confuse `lb.left` with the
// unrelated tainted binding named `left`.

const r = el.getBoundingClientRect();
let left = r.left + 4;
void left;

const lb = anchorLocalBox(el);
el.style.left = `${lb.left}px`;
