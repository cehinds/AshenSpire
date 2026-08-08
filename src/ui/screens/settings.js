// src/ui/screens/settings.js — settings controls (SPEC §7)
//
// Rows are declarative and grouped into categories. `renderSettings` builds the
// controls into any container and wires change events, so the same controls
// back both the standalone modal (openSettings) and the in-run overlay's
// Settings tab. Each row declares its default so stored settings stay sparse.
// `onChange({key:value})` lets the orchestrator persist + apply immediately.

import { openDebugLog } from '../debuglog.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { setTabRing, hasTabRing } from '../input.js';
import { renderProfileSection } from './profileArchive.js';
import { renderAboutSection } from './about.js';
import { AUDIO_DEFAULTS } from '../audio.js';
import { balance } from '../../content/balance.js';
import { ZOOM_STEPS, MAP_ZOOM_DEFAULT } from '../../model/mapview.js';
import { MAP_MODES, MAP_MODE_DEFAULT } from '../../model/mapknowledge.js';

const UI_DEFAULTS = balance.ui;

const ROWS = [
  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },
  { cat: 'Display', key: 'animSpeed', type: 'choice', def: 'normal',
    choices: ['slow', 'normal', 'fast', 'instant'], label: 'Combat pacing',
    note: 'How deliberately actions play out — one actor at a time, or instant.' },
  // `choices` and `def` are DERIVED. The four numbers here used to be typed, and
  // they were a second copy of the zoom ladder that had already drifted: the
  // ladder has six steps and this row offered four of them, so 175% and 200%
  // were reachable with the in-map + button and unreachable as a default.
  //
  // `def` IS MAP_ZOOM_DEFAULT AND NOT A LITERAL. It reads '115' today because
  // Sunna held #107 on that token; the map screen reads the same const, so the
  // default cannot be flipped in one place and stay in the other.
  //
  // THE NOTE PROMISES PLAINLY AGAIN, AND ONLY BECAUSE THE PROMISE IS NOW TRUE.
  //
  // It said this sentence for one night while 8 of 12 seeds broke it at the
  // entrance row — the first map of every run — which is a settings note the
  // game could not keep, and Sunna held #107 partly on that. I had already
  // bounded it ("gets as close as it can and you pan for the rest"). Then
  // Constantine shipped one map entrance, and the honest move is to re-measure
  // the sentence rather than keep a hedge that has stopped being true:
  //
  //   node tools/mapfit.mjs --dist --zoom Fit   ->  0 of 120 framings hide a
  //   next step; 390x844 and 1200x730, 12 seeds, entrance + four mid-climb rows.
  //
  // A hedge nobody needs teaches a player the game is unsure of itself. The
  // BOUNDARY still exists and still belongs to a maintainer, not to this string:
  // 120 measured cells is not every seed, so the map keeps reporting a frame it
  // could not fit (`.map-scroll[data-framing]`, and the warning it logs).
  { cat: 'Display', key: 'mapZoom', type: 'choice', def: MAP_ZOOM_DEFAULT,
    choices: ['Fit', ...ZOOM_STEPS.map((z) => String(Math.round(z * 100)))], label: 'Map zoom',
    note: 'Fit opens the map close enough that your current node and every node it connects to are on screen. A percentage fixes the zoom instead; + / − and ⊙ still work in the map.' },
  // THE FOG A/B, and it sits HERE rather than in Custom Climb — Marina's ruling,
  // reversed from Custom Climb on the argument that Settings is the only surface
  // reachable WHILE YOU ARE LOOKING AT THE THING YOU ARE JUDGING. Fog cannot be
  // A/B'd mid-run: once you have seen the map you cannot unsee it. So the
  // comparison is Custom Climb's existing seed field plus this row — same seed,
  // same act, two readings — and Custom Climb grows nothing new.
  //
  // DEFAULT IS `path`, which is today exactly: nobody who does not opt in sees a
  // pixel move. The COMPARISON is the deliverable, not the answer.
  //
  // `choices` and `def` are the ladder's own, never a second list (the row three
  // above learned this the hard way — it carried four of the zoom ladder's six
  // steps for a night).
  { cat: 'Display', key: 'mapMode', type: 'choice', def: MAP_MODE_DEFAULT,
    choices: MAP_MODES, label: 'Map reveal (test)',
    note: 'A test — PATH is the game as it shipped: the whole act is drawn. FOG draws only the doors you started from, the boss, everywhere you have been, and the places you can step to next; the rest is unlit parchment. Fog never closes behind you — somewhere you have seen stays seen. Switching redraws the map straight away, so you can hold the two against the same seed.' },
  { cat: 'Display', key: 'accent', type: 'choice', def: 'gold',
    choices: ['gold', 'crimson', 'frost', 'verdant', 'violet'], label: 'Accent color',
    note: 'Tint the interface — highlights, borders, focus ring, and glow.' },
  { cat: 'Display', key: 'uiScale', type: 'choice', def: 'Auto',
    choices: ['Auto', 'S', 'M', 'L', 'XL'], label: 'UI size', applied: appliedHtml,
    note: 'Auto flexes the whole interface with your screen; S–XL asks for a fixed size and gets as much of it as fits.' },
  { cat: 'Display', key: 'cardMotif', type: 'choice', def: UI_DEFAULTS.cardMotif,
    choices: UI_DEFAULTS.cardMotifModes, label: 'Card motif',
    note: 'Colour cards by their class. Wash tints the card body; Accent puts your accent on the border and moves rarity to a corner pip; Band adds a class stripe. Off keeps every card the same frame.' },
  { cat: 'Display', key: 'cardMotifStrength', type: 'choice', def: 'normal',
    choices: ['subtle', 'normal', 'strong'], label: 'Motif strength',
    note: 'How strongly the class colour tints a card.' },
  { cat: 'Display', key: 'screenShake', def: true, label: 'Screen shake',
    note: 'Camera kick on heavy hits and staggers. Off keeps combat steady.' },
  { cat: 'Display', key: 'ambient', type: 'choice', def: 'normal',
    choices: ['off', 'low', 'normal', 'high'], label: 'Ambient effects',
    note: 'Drifting embers and the title-screen glow. Off is the calmest.' },
  { cat: 'Display', key: 'controlHints', def: true, label: 'Control hints',
    note: 'Show the bar of keyboard shortcuts along the bottom of the map and combat.' },
  { cat: 'Display', key: 'mapHeaderDensity', type: 'choice', def: 'comfortable',
    choices: ['comfortable', 'compact'], label: 'Map header',
    note: 'Comfortable shows your name and full stats; Compact tightens the bar.' },
  { cat: 'Display', key: 'mapHeaderRelics', def: true, label: 'Relics in map header',
    note: 'Show your relic icons in the map header bar.' },
  { cat: 'Display', key: 'mapHeaderSeed', def: true, label: 'Seed in map header',
    note: 'Show the run seed in the map header bar.' },
  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',
    note: 'Fill the screen (also toggles with F11 in most browsers).' },

  // THE QUICK-MENU EXPERIMENT (EldenSpire#34). Three things are compared by
  // being PLAYED rather than looked at: today, and two readings of "the ☰ button
  // should offer everywhere you can go from here".
  //
  // DEFAULT IS OFF, and off is today exactly — nobody who does not opt in sees a
  // pixel move. It ships in the build rather than hiding behind a URL flag
  // because the question it asks is a PHONE question (the menu's tab strip wraps
  // to two rows at 390 px, measured), and a dev flag is not reachable on a phone.
  //
  // The note carries the way back, and so does the list itself: it names the
  // variant and points here every time it opens. An experiment that outlives the
  // memory of switching it on has stopped being an experiment and become a bug
  // report.
  { cat: 'Display', key: 'quickNav', type: 'choice', def: 'off',
    choices: ['off', 'mirror', 'switcher'], label: 'Quick menu (test)',
    note: 'A test — OFF is the game as it shipped. MIRROR: the ☰ button opens a list of everywhere you can go from this screen, and the menu keeps its row of tabs. SWITCHER: the same list, but on a narrow screen the menu\'s tab row folds into one button naming the tab you are on. The list says which one you picked, every time it opens.' },
  { cat: 'Display', key: 'quickNavFixedEnds', def: true, label: 'Quick menu · fixed ends',
    note: 'Only does anything while Quick menu is on. ON keeps rows in the same places on every screen — this screen\'s own tools at the top, Save and Save & Quit always last, everything else between. OFF orders the whole list by what the screen is, so a row can sit somewhere else in combat than it does on the map.' },

  { cat: 'Audio', key: 'muteAudio', def: false, label: 'Mute all audio',
    note: 'Silence music and sound effects.' },
  { cat: 'Audio', key: 'musicVolume', type: 'range', def: AUDIO_DEFAULTS.musicVolume, label: 'Music volume',
    note: 'Ambient score for the title, map, and battles.' },
  { cat: 'Audio', key: 'sfxVolume', type: 'range', def: AUDIO_DEFAULTS.sfxVolume, label: 'Sound effects',
    note: 'Hits, blocks, status bursts, cards, and pickups.' },
  { cat: 'Audio', key: 'musicFolder', type: 'text', def: '', label: 'Music folder',
    placeholder: 'e.g. music/ or https://…',
    note: 'Folder/URL with a manifest.json mapping combat/boss/shop/rest/… to track files. Empty = built-in generated score.' },

  { cat: 'Accessibility', key: 'reducedMotion', def: false, label: 'Reduced motion',
    note: 'Calm ambient effects, drop the map pulse, and shorten animations.' },
  // ON by default. Measured, not assumed: at the old default eight text targets
  // sat below the WCAG AA floor and the secondary buttons' own outlines sat at
  // 1.64:1 against a 3.0 floor. High contrast clears all of that and costs one
  // thing — see the note. `node tools/contrast-audit.mjs` re-runs the numbers.
  { cat: 'Accessibility', key: 'highContrast', def: true, label: 'High contrast',
    note: 'Brighter text and stronger borders throughout for readability. On by default — turn it off for the dimmer, more atmospheric palette.' },
  { cat: 'Accessibility', key: 'textSize', type: 'choice', def: 'M',
    choices: ['S', 'M', 'L', 'XL'], label: 'Text size',
    note: 'Scale all interface text and sizing together (sets the root size). M is default; L/XL aid readability. Stacks with UI size.' },
  // Constantine, twice: "just make the tabs about 20% smaller or the size
  // configurable or scalable with UI or both", then "actually, I think it
  // should be able to go smaller than 44px." Range 24–44 is Marina's call, and
  // it is told to him as a choice we made rather than a limit he ran into: we
  // let it go below 44 as asked and stopped at 24, WCAG 2.2 AA's minimum. His
  // no is free.
  //
  // NUMBERS, NOT S/M/L/XL. Text size is S/M/L/XL and UI size is S/M/L/XL, both
  // within a few rows of this one. A third four-letter ladder doing a third job
  // is Law 4's defect — two controls with one job, the weaker reading as broken
  // — with better manners. These are the numbers he typed.
  //
  // ACCESSIBILITY, NOT DISPLAY: it sits with Text size, High contrast and
  // Reduced motion because it is an ergonomic floor, not a look.
  //
  // DEFAULT 44 = TODAY, TO THE PIXEL. Nobody who never opens this sees anything
  // move — the same principle `quickNav: def 'off'` already carries above.
  // `choices` and `def` are DERIVED from balance.ui.tapSize; the four numbers
  // are not written here, or the closed set would have two homes.
  //
  // `resizesWhilePressed` — THE ONE CONTROL EXEMPT FROM THE FLOOR IT SETS.
  // Marina's ruling, on the narrowest reason available so it cannot spread:
  // this is the only control in the game whose resizing happens WHILE IT IS
  // BEING PRESSED. Measured cause: at the 44 step the pressed chip landed 61.44
  // device px from the finger because the whole group re-lays-out, which is
  // wider than a fingertip and which no `scrollTop` can answer.
  // Declared as a CHARACTERISTIC rather than handled by name, so the stylesheet
  // keys on the property and not on `tapFloor` (Law 1 clause 3, one layer up).
  { cat: 'Accessibility', key: 'tapFloor', type: 'choice', def: String(UI_DEFAULTS.tapSize.def),
    choices: UI_DEFAULTS.tapSize.sizes.map(String), label: 'Minimum tap size',
    applied: tapCostHtml, resizesWhilePressed: true,
    note: 'How small a button, tab, or option is allowed to get. 44 is the size a fingertip reliably hits; smaller fits more on screen.' },
  { cat: 'Accessibility', key: 'colorblindSafe', def: false, label: 'Colorblind-friendly',
    note: 'Shift danger/heal/blight/frost colors to a more distinguishable palette.' },
  { cat: 'Accessibility', key: 'reduceFlashes', def: false, label: 'Reduce flashes',
    note: 'Suppress bright impact and proc flashes (photosensitivity). Damage numbers stay.' },
  { cat: 'Accessibility', key: 'readableHeadings', def: false, label: 'Readable headings',
    note: 'Use the plain UI font for titles instead of the decorative serif.' },
  { cat: 'Advanced', key: 'commandLog', type: 'button', btn: 'Open', label: 'Command log',
    note: 'The recent commands and results between the interface and the engine. Copy it into a bug report if the game misbehaves.' },
  // HOLD TO CONFIRM. Constantine: "yes press and hold" / "configurable in
  // debugging settings as enum drop down". Advanced is the debugging surface,
  // which is where he put it and where it stays.
  //
  // IT IS A CHIP ROW AND NOT A `<select>`, AND THAT IS AN ANSWER, NOT A
  // SHORTCUT. This game has no dropdown anywhere; `.choice-group` IS its enum
  // control. A native `<select>` would be the only one in the build, and it
  // would arrive outside everything this row gets for free: `--tap-floor` has
  // no relationship to a UA-drawn select, the accent theme and the
  // high-contrast profile do not reach inside one, it renders as three
  // different surfaces (iOS wheel / Android sheet / desktop popup) and none of
  // the three can be photographed or measured by any instrument in this repo —
  // `tools/tapsize.mjs` and `tools/settingsreach.mjs` both count `.choice`, so
  // they would read this row as ABSENT, which is silence, which is `unknown`.
  // Four chips is also the shape I measured safe tonight: Combat pacing is four
  // and renders 92.1 px tall at 390x844, where the seven-chip Map zoom row runs
  // to 301.2 px and puts its last chip off the viewport.
  //   IF HE MEANT THE NATIVE WIDGET SPECIFICALLY, that is one word and I will
  // swap it — but adding the game's only `<select>` on a guess, on the one page
  // no instrument here can see, is not a thing to do quietly.
  //
  // `choices` and `def` are DERIVED from balance.ui.holdConfirm. Adding a fifth
  // speed is a row there and nothing here.
  { cat: 'Advanced', key: 'holdConfirm', type: 'choice', def: UI_DEFAULTS.holdConfirm.def,
    choices: Object.keys(UI_DEFAULTS.holdConfirm.steps), label: 'Hold to confirm',
    // SHORT ON PURPOSE, and I measured why. My own ruling on the Map zoom row
    // tonight was that a long note plus a chip strip squeezes the text column
    // to a ribbon; the first draft of THIS note ran three sentences and took
    // the row to 216.9 px against 92.1 for Combat pacing. A rule I hold someone
    // else to on a Thursday holds on my own row on the same Thursday.
    note: 'Choices a run can’t take back fill as you hold them, so a mis-tap can be let go before it lands. Off returns to one tap.' },
];

// ---- categories: a heading is DERIVED from what is under it (#78) ----------
//
// This used to be a hand-written list of six names, and `renderSettings` looked
// up `ROWS.filter(r => r.cat === cat)`. A name in that list with no rows and no
// section rendered a LONE HEADING — the author did the data-driven thing and got
// a promise with nothing behind it, in silence.
//
// So the list is no longer authored. A category EXISTS because something is
// filed under it: a `cat:` on a row, or a section below. What stays authored is
// the ORDER, which is a design decision and not derivable — and a name in the
// order that nothing files under is a defect that fails by name at boot
// (assertSurfaces, src/ui/surfaces.js), not a heading over nothing.
//
// Adding a settings row under a brand-new category needs NO edit here: the
// heading appears, after the ordered ones, in the order its first row appears.
//
// SECTIONS are the two categories whose contents are code rather than rows.
// 'Profile' is the calm-moment route to set-aside profiles and runs (#67); its
// mount renders only when a save manager is passed in — a section that promises
// a drawer it cannot open would be the same broken promise one layer down.
// 'About' carries the AI-use acknowledgement, rendered from its one home in
// src/content/aiDisclosure.js — the same text the store page shows (#69).
//
// `tip` IS THE ONE THING A SECTION HAS TO WRITE, and it is the honest edge of
// clause 7 on this screen. A category made of rows derives its tooltip from the
// rows filed under it — the author writes nothing. A section has no rows to
// read, so its one sentence is authored here, where its code already is. That
// is Law 0 clause 2 exactly: a section is a WORD, not a row, and a word costs
// an edit. Say it out loud rather than pretend the whole screen is free.
const SECTIONS = {
  Profile: { mount: 'set-profile-mount', needs: 'saves',
    tip: 'Set-aside profiles and runs — export, restore, start fresh.' },
  About: { mount: 'set-about-mount', needs: null,
    tip: 'Version, credits, and how AI was used to make this game.' },
};

/** The key the chosen category rides in. `meta.settings` is a free bag. */
const CAT_KEY = 'settingsCategory';

export const CATEGORY_ORDER = ['Display', 'Audio', 'Accessibility', 'Profile', 'Advanced', 'About'];

/**
 * categoryHandler(cat) → what will render under that heading, or null.
 *
 * Null is the whole point: it is the difference between a heading with contents
 * and a heading with a promise. assertSurfaces() turns null into a named boot
 * failure; nothing here guesses.
 */
export function categoryHandler(cat) {
  if (SECTIONS[cat]) return SECTIONS[cat];
  const rows = ROWS.filter((r) => r.cat === cat);
  return rows.length ? { rows } : null;
}

/**
 * filedCategories() → every category something is actually FILED under: a row's
 * `cat`, or a SECTIONS key. The DERIVED half of this set.
 *
 * Exported because it is one of the set's two homes and surfaces.js now asks
 * each home for its own members rather than asking the set for a union (Vira,
 * re-gate of #78: a guard proven over one home must be re-proven when the set
 * gains a second — with one union, `CATEGORY_ORDER = []` left six categories,
 * a green verdict, and the only authored fact about this screen silently gone).
 * It is a read of the rows, not a copy of them: `settingsCategories()` below is
 * derived from it, so the two cannot drift.
 */
export function filedCategories() {
  return [...new Set([...ROWS.map((r) => r.cat), ...Object.keys(SECTIONS)])];
}

/** Every category that exists, in the order it is drawn. Derived, one home. */
export function settingsCategories() {
  const found = filedCategories();
  // An authored name nothing files under is KEPT in place, not dropped: dropping
  // it is the silence again. It renders its own defect and assertSurfaces names
  // it. Anything filed under a name the order does not mention goes last.
  return [...CATEGORY_ORDER, ...found.filter((c) => !CATEGORY_ORDER.includes(c))];
}

/**
 * categoryTip(cat) → the sentence a tab says on hover AND on the pad's focus
 * cursor (Law 3 clause 4). DERIVED for a category of rows, authored for a
 * section.
 *
 * It answers the question the tabs create. Six names hide five sixths of the
 * screen, and the player's question stops being "what is under this heading"
 * and becomes "WHICH TAB HOLDS THE THING I CAME FOR". Counting the rows and
 * naming the first few of them answers exactly that, and it costs an author
 * nothing — the labels are already written, once, on the rows.
 *
 * Three labels, then an ellipsis: enough to recognise, short enough to finish.
 */
export function categoryTip(cat) {
  const h = categoryHandler(cat);
  if (!h) return `Nothing is filed under "${cat}".`;
  if (h.mount) return h.tip || `The ${cat} section.`;
  const labels = h.rows.map((r) => r.label);
  const n = labels.length;
  const shown = labels.slice(0, 3).join(', ');
  return `${n} setting${n === 1 ? '' : 's'} — ${shown}${n > 3 ? '…' : ''}`;
}

// Resolve a stored value against its default (defaults keep settings sparse).
function valueOf(settings, row) {
  return row.def ? settings[row.key] !== false : settings[row.key] === true;
}

/**
 * settingOn(settings, key) → is this boolean setting ON, given a sparse store?
 *
 * Exported because a default lives in exactly one place — the `def` field on the
 * row above — and everything else asks. Stored settings are sparse (an untouched
 * key is simply absent), so "is it on" is not `!!settings[key]`: it depends on
 * the default, and the polarity inverts with it. `def: false` must be read as
 * `=== true`; `def: true` must be read as `!== false`. Writing that test out by
 * hand at the point of use means the default is recorded twice, once here and
 * once as a comparison operator somewhere else — and the two are only ever
 * checked by a human noticing that the toggle in Settings disagrees with the
 * screen. That is the second copy this project keeps finding. This function is
 * the one home.
 *
 * NOT YET the one home for every toggle: applyDisplaySettings in src/main.js
 * still hand-writes the polarity for useSprites, reducedMotion, screenShake,
 * controlHints, colorblindSafe, reduceFlashes, readableHeadings, mapHeaderRelics
 * and mapHeaderSeed. Those are all still `def:`-agreeing today, and converting
 * them is a mechanical change I deliberately did not make in the same commit as
 * a default flip: one wrong polarity there silently changes a different default,
 * and nothing in the suite would catch it. Convert them when someone next has a
 * reason to touch that function, one at a time.
 */
export function settingOn(settings, key) {
  const row = ROWS.find((r) => r.key === key);
  if (!row) throw new Error(`settingOn: no settings row named '${key}'`);
  return valueOf(settings || {}, row);
}

function rowHtml(settings, r) {
  if (r.type === 'text') {
    const val = typeof settings[r.key] === 'string' ? settings[r.key] : r.def;
    return `<div class="set-row set-row-wide">
        <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
        <input type="text" class="set-text" spellcheck="false" data-key="${r.key}" value="${(val || '').replace(/"/g, '&quot;')}" placeholder="${r.placeholder || ''}">
      </div>`;
  }
  if (r.type === 'range') {
    const val = typeof settings[r.key] === 'number' ? settings[r.key] : r.def;
    return `<div class="set-row">
        <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
        <div class="range-wrap">
          <input type="range" class="set-range" min="0" max="100" step="5" value="${val}" data-key="${r.key}">
          <span class="range-val" data-for="${r.key}">${val}</span>
        </div>
      </div>`;
  }
  if (r.type === 'button') {
    return `<div class="set-row">
        <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
        <button class="subtle" data-btn="${r.key}">${r.btn || 'Open'}</button>
      </div>`;
  }
  if (r.type === 'choice') {
    const cur = r.choices.includes(settings[r.key]) ? settings[r.key] : r.def;
    const opts = r.choices
      .map((c) => `<button class="choice${c === cur ? ' on' : ''}" data-key="${r.key}" data-val="${c}">${c.toUpperCase()}</button>`)
      .join('');
    return `<div class="set-row">
        <div><b>${r.label}</b><p class="set-note">${r.note}</p>${appliedSlot(settings, r)}</div>
        <div class="choice-group"${r.resizesWhilePressed ? ' data-resizes-while-pressed="1"' : ''}>${opts}</div>
      </div>`;
  }
  // 'action' rows (e.g. fullscreen) render as a live toggle reflecting state.
  const on = r.type === 'action' ? isFullscreen() : valueOf(settings, r);
  return `<div class="set-row">
      <div><b>${r.label}</b><p class="set-note">${r.note}</p></div>
      <button class="toggle ${on ? 'on' : ''}" data-key="${r.key}"${r.type === 'action' ? ' data-action="1"' : ''} role="switch" aria-checked="${on}">
        <span class="knob"></span>
      </button>
    </div>`;
}

// ---- the line under a row that says what the choice actually means ---------
//
// `applied:` USED TO BE `true` AND MEANT ONE FUNCTION. One row had it, and
// `rowHtml` called `appliedHtml` by name — a flag whose only legal value stood
// for a function the flag could not name. The second row that wants a line
// under it (Minimum tap size) would have made that an `if` per key, which is
// exactly the shape Law 1 clause 3 forbids one layer down: `if (key === …)`
// deciding behaviour that the row could have declared.
//
// So the field HOLDS THE FUNCTION. That is Law 0 clause 2 said honestly — a
// row that wants a derived line under it is data, and the derivation is a word,
// authored in code, joined here by the row that asks for it. It is the same
// declaration/handler join `src/ui/surfaces.js` makes for navigable sets, at
// one row's scale.
//
// THE SLOT IS ALWAYS RENDERED, even when the line is empty. A function may
// legitimately say nothing (Minimum tap size is SILENT at 44 — Sunna: "a state
// that needs no words needs silence"), and a slot that only exists while it has
// something to say is a slot `refreshApplied` cannot find the moment it starts
// having something to say. Empty div, no padding, no margin: zero height, no
// stylesheet change.
function appliedSlot(settings, r) {
  if (!r.applied) return '';
  return `<div class="set-applied-slot" data-applied="${r.key}">${r.applied(settings, r) || ''}</div>`;
}

/**
 * resolveTapSize(settings) → { px, stored, bad }
 *
 * THE ONE HOME FOR "what tap floor is in force", asked by the settings row and
 * by applyTapSize() in src/main.js. The closed set and the default are read off
 * the row, which reads them off `balance.ui.tapSize` — so the four numbers are
 * written once, in content, and nothing here restates them.
 *
 * `bad` IS THE POINT, and it is Law 1 clause 5. A sparse store is normal — an
 * untouched key is simply absent, and absent resolves to the default with
 * nothing to report. A key that is PRESENT and not in the closed set is bad
 * data: a hand-edited save, an older build's value, a restored profile from a
 * tree where the set was different. It still has to render something, so it
 * renders the default — but it must not do that SILENTLY, which is the failure
 * that gets called "the setting doesn't stick". `bad` is what lets both callers
 * say so: main.js writes it into the command log by name, and the row prints
 * the rejected value where the choice is made.
 */
export function resolveTapSize(settings) {
  const row = ROWS.find((r) => r.key === 'tapFloor');
  const def = Number(row.def);
  const stored = (settings || {}).tapFloor;
  if (stored === undefined || stored === null || stored === '') {
    return { px: def, stored: null, bad: false };
  }
  const s = String(stored);
  if (row.choices.includes(s)) return { px: Number(s), stored: s, bad: false };
  return { px: def, stored: s, bad: true };
}

// THE COST LINE. Sunna's ruling, and it is her own rule from the day before
// aimed at her own proposal: "a line that says the same thing every time you
// open the screen is not a warning, it is decoration with a worried face." So
// the NOTE is constant and carries no percentages, and THIS line appears only
// below the largest size, and changes with the value chosen.
//
// THE PERCENTAGES ARE NOT WRITTEN HERE. `balance.ui.tapSize.missRate` carries
// one entry per size that has research behind it — 44 and 24, the two points
// WCAG gives us — and this function prints a number only where an entry exists.
// 36 and 30 get the sentence and no statistic, because interpolating between
// two measured points would be fabricating one, and a fabricated number in a
// player-facing line is the worst place this house could put one.
//
// The leading "NN px —" is the one thing I added to Sunna's wording: the
// dispatch asks the line to NAME THE VALUE CHOSEN, and without it 36 and 30
// render the identical sentence — a line that does not change when the setting
// does, which is the test she set for it. Her sentence is untouched underneath.
function tapCostHtml(settings) {
  const { px, stored, bad } = resolveTapSize(settings);
  const sizes = UI_DEFAULTS.tapSize.sizes;
  const max = Math.max(...sizes);
  // Bad data is loud HERE too, not only in the log: the player who typed 32
  // into a save file is the one person who needs to be told 32 is not a size.
  const badLine = bad
    ? `<p class="set-applied limited">Stored value ${esc(String(stored))} is not one of `
      + `${esc(sizes.join(', '))} — using ${px}.</p>`
    : '';
  if (px >= max) return badLine;
  const rate = UI_DEFAULTS.tapSize.missRate;
  const here = rate[px];
  const there = rate[max];
  const tail = here && there
    ? `: about ${here} misses here, against ${there} at ${max}`
    : '';
  return `${badLine}<p class="set-applied">${px} px — below the size a fingertip`
    + ` reliably hits${tail}.</p>`;
}

// EldenSpire#26 — SHOW THE VALUE ACTUALLY APPLIED.
//
// Clamping the named sizes without this makes the control a liar: pick XL on a
// 1200x730 window and the fit path holds it at 1.00, so the button lights up
// and nothing on screen changes. balance.js records that exact complaint
// landing once before, when Auto "looked dead" — a setting that bricks the
// fight is a trap, one that silently shrinks is a liar, and only the pair is
// neither. The clamp is Constantine's ruling; this half is why it is safe.
//
// IT READS --ui-zoom RATHER THAN RECOMPUTING THE FIT. main.js already resolved
// it and wrote it to <html>; asking the same question a second way is how the
// tablet lockout happened (#24), and a readout that disagrees with the screen
// is worse than no readout. The requested value comes from the same balance
// data main.js caps against, so "limited" is a comparison of one computed
// number against one authored one, not of two computations.
function appliedHtml(settings) {
  if (typeof document === 'undefined') return '';
  const applied = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'));
  if (!applied) return '';
  const key = String(settings.uiScale == null ? 'auto' : settings.uiScale).toLowerCase();
  const asked = UI_DEFAULTS.uiScale.named[key];
  const shown = `${applied.toFixed(2)}\u00d7`;
  // A hundredth of slack: the fit path rounds to two decimals, so an exact
  // grant can miss by 0.004 and must not be reported as a limit.
  const limited = asked != null && applied < asked - 0.005;
  // "your screen", not "this window". Shown on three phone shapes, where a
  // window is not a thing the player has; "your screen" is true on both.
  // Sunna's, and the row's own note carries the same noun for the same reason.
  //
  // THE HINT IS UNCONDITIONAL, and that is the decision rather than an
  // oversight. Its job is to reach one person: the player who sets XL BECAUSE
  // SHE CANNOT READ THE GAME, gets 0.82x and a polite explanation, and is not
  // helped at all — the clamp fixes reachability and does nothing for
  // legibility, and the player who most needs XL is the one on the smallest
  // screen. Every condition I drafted for showing it (limited-only, named-size
  // only, L-and-XL-only) had a screen where she asks for bigger, is refused or
  // under-served, and is told nothing. A five-word pointer to a sibling control
  // cannot be wrong; a condition deciding when she deserves to see it can, and
  // this week has been a week of conditions that were. Wording is Sunna's.
  // `data-applied` lives on the SLOT now (appliedSlot, above), not on this
  // paragraph — one row, one slot, one key, whether or not the line has
  // anything to say this frame. A selector of `[data-applied="uiScale"]` still
  // resolves; it lands on the wrapper instead of the paragraph inside it.
  return `<p class="set-applied${limited ? ' limited' : ''}">`
    + (limited
      ? `Showing ${shown} — the largest that fits your screen (${key.toUpperCase()} is ${asked.toFixed(2)}\u00d7)`
      : `Showing ${shown}`)
    + ` <span class="set-applied-hint">For bigger text, try Text size.</span>`
    + `</p>`;
}

// Re-read after the orchestrator has applied the change, and on resize, because
// Auto's applied value moves with the window while the chosen setting does not.
//
// EVERY SLOT ON THE PANEL, not a named one. It used to replace the uiScale
// paragraph by selector, which meant the second row with a derived line under
// it would need this function to learn its key. It reads the slots the panel
// actually drew and asks each row's own function — so a third row costs nothing
// here, and a line that is EMPTY this frame (Minimum tap size at 44) still has
// a slot to come back into. Refilling rather than replacing is what makes the
// empty case work at all.
function refreshApplied(container, settings) {
  container.querySelectorAll('[data-applied]').forEach((slot) => {
    const row = ROWS.find((r) => r.key === slot.dataset.applied);
    if (!row || !row.applied) return;
    slot.innerHTML = row.applied(settings, row) || '';
  });
}

/**
 * anchorPressed(container, btn, wasAt) — keep the pressed control where the
 * finger left it.
 *
 * SUNNA'S FLOOR, and it is a property this build has to satisfy rather than a
 * nicety: *a control that changes layout must still be under the finger that
 * changed it.* Minimum tap size is the case that produced the rule — its own
 * chips are floored by the value it sets, and so is every floored control above
 * it, so choosing a smaller size lifts the whole row up the page and the finger
 * ends on empty background. Measured before this existed: pressing 36 moved the
 * chip 36.4 device px, and 3 of 4 transitions left the chip behind.
 *
 * THE MECHANISM IS HERS: give the difference back through the scrolling pane's
 * `scrollTop`, so nothing about the layout is faked and no element is moved.
 *
 * THE BOUNDARY IS HERS TOO AND SHE STATED IT UNPROMPTED: at `scrollTop 0` with
 * SHRINKING content there is nothing to give back — you cannot scroll above the
 * top of a pane. That is not a bug in this function, it is the arithmetic, and
 * it is exactly where the 44 and 36 steps land when the panel is already at the
 * top. This function reports nothing; `underfinger.mjs` measures which
 * transitions it rescues and which fall in that hole, and the residual is handed
 * back rather than papered over.
 *
 * Applied to EVERY choice row, not to this one by name. A row that changes no
 * layout produces a delta of zero and pays nothing — cheaper than a list of
 * which keys move the page, and a list is a second copy of a fact the layout
 * already knows.
 */
function anchorPressed(container, btn, wasAt) {
  if (typeof document === 'undefined' || !btn.isConnected) return;
  const delta = btn.getBoundingClientRect().top - wasAt;
  if (!delta) return;
  // The nearest ancestor that can actually scroll. Asked of the live boxes, not
  // assumed to be `.set-panel`: both doors mount this container differently and
  // the modal scrolls at a different level than the in-run overlay.
  for (let el = btn.parentElement; el; el = el.parentElement) {
    const canScroll = el.scrollHeight > el.clientHeight + 1;
    if (canScroll) {
      const before = el.scrollTop;
      el.scrollTop = before + delta;
      // It moved as far as it could, which may be zero. Whatever is left is the
      // hole Sunna named, and it belongs to the measurement, not to a retry.
      if (el.scrollTop !== before) return;
    }
    if (el === container) break;
  }
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (isFullscreen()) {
    (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  } else {
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  }
}

/** The categories that will actually DRAW, given whether a save manager exists.
 *  A section that needs `saves` and has none renders nothing, so it must not
 *  get a tab either — a tab onto an empty panel is the lone heading with a
 *  bigger promise. This is the one place `saves` narrows the set. */
function shownCategories(saves) {
  return settingsCategories().filter((cat) => {
    const h = categoryHandler(cat);
    return !(h && h.needs === 'saves' && !saves);
  });
}

/** The body of one category, as HTML. */
function categoryHtml(cat, settings, saves) {
  const h = categoryHandler(cat);
  if (!h) {
    // The lone heading, made loud — now a lone TAB, which is louder still: it
    // is on screen from the moment Settings opens instead of 2000px down. It
    // cannot reach a player (the boot assert fails first), so this is what a
    // developer sees on the way.
    return `<p class="set-note">Nothing is filed under "${esc(cat)}".`
      + ' Give it a row (<code>cat:</code>) or a section, or take it out of'
      + ' CATEGORY_ORDER in src/ui/screens/settings.js.</p>';
  }
  if (h.mount) return `<div class="${h.mount}"></div>`;
  return h.rows.map((r) => rowHtml(settings, r)).join('');
}

/**
 * renderSettings(container, { settings, onChange, grouped })
 * Fills `container` with the settings controls and wires change events.
 * grouped=true draws the category TAB STRIP and one category at a time.
 *
 * SIX SECTIONS USED TO BE SIX HEADINGS DOWN ONE SCROLLING COLUMN. One name was
 * on screen when Settings opened, at every shape and every text size measured;
 * AUDIO sat 1848px below DISPLAY at 390/Text M, and the last section was five
 * thumb-drags away — eight at Text XL, and six at 1200x730, so it was never
 * only a phone. A gold, letter-spaced, uppercase heading promises a taxonomy;
 * hiding five sixths of it is the promise broken in silence.
 *
 * BOTH EDGES, because a tab strip can break this in the other direction:
 *   - six sections must not become six screens a player has to HUNT — so the
 *     whole strip is on screen at once and wraps rather than scrolling
 *     sideways. All six names are readable before the first tap.
 *   - a section that scrolls internally must STILL SCROLL — the panel keeps
 *     the container's overflow, so Display's sixteen rows are all reachable.
 *
 * NOTHING NEW IS AUTHORED to add a seventh. `settingsCategories()` already
 * derives the set from what is filed; a tab, its tooltip, its bumper stop and
 * its place in the ring all follow from that one list.
 */
export function renderSettings(container, { settings, onChange, grouped = true, saves = null, onProfileRestored = null }) {
  let html = '';
  let cats = [];
  let current = null;
  if (grouped) {
    cats = shownCategories(saves);
    // A stored category that no longer exists must not blank the screen. Fail
    // SAFE and visibly: fall back to the first tab, which is where a player who
    // never chose one lands anyway.
    const stored = settings[CAT_KEY];
    current = cats.includes(stored) ? stored : cats[0] || null;
    if (!cats.length) {
      // Nothing is filed anywhere. assertSurfaces fails the boot before a
      // player can meet this, so it is a developer's message, not a player's.
      html = '<p class="set-note">No settings categories exist —'
        + ' nothing is filed under any name in src/ui/screens/settings.js.</p>';
    } else {
      // `data-member` on each TAB is the house convention for a navigable set
      // (#78): the host names the set, each member names itself, so an
      // instrument reads this off the rendered page instead of importing three
      // modules. It moved from the heading to the tab because the tab is now
      // what a player navigates — the heading is gone, since the selected tab
      // IS the heading and printing the name twice costs a phone a line it
      // does not have.
      //
      // role=tab / tablist / tabpanel / aria-selected are the FIRST in this
      // repo. Before tonight a screen reader had no tabs on any surface here,
      // including the overlay's six — that half is still open and is not mine
      // to fix in this file.
      const tabs = cats.map((cat) => `<button class="set-tab${cat === current ? ' on' : ''}"`
        + ` role="tab" id="set-tab-${esc(cat)}" aria-selected="${cat === current}"`
        + ` aria-controls="set-panel" data-member="${esc(cat)}">${esc(cat)}</button>`).join('');
      html = `<div class="set-tabs" role="tablist" aria-label="Settings sections"`
        + ` data-surface="settingsCategory">${tabs}</div>`
        + `<div class="set-panel" id="set-panel" role="tabpanel"`
        + ` aria-labelledby="set-tab-${esc(current)}">${categoryHtml(current, settings, saves)}</div>`;
    }
  } else {
    html = ROWS.map((r) => rowHtml(settings, r)).join('');
  }
  container.innerHTML = html;
  container.setAttribute('data-settings-host', '');

  // ---- everything below wires ONE PANEL'S controls -------------------------
  // It used to run once over the whole column, because the whole column was on
  // screen. With one category at a time it has to run again after every tab
  // switch — the old nodes go with the innerHTML that replaced them, so nothing
  // accumulates. The one listener that is NOT per-panel (the resize handler for
  // the applied-zoom readout) is installed once per open, below.
  const wire = () => {
  const profileMount = container.querySelector('.set-profile-mount');
  // onRestored was a parameter renderProfileSection accepted, called — and that
  // NOBODY EVER PASSED, on either door (#68 D22). So a restore swapped the
  // profile and left the screen wearing the old one's accessibility settings:
  // high contrast stored on and off on screen, reduced motion stored off and on
  // on screen, text size unmoved. The player who most needs those settings is
  // the player who just lost a save.
  if (profileMount && saves) {
    renderProfileSection(profileMount, {
      saves,
      onRestored: () => {
        // Re-read from the manager rather than trusting the closed-over
        // `settings` object: the restore replaced the profile, so the settings
        // this screen was built from are the OLD ones.
        const restored = (saves.loadMeta().settings) || {};
        if (onProfileRestored) onProfileRestored(restored);
      },
    });
  }

  // The acknowledgement needs no manager and no settings — it always renders.
  const aboutMount = container.querySelector('.set-about-mount');
  if (aboutMount) renderAboutSection(aboutMount);

  container.querySelectorAll('.set-text').forEach((input) => {
    // Commit on change/blur (not each keystroke) so we don't re-fetch a manifest
    // mid-type.
    const commit = () => {
      settings[input.dataset.key] = input.value.trim();
      onChange({ [input.dataset.key]: input.value.trim() });
    };
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
  });

  container.querySelectorAll('.set-range').forEach((slider) => {
    slider.addEventListener('input', () => {
      const val = Number(slider.value);
      const out = container.querySelector(`.range-val[data-for="${slider.dataset.key}"]`);
      if (out) out.textContent = val;
      settings[slider.dataset.key] = val;
      onChange({ [slider.dataset.key]: val });
    });
  });

  container.querySelectorAll('[data-btn="commandLog"]').forEach((btn) => {
    btn.addEventListener('click', openDebugLog);
  });

  container.querySelectorAll('.choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      // SUNNA'S FLOOR: a control that changes layout must still be under the
      // finger that changed it. Read where the pressed chip is BEFORE the change
      // lands, so the anchor below has something to aim at.
      const wasAt = btn.getBoundingClientRect().top;
      btn.parentElement.querySelectorAll('.choice').forEach((b) => b.classList.toggle('on', b === btn));
      settings[btn.dataset.key] = btn.dataset.val;
      onChange({ [btn.dataset.key]: btn.dataset.val });
      // AFTER onChange, which is what applies the zoom. Reading before it would
      // report the previous value and the readout would always be one click
      // behind — a display that lies more quietly than the one it replaced.
      //
      // Unconditional, over every slot on the panel. The old `if (key ===
      // 'uiScale')` was the row's identity written a second time in the wiring,
      // and the second row with a derived line under it would have been a
      // second clause. There are at most two slots on a panel; asking both is
      // cheaper than remembering which one moved.
      refreshApplied(container, settings);
      // ANCHOR LAST, and the order is load-bearing — it cost me a measurement.
      // I anchored straight after onChange first, and the 44 step still lost the
      // finger by 16.25 device px: the cost line above had not gone silent yet,
      // so the anchor aimed at a layout that was one paragraph taller than the
      // one the player ends up looking at. Everything that moves the page in
      // response to this press has to have moved before the correction is read.
      anchorPressed(container, btn, wasAt);
    });
  });

  container.querySelectorAll('.toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action) {
        toggleFullscreen();
        // Reflect the new state shortly after the API resolves.
        setTimeout(() => {
          const on = isFullscreen();
          btn.classList.toggle('on', on);
          btn.setAttribute('aria-checked', String(on));
        }, 60);
        return;
      }
      const now = !btn.classList.contains('on');
      btn.classList.toggle('on', now);
      btn.setAttribute('aria-checked', String(now));
      settings[btn.dataset.key] = now;
      onChange({ [btn.dataset.key]: now });
    });
  });
  }; // ---- end wire() ---------------------------------------------------

  wire();

  // Declared before the observer that reads it: the early return below skips
  // the claim, and a `let` read before its declaration is a crash, not a false.
  let claimedRing = false;

  // Auto's applied value moves with the window even though the setting does not.
  // ONE listener per open, not one per tab switch: the readout lives on a row
  // inside Display, so a player who visits Display four times would otherwise
  // collect four handlers that all write the same number.
  const onResize = () => refreshApplied(container, settings);
  window.addEventListener('resize', onResize);
  // The settings container is rebuilt on every open, so the listener is dropped
  // with it rather than accumulating one per visit. Same observer releases the
  // bumpers if this strip took them.
  const obs = new MutationObserver(() => {
    if (container.isConnected) return;
    window.removeEventListener('resize', onResize);
    if (claimedRing) setTabRing(null);
    obs.disconnect();
  });
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (!grouped || !cats.length) return;

  // ---- the strip: selection, tooltips, and the ring ------------------------

  function selectCategory(cat) {
    if (!cats.includes(cat) || cat === current) return;
    current = cat;
    settings[CAT_KEY] = cat;
    // Persisted through the same free bag every other setting rides in
    // (`meta.settings`) — no save-schema change. IN COMBAT IT DOES NOT PERSIST
    // and cannot: that mount passes a synthetic meta with no onChange, so the
    // choice is per-mount there. Stated, not hidden — and not new: the armoury
    // view has always been per-mount at that same call site.
    onChange({ [CAT_KEY]: cat });
    container.querySelectorAll('.set-tab').forEach((b) => {
      const on = b.dataset.member === cat;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    const panel = container.querySelector('.set-panel');
    if (!panel) return;
    panel.innerHTML = categoryHtml(cat, settings, saves);
    panel.setAttribute('aria-labelledby', `set-tab-${cat}`);
    // A tab switch is a new screenful. Start it at the top, or the player lands
    // mid-way down a section they have never seen.
    panel.scrollTop = 0;
    if (panel.parentElement) panel.parentElement.scrollTop = 0;
    wire();
  }

  container.querySelectorAll('.set-tab').forEach((b) => {
    b.addEventListener('click', () => selectCategory(b.dataset.member));
    // Law 3 clause 4: hover AND the pad/keyboard focus cursor. `title=` alone
    // does not satisfy it — touch and gamepad players never see one.
    attachTooltip(b, () => `<b>${esc(b.dataset.member)}</b><br>${esc(categoryTip(b.dataset.member))}`);
  });

  // Law 3 clauses 1 + 1a: RB → next, LB → previous, wrap at BOTH ends, over the
  // same set in the same order. The ring is the `cats` array — one order, and
  // the widget is not consulted.
  //
  // CLAIMED ONLY IF FREE. See hasTabRing() in input.js for the ruling: on the
  // in-run overlay this strip sits INSIDE another tab set, and the bumpers stay
  // with the outer one so RB never changes meaning between two tabs of the same
  // menu. Nothing is passed in; the answer is derived from whether a ring is
  // already held.
  if (!hasTabRing()) {
    claimedRing = true;
    const step = (d) => {
      const i = cats.indexOf(current);
      const at = i < 0 ? 0 : i;
      selectCategory(cats[(at + d + cats.length) % cats.length]);
    };
    setTabRing({ prev: () => step(-1), next: () => step(1) });
  }
}

/**
 * showSettingsNotice(msg) — say something in the open Settings modal. Exists so
 * a refused write can answer instead of being a silent no-op (#67); no-op when
 * Settings is not open.
 */
export function showSettingsNotice(msg) {
  // BOTH doors. This used to look only for the modal's own body, so on the
  // in-run overlay it would have been a silent no-op — the very defect it
  // exists to fix, one layer down (#67, Sunna's D18). renderSettings marks
  // whatever container it filled, so the notice lands wherever Settings is.
  const host = document.querySelector('[data-settings-host]');
  if (!host) return;
  let el = host.querySelector('.set-notice');
  if (!el) {
    el = document.createElement('p');
    el.className = 'set-notice';
    el.setAttribute('role', 'status');
    host.prepend(el);
  }
  el.textContent = msg;
}

export function openSettings({ meta, onChange, saves = null, onProfileRestored = null }) {
  const settings = meta.settings || (meta.settings = {});
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal settings-modal">
      <h2>Settings</h2>
      <div class="set-body"></div>
      <div class="set-actions"><button id="set-close">Done</button></div>
    </div>`;
  document.body.appendChild(veil);
  renderSettings(veil.querySelector('.set-body'), { settings, onChange, saves, onProfileRestored });

  const close = () => veil.remove();
  veil.addEventListener('click', (e) => {
    if (e.target === veil) close();
  });
  veil.querySelector('#set-close').addEventListener('click', close);
}
