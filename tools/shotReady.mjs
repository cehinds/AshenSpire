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
 * `shownImages` is the list of those shown elements, so readyExpression
 * decodes exactly the images this check counted (one filter, not two).
 * @returns {{ ready: boolean, combatants: Array<{ eid: string, shown: number, drawn: number }>,
 *   pending: string[], broken: string[], shownImages: object[] }}
 */
export function combatantArt(doc = globalThis.document, view = globalThis.window) {
  const frames = [...doc.querySelectorAll('.combatant')];
  const pending = [], broken = [], shownImages = [];
  const combatants = frames.map((frame) => {
    const eid = frame.dataset?.eid || '?';
    let shown = 0, drawn = 0;
    for (const img of frame.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      if (!src) continue;
      const css = view.getComputedStyle(img);
      if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) continue;
      shown++;
      shownImages.push(img);
      const label = `${eid}:${src.split('/').pop()}`;
      if (!img.complete) pending.push(label);
      else if (!(img.naturalWidth > 0)) broken.push(label);
      else drawn++;
    }
    return { eid, shown, drawn };
  });
  const ready = frames.length > 0 && !pending.length && !broken.length
    && combatants.every((c) => c.drawn > 0);
  return { ready, combatants, pending, broken, shownImages };
}

/**
 * The in-page expression screenshot.mjs evaluates: the art state, and once it
 * is ready, every shown image decoded so the next frame paints it.
 */
export function readyExpression() {
  return `(async () => {
    const combatantArt = ${combatantArt.toString()};
    const { shownImages, ...state } = combatantArt(document, window);
    if (!state.ready) return state;
    const failed = [];
    await Promise.all(shownImages.map((img) => img.decode().catch(() => failed.push(img.getAttribute('src').split('/').pop()))));
    // Two frames: one to commit the decoded images, one to paint them.
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    return failed.length ? { ...state, ready: false, broken: failed } : state;
  })()`;
}

/**
 * A DevTools client over an open WebSocket in which every call settles.
 * `send(method, params, timeoutMs)` resolves with the reply, rejects with the
 * reply's error, rejects by name once `timeoutMs` passes with no reply, and
 * rejects when the socket closes or errors, so a Chromium that exits mid-run
 * cannot leave screenshot.mjs waiting forever short of its cleanup. The caller
 * passes the time left before its own deadline (--ready-timeout).
 */
export function devtoolsClient(socket) {
  let id = 0;
  let gone = null;
  const waiting = new Map();
  const fail = (why) => {
    gone ??= why;
    for (const [key, pair] of waiting) { waiting.delete(key); pair.no(new Error(gone)); }
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    const pair = data.id != null && waiting.get(data.id);
    if (!pair) return;
    waiting.delete(data.id);
    data.error ? pair.no(new Error(data.error.message)) : pair.ok(data.result);
  };
  socket.onclose = () => fail('DevTools connection closed');
  socket.onerror = () => fail('DevTools connection failed');
  return (method, params = {}, timeoutMs) => new Promise((ok, no) => {
    if (gone) { no(new Error(gone)); return; }
    const next = ++id;
    const limit = Math.max(1, Math.floor(timeoutMs));
    const timer = setTimeout(() => {
      waiting.delete(next);
      no(new Error(`DevTools ${method} gave no reply in ${limit} ms`));
    }, limit);
    const settle = (fn) => (value) => { clearTimeout(timer); fn(value); };
    waiting.set(next, { ok: settle(ok), no: settle(no) });
    try { socket.send(JSON.stringify({ id: next, method, params })); } catch (e) { waiting.delete(next); settle(no)(e); }
  });
}

/**
 * Keep a frame only when a retake `waitMs` later is byte-identical to it, up to
 * `tries` retakes. Resolves with the agreed frame, or null when the frames
 * never agree; the caller then writes NO PNG.
 *
 * BOUNDARY: this assumes the captured board holds still once its art is ready.
 * The shipped combat and co-op boards do: both draw their backdrop through
 * combatBackdropHtml() as `.environment-backdrop`, whose `::after` (the only
 * carrier of the infinite `backdropGlow` animation) is `display: none` in
 * styles/combat.css. A board that showed an always-running animation would
 * never agree here and FAILS CLOSED (no PNG) rather than being widened to
 * tolerate motion; freezing animations would change what the preview shows,
 * so that is its own change. tests/shot-ready.test.mjs pins both halves.
 */
export async function settledFrame(grab, { tries, waitMs, onRetry = () => {} }) {
  let frame = await grab();
  for (let attempt = 1; attempt <= tries; attempt++) {
    await new Promise((ok) => setTimeout(ok, waitMs));
    const retake = await grab();
    if (retake.equals(frame)) return retake;
    onRetry(attempt);
    frame = retake;
  }
  return null;
}
