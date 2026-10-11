// workbench/retired-banner.js — the notice on an old tool page that the Workbench now holds.
// Dependency-free and not a redirect: the page keeps working. Load it from a page with
//   <script src="<relative>/workbench/retired-banner.js" defer data-hash="#mod=data&table=…"
//           data-module="Data Studio" data-coverage="full|partial" data-missing="A; B"></script>
// data-workbench (optional) is the Workbench origin; it defaults to the Workbench's port 4300.
(function () {
  var script = document.currentScript;
  if (!script || !document.body) return;
  var d = script.dataset;
  var key = 'wb.retired.dismissed:' + location.pathname;
  try { if (localStorage.getItem(key) === '1') return; } catch (e) { /* private window: the notice shows */ }

  var base = (d.workbench || 'http://127.0.0.1:4300/').replace(/\/?$/, '/');
  var href = base + (d.hash || '');
  var missing = (d.missing || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean);

  var style = document.createElement('style');
  style.textContent = '.wb-retired{font:14px/1.45 system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:10px 16px;margin:0;background:#fff4dc;color:#2b2110;border-bottom:1px solid #e0c58a}' +
    '.wb-retired a{color:inherit;font-weight:700}.wb-retired button{font:inherit;margin-left:auto;padding:2px 10px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer}' +
    '.wb-retired small{display:block;opacity:.85}' +
    '@media (prefers-color-scheme: dark){.wb-retired{background:#3a2c12;color:#f3e3bf;border-color:#6b5226}}';
  document.head.appendChild(style);

  var bar = document.createElement('aside');
  bar.className = 'wb-retired';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Workbench notice');

  var text = document.createElement('span');
  text.appendChild(document.createTextNode(
    (d.coverage === 'partial' ? 'This tool has mostly moved to the Workbench' : 'This tool now lives in the Workbench') + ' → '));
  var link = document.createElement('a');
  link.href = href;
  link.textContent = 'Open in Workbench' + (d.module ? ' (' + d.module + ')' : '');
  text.appendChild(link);
  if (missing.length) {
    var note = document.createElement('small');
    note.textContent = 'Still only here: ' + missing.join(', ') + '.';
    text.appendChild(note);
  }
  bar.appendChild(text);

  var keep = document.createElement('button');
  keep.type = 'button';
  keep.textContent = 'Keep using this page';
  keep.addEventListener('click', function () {
    try { localStorage.setItem(key, '1'); } catch (e) { /* the notice returns on the next visit */ }
    bar.remove();
  });
  bar.appendChild(keep);

  document.body.insertBefore(bar, document.body.firstChild);
})();
