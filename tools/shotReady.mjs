// tools/shotReady.mjs — "is every combatant's artwork on screen yet?", asked
// in the page by tools/screenshot.mjs before it captures a combat shot.
//
// WHY. A one-shot `--screenshot` fires when Chrome's virtual-time budget
// expires, not when the images it photographs can be painted. Measured
// 2026-10-01 at 1440x860 on dev a2be33e97: three of three `?shot=combat`
// captures drew both enemies and the player's ground shadow but NOT the
// player, while the same page in real time had the Reaver's
// `STANCE-READY.webp` loaded (naturalWidth 512), display:block,
// visibility:visible, opacity 1, no transform — the player's frame is added
// last and was still decoding (`decoding="async"`) when the budget ran out.
// The game was right; the photograph was not. So a combat shot now waits on
// the artwork itself, and fails by name rather than writing a frame that is
// missing a figure.
//
// `combatantArt` runs IN THE PAGE (screenshot.mjs serialises it with
// toString), so it must stay self-contained: no imports, no closures.
// tests/shot-ready.test.mjs drives it against a fake document.

/**
 * The state of every combatant's shown artwork.
 * An image counts as SHOWN when it has a src and is not display:none,
 * visibility:hidden or opacity:0 — hidden pose and state frames are skipped,
 * exactly the ones the game keeps parked for later.
 * @returns {{ ready: boolean, combatants: Array<{ eid: string, shown: number, drawn: number }>,
 *   pending: string[], broken: string[] }}
 */
export function combatantArt(doc = globalThis.document, view = globalThis.window) {
  const frames = [...doc.querySelectorAll('.combatant')];
  const pending = [], broken = [];
  const combatants = frames.map((frame) => {
    const eid = frame.dataset?.eid || '?';
    let shown = 0, drawn = 0;
    for (const img of frame.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      if (!src) continue;
      const css = view.getComputedStyle(img);
      if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) continue;
      shown++;
      const label = `${eid}:${src.split('/').pop()}`;
      if (!img.complete) pending.push(label);
      else if (!(img.naturalWidth > 0)) broken.push(label);
      else drawn++;
    }
    return { eid, shown, drawn };
  });
  const ready = frames.length > 0 && !pending.length && !broken.length
    && combatants.every((c) => c.drawn > 0);
  return { ready, combatants, pending, broken };
}

/**
 * The in-page expression screenshot.mjs evaluates: the art state, and once it
 * is ready, every shown image decoded so the next frame paints it.
 */
export function readyExpression() {
  return `(async () => {
    const combatantArt = ${combatantArt.toString()};
    const state = combatantArt(document, window);
    if (!state.ready) return state;
    const shown = [...document.querySelectorAll('.combatant img')].filter((img) => {
      const css = getComputedStyle(img);
      return img.getAttribute('src') && css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) !== 0;
    });
    const failed = [];
    await Promise.all(shown.map((img) => img.decode().catch(() => failed.push(img.getAttribute('src').split('/').pop()))));
    // Two frames: one to commit the decoded images, one to paint them.
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    return failed.length ? { ...state, ready: false, broken: failed } : state;
  })()`;
}
