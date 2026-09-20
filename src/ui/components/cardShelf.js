import { cardShelfColumnsAt } from '../models/CardSizeModel.js';

/**
 * THE SHELF TELLS ITS OWN ITEMS HOW MANY OF THEM A ROW HOLDS.
 *
 * `.card-shelf` (styles/kit.css) lays resting cards out on its own, from three
 * authored numbers, and that is the whole rule where no script is running — a
 * preview page, a screenshot harness, the kit's own component gallery. What it
 * cannot do alone is agree with ITSELF across two rows.
 *
 * A wrapping flex row sizes its items from `flex-basis` and then lets the last
 * row's stragglers GROW into the slack beside them. Photographed at 1328x744
 * on the merchant's five-card shelf: four cards at 145px and the fifth, alone
 * on its row, at 155. The same card, two sizes, on one shelf — the defect
 * CardSizeModel.js exists to argue against, reproduced by the layout rather
 * than by a stylesheet's number.
 *
 * Turning the growth off would fix the disagreement and cost the phone: with
 * `flex-grow: 0` a two-card row sits at the 120px floor with a hundred pixels
 * of slack beside it, where growing filled the row at 137. So neither half of
 * the CSS bargain is dropped. Instead the COLUMN COUNT stops being the
 * authored maximum and becomes the count this shelf actually holds at its
 * measured width — `cardShelfColumnsAt`, the model's own arithmetic — which
 * makes `calc((100% - (n - 1) * gap) / n)` the exact track. Every item on the
 * shelf then has the same basis, the row is full, and growth has nothing left
 * to distribute.
 *
 * Measure, then write, on the next frame: ResizeObserver delivers DURING
 * layout, and a custom property written there invalidates the box that is
 * being laid out. `wireShopLayout` in screens/shop.js keeps the same shape for
 * the same reason.
 */
export function wireCardShelf(host) {
  let pending = 0;
  let observer = null;
  const shelves = () => {
    const found = host && host.querySelectorAll ? [...host.querySelectorAll('.card-shelf')] : [];
    return host && host.classList && host.classList.contains('card-shelf') ? [host, ...found] : found;
  };
  function apply() {
    pending = 0;
    if (host && host.isConnected === false) { release(); return; }
    for (const shelf of shelves()) {
      // A hidden shelf measures 0 and would be told it holds one card; it is
      // left alone and measured again when the pane shows it. The merchant
      // keeps every shelf mounted and hides all but one, so this is the
      // ordinary case here, not an edge.
      const width = shelf.clientWidth;
      if (!(width > 0)) continue;
      shelf.style.setProperty('--card-shelf-cols', `${cardShelfColumnsAt(width)}`);
    }
  }
  const schedule = () => {
    if (pending) return;
    pending = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(apply) : setTimeout(apply, 0);
  };
  function release() {
    if (pending && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pending);
    pending = 0;
    if (observer) observer.disconnect();
    observer = null;
  }
  if (typeof ResizeObserver !== 'undefined' && host) {
    observer = new ResizeObserver(schedule);
    for (const shelf of shelves()) observer.observe(shelf);
    // The shelves live inside a pane that resizes without them: a hidden shelf
    // has no box to report and would never be measured after it was shown.
    if (host.nodeType === 1) observer.observe(host);
  }
  apply();
  return { apply, release };
}
