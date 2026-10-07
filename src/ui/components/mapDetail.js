import { MAP_ART } from '../../content/mapArt.generated.js';
import { MAP_PRESENTATION as policy } from '../../content/mapPresentation.js';
import { detailLevel, visibleTiles } from '../models/MapDetailModel.js';
import { assetUrl, builtInSource } from '../assetmap.js';
import { ART_SOURCE_EVENT } from '../highResArt.js';

// Fallback stays underneath at all times. Detail files are never bundled into
// the single HTML. Each tile is an asset id, `map-detail/<hash>/<edge>/<x>-<y>.webp`
// (tileId below), resolved by assetUrl(): the web edition finds it in the
// common pack's object store (docs/EXTERNAL-ASSETS-PLAN.md §3.8, step 3c); a
// single file served over http(s) and the source tree pass the id through as
// the path of the map-detail/ folder beside the page, as before. A tile is a
// plain Image load of that URL (no fetch, no blob), so it is cached by the
// browser like any other image, and works under file:// too (step 4): a
// double-clicked web edition draws its tiles from the objects beside it. Under
// file:// only a tile the built-in source lists is requested: a single file
// has no index, and a path beside a downloaded file is usually not there, so
// it keeps its low-detail fallback without asking, as before.
export const tileId = (assetHash, key) => `map-detail/${assetHash}/${key}.webp`;
/** Whether a tile may be requested: always over http(s); under file:// only when the pack index lists it. */
export function tileReachable(id, { protocol = globalThis.location?.protocol, source = builtInSource() } = {}) {
  return protocol !== 'file:' || !!(source && source.has(id));
}
export function mountMapDetail(port, surface, source) {
  const art = MAP_ART[source], base = surface?.querySelector('image');
  if (!art || !base) return () => {};
  const svg = base.ownerSVGElement, ns = 'http://www.w3.org/2000/svg';
  const tiles = document.createElementNS(ns, 'g'); tiles.classList.add('map-detail-tiles'); surface.append(tiles);
  const cache = new Map(), failed = new Set(), pending = new Set();
  const loading = new Set(); // the Image of each tile in flight, dropped on dispose
  let generation = 0; // bumped when the art source changes
  let disposed = false, frame = 0, level = null, desired = [], active = 0;
  port.style.setProperty('--map-route-width', policy.routeWidth + 'px');
  port.style.setProperty('--map-route-outline-width', policy.routeOutlineWidth + 'px');
  port.dataset.detailState = location.protocol === 'file:' ? 'offline-fallback' : 'fallback';
  const evict = () => {
    const protectedKeys = new Set(desired.map(t => t.key));
    for (const key of cache.keys()) {
      if (cache.size <= policy.cacheTiles) break;
      if (!protectedKeys.has(key)) cache.delete(key);
    }
  };
  // THE TILES ON THE BOARD, BY KEY, AND TOUCHED ONLY WHEN THE SET CHANGES.
  // update() runs on every scroll and every viewBox change, so on every frame
  // of a camera glide (a node pick, a tray opening). It used to rebuild every
  // tile <image> each time. Each insertion re-ran the board's `:has()` rules
  // (styles/map.css, `svg:has(.map-terrain)` and friends), which restyled the
  // whole screen, then laid the board out and decoded the tiles again: a full
  // restyle per frame, which is what made a pick on a phone stutter. A tile
  // that stays visible now keeps its node; only tiles that enter or leave the
  // visible set are added or removed.
  const drawn = new Map();
  let drawnSize = '';
  const setData = (name, value) => { if (port.dataset[name] !== value) port.dataset[name] = value; };
  function paint() {
    if (disposed || !desired.length || desired.some(t => !cache.has(t.key) && !failed.has(t.key))) return;
    const width = Number(base.getAttribute('width')), height = Number(base.getAttribute('height'));
    // The base image's size places every tile; if it changed, place them again.
    if (drawnSize !== `${width}x${height}`) { drawnSize = `${width}x${height}`; for (const image of drawn.values()) image.remove(); drawn.clear(); }
    const shown = desired.filter(t=>cache.has(t.key));
    const keep = new Set(shown.map(t => t.key));
    for (const [key, image] of drawn) if (!keep.has(key)) { image.remove(); drawn.delete(key); }
    for (const t of shown) {
      const href = cache.get(t.key);
      let image = drawn.get(t.key);
      if (!image) {
        image = document.createElementNS(ns, 'image');
        image.setAttribute('x', t.x*width); image.setAttribute('y', t.y*height);
        image.setAttribute('width', t.width*width); image.setAttribute('height', t.height*height);
        image.setAttribute('preserveAspectRatio','none'); image.dataset.tile=t.key;
        drawn.set(t.key, image);
      }
      if (image.getAttribute('href') !== href) image.setAttribute('href', href);
      if (image.parentNode !== tiles) tiles.append(image);
    }
    setData('detailLevel', String(level.edge));
    setData('detailState', shown.length === desired.length ? 'ready' : 'fallback');
    setData('detailTiles', String(shown.length)); evict();
  }
  async function load(tile) {
    // The source this load resolved against (see sourceChanged below): a
    // failure under an older source is not recorded, so the tile is asked for
    // again through the new one once this load has finished.
    const gen = generation;
    active++; pending.add(tile.key);
    const image = new Image();
    loading.add(image);
    try {
      const url = assetUrl(tileId(art.assetHash, tile.key));
      image.src = url; await image.decode();
      if (!disposed) cache.set(tile.key, url);
    } catch (error) {
      if (!disposed && gen === generation) failed.add(tile.key);
    } finally {
      loading.delete(image);
      active--; pending.delete(tile.key);
      if (!disposed) { paint(); evict(); pump(); }
    }
  }
  function pump() {
    if (disposed) return;
    let marked = false;
    for (const tile of desired) {
      if (active >= policy.concurrentLoads) break;
      if (cache.has(tile.key) || failed.has(tile.key) || pending.has(tile.key)) continue;
      if (tileReachable(tileId(art.assetHash, tile.key))) load(tile);
      // file:// with an index that lacks this tile: it counts as missing, as a
      // 404 would over http(s), so the tiles the index has still draw.
      else if (builtInSource()) { failed.add(tile.key); marked = true; }
    }
    if (marked) paint();
  }
  function update() {
    frame = 0; if (disposed || !base.isConnected) return;
    const rect = base.getBoundingClientRect(), view = port.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Keep engraving fine even when the underlying world is many screens wide.
    const matrix = base.getScreenCTM();
    // Written only when the scale moved: a pattern attribute invalidates every
    // shape the pattern fills, and a glide does not change the zoom.
    if (matrix) {
      const scale = `scale(${1/Math.hypot(matrix.a,matrix.b)})`;
      for (const pattern of svg.querySelectorAll('.map-paper-pattern')) if (pattern.getAttribute('patternTransform') !== scale) pattern.setAttribute('patternTransform', scale);
    }
    level = detailLevel(art.levels,rect.width,rect.height,devicePixelRatio,level);
    desired = visibleTiles(level,{x0:(view.left-rect.left)/rect.width,y0:(view.top-rect.top)/rect.height,x1:(view.right-rect.left)/rect.width,y1:(view.bottom-rect.top)/rect.height});
    setData('detailRequested', String(level.edge));
    // Only the small visible set is requested, even at Fit. `cache` only
    // records which tiles have loaded (policy.cacheTiles bounds it); the
    // browser's image cache holds the bytes, so evicting frees none.
    paint(); pump();
  }
  const schedule = () => { if (!disposed && !frame) frame=requestAnimationFrame(update); };
  const resize = new ResizeObserver(schedule); resize.observe(port);
  const geometry = new MutationObserver(schedule);
  geometry.observe(svg,{attributes:true,attributeFilter:['viewBox','style']});
  if (svg.parentElement) geometry.observe(svg.parentElement,{attributes:true,attributeFilter:['style']});
  port.addEventListener('scroll',schedule,{passive:true});
  // THE SOURCE CHANGED (a tier switch, highResArt.js builtInArtArrived): a tile
  // that failed because the earlier source did not list it (the common index
  // missed at boot) may resolve now, so the failures are forgotten and the
  // visible set is requested again. A load still in flight resolved against
  // the old source: the generation bump keeps its failure out of `failed`, and
  // its end re-pumps the tile. Tiles already drawn stay until replaced.
  const sourceChanged = () => { if (disposed) return; generation++; failed.clear(); schedule(); };
  document.addEventListener(ART_SOURCE_EVENT, sourceChanged);
  const removal = new MutationObserver(() => { if (!port.isConnected) dispose(); });
  removal.observe(document.body,{childList:true,subtree:true});
  function dispose() {
    if (disposed) return; disposed=true; cancelAnimationFrame(frame);
    // A tile still loading is not wanted: dropping its src stops the request.
    for (const image of loading) image.removeAttribute('src');
    loading.clear();
    resize.disconnect(); geometry.disconnect(); removal.disconnect(); port.removeEventListener('scroll',schedule);
    document.removeEventListener(ART_SOURCE_EVENT, sourceChanged);
    tiles.remove(); cache.clear();
  }
  schedule(); return dispose;
}
