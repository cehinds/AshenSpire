// src/ui/uiContent.js — shared UI presentation data.
//
// The map, combat, and co-op screens all draw the same things — map node
// types, act titles, enemy intents. These used to be hardcoded (and drifting)
// in each screen. This is the single source so their icons, labels, and prose
// can't diverge. Pure presentation data + tiny pure helpers, no game state.

import { balance } from '../content/balance.js';

// ---- status tooltip tokens (#61) --------------------------------------------
// Status tooltips carry {tokens} bound to the row's OWN knobs, so the prose
// can never restate a number the table holds (Law 1 clause 2 — a literal in
// tooltip prose is a copy nothing syncs). One substitution home; a token that
// resolves to nothing stays visible as its literal '{...}' — a loud defect,
// not a silent blank.
export function statusTooltipText(def) {
  let t = def.tooltip || '';
  const sub = (token, v) => {
    if (v != null) t = t.split(`{${token}}`).join(String(v));
  };
  if (def.proc) {
    sub('proc.threshold', def.proc.threshold);
    sub('proc.burstPercent', def.proc.burstPercent);
    sub('proc.burstMin', def.proc.burstMin);
    sub('proc.burstMax', def.proc.burstMax);
    sub('proc.poiseDamage', def.proc.poiseDamage);
  }
  if (def.resists) sub('resists.percent', def.resists.percent);
  if (def.taggedVulnerability) sub('tv.pct', Math.round((def.taggedVulnerability.mult - 1) * 100));
  if (def.decay && typeof def.decay === 'object') sub('decay.duration', def.decay.duration);
  return t;
}

// One typed instance presentation for both combat clients. A registered
// percent payload is not a generic stack count; its duration is a separate
// clock and must be named separately.
export function statusInstancePresentation(def, inst) {
  const rawValue = inst && inst.meter ? inst.meter.value : (inst && inst.stacks) || 0;
  const valueToken = def.instancePresentation?.valueToken || 'stacks';
  const durationText = inst && Number.isFinite(inst.duration)
    ? `${inst.duration} ${inst.duration === 1 ? 'turn' : 'turns'}` : '';
  const valueText = valueToken === 'percent' ? `${rawValue}%` : String(rawValue);
  const label = valueToken === 'percent'
    ? `${def.name} ${valueText}${durationText ? ` · ${durationText}` : ''}`
    : `${def.name} ×${rawValue}`;
  return {
    valueToken,
    valueText,
    durationText,
    label,
    tooltip: `${statusTooltipText(def)}${durationText ? ` Turns left: ${inst.duration}.` : ''}`,
    semantic: { statusId: def.id, valueToken, ariaLabel: label },
  };
}

/** Pure attribute map shared by both combat clients. */
export function statusInstanceSemanticAttrs(presentation) {
  return {
    'data-status-id': presentation.semantic.statusId,
    'data-status-value-token': presentation.semantic.valueToken,
    'aria-label': presentation.semantic.ariaLabel,
  };
}

// ---- map node types ---------------------------------------------------------
export const NODE_TYPES = {
  monster: { icon: '⚔', name: 'Monster', blurb: 'A fight — cinders and a card reward.' },
  fight: { icon: '⚔', name: 'Monster', blurb: 'A fight — cinders and a card reward.' },
  elite: { icon: '☠', name: 'Elite', blurb: 'A hard fight. Drops a relic.' },
  boss: { icon: '👁', name: 'Boss', blurb: 'The act boss.' },
  shrine: { icon: '♨', name: 'Shrine of Emberlight', blurb: 'Rest (heal), smith (upgrade a card), or mend an ally.' },
  merchant: { icon: '⚖', name: 'Merchant', blurb: 'Cards, relics, flasks, card removal.' },
  treasure: { icon: '▣', name: 'Treasure', blurb: 'A relic, free.' },
  event: { icon: '?', name: 'Unknown', blurb: 'An event, a fight, a shrine… who can say.' },
  unknown: { icon: '?', name: 'Unknown', blurb: 'An event, a fight, a shrine… who can say.' },
};
export const nodeIcon = (type) => (NODE_TYPES[type] || {}).icon || '?';
export const nodeName = (type) => (NODE_TYPES[type] || {}).name || String(type);
export const nodeBlurb = (type) => (NODE_TYPES[type] || {}).blurb || '';

// Tints for the map glyphs. Here rather than in the map's markup for the reason
// this file already claims in its header — one source, or they diverge.
export const NODE_TINT = {
  elite: 'var(--ember)',
  boss: 'var(--ember)',
  shrine: 'var(--gold)',
  merchant: 'var(--grace)',
  treasure: 'var(--gold)',
};

/**
 * legendEntries() → [{ icon, name, tint }], one row per distinct glyph.
 *
 * Bjorn cold-played the map and could not identify `👁`. It is the BOSS — the
 * most important node on the board — and it was missing from the legend, because
 * the legend was hand-written in map.js while the icons live here, in a file
 * whose own header says it is the single source so they "can't diverge".
 *
 * A claim of single-sourcing with an unchecked second copy beside it. Deriving
 * the legend means a new node type appears in it without anyone remembering to,
 * and the hardcoded list dies — which is the proof the collapse was real rather
 * than a layer of indirection (Bjorn's criterion).
 *
 * Aliases (monster/fight, event/unknown) collapse to one row by glyph.
 */
export function legendEntries() {
  const seen = new Set();
  const out = [];
  for (const [type, def] of Object.entries(NODE_TYPES)) {
    if (seen.has(def.icon)) continue;
    seen.add(def.icon);
    out.push({ icon: def.icon, name: def.name, tint: NODE_TINT[type] || '' });
  }
  return out;
}

// ---- act titles -------------------------------------------------------------
export const ACT_NAMES = {
  1: 'ACT I — THE FALLOW MARCHES',
  2: 'ACT II — THE STITCHED COURT',
  3: 'ACT III — THE ASHEN CROWN',
};
// Endless Spire: acts past 3 reuse the act 1-3 names with a "· CYCLE n" marker.
// The cycling arithmetic is `actPlate` (below, with the per-act art it now also
// serves) and the count is the NUMBER OF NAMES WRITTEN, asked rather than typed —
// this line held a literal `3` beside a table of three, which is one fact in two
// places and would have gone wrong the day a fourth act was named.
export const ACT_NAME_COUNT = Object.keys(ACT_NAMES).length;
export function actTitle(actNumber) {
  const base = ACT_NAMES[actPlate(actNumber, ACT_NAME_COUNT)] || `ACT ${actNumber}`;
  const loop = Math.floor((actNumber - 1) / ACT_NAME_COUNT);
  return loop > 0 ? `${base} · CYCLE ${loop + 1}` : base;
}

// ---- enemy intents ----------------------------------------------------------
// `iv` is a preview/snapshot intent:
//   { kind, moveId?, damage?, hits?, block?, delayed?, pending?, totalDamage? }
export const INTENT_ICONS = { attack: '⚔', block: '🛡', buff: '↑', debuff: '☾', staggered: '✦', unknown: '?' };

// Solo (previewIntent) supplies { kind, damage, hits, block, delayed, pending,
// totalDamage } and marks unknown via kind:'unknown'; the co-op snapshot intent
// supplies the same fields plus moveId (null when unknown). These helpers key on
// kind + field presence so both shapes render identically.
const isUnknownIntent = (iv) => !iv || iv.kind === 'unknown' || iv.moveId === null;

/** The badge shown over an enemy → { cls, html }. */
export function intentBadge(iv) {
  if (isUnknownIntent(iv)) return { cls: 'unknown', html: '?' };
  if (iv.kind === 'staggered') return { cls: 'staggered', html: '✦ STAGGERED' };
  if (iv.damage != null) {
    const n = iv.hits > 1 ? `${iv.damage}×${iv.hits}` : `${iv.damage}`;
    return { cls: `attack${iv.delayed ? ' delayed' : ''}`, html: `<span class="ic">${INTENT_ICONS.attack}</span>${n}${iv.delayed ? ' ⌛' : ''}` };
  }
  if (iv.block != null) return { cls: 'block', html: `<span class="ic">${INTENT_ICONS.block}</span>` };
  if (iv.kind === 'buff') return { cls: 'buff', html: `<span class="ic">${INTENT_ICONS.buff}</span>` };
  if (iv.kind === 'debuff') return { cls: 'debuff', html: `<span class="ic">${INTENT_ICONS.debuff}</span>` };
  return { cls: iv.kind || 'unknown', html: '?' };
}

/** Intent hover tooltip. `victim` names who attacks/debuffs hit ('you' solo,
 *  'each hero' in co-op). Reads totalDamage/pending when the caller has them. */
export function intentTooltip(iv, { victim = 'you' } = {}) {
  if (isUnknownIntent(iv)) return '<div class="tt-title">Intent: Unknown</div>';
  if (iv.kind === 'staggered') return `<div class="tt-title">Staggered</div>Poise broken — this enemy's turn is skipped and it takes +50% damage.`;
  if (iv.damage != null) {
    const total = iv.totalDamage != null && iv.hits > 1 ? ` (${iv.totalDamage} total)` : '';
    let t = `<div class="tt-title">Intent: Attack</div>Attacking ${victim} for <b>${iv.damage}${iv.hits > 1 ? ` × ${iv.hits}${total}` : ''}</b> damage (modifiers included).`;
    if (iv.pending) t += '<br><b>Committed:</b> this delayed attack lands this coming turn — Stagger cancels it.';
    else if (iv.delayed) t += '<br><b>Delayed:</b> it holds this turn and strikes the next. Stagger cancels it.';
    return t;
  }
  if (iv.block != null) return '<div class="tt-title">Intent: Defend</div>Gaining Block.';
  if (iv.kind === 'buff') return '<div class="tt-title">Intent: Buff</div>Strengthening itself.';
  if (iv.kind === 'debuff') return `<div class="tt-title">Intent: Debuff</div>Hindering ${victim}.`;
  return '<div class="tt-title">Intent: Unknown</div>';
}

// ---- act backdrops ---------------------------------------------------------
// One rendered plate per act (tools/backdrops-blender.py → assets/bg/*.webp,
// styled by .backdrop.act-N in combat.css). Endless loops past act 3, so the
// act cycles back through the three plates rather than rendering art-less.
export const BACKDROP_ACTS = balance.ui.backdropActs;
export function backdropClass(actNumber) {
  return `backdrop act-${actPlate(actNumber, BACKDROP_ACTS)}`;
}

// ---- map parchment (the fog's undiscovered ground) --------------------------
//
// THREE AUTHORED LOOKS, ONE PER ACT, BOUND BY NAME — Law 1 clause 4, and the
// backdrop plates directly above are the precedent this copies rather than
// invents. `assets/map/parchment_act1.webp`, `_act2`, `_act3`; no registration
// list anywhere, so Freja drops a file in and the act wears it.
//
// GENERATED PARCHMENT WAS REFUSED, and on Law 0 rather than on budget: art
// derived from the graph COUPLES THE FLAVOUR LAYER TO `mapgen`, and Constantine
// now turns `floors` and `columns` himself — so a knob he reaches for to shorten
// a run would silently change the art. A tunable that moves a thing its turner
// was not thinking about is exactly clause 5's silent-plausible-derivation.
//
// ~~UNTIL THE ART EXISTS THE GROUND IS A DERIVED PLACEHOLDER and the screen says
// so rather than this comment~~ — STRUCK 2026-08-08 by Sunna. It did not say so.
// The three files NEVER EXISTED, the `<image>` resolved to nothing exactly as
// this paragraph promised, and what a player got under fog was a flat wash: no
// paper, no grain, no border, on a screen that is 95% ground. A missing thing
// that renders as "fine, just flat" is invisible, and this one was invisible for
// as long as the hook has existed.
//
// THE PLATES NOW EXIST AND ARE GENERATED, on Constantine's standing constraint
// ("no billing, keep everything free"): `tools/parchment.mjs` writes three
// feTurbulence sheets — blotch, fibre, grain — about two kilobytes each, from
// the plate INDEX and nothing else. The refusal above is untouched and still
// binds: the only input is the index, never the graph, so no knob he turns to
// shorten a run can move the paper.
//
// THE PER-ACT TONE IS STILL CSS'S AND THE PLATES CARRY NO COLOUR — one home for
// that datum (`--fog-parchment`), one reader that paints it, one grey texture
// laid over it. FREJA STILL OWNS THE ACTUAL LOOK: these are the same three
// filenames, so authored art replaces them by overwriting, and nothing else in
// the tree moves.
export const PARCHMENT_ACTS = balance.ui.parchmentActs;
/**
 * THE PLATE'S FILE TYPE, one home and one token.
 *
 * `.svg` because the plate has to EXIST and that is the medium this repo can
 * generate for free (`tools/parchment.mjs`). It is a const rather than a
 * literal in the template below because the day authored `.webp` plates land,
 * the whole of that change should be this line plus three files — and because a
 * literal here would be a second copy of a fact `tools/parchment.mjs`,
 * `tools/bundle.mjs`'s MIME table and the act-plate test all depend on.
 */
export const PARCHMENT_EXT = '.svg';
export function parchmentAsset(actNumber) {
  return `assets/map/parchment_act${actPlate(actNumber, PARCHMENT_ACTS)}${PARCHMENT_EXT}`;
}
export function parchmentClass(actNumber) {
  return `parch-${actPlate(actNumber, PARCHMENT_ACTS)}`;
}

/**
 * actPlate(actNumber, plates) → 1..plates — WHICH OF N AUTHORED PLATES AN ACT
 * WEARS, once, for every set of per-act art.
 *
 * Endless Spire runs past act 3, so every per-act art set has to answer "what
 * does act 7 look like" and every one of them answers it the same way: cycle.
 * This was written out twice (backdrops here, `actTitle` above) before the
 * parchment would have made it three — and three copies of a modulo is how act 7
 * comes to show plate 1 and be called ACT I · CYCLE 3 while a fourth set shows
 * plate 3, with nothing in the tree able to notice.
 */
export function actPlate(actNumber, plates) {
  const n = Number(actNumber) > 0 ? Math.floor(Number(actNumber)) : 1;
  const p = Number.isInteger(plates) && plates > 0 ? plates : 1;
  return ((n - 1) % p) + 1;
}

// ---- the in-run menu: ONE table, two widgets --------------------------------
//
// The overlay's tab strip and the ☰ quick-nav dropdown are two presentations of
// the same set of destinations. They used to be one presentation and a hardcoded
// list (`TABS` in overlay.js) — adding the dropdown beside that list would have
// made it the second copy this file's header exists to prevent (Law 1).
//
// ROWS ARE LAUNCHERS, NOT STATE. `act` is a closed vocabulary the UI resolves to
// a handler that already exists; `selectTab` in overlay.js stays the only thing
// that knows which tab is current. The day a row knows something selectTab does
// not, this is a second menu rather than a quick way into the one we have.
//
// The act vocabulary is MENU_ACTS, below — one home, not a list in this comment
// as well. `act: 'tab'` is the one act that carries a second field: the tab it
// opens, which is a member of MENU_TABS and joined to it by surfaces.js.
//
// TWO READINGS OF "CONTEXT-SPECIFIC", AND THE TABLE SERVES BOTH.
// Constantine: "all buttons should be context-specific." Marina's dissent: the
// ends are fixed, the middle is contextual, because a row whose meaning moves
// between screens is a trap for a player who navigates by muscle memory. They
// disagree in a way only play settles, so both orders come out of this one
// table and a setting picks:
//
//   fixed ends (Marina)  — group by `band`: head, body, tail. Array order within
//                          a band. Second row is Deck on every screen.
//   all contextual (his) — rows marked `local` (they exist only on this screen)
//                          come first, then the rest; `tail` still last, because
//                          he fixed Save · Save & Quit as the last two by hand.
//
// The map row set is IDENTICAL under both — which is the honest shape of the
// argument: it only bites where a screen has destinations of its own, and combat
// is the screen that does.
export const MENU_TABS = [
  { id: 'settings', label: 'Settings', icon: '⚙', tip: 'Display, audio, and accessibility.' },
  { id: 'controls', label: 'Controls', icon: '⌨', tip: 'Every key and pad button, and how to rebind them.' },
];

const TAIL = [
  { act: 'save', icon: '💾', label: 'Save', band: 'tail', tip: 'Write the climb to its slot and stay here.' },
  { act: 'quit', icon: '⏻', label: 'Save & Quit to Title', band: 'tail', tone: 'danger',
    tip: 'Save, then back to the title. Continue picks the climb up again.' },
];

const QUICK_CONTROLS = [
  { act: 'fullscreen', icon: '⛶', label: 'Fullscreen', band: 'head', control: 'switch',
    tip: 'Use the browser fullscreen owner; its live state is shared with Settings.' },
  { act: 'music', icon: '♫', label: 'Music', band: 'head', control: 'switch',
    tip: 'Turn music on or off without changing its volume, sound effects, or global mute.' },
];

export const MENU = {
  map: [
    ...QUICK_CONTROLS,
    { act: 'armoury', icon: '⚒', label: 'Armoury', band: 'head', local: true,
      tip: 'Weapons and armour — swap between fights for free.' },
    { act: 'legend', icon: '?', label: 'Map legend', band: 'head', local: true,
      tip: 'What each mark on the act map means.' },
    { act: 'tab', tab: 'settings', band: 'body' },
    { act: 'tab', tab: 'controls', band: 'body' },
    ...TAIL,
  ],
  // Draw and discard are real destinations that exist ONLY here (combat.js's
  // pile modals) — the demonstration that context-specific means something.
  combat: [
    ...QUICK_CONTROLS,
    { act: 'armoury', icon: '⚒', label: 'Armoury', band: 'head', local: true,
      tip: 'Equipment and carried items. Hand-set swaps cost energy mid-fight.' },
    { act: 'draw', icon: '⛁', label: 'Draw pile', band: 'body', local: true, count: 'draw',
      tip: 'What is still to come, shuffled for viewing.' },
    { act: 'discard', icon: '✖', label: 'Discard pile', band: 'body', local: true, count: 'discard',
      tip: 'What you have played and what was discarded.' },
    { act: 'tab', tab: 'settings', band: 'body' },
    { act: 'tab', tab: 'controls', band: 'body' },
    ...TAIL,
  ],
  // The menu already open: the dropdown mirrors the strip behind it, current tab
  // marked. Controls earns a row here (it is a tab) and not on map/combat, where
  // it is one click away once you land.
  overlay: [
    ...QUICK_CONTROLS,
    { act: 'close', icon: '✕', label: 'Close menu', band: 'head', local: true,
      tip: 'Back to the screen behind this one.' },
    { act: 'tab', tab: 'settings', band: 'body' },
    { act: 'tab', tab: 'controls', band: 'body' },
    ...TAIL,
  ],
};

const BANDS = ['head', 'body', 'tail'];

// The acts a MENU row may name — the vocabulary, beside the table it governs.
// It lived in src/ui/surfaces.js, whose header promises THAT FILE HOLDS NO
// MEMBERS; eight members later it was the second copy that file exists to
// prevent (Vira, gate of 5c49fed).
//
// WHAT THIS CATCHES AND WHAT IT DOES NOT, because a hand-kept list should say
// so out loud. A launcher row is dropped when the CONTEXT does not offer its act
// (the map has no draw pile — correct, by design), so two different situations
// wear the same silence:
//
//   TYPO      — `act: 'jorunal'`, not a word at all → not in this list → the
//               boot check names it. Caught, and this list is why.
//   ORPHAN    — a word in this list that NO context implements anywhere. Delete
//               `legend:` from the actions bag in src/ui/screens/map.js — its
//               only implementation — and the Map legend row silently vanishes
//               with every check green. NOT CAUGHT HERE, and it cannot be: the
//               actions bags are built inside a click handler, closed over live
//               run state, so no source-level join can see them.
//
// The orphan edge is answered on the RENDERED PAGE instead, which is where the
// implemented acts actually exist: quicknav marks its panel
// `data-surface="menuAct"` and each row `data-member="<act>"`, so an instrument
// that opens the three contexts can subtract what was drawn from what is
// declared here. That instrument is Bjorn's lens and is not written yet — this
// comment is the statement of the gap, not a claim it is closed.
export const MENU_ACTS = ['tab', 'armoury', 'legend', 'draw', 'discard', 'fullscreen', 'music', 'save', 'quit', 'close'];

/** The tab a `tab` row points at, resolved against MENU_TABS. */
function tabDef(id) {
  return MENU_TABS.find((t) => t.id === id) || null;
}

/**
 * menuTabRefs() → every tab id a MENU row NAVIGATES TO, across all contexts.
 *
 * The other half of a `{ act: 'tab', tab: … }` row. `menuRows()` resolves it to
 * blank icon/label/tip when it names nothing, and quicknav keeps the row because
 * the ACT is implemented — so the typo has to be caught by joining the tab, and
 * this is the enumeration that lets surfaces.js do it.
 */
export function menuTabRefs() {
  return [...new Set(Object.values(MENU).flat()
    .filter((r) => r.act === 'tab' && typeof r.tab === 'string' && r.tab)
    .map((r) => r.tab))];
}

/**
 * menuTabs({ hasSave }) → the overlay's tab strip, in order.
 * The strip and the dropdown read the same table, so a tab cannot exist in one
 * and not the other. `counts` supplies live numbers (deck size) for the label.
 */
export function menuTabs({ hasSave = true, counts = {} } = {}) {
  return MENU_TABS.filter((t) => hasSave || !t.needsSave).map((t) => ({
    id: t.id,
    label: t.count != null && counts[t.count] != null ? `${t.label} (${counts[t.count]})` : t.label,
    icon: t.icon,
    tip: t.tip,
  }));
}

/**
 * menuRows(context, { fixedEnds, hasSave, counts, current }) → resolved rows.
 *
 * Each row comes back with its icon, label, tooltip and a `sep` flag marking the
 * first row of a new band (drawn as a rule under fixed ends, absent otherwise —
 * the two readings look different, which is the point of being able to try both).
 */
export function menuRows(context, { fixedEnds = true, hasSave = true, counts = {}, current = null } = {}) {
  const src = (MENU[context] || []).filter((r) => (hasSave ? true : r.band !== 'tail'));
  const ordered = fixedEnds
    ? BANDS.flatMap((b) => src.filter((r) => r.band === b))
    : [
        ...src.filter((r) => r.control && r.band !== 'tail'),
        ...src.filter((r) => !r.control && r.local && r.band !== 'tail'),
        ...src.filter((r) => !r.control && !r.local && r.band !== 'tail'),
        ...src.filter((r) => r.band === 'tail'),
      ];
  let prevBand = null;
  return ordered.map((r) => {
    const t = r.act === 'tab' ? tabDef(r.tab) : null;
    const countKey = r.count || (t && t.count);
    const sep = fixedEnds && prevBand !== null && r.band !== prevBand;
    prevBand = r.band;
    return {
      act: r.act,
      tab: r.tab || null,
      icon: r.icon || (t && t.icon) || '',
      label: r.label || (t && t.label) || '',
      tip: r.tip || (t && t.tip) || '',
      tone: r.tone || '',
      badge: countKey != null && counts[countKey] != null ? String(counts[countKey]) : '',
      on: !!(current && r.act === 'tab' && r.tab === current),
      control: r.control || '',
      sep,
    };
  });
}

// ---- gamepad buttons --------------------------------------------------------
// One table, two presentations. The hint bar wants a compact glyph and the
// controls screen wants a readable word; these lived as two near-identical
// tables (input.js PAD_LABELS / controls.js BUTTON_NAMES) that agreed on
// buttons 0-11 and silently disagreed on the d-pad and guide.
export const PAD_BUTTONS = {
  0: { glyph: 'A', name: 'A' },
  1: { glyph: 'B', name: 'B' },
  2: { glyph: 'X', name: 'X' },
  3: { glyph: 'Y', name: 'Y' },
  4: { glyph: 'LB', name: 'LB' },
  5: { glyph: 'RB', name: 'RB' },
  6: { glyph: 'LT', name: 'LT' },
  7: { glyph: 'RT', name: 'RT' },
  8: { glyph: 'Back', name: 'Back' },
  9: { glyph: 'Start', name: 'Start' },
  10: { glyph: 'L3', name: 'L3' },
  11: { glyph: 'R3', name: 'R3' },
  12: { glyph: '▲', name: 'D-Up' },
  13: { glyph: '▼', name: 'D-Down' },
  14: { glyph: '◀', name: 'D-Left' },
  15: { glyph: '▶', name: 'D-Right' },
  16: { glyph: '⊙', name: 'Guide' },
};
/** Compact glyph for the hint bar; falls back to B<n> for unmapped buttons. */
export function padGlyph(btn) {
  const b = PAD_BUTTONS[btn];
  return b ? b.glyph : `B${btn}`;
}
/** Readable name for the controls/rebind list; '—' when nothing is bound. */
export function padName(btn) {
  if (btn == null) return '—';
  const b = PAD_BUTTONS[btn];
  return b ? b.name : `Btn ${btn}`;
}

// ---- why a piece is not yours, in the player's words ------------------------
// `ownership().why()` (src/model/loadout.js) names the GATE and declares the
// closed set of them as OWNERSHIP_GATES; the sentence is UI copy and lives here.
// It was a literal inside equipment.js's `gate()`, which was fine while one
// screen existed and becomes a copy nothing syncs the moment a second one asks
// the same question (Law 1 clause 2, pointed at prose).
//
// DECLARED AND HANDLED: the suite asserts these keys are exactly OWNERSHIP_GATES
// — a route the model can return with no sentence here renders an empty reason,
// which is the quiet graceful failure rather than the loud one.
//
// A row's own `hint` from unlocks.csv always wins over LOCK_COPY.unearned —
// that is the whole point of the hint column. This is what is said when the
// table has nothing to say.
export const LOCK_COPY = Object.freeze({
  unearned: 'Not yet earned.',
  unfound: 'Not yet found. Armaments turn up in treasure, and on the bodies of things that owned them.',
});

// ---- what a kind of armament is called in the plural ------------------------
// The Compendium's section headings. A LABEL is a word, not a derivation:
// 'staff' → 'STAVES' is not a rule any pluraliser gets right, and inventing one
// is how a screen ends up saying STAFFS. So the irregulars are listed and
// everything else derives, WITH A WARNING — a new kind gets a plausible heading
// rather than a broken screen, and says so in the console so the plausible one
// is not mistaken for an authored one (Law 0 clause 5: a generated thing that is
// wrong but reasonable is the invisible failure).
const ARMAMENT_KIND_LABELS = { weapon: 'WEAPONS', shield: 'SHIELDS', staff: 'STAVES' };
export function armamentKindLabel(kind) {
  const known = ARMAMENT_KIND_LABELS[kind];
  if (known) return known;
  console.warn(`[content] armament kind ${JSON.stringify(kind)} has no heading in`
    + ' src/ui/uiContent.js ARMAMENT_KIND_LABELS — showing a derived one.');
  return `${String(kind || '').toUpperCase()}S`;
}
