// workbench/modules/review/model.mjs — the pure logic of Visual Review: the
// screens and device presets it captures, the pixel diff, filters, the deep link
// and the baseline-accept plan. DOM-free and file-free, so the tests run in Node.
// The screen list mirrors the SHOTS table in tools/screenshot.mjs; a test fails
// when the two drift apart.

/** Device presets. Desk is the Workbench's own 1280x800 review shape. */
export const DEVICES = [
  { id: 'desk', label: 'Desk', width: 1280, height: 800 },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { id: 'phone', label: 'Phone', width: 390, height: 844 },
];

/**
 * The game's ?shot= scenes. `layout: true` marks a screen that draws UI config
 * (HUD, battlefield, room bands) and so links to Layout Studio.
 */
export const SCREENS = [
  { id: 'startup', label: 'Startup', query: '?shot=startup' },
  { id: 'title', label: 'Title', query: '?shot=title', layout: true },
  { id: 'map', label: 'Map', query: '?shot=map', layout: true },
  { id: 'combat', label: 'Combat', query: '?shot=combat', layout: true },
  { id: 'fx', label: 'Combat FX', query: '?shot=fx', layout: true },
  { id: 'boss-intro', label: 'Boss intro', query: '?shot=boss', layout: true },
  { id: 'death', label: 'Death', query: '?shot=death', layout: true },
  { id: 'coop-combat', label: 'Co-op combat', query: '?shot=coop' },
  { id: 'coop-map', label: 'Co-op map', query: '?shot=coopmap' },
  { id: 'coop-reward', label: 'Co-op reward', query: '?shot=coopreward' },
  { id: 'victory-receipt', label: 'Victory receipt', query: 'build/AshenSpire.html?shot=reward&shotReward=receipt' },
  { id: 'coop-shrine', label: 'Co-op shrine', query: '?shot=coopshrine' },
  { id: 'coop-catchup', label: 'Co-op catch-up', query: '?shot=coopcatchup' },
  { id: 'event', label: 'Event', query: '?shot=event', layout: true },
  { id: 'rest', label: 'Rest', query: '?shot=rest', layout: true },
  { id: 'shop', label: 'Shop', query: '?shot=shop', layout: true },
  { id: 'customize', label: 'Customize', query: '?shot=customize', layout: true },
  { id: 'prologue', label: 'Prologue', query: '?shot=prologue' },
  { id: 'class-reaver', label: 'Reaver', query: '?shot=customize&shotClass=reaver' },
  { id: 'class-starseer', label: 'Starseer', query: '?shot=customize&shotClass=starseer' },
  { id: 'class-rogue', label: 'Rogue', query: '?shot=customize&shotClass=rogue' },
  { id: 'class-herald', label: 'Herald', query: '?shot=customize&shotClass=herald' },
  { id: 'class-rogue-ember', label: 'Rogue (ember)', query: '?shot=customize&shotClass=rogue&shotTint=ember' },
];

export const screenById = (id) => SCREENS.find((s) => s.id === id) || null;
export const deviceById = (id) => DEVICES.find((d) => d.id === id) || null;

/** The capture file name for one screen on one device: desk-title.png. */
export const captureFile = (device, screen) => `${device}-${screen}.png`;

/** One row per screen x device, screen-major, the order the grid shows. */
export function rowsFor(screens = SCREENS, devices = DEVICES) {
  return screens.flatMap((s) => devices.map((d) => ({ key: `${d.id}/${s.id}`, screen: s.id, device: d.id, file: captureFile(d.id, s.id) })));
}

/** A channel may differ by this much (0-255) before a pixel counts as changed: anti-aliasing noise. */
export const DEFAULT_TOLERANCE = 8;
/** A screen is changed when more than this percentage of its pixels changed. */
export const DEFAULT_THRESHOLD = 0.05;

const pixelDiffers = (a, b, i, tolerance) => {
  for (let c = 0; c < 4; c++) if (Math.abs(a[i + c] - b[i + c]) > tolerance) return true;
  return false;
};

/**
 * Compares two RGBA images, `{ width, height, data }` with four bytes a pixel.
 * Returns { sizeMismatch, total, changed, percent }. Two images of different
 * sizes are changed by definition: sizeMismatch is true and percent is 100.
 */
export function diffPixels(a, b, { tolerance = DEFAULT_TOLERANCE } = {}) {
  if (a.width !== b.width || a.height !== b.height) {
    return { sizeMismatch: true, total: Math.max(a.width * a.height, b.width * b.height), changed: null, percent: 100 };
  }
  const total = a.width * a.height;
  const bytes = Math.min(a.data.length, b.data.length, total * 4);
  let changed = 0;
  for (let i = 0; i + 3 < bytes; i += 4) if (pixelDiffers(a.data, b.data, i, tolerance)) changed++;
  return { sizeMismatch: false, total, changed, percent: total ? (changed * 100) / total : 0 };
}

/**
 * The diff picture: a changed pixel is red, an unchanged one is the current
 * image faded to a light grey, so the changes read at a glance. null when the
 * two sizes differ, since no pixel lines up.
 */
export function diffImage(a, b, { tolerance = DEFAULT_TOLERANCE } = {}) {
  if (a.width !== b.width || a.height !== b.height) return null;
  const out = new Uint8ClampedArray(a.width * a.height * 4);
  for (let i = 0; i + 3 < out.length; i += 4) {
    if (pixelDiffers(a.data, b.data, i, tolerance)) {
      out[i] = 255; out[i + 1] = 0; out[i + 2] = 80; out[i + 3] = 255;
    } else {
      const lum = 0.299 * a.data[i] + 0.587 * a.data[i + 1] + 0.114 * a.data[i + 2];
      const v = Math.round(lum * 0.3 + 178);
      out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
    }
  }
  return { width: a.width, height: a.height, data: out };
}

/** The verdict on a diff summary: changed when it is a size mismatch or more than `thresholdPercent` of pixels changed. */
export function judge(summary, { thresholdPercent = DEFAULT_THRESHOLD } = {}) {
  if (!summary) return { status: 'none', changed: false };
  if (summary.sizeMismatch) return { status: 'size', changed: true };
  const changed = summary.percent > thresholdPercent;
  return { status: changed ? 'changed' : 'unchanged', changed };
}

/**
 * Keeps the rows the grid filters ask for: `changedOnly` keeps the changed rows
 * (and size changes), `screen` and `device` keep one screen or one device ('' keeps all).
 */
export function filterRows(rows, { changedOnly = false, screen = '', device = '' } = {}) {
  return rows.filter((r) => (!changedOnly || r.changed === true)
    && (!screen || r.screen === screen)
    && (!device || r.device === device));
}

/** Counts for the grid's status line: how many rows are changed, unchanged, unbaselined or missing a capture. */
export function summarizeRows(rows) {
  const out = { total: rows.length, changed: 0, unchanged: 0, noBaseline: 0, noCapture: 0 };
  for (const r of rows) {
    if (!r.hasCapture) out.noCapture++;
    else if (!r.hasBaseline) out.noBaseline++;
    if (r.changed === true) out.changed++;
    else if (r.changed === false) out.unchanged++;
  }
  return out;
}

/**
 * The deep link's params, #mod=review&screen=…&device=…. Unknown screens and
 * devices are dropped, so a stale link opens the grid rather than failing.
 */
export function parseDeepLink(params = {}) {
  const screen = screenById(params.screen) ? params.screen : null;
  const device = deviceById(params.device) ? params.device : null;
  return { screen, device };
}

/** The inverse of parseDeepLink: only the chosen filters appear in the link. */
export function deepLinkOf({ screen = null, device = null } = {}) {
  const out = {};
  if (screenById(screen)) out.screen = screen;
  if (deviceById(device)) out.device = device;
  return out;
}

/** 0 reads as 0%, a tiny but non-zero share as <0.01%, and anything else to two places. */
export function percentLabel(p) {
  if (!(p > 0)) return '0%';
  if (p < 0.01) return '<0.01%';
  return `${p.toFixed(2)}%`;
}
