// tools/contrast-audit.mjs — what the eye actually gets: WCAG contrast of the
// real UI, measured from rendered pixels.
//
//   node tools/contrast-audit.mjs                 → the whole matrix, table form
//   node tools/contrast-audit.mjs --profile shipped-default
//   node tools/contrast-audit.mjs --json          → machine-readable
//   node tools/contrast-audit.mjs --gate          → exit 1 on a NEW or WORSENED
//                                                   AA failure at a gated profile
//                                                   (default, + the #45 map rows
//                                                   in hi-contrast-off)
//   node tools/contrast-audit.mjs --selftest      → plant a real palette token
//                                                   below AA, require the gate to
//                                                   name it, revert, re-prove clean
//   node tools/contrast-audit.mjs --gated-only    → render only the profiles the
//                                                   gate judges (used by --selftest)
//
// ── THIS TOOL GATES, AND UNTIL 2026-08-15 NOBODY HAD WATCHED ITS GATE GO RED ──
// Vira's doors audit (docs/TOOL-DOORS-AUDIT.md, 2026-08-14) filed this file under
// HARNESS — "not a check; asserts nothing; the rule has no claim on it". That is
// wrong and it is my own file, so the correction is mine: `--gate` exits 1 on
// three named classes (NEW, REGRESSED, BLIND) and is a check by every definition
// in this house. It belonged in the NO-KNOWN-BAD column, which is where the
// P-BATCH deal would have found it. The one red anyone ever watched here was
// Vira's, on the #45 branch, before the profile map existed — ref-pinned, so
// `unknown (drifted)` ever since (SOP 2's drift clause).
//
// --selftest is the re-runnable replacement: it edits a REAL PALETTE TOKEN in
// styles/base.css, serves the real tree, renders in the real browser, captures
// real pixels, and requires the gate to name the rows that fell. Nothing is
// handed to the ratio function.
//
// Why this reads pixels and not the stylesheet: a declared colour and a
// delivered colour are two different facts. `.card .ctag` specs 4.67:1 at 8px —
// and its brightest RENDERED pixel reaches 3.36:1, because at that size every
// glyph pixel is antialiased and NONE of them attains the declared colour. So
// this reports two numbers per target and they are allowed to disagree:
//
//   spec   — computed `color` composited onto the rendered backdrop. What the
//            palette promises. This is the number a stylesheet audit finds.
//   render — the glyph pixel furthest in luminance from that backdrop. What a
//            tired human at 11pm actually receives.
//
// `render` is the honest one, and it is the one `--gate` fails on. When
// render << spec, no palette change fixes the target: the size does.
//
// Zero dependencies (house rule). Chromium is driven over raw CDP through
// node's global WebSocket; the PNG is decoded by handing it back to the page as
// a data URL and reading it off a canvas — the browser already owns a decoder.
//
// Removal condition (development.md SOP 1 corollary): delete this file the day
// the accessibility palette stops being hand-audited — i.e. when a CI workflow
// runs the same matrix per commit, or when the family stops shipping a
// contrast-sensitive default. A hand-run check nobody runs is decoration.

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const BROWSERS = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// ---- the matrix ---------------------------------------------------------------
// Settings profiles. `{}` is what a first-boot player has in sote_meta_v1, so
// the `default` profile measures whatever main.js resolves an ABSENT key to —
// which is exactly the thing a default flip changes.
const PROFILES = {
  default: {},
  'hi-contrast': { highContrast: true },
  'cb-safe': { colorblindSafe: true },
  'hi-contrast+cb-safe': { highContrast: true, colorblindSafe: true },
  'hi-contrast-off': { highContrast: false }, // the pre-flip look, pinned explicitly
  'text-L': { textSize: 'L' },
  'hi-contrast+text-L': { highContrast: true, textSize: 'L' },
  // The SMALL edge, and it is not cosmetic. Auto zoom resolves to 1.29 at
  // 1920x1080, so 'Auto' silently enlarges everything by 29% and flatters every
  // small-type reading in this table. UI size S pins zoom at 0.85 — the smallest
  // the app ships — which is where the 0.8rem card tag actually renders at 6.8px.
  'ui-S': { uiScale: 'S' },
  'hi-contrast+ui-S': { highContrast: true, uiScale: 'S' },
};

// Each target names a screen (?shot=), a selector, and whether WCAG treats it as
// large text (≥24px, or ≥18.66px bold → 3.0 floor instead of 4.5).
const TARGETS = [
  { screen: '', sel: '.title-stack .title-big', label: 'ASHEN SPIRE (title)' },
  { screen: '', sel: '.title-stack .subtitle', label: 'title subtitle' },
  { screen: '', sel: '.title-screen > p:last-of-type', label: 'title tagline' },
  { screen: '', sel: '.slot-new', label: 'BEGIN A CLIMB (primary)' },
  { screen: '', sel: '#settings', label: 'SETTINGS (secondary)' },
  // Non-text: the button RING. Here because "does high contrast make the primary
  // action harder to find?" is a question about salience, and text contrast
  // cannot answer it — both buttons clear AA either way. What changes is the
  // ordering: the gold ring is a fixed token, the secondary's --line-soft is one
  // high contrast brightens. Same difference trick, on border-color.
  { screen: '', sel: '.slot-new', label: '  ↳ its gold ring', prop: 'border-color', box: true },
  { screen: '', sel: '#settings', label: '  ↳ its ring', prop: 'border-color', box: true },
  { screen: 'map', sel: '.map-header .mh-prog', label: 'Act/Floor' },
  { screen: 'map', sel: '.map-header .mh-seed', label: 'SEED' },
  { screen: 'map', sel: '.map-header #map-legend', label: 'topbar ? button' },
  { screen: 'map', sel: '.hint-bar .hint:first-child', label: 'keyboard hint' },
  // Map STRUCTURE (#45): the graph itself — the roads and rings a player reads
  // to plan a run. Non-text (WCAG 1.4.11 → 3.0 floor), SVG, so the ink property
  // is stroke/fill rather than color. The selectors pin the PLAIN node and the
  // untraveled edge deliberately: every state class (visited/reachable/current/
  // elite/boss, .traveled) swaps the stroke to a token high contrast never
  // touches (--gold 8.12:1, --blood, --parchment), so the states survive either
  // palette — it is the bare --line-soft ring and road that the atmospheric
  // palette (hi-contrast OFF) drops to 1.94:1 at the token, and antialiasing
  // means the render sits at or below that, never above. ?shot=map boots
  // shotSeed SHOWCASE (src/main.js) so the graph, and these selectors' matches,
  // are the same every run.
  // `adjacency`: judged on the boundary's worst adjacent rendered colour — the
  // ring straddles its own fill and the field and must clear the floor against
  // BOTH (Sunna's #45 ruling; the two clusters print beside the verdict).
  { screen: 'map', sel: '.map-edge:not(.traveled)', label: 'map edge (untraveled road)', prop: 'stroke', box: true, adjacency: true },
  {
    screen: 'map',
    sel: '.map-node:not(.elite):not(.boss):not(.visited):not(.current):not(.reachable) circle:not(.node-halo)',
    label: 'map node ring (plain)', prop: 'stroke', box: true, adjacency: true,
  },
  // The fill is sampled from the CENTRAL HALF of the node (shrink: 0.5), for the
  // same reason the text probe skips the emoji: when the fill is forced
  // transparent, the ring's antialiased rim re-blends and registers as changed
  // pixels, and the "best ink pixel" then reads the RIM's contrast (3.54 at
  // default), not the fill's (1.17). A half-box on a circle contains no rim
  // (corner distance 0.71r < r), so the fill is measured as itself.
  {
    screen: 'map',
    sel: '.map-node:not(.elite):not(.boss):not(.visited):not(.current):not(.reachable) circle:not(.node-halo)',
    label: 'map node body (fill vs bg)', prop: 'fill', box: true, shrink: 0.5, median: true,
  },
  { screen: 'combat', sel: '.topbar .fight-label', label: 'fight label (combat)' },
  // The combat HUD is two rows now (D10 wave 4) and the hero name sits directly
  // in the bottom row — `.who` is the MAP header's wrapper and combat has none.
  // Re-pointed rather than left to match nothing: a probe whose selector has no
  // referent reports a clean sheet about a thing it never looked at.
  { screen: 'combat', sel: '.topbar .nm', label: 'hero name (combat)' },
  { screen: 'combat', sel: '.resbar .label', label: 'resource bar label (combat)' },
  { screen: 'combat', sel: 'CTAG:Blood', label: 'Blood card tag (label only)' },
  { screen: 'death', sel: '.title-big', label: 'YOU PERISHED' },
];

// Failures that are KNOWN, MEASURED, and deliberately not fixed by the default
// flip — each with the reason it was left and what would actually fix it. This
// list exists so `--gate` can fail on a NEW failure without going red on the
// standing ones, because a gate that is always red is a gate nobody runs.
//
// Every entry names its PROFILE, and the gate keys the ledger on
// `profile :: label` — an excused number in one palette must not silence the
// same target in another (Vira's #45 finding: the gate judged `default` only,
// highContrast defaults TRUE, so the atmospheric palette's map values — the
// exact thing the #45 remedy ships — could regress to any depth at exit 0).
//
// Every entry is a Tier-2 card waiting to be written, not a shrug. Two of them
// are the same shape: high contrast swaps the muted / parchment / line tokens
// and deliberately does not touch --blood or --gold, so the accent family sits
// outside its reach entirely.
const KNOWN_BELOW = [
  {
    label: 'map node body (fill vs bg)', profile: 'default', render: 1.17, floor: 3.0,
    why: '--panel on --bg, 1.17 in BOTH palettes — high contrast never touches --panel, '
       + 'so no toggle reaches this number. Sunna ruled the floor for non-text map glyphs '
       + '(#45): 3:1 on each glyph\'s IDENTIFYING BOUNDARY against each adjacent rendered '
       + 'colour. The node\'s identifying boundary is its RING, not its fill, and at '
       + 'default the ring clears both adjacencies (4.18 vs field, 3.54 vs its fill — the '
       + 'row above, judged on its worst). The fill owes no independent floor; the row '
       + 'stays measured so a --panel/--bg drift is seen, and so the ring-vs-fill '
       + 'adjacency keeps meaning what it says.',
    fix: 'Nothing, while the ring exists. If the ring is ever removed or dropped to the '
       + 'fill\'s colour, the fill BECOMES the boundary and this entry must be deleted so '
       + 'the row goes red.',
  },
  {
    label: 'map node body (fill vs bg)', profile: 'hi-contrast-off', render: 1.17, floor: 3.0,
    why: 'The same fact in the atmospheric palette: --panel on --bg is untouched by the '
       + 'highContrast toggle, so the fill measures 1.17 here too, and Sunna\'s #45 ruling '
       + 'answers it the same way — the ring is the identifying boundary, and since the '
       + '--map-structure remedy (#7a6b54) it clears both adjacencies in THIS palette as '
       + 'well: 3.78 edge, 3.36 ring judged, rendered. A separate entry because the ledger '
       + 'is keyed per profile — the default entry excusing this number here would be the '
       + 'exact cross-palette silence the per-profile keys exist to forbid.',
    fix: 'Same condition as the default entry: the day the ring stops being the boundary, '
       + 'delete this so the row goes red.',
  },
  {
    label: 'YOU PERISHED', profile: 'default', render: 1.97, floor: 3.0,
    why: '--blood #8a1a1a on the death screen. High contrast does not touch --blood, so '
       + 'the flip cannot reach it. `colorblindSafe` does (4.77) but that is a different '
       + 'setting with a different meaning, and turning it on by default would repaint '
       + 'danger/heal/frost/blight for every player.',
    fix: 'A palette decision about --blood, which is a LOOK change to the game and '
       + 'therefore Constantine\'s call, not a default flip.',
  },
  {
    label: 'Blood card tag (label only)', profile: 'default', render: 1.71, floor: 4.5,
    why: 'The worst contrast in the game, on the Reaver\'s staple card, and NO accessibility '
       + 'toggle can reach it: the tag colour is not --blood. It is the literal string '
       + '8A1A1A in the `color` column of content/source/cardTags.csv, applied inline as '
       + '--tag-color by src/ui/components/card.js. A second copy of the blood hex, living '
       + 'in content, invisible to every CSS override in styles/base.css. `body.cb-safe` '
       + 'remaps --blood and leaves this tag at 1.71 — the two look linked and are not.',
    fix: 'Either the CSV colours become semantic token NAMES that the accessibility '
       + 'layers can override, or that column is deleted and the tag inherits. Also the '
       + 'size: .ctag is 0.8rem, which is 6.8px at UI size S.',
  },
  {
    label: 'fight label (combat)', profile: 'default', render: 2.47, floor: 4.5,
    why: 'Not a palette problem — an OCCLUSION bug, and high contrast cannot fix a veil. '
       + '.backdrop in styles/combat.css is `position:absolute; inset:0; z-index:0` inside '
       + '.combat with `opacity:0.55`, and .topbar carries no z-index at all — so the act '
       + 'art plate paints ON TOP OF the top bar. .field was given `z-index:1` to escape '
       + 'exactly this; the top bar was forgotten. Solving the overlay algebra from the '
       + 'captured pixels gives a ~55%-opaque rgb(60,52,40) veil, which matches '
       + '.backdrop\'s own opacity. It costs the hero name 9.59 points of its declared '
       + '11.15, and the hero name then clears AA by 0.005.',
    fix: 'One declaration — a z-index on .topbar above the backdrop. Held back because it '
       + 'is a visible change to the combat screen that was not what got approved, and it '
       + 'deserves its own card and its own before/after.',
  },
];

// ---- WCAG --------------------------------------------------------------------
function lum([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ---- CDP over the global WebSocket (node ≥22) ---------------------------------
async function connectCdp(port) {
  let list;
  for (let i = 0; i < 100; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (list.length) break;
    } catch { /* browser still booting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!list || !list.length) throw new Error('CDP: no target — is the browser up?');
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('CDP: socket refused')); });
  let id = 0;
  const waiting = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id != null && waiting.has(msg.id)) {
      const { ok, no } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? no(new Error(`${msg.error.message}`)) : ok(msg.result);
    } else if (msg.method) listeners.forEach((f) => f(msg));
  };
  return {
    send(method, params = {}) {
      const n = ++id;
      ws.send(JSON.stringify({ id: n, method, params }));
      return new Promise((ok, no) => waiting.set(n, { ok, no }));
    },
    on(f) { listeners.push(f); },
    close() { ws.close(); },
  };
}

/** Navigate, wait for the app to settle, return when the screen is up. */
async function gotoScreen(cdp, url, settings) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  // TWO CHANNELS, because there are two kinds of boot and only one of them reads
  // localStorage. This is the defect Vira held #10 for: everything below used to
  // be the localStorage seed alone.
  //
  //  · TITLE SCREEN (no ?shot=) — a normal boot. localStorage is the store, so
  //    seeding sote_meta_v1 before any page script is exactly what a returning
  //    player has. Settings must exist BEFORE src/main.js runs, because
  //    applyDisplaySettings is called at module top level and a post-load write
  //    would measure the wrong body.
  //  · ?shot= SCREENS — gated onto the memory stub since #8, so sote_meta_v1 is
  //    NEVER READ and every display setting resolves to its default. The seed
  //    below reached none of them: nine profiles rendered one identical frame and
  //    this tool reported the differences it had asked for. `?shotSettings=`
  //    (src/main.js, beside pickStorage) is the channel that does reach them; it
  //    writes the same settings into that same ephemeral store, so the app
  //    resolves them through its own saves.loadMeta() and I measure its rules
  //    rather than my copy of them.
  //
  // Both are sent every time. Sending the wrong one is a no-op; deciding which to
  // send from the URL would be a second place that knows how the gate works.
  //
  // localStorage is CLEARED, not just overwritten, so the title screen offers
  // BEGIN A CLIMB and not CONTINUE across profiles. The numbers survive an
  // occupied slot (targets are looked up per screen) but a before/after pair where
  // one side has a save reads as "this change deleted my run", which is the
  // opposite of what is being claimed. (A ?shot= boot no longer writes that slot
  // at all — Rune's gate, #8 — so this is now about the localStorage era and about
  // any real save the browser profile happens to carry.)
  const seed = { ...settings, seenTutorial: true, musicVolume: 0, sfxVolume: 0 };
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.clear();
      localStorage.setItem('sote_meta_v1', ${JSON.stringify(
    JSON.stringify({ settings: seed, results: [] })
  )});`,
  });
  if (url.includes('?shot=')) {
    url += `&shotSettings=${encodeURIComponent(JSON.stringify(seed))}`;
  }
  const loaded = new Promise((ok) => {
    const off = (m) => { if (m.method === 'Page.loadEventFired') ok(); };
    cdp.on(off);
  });
  await cdp.send('Page.navigate', { url });
  await loaded;
  await new Promise((r) => setTimeout(r, 1400)); // screen transitions + sprite paint
  // FREEZE THE FRAME. Without this the two captures differ for reasons that have
  // nothing to do with the colour toggle — drifting embers, idle sprites, the
  // 140ms `transition: color` on .topbar-btn — and every moving pixel inside the
  // target's box is counted as ink. That is what made the ? button read 2.23:1
  // against a teal "backdrop" and the Blood tag report a 4.89:1 pixel brighter
  // than its own declared colour. A contrast number is a claim about a resting
  // frame; this makes the frame actually rest.
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const s = document.createElement('style');
      s.id = 'contrast-audit-freeze';
      s.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
      document.head.appendChild(s);
      return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    })()`,
    awaitPromise: true,
  });
}

// In-page: resolve a target to a rect + its computed colour + font px.
//
// The rect is the union of the client rects of the element's ASCII text runs,
// not the element box. That matters for one specific reason: a card tag reads
// "🩸 Blood", and the 🩸 is a FULL-COLOUR emoji glyph whose pixels the `color`
// property does not choose. Its brightest pixel is #f6624f — which scored the
// Blood tag at 4.89:1 and made the worst contrast in the game look like a pass,
// when the word "Blood" beside it never clears 1.62:1. Measuring the emoji
// instead of the label is measuring the adjacent thing. Restricting to the ASCII
// run also keeps borders and padding out of the ink search everywhere else.
const PROBE = `(sel, opts) => {
  const o = opts || {};
  let el;
  if (sel.startsWith('CTAG:')) {
    const want = sel.slice(5);
    el = [...document.querySelectorAll('.card .ctag')].find((n) => n.textContent.includes(want));
  } else el = document.querySelector(sel);
  if (!el) return null;
  // Union of the client rects of every ASCII-printable run in the subtree.
  // Skipped for non-text targets (a ring has no text run) — those use the box.
  let box = null;
  if (o.box) box = null; else {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = n.nodeValue;
    let i = 0;
    while (i < s.length) {
      if (!/[\\x21-\\x7E]/.test(s[i])) { i++; continue; }
      let j = i;
      while (j < s.length && /[\\x20-\\x7E]/.test(s[j])) j++;
      const rg = document.createRange();
      rg.setStart(n, i); rg.setEnd(n, j);
      for (const q of rg.getClientRects()) {
        if (q.width < 0.5 || q.height < 0.5) continue;
        box = box
          ? { l: Math.min(box.l, q.left), t: Math.min(box.t, q.top), r: Math.max(box.r, q.right), b: Math.max(box.b, q.bottom) }
          : { l: q.left, t: q.top, r: q.right, b: q.bottom };
      }
      i = j;
    }
  }
  }
  let r = box
    ? { left: box.l, top: box.t, width: box.r - box.l, height: box.b - box.t }
    : el.getBoundingClientRect();
  // Optional central sampling: scale the rect about its centre. Used by fill
  // targets whose box is rimmed by a brighter stroke (see the map node body
  // target) — the rim must not lend the fill its contrast.
  if (o.shrink) {
    const k = o.shrink;
    r = {
      left: r.left + (r.width * (1 - k)) / 2,
      top: r.top + (r.height * (1 - k)) / 2,
      width: r.width * k,
      height: r.height * k,
    };
  }
  const cs = getComputedStyle(el);
  // Authored px is what the stylesheet says; RENDERED px is what WCAG's size
  // thresholds are about. The whole app sits under body { zoom: --ui-zoom }, and
  // Auto resolves to 1.29 at 1920x1080 — so an "8px" tag reaches the eye at
  // 10.3px and a "15px" button at 19.4px. Classifying by the authored number
  // puts targets on the wrong side of the 24px large-text line.
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const authoredPx = parseFloat(cs.fontSize);
  const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
  return {
    x: Math.round(r.left), y: Math.round(r.top),
    w: Math.round(r.width), h: Math.round(r.height),
    color: o.prop === 'border-color' ? cs.borderTopColor
      : o.prop === 'stroke' ? cs.stroke
      : o.prop === 'fill' ? cs.fill
      : cs.color,
    nonText: !!o.prop,
    authoredPx, zoom, fontPx: authoredPx * zoom, bold,
    text: (el.textContent || '').trim().slice(0, 40),
  };
}`;

// In-page: force one element's own ink transparent (and back). `!important` on
// the element itself, so it beats any stylesheet rule without editing one.
const INK_OFF = `(sel, off, prop) => {
  const p = prop || 'color';
  let el;
  if (sel.startsWith('CTAG:')) {
    const want = sel.slice(5);
    el = [...document.querySelectorAll('.card .ctag')].find((n) => n.textContent.includes(want));
  } else el = document.querySelector(sel);
  if (!el) return false;
  if (off) el.style.setProperty(p, 'transparent', 'important');
  else el.style.removeProperty(p);
  return true;
}`;

// In-page: measure one rect by DIFFERENCING two captures of the same frame —
// the normal one, and one with the target's own `color` forced transparent.
//
// Differencing is what makes this trustworthy, and it took two tries to get
// right. A single capture forces you to guess the backdrop from the modal colour
// in the rect, and that guess breaks in every interesting case: a 44px title
// fills its own box (so the modal colour IS the ink and the ratio reads 1.00),
// a `.hint` contains a `<kbd>` child (so the "furthest pixel" is the child's
// text, not the target's), and a `.ctag` has a tinted fill and a border inside
// its box. Differencing needs no guess:
//
//   ink pixels = exactly the pixels that CHANGED → precisely the pixels the
//                `color` property paints. Borders, child elements, tints,
//                backgrounds, text-shadow glow and FULL-COLOUR EMOJI all hold
//                still between the two frames and are therefore treated as
//                backdrop — which is what they are. (The 🩸 in a card tag is
//                not palette-governed: `color: transparent` doesn't move it.
//                Measuring the emoji instead of the word "Blood" would flatter
//                the tag by ~1.5 points.)
//   backdrop   = each ink pixel's OWN location in the transparent frame, so
//                gradients and tints are handled per-pixel, not averaged.
//
// Three numbers out, because small text needs all three:
//   spec     — declared colour vs the median backdrop under the ink. The
//              palette's promise; what a stylesheet audit sees.
//   render   — the BEST-formed ink pixel. Generous to the game on purpose: if
//              even the strongest stroke pixel fails, the target definitively
//              fails, and no reviewer has to argue about antialiasing.
//   renderP50 — the median ink pixel: closer to what the eye integrates over a
//              whole word, and always the grimmer number at small sizes.
const MEASURE = `async (dataUrlA, dataUrlB, rect, colorStr) => {
  const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
  const [a, b] = await Promise.all([load(dataUrlA), load(dataUrlB)]);
  const dpr = a.width / window.innerWidth;
  const X = Math.max(0, Math.round(rect.x * dpr)), Y = Math.max(0, Math.round(rect.y * dpr));
  const W = Math.min(a.width - X, Math.max(1, Math.round(rect.w * dpr)));
  const H = Math.min(a.height - Y, Math.max(1, Math.round(rect.h * dpr)));
  const grab = (img) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, X, Y, W, H, 0, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  };
  const da = grab(a), db = grab(b);
  const L = (r, gg, bb) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bb);
  };
  const ratio = (p, q) => {
    const [hi, lo] = [L(p[0], p[1], p[2]), L(q[0], q[1], q[2])].sort((u, v) => v - u);
    return (hi + 0.05) / (lo + 0.05);
  };
  // Threshold of 6/255 per channel: below that it is capture noise, not ink.
  const ink = [];
  const bgL = [];
  // Adjacency clusters (#45 — Sunna's ruling): a glyph's identifying boundary
  // must clear the floor against EACH adjacent rendered colour, so a ring that
  // straddles fill and field is judged twice. Backdrops quantize to 16-step
  // buckets; each cluster keeps its own best-formed ink pixel. Sub-5% clusters
  // are AA blend slivers at the fill/field seam, not an adjacency.
  const clusters = new Map();
  let bestIdx = -1, bestR = -1;
  for (let i = 0; i < da.length; i += 4) {
    const d0 = Math.abs(da[i] - db[i]), d1 = Math.abs(da[i + 1] - db[i + 1]), d2 = Math.abs(da[i + 2] - db[i + 2]);
    if (d0 + d1 + d2 < 6) continue;
    const p = [da[i], da[i + 1], da[i + 2]];
    const q = [db[i], db[i + 1], db[i + 2]];
    const r = ratio(p, q);
    ink.push(r);
    bgL.push(q);
    const k = (q[0] >> 4) + ',' + (q[1] >> 4) + ',' + (q[2] >> 4);
    const c = clusters.get(k) || { n: 0, bestR: -1, bg: q };
    c.n++;
    if (r > c.bestR) { c.bestR = r; c.bg = q; }
    clusters.set(k, c);
    if (r > bestR) { bestR = r; bestIdx = ink.length - 1; }
  }
  if (!ink.length) return { inkPixels: 0 };
  const adj = [...clusters.values()]
    .filter((c) => c.n >= Math.max(8, ink.length * 0.05))
    .sort((u, v) => v.n - u.n);
  ink.sort((u, v) => u - v);
  // Median backdrop under the ink, for the spec comparison.
  const bys = bgL.slice().sort((u, v) => L(u[0], u[1], u[2]) - L(v[0], v[1], v[2]));
  const bg = bys[bys.length >> 1];
  const m = colorStr.match(/[\\d.]+/g).map(Number);
  const alpha = m.length > 3 ? m[3] : 1;
  const spec = [0, 1, 2].map((j) => Math.round(m[j] * alpha + bg[j] * (1 - alpha)));
  const hex = (p) => '#' + p.map((v) => v.toString(16).padStart(2, '0')).join('');
  const rd = (v) => Math.round(v * 100) / 100;
  return {
    bg: hex(bg), specHex: hex(spec),
    spec: rd(ratio(spec, bg)),
    render: rd(bestR),
    renderP50: rd(ink[ink.length >> 1]),
    adj: adj.map((c) => ({ bg: hex(c.bg), render: rd(c.bestR), n: c.n })),
    inkPixels: ink.length,
    boxPixels: W * H,
  };
}`;

async function evalIn(cdp, fnSrc, args) {
  const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
    functionDeclaration: `function(){ return (${fnSrc}).apply(null, ${JSON.stringify(args)}); }`,
    executionContextId: undefined,
    objectId: (await cdp.send('Runtime.evaluate', { expression: 'window' })).result.objectId,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}

// ---- run ---------------------------------------------------------------------
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const onlyProfile = arg('--profile', null);

// ---- --selftest ---------------------------------------------------------------
// THE KNOWN-BAD IS A REAL PALETTE EDIT, AND IT ENTERS WHERE A PALETTE ENTERS.
//
// The defect class this gate exists to catch is one sentence: somebody changes a
// colour token and a target the player reads drops under the WCAG floor. So the
// plant IS that — one token in styles/base.css, dimmed. It then travels every
// stage a real palette change travels: the file on disk, serve(), the browser,
// the cascade, the ?shotSettings profile, the rendered glyph pixels, the capture,
// the luminance maths, the KNOWN_BELOW ledger, and the gate's own verdict. There
// is no fixture here and no ratio is computed by this block.
//
// `--muted` under `body.hi-contrast` is the token chosen because highContrast
// DEFAULTS TRUE: it is what a first-boot player receives, so dimming it is a
// change to the shipped default palette and lands in the `default` profile the
// gate judges. Three targets ride it (Act/Floor, SEED, keyboard hint) and all
// three sit comfortably above the floor at 6.33/6.33/6.79 on a healthy tree —
// so a red here cannot be the tree's standing state leaking in.
//
// The child is spawned rather than re-entered in-process: this file measures on
// import, and a selftest that shares module state with the run it judges is the
// witness-sharing-plumbing failure I hit on 2026-08-14. The child runs the real
// CLI, the real gate, and its exit code and stdout are the evidence.
if (args.includes('--selftest')) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const BASE = resolve(ROOT, 'styles/base.css');
  const ARMS = [
    {
      name: 'subfloor',
      find: '  --muted: #a89571;\n  --line: #6a5b43;',
      replace: '  --muted: #5f5748;\n  --line: #6a5b43;',
      why: 'the shipped high-contrast --muted dimmed to #5f5748 — the palette edit this gate exists to catch',
      // Named rather than counted: a gate that merely "exits 1" would be
      // satisfied by the standing BLIND rows below and prove nothing new.
      expectRows: ['Act/Floor', 'SEED', 'keyboard hint'],
    },
  ];
  const runChild = () => new Promise((res) => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url), '--gate', '--gated-only'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { out += d; });
    c.on('exit', (code) => res({ code, out }));
  });

  console.log('contrast-audit --selftest — the gate\'s own known-bad, by the palette door.\n');
  const before = readFileSync(BASE, 'utf8');
  let bad = 0;
  for (const arm of ARMS) {
    if (!before.includes(arm.find)) {
      console.log(`  ${arm.name}: PLANT DID NOT APPLY — the anchor is gone from styles/base.css.`);
      console.log('    A known-bad that cannot be planted proves nothing; re-point it before trusting this gate.');
      bad++; continue;
    }
    let got;
    try {
      writeFileSync(BASE, before.replace(arm.find, arm.replace));
      got = await runChild();
    } finally { writeFileSync(BASE, before); }
    // The gate must NAME the rows, at the gated profile, as NEW failures.
    const newBlock = /--gate: \d+ NEW failure\(s\)[\s\S]*?(?=\n\ncontrast-audit --gate:|$)/.exec(got.out);
    const named = arm.expectRows.filter((r) => newBlock && newBlock[0].includes(`${r} [default]`));
    console.log(`  ${arm.name}: ${arm.why}`);
    if (named.length === arm.expectRows.length && got.code === 1) {
      for (const line of (newBlock[0].split('\n').filter((l) => arm.expectRows.some((r) => l.includes(`${r} [default]`))))) {
        console.log(`    RED  ${line.trim()}`);
      }
      console.log(`    exit ${got.code}; all ${named.length} expected rows named as NEW failures at the gated profile.`);
    } else {
      bad++;
      console.log(`    DID NOT FIRE as required — exit ${got.code}, named ${named.length}/${arm.expectRows.length} expected rows.`);
      console.log(`    ${newBlock ? newBlock[0].split('\n').slice(0, 6).join('\n    ') : 'no NEW-failure block in the child output at all'}`);
    }
  }
  // THE CONTROL. The restore has to be proven, and a row that is red on a healthy
  // tree is not evidence. This asserts the planted rows are NOT named — never
  // that the gate exits 0, because it does not: see the standing red below.
  const clean = await runChild();
  const stillNamed = ARMS.flatMap((a) => a.expectRows).filter((r) => new RegExp(`${r} \\[default\\] — `).test(clean.out));
  console.log(`\n  control: restored tree — ${stillNamed.length ? `STILL RED: ${stillNamed.join(', ')}` : 'none of the planted rows is named; the plant is gone'}`);
  console.log(`
DOOR: the known-bad is an edit to styles/base.css, a real shipped stylesheet, served by the real
      serve() and rendered by the real browser. It travels the cascade, the ?shotSettings profile,
      the captured pixels, the luminance maths, the KNOWN_BELOW ledger and the gate's own verdict.
      No ratio in this block is computed by the selftest; every number above came from a pixel.
NOT PASSED: only the NEW-failure class is planted. REGRESSED (a KNOWN_BELOW row worsening past its
      0.15 slack) has no plant here. BLIND needs none right now and that is not good news — see below.
STANDING RED, on real code, at dev = 5244543 and unplanted: all three #45 map rows are BLIND in BOTH
      gated profiles. \`?shot=map\` draws 2 nodes and 0 edges (fog), and both survivors carry an
      excluded class (reachable, boss), so \`.map-edge:not(.traveled)\` and the plain-node selector
      match nothing. The gate has been reporting six BLIND rows rather than measuring the map
      structure it was extended to protect (#45). BLIND fired correctly — the instrument said it had
      lost sight instead of going quiet, which is the one thing that went right here. Re-pointing the
      probe at a state where the graph is drawn is a separate act; this line is the record, not the fix.
BOUNDARY: one plant, one token, one profile family, one viewport, one font stack. Proof this gate CAN
      go red on a real palette change — not proof it catches a palette change shaped differently.`);
  console.log(bad ? `\nSELFTEST: ${bad} arm(s) did not fire` : `\nSELFTEST: ${ARMS.length}/${ARMS.length} arms observed RED by the palette door, plant reverted`);
  process.exit(bad || stillNamed.length ? 1 : 0);
}
const asJson = args.includes('--json');
const gate = args.includes('--gate');
const shotDir = arg('--shots', null);
const width = +arg('--width', 1920);
const height = +arg('--height', 1080);

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) { console.error('contrast-audit: no Chrome/Chromium found (set CHROME_PATH).'); process.exit(1); }

const { server, port } = await serve({ root: ROOT, port: 8137, open: false });
// THE DEBUGGING PORT IS NOT GUESSED, AND THIS IS A CORRECTNESS FIX, NOT TIDINESS.
//
// This line was `const dbg = 9222 + (process.pid % 400)` — the range 9222..9621,
// which CONTAINS 9431, the port tools/release-shots.mjs pins. One run in four
// hundred, this tool picked that port while another seat's harness held it, and
// the failure is silent and total: the spawn below cannot bind, its complaint
// goes into the stderr handler that discards everything, and then connectCdp()
// polls `http://127.0.0.1:9431/json/list` and CONNECTS TO THE OTHER SEAT'S
// BROWSER. It then drives that browser, navigates it, toggles ink on its page
// and reports contrast ratios measured on somebody else's run. Nothing in the
// output says so. (Vira found the line; the property is Marina's — A RUN MUST
// PROVE THE BROWSER IT MEASURED IS THE ONE IT STARTED.)
//
// Port 0 asks the OS for a free port and Chrome prints the endpoint it actually
// got on its own stderr. Reading it from THIS child is the proof: there is no
// number to collide on, and no way for this tool to reach a browser it did not
// start. If the child never announces one, that is a hard exit — the old code's
// way of "handling" it was to find a stranger's browser and carry on.
//
// This is the one-line half of the port work. The HARNESS half — release-shots
// pinning 9431 while serve() bumps its HTTP port, so a second run drives the
// first run's browser — is Bjorn's, in his file, and is not touched here.
const child = spawn(browser, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  // Both flags are load-bearing, not tidiness. Without --disable-lcd-text,
  // subpixel antialiasing paints COLOURED fringes around every glyph: a solid
  // `--panel` box that computes to rgb(36,29,21) captured pixels as far off as
  // #2e3635, which fed a teal "backdrop" into the ratio and moved answers by
  // ~0.9. Greyscale AA also makes the small-type story a pure-luminance one,
  // which is the claim being made. --force-color-profile=srgb stops the capture
  // being colour-managed on the way out, so a captured pixel equals the
  // computed pixel — verified: #241d15 in, #241d15 out.
  '--disable-lcd-text', '--force-color-profile=srgb',
  `--window-size=${width},${height}`,
  '--remote-debugging-port=0',
  '--user-data-dir=' + resolve('/tmp', `ca-profile-${process.pid}`),
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
// The port this child actually got, read off the line it prints itself.
const dbg = await new Promise((res, rej) => {
  let buf = '';
  const onData = (d) => {
    buf += d;
    const m = /DevTools listening on ws:\/\/[^:/]+:(\d+)\//.exec(buf);
    if (m) { child.stderr.off('data', onData); child.stderr.on('data', () => {}); res(+m[1]); }
  };
  child.stderr.on('data', onData);
  child.on('error', rej);
  setTimeout(() => rej(new Error(`the browser announced no DevTools endpoint in 15s:\n${buf.slice(-400)}`)), 15000);
}).catch((e) => {
  console.error(`contrast-audit: ${e.message}`);
  server.close(); child.kill(); process.exit(2);
});

// --gated-only renders exactly the profiles `--gate` judges and nothing else.
// This is NOT the partial run the gate refuses below: that refusal exists because
// a `--profile` invocation can omit a GATED profile and then exit 0 having judged
// nothing there. This flag omits only profiles the gate never judged — the
// verdict is bit-for-bit the one the full matrix produces, at a quarter of the
// renders. The table it prints is narrower, and says so.
const gatedOnly = args.includes('--gated-only');
const GATED_PROFILES = ['default', 'hi-contrast-off'];
const profiles = onlyProfile
  ? { [onlyProfile]: PROFILES[onlyProfile] }
  : (gatedOnly
    ? Object.fromEntries(GATED_PROFILES.map((p) => [p, PROFILES[p]]))
    : PROFILES);
if (gatedOnly) {
  console.log(`(--gated-only: rendering ${GATED_PROFILES.join(' + ')} — the profiles --gate judges. `
    + `The other ${Object.keys(PROFILES).length - GATED_PROFILES.length} profiles are NOT measured in this run and this table is not the full matrix.)`);
}
if (onlyProfile && !PROFILES[onlyProfile]) {
  console.error(`contrast-audit: unknown profile '${onlyProfile}'. Have: ${Object.keys(PROFILES).join(', ')}`);
  server.close(); child.kill(); process.exit(2);
}

const rows = [];
try {
  const cdp = await connectCdp(dbg);
  for (const [pname, settings] of Object.entries(profiles)) {
    for (const screen of ['', 'map', 'combat', 'death']) {
      const targets = TARGETS.filter((t) => t.screen === screen);
      if (!targets.length) continue;
      await gotoScreen(cdp, `http://localhost:${port}/${screen ? `?shot=${screen}` : ''}`, settings);
      const shot = async () => `data:image/png;base64,${(await cdp.send('Page.captureScreenshot', { format: 'png' })).data}`;
      const dataUrlA = await shot();
      if (shotDir) {
        writeFileSync(resolve(shotDir, `${pname}-${screen || 'title'}.png`), Buffer.from(dataUrlA.split(',')[1], 'base64'));
      }
      for (const t of targets) {
        const probe = await evalIn(cdp, PROBE, [t.sel, { prop: t.prop, box: t.box, shrink: t.shrink }]);
        if (!probe) { rows.push({ profile: pname, ...t, missing: true }); continue; }
        // Frame B: this target's own ink made transparent, everything else held.
        await evalIn(cdp, INK_OFF, [t.sel, true, t.prop]);
        await cdp.send('Runtime.evaluate', {
          expression: 'new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))',
          awaitPromise: true,
        });
        const dataUrlB = await shot();
        await evalIn(cdp, INK_OFF, [t.sel, false, t.prop]);
        const m = await evalIn(cdp, MEASURE, [dataUrlA, dataUrlB, probe, probe.color]);
        // WCAG "large text": ≥24px, or ≥18.66px when bold.
        // WCAG 1.4.11 puts non-text UI components at 3.0 whatever their size;
        // 1.4.3 puts text at 4.5, or 3.0 once it is large (>=24px, or >=18.66 bold).
        const large = probe.nonText || probe.fontPx >= 24 || (probe.bold && probe.fontPx >= 18.66);
        const floor = large ? 3.0 : 4.5;
        // What the floor judges, per target kind (#45 — Sunna's ruling):
        //   adjacency — the boundary's WORST adjacent colour. A ring that clears
        //               the field but melts into its own fill has no boundary on
        //               that side, so every adjacency must clear on its own.
        //   median    — solid fills. The best pixel of a solid region is an AA
        //               blend against whatever overlaps it (here, the node
        //               label's glyph edges re-blending when the fill goes
        //               transparent read 3.54 while the fill itself sits at
        //               1.17). Best-pixel generosity exists for antialiased
        //               type; for paint, the median IS the fill.
        const judged = t.median ? m.renderP50
          : t.adjacency && m.adj && m.adj.length ? Math.min(...m.adj.map((a) => a.render))
          : m.render;
        rows.push({
          profile: pname, label: t.label, screen: screen || 'title', sel: t.sel,
          text: probe.text, authoredPx: probe.authoredPx, zoom: probe.zoom,
          fontPx: Math.round(probe.fontPx * 10) / 10, large, floor,
          ...m,
          judged,
          pass: m.inkPixels ? judged >= floor : null,
          specPass: m.inkPixels ? m.spec >= floor : null,
        });
      }
    }
  }
  cdp.close();
} finally {
  child.kill();
  server.close();
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  let lastProfile = null;
  for (const r of rows) {
    if (r.profile !== lastProfile) {
      lastProfile = r.profile;
      console.log(`\n── profile: ${r.profile} ${JSON.stringify(PROFILES[r.profile])}`);
      console.log('     spec  render    p50  floor    px  target        (px = rendered, authored x zoom)');
    }
    if (r.missing) { console.log(`  ?      —      —      —      —     —  ${r.label} (selector not found: ${r.sel})`); continue; }
    if (!r.inkPixels) { console.log(`  ?      —      —      —      —     —  ${r.label} (no ink pixels — invisible or clipped)`); continue; }
    const mark = r.pass ? '✓' : '✗';
    // The gap between declared and delivered has two causes and this tool cannot
    // tell them apart: antialiasing (small type never reaching full colour) and
    // OCCLUSION (something translucent painted on top). Both were present here —
    // the combat top bar loses 7.27 points to the act backdrop plate, which is
    // not antialiasing at all. So the note names the gap and refuses to diagnose.
    const drift = r.spec - r.render >= 0.4
      ? `  ← delivers ${(r.spec - r.render).toFixed(2)} less than declared` : '';
    // Adjacency rows are judged on their worst adjacent colour, so the verdict
    // can disagree with the render column — print the per-adjacency numbers.
    const adjNote = r.adj && r.adj.length > 1 && r.judged !== r.render
      ? `  ← judged ${r.judged} (worst adjacency: ${r.adj.map((a) => `${a.render} vs ${a.bg}`).join(', ')})` : '';
    console.log(
      `  ${mark} ${String(r.spec).padStart(6)} ${String(r.render).padStart(6)} ${String(r.renderP50).padStart(6)}`
      + ` ${String(r.floor).padStart(6)} ${String(r.fontPx).padStart(5)}  ${r.label}${drift}${adjNote}`
    );
  }
  const measured = rows.filter((r) => !r.missing && r.inkPixels);
  const fails = measured.filter((r) => !r.pass);
  console.log(`\n${measured.length} measured · ${fails.length} below the WCAG AA floor (best rendered pixel).`);
  // Named boundary, in the run's own output (SOP 3, CI expectation 4).
  console.log(
    'Boundary: this measures TEXT contrast plus the named non-text targets (button\n'
    + 'rings; map structure since #45), at one viewport, one font stack, with\n'
    + 'hover/focus states unvisited. Other non-text ink — bars, dividers, fog panels,\n'
    + 'state-coloured nodes (elite/boss/visited/current ride tokens this never judges)\n'
    + '— plus colour-blind confusability and motion stay unmeasured. A green run is\n'
    + 'not an accessibility pass.\n'
    + 'This line said "one zoom (Auto)" until 2026-07-28. That was TRUE of every ?shot=\n'
    + 'screen, for the wrong reason: those screens ignored the profile entirely, so ui-S\n'
    + 'really did render at Auto while this table printed ui-S next to it. A boundary can\n'
    + 'be accurate and still be a lie about why. Fixed via ?shotSettings= (Vira, #10).'
  );
}

if (gate) {
  // WHICH ROWS THE GATE JUDGES — and why it is not just `default`. `default`
  // judges every target: it is what a first-boot player receives. But
  // highContrast defaults TRUE, so the ATMOSPHERIC palette's values ship only
  // under `hi-contrast-off` — and until 2026-08-06 this gate filtered to
  // `default` alone, which meant nine profiles rendered, one judged, and a
  // sub-floor plant in --map-structure (the exact value the #45 remedy ships)
  // exited 0. Observed red by Vira on the #45 branch before this map existed.
  // So the #45 map-structure rows are additionally judged in `hi-contrast-off`.
  const MAP45 = new Set([
    'map edge (untraveled road)',
    'map node ring (plain)',
    'map node body (fill vs bg)',
  ]);
  const GATED = {
    default: () => true,
    'hi-contrast-off': (label) => MAP45.has(label),
  };
  // A partial run cannot gate: a `--profile` invocation that omits a gated
  // profile would judge nothing there and exit 0 — the same silence this block
  // exists to close. Absent is unknown, and unknown blocks (SOP 2).
  const absent = Object.keys(GATED).filter((p) => !profiles[p]);
  if (absent.length) {
    console.error(`\ncontrast-audit --gate: gated profile(s) not rendered this run: ${absent.join(', ')}.`);
    console.error(`  The gate judges ${Object.keys(GATED).join(' + ')} — run --gate without --profile.`);
    process.exit(1);
  }
  const gated = rows.filter((r) => GATED[r.profile] && GATED[r.profile](r.label));
  // A gated row with no pixels does not drop out silently: a selector that
  // stops matching, or ink that stops rendering, is the gate going BLIND — the
  // target did not go green, the instrument lost sight of it.
  const blind = gated.filter((r) => r.missing || !r.inkPixels);
  const measured = gated.filter((r) => !r.missing && r.inkPixels);
  // The ledger is keyed per profile: an excused number in one palette must not
  // silence the same target in another.
  const known = new Map(KNOWN_BELOW.map((k) => [`${k.profile} :: ${k.label}`, k]));
  const newly = [];
  const worse = [];
  const stale = [];
  for (const r of measured) {
    const k = known.get(`${r.profile} :: ${r.label}`);
    const v = r.judged ?? r.render; // the same number `pass` was decided on
    if (r.pass) { if (k) stale.push({ r, k }); continue; }
    if (!k) { newly.push(r); continue; }
    // 0.15 of slack: font stacks and GPU-less rasterisation move the last digit.
    if (v < k.render - 0.15) worse.push({ r, k });
  }
  if (newly.length) {
    console.error(`\ncontrast-audit --gate: ${newly.length} NEW failure(s) at gated profiles:`);
    for (const r of newly) console.error(`  ${r.label} [${r.profile}] — ${r.judged ?? r.render}:1 at ${r.fontPx}px (floor ${r.floor})`);
  }
  for (const { r, k } of worse) {
    console.error(`\ncontrast-audit --gate: ${r.label} [${r.profile}] REGRESSED — ${r.judged ?? r.render}:1, was ${k.render}:1`);
  }
  for (const r of blind) {
    console.error(`\ncontrast-audit --gate: ${r.label} [${r.profile}] is BLIND — ${r.missing ? `selector not found: ${r.sel}` : 'no ink pixels (invisible or clipped)'}`);
  }
  for (const { r, k } of stale) {
    console.log(`\ncontrast-audit --gate: ${r.label} [${r.profile}] now PASSES at ${r.judged ?? r.render}:1 (recorded ${k.render}).`);
    console.log(`  Fixed? Delete its KNOWN_BELOW entry in this file — a stale allowlist is how a`);
    console.log(`  gate goes quiet. Not failing the run for good news, but this line will not stop.`);
  }
  if (newly.length || worse.length || blind.length) process.exit(1);
}
process.exit(0);
