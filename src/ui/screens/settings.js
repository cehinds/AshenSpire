// src/ui/screens/settings.js — settings controls (SPEC §7)
//
// Rows are declarative and grouped into categories. `renderSettings` builds the
// controls into any container and wires change events, so the same controls
// back both the standalone modal (openSettings) and the in-run overlay's
// Settings tab. Each row declares its default so stored settings stay sparse.
// `onChange({key:value})` lets the orchestrator persist + apply immediately.

import { openDebugLog } from '../debuglog.js';
import { renderProfileSection } from './profileArchive.js';
import { AUDIO_DEFAULTS } from '../audio.js';
import { balance } from '../../content/balance.js';

const UI_DEFAULTS = balance.ui;

const ROWS = [
  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },
  { cat: 'Display', key: 'animSpeed', type: 'choice', def: 'normal',
    choices: ['slow', 'normal', 'fast', 'instant'], label: 'Combat pacing',
    note: 'How deliberately actions play out — one actor at a time, or instant.' },
  { cat: 'Display', key: 'mapZoom', type: 'choice', def: '115',
    choices: ['100', '115', '130', '150'], label: 'Map zoom %',
    note: 'Default zoom when the act map opens. In-map + / − buttons override per view.' },
  { cat: 'Display', key: 'accent', type: 'choice', def: 'gold',
    choices: ['gold', 'crimson', 'frost', 'verdant', 'violet'], label: 'Accent color',
    note: 'Tint the interface — highlights, borders, focus ring, and glow.' },
  { cat: 'Display', key: 'uiScale', type: 'choice', def: 'Auto',
    choices: ['Auto', 'S', 'M', 'L', 'XL'], label: 'UI size', applied: true,
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
    note: 'Hits, blocks, bleed bursts, UI.' },
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
  { cat: 'Accessibility', key: 'colorblindSafe', def: false, label: 'Colorblind-friendly',
    note: 'Shift danger/heal/blight/frost colors to a more distinguishable palette.' },
  { cat: 'Accessibility', key: 'reduceFlashes', def: false, label: 'Reduce flashes',
    note: 'Suppress bright impact and proc flashes (photosensitivity). Damage numbers stay.' },
  { cat: 'Accessibility', key: 'readableHeadings', def: false, label: 'Readable headings',
    note: 'Use the plain UI font for titles instead of the decorative serif.' },
  { cat: 'Advanced', key: 'commandLog', type: 'button', btn: 'Open', label: 'Command log',
    note: 'The recent commands and results between the interface and the engine. Copy it into a bug report if the game misbehaves.' },
];

// 'Profile' is the calm-moment route to set-aside profiles and runs (#67).
// It renders only when a save manager is passed in — a section that promises a
// drawer it cannot open would be the same broken promise one layer down.
const CATEGORIES = ['Display', 'Audio', 'Accessibility', 'Profile', 'Advanced'];

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
        <div><b>${r.label}</b><p class="set-note">${r.note}</p>${r.applied ? appliedHtml(settings) : ''}</div>
        <div class="choice-group">${opts}</div>
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
  return `<p class="set-applied${limited ? ' limited' : ''}" data-applied="uiScale">`
    + (limited
      ? `Showing ${shown} — the largest that fits your screen (${key.toUpperCase()} is ${asked.toFixed(2)}\u00d7)`
      : `Showing ${shown}`)
    + ` <span class="set-applied-hint">For bigger text, try Text size.</span>`
    + `</p>`;
}

// Re-read after the orchestrator has applied the change, and on resize, because
// Auto's applied value moves with the window while the chosen setting does not.
function refreshApplied(container, settings) {
  const el = container.querySelector('[data-applied="uiScale"]');
  if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = appliedHtml(settings);
  const next = tmp.firstElementChild;
  if (next) el.replaceWith(next);
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

/**
 * renderSettings(container, { settings, onChange, grouped })
 * Fills `container` with the settings controls and wires change events.
 * grouped=true adds category headers.
 */
export function renderSettings(container, { settings, onChange, grouped = true, saves = null, onProfileRestored = null }) {
  let html = '';
  if (grouped) {
    for (const cat of CATEGORIES) {
      if (cat === 'Profile') {
        if (!saves) continue; // no manager, no promise
        html += `<h3 class="set-cat">Profile</h3><div class="set-profile-mount"></div>`;
        continue;
      }
      const rows = ROWS.filter((r) => r.cat === cat);
      html += `<h3 class="set-cat">${cat}</h3>` + rows.map((r) => rowHtml(settings, r)).join('');
    }
  } else {
    html = ROWS.map((r) => rowHtml(settings, r)).join('');
  }
  container.innerHTML = html;
  container.setAttribute('data-settings-host', '');

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
      btn.parentElement.querySelectorAll('.choice').forEach((b) => b.classList.toggle('on', b === btn));
      settings[btn.dataset.key] = btn.dataset.val;
      onChange({ [btn.dataset.key]: btn.dataset.val });
      // AFTER onChange, which is what applies the zoom. Reading before it would
      // report the previous value and the readout would always be one click
      // behind — a display that lies more quietly than the one it replaced.
      if (btn.dataset.key === 'uiScale') refreshApplied(container, settings);
    });
  });

  // Auto's applied value moves with the window even though the setting does not.
  if (container.querySelector('[data-applied="uiScale"]')) {
    const onResize = () => refreshApplied(container, settings);
    window.addEventListener('resize', onResize);
    // The settings container is rebuilt on every open, so the listener is
    // dropped with it rather than accumulating one per visit.
    const obs = new MutationObserver(() => {
      if (!container.isConnected) { window.removeEventListener('resize', onResize); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

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
