import { MAP_ART } from '../../content/mapArt.generated.js';
import { MAP_PRESENTATION as policy } from '../../content/mapPresentation.js';
import { detailLevel, visibleTiles } from '../models/MapDetailModel.js';

// Fallback stays underneath at all times. Detail files are never bundled into
// the single HTML: hosted builds carry a sibling map-detail directory.
export function mountMapDetail(port, surface, source) {
  const art = MAP_ART[source], base = surface?.querySelector('image');
  if (!art || !base) return () => {};
  const svg = base.ownerSVGElement, ns = 'http://www.w3.org/2000/svg';
  const tiles = document.createElementNS(ns, 'g'); tiles.classList.add('map-detail-tiles'); surface.append(tiles);
  const cache = new Map(), failed = new Set(), pending = new Set();
  const abort = new AbortController();
  let disposed = false, frame = 0, level = null, desired = [], active = 0;
  const root = new URL('map-detail/', document.baseURI);
  port.style.setProperty('--map-route-width', policy.routeWidth + 'px');
  port.style.setProperty('--map-route-outline-width', policy.routeOutlineWidth + 'px');
  port.dataset.detailState = location.protocol === 'file:' ? 'offline-fallback' : 'fallback';
  const evict = () => {
    const protectedKeys = new Set(desired.map(t => t.key));
    for (const [key, url] of cache) {
      if (cache.size <= policy.cacheTiles) break;
      if (!protectedKeys.has(key)) { URL.revokeObjectURL(url); cache.delete(key); }
    }
  };
  function paint() {
    if (disposed || !desired.length || desired.some(t => !cache.has(t.key) && !failed.has(t.key))) return;
    const width = Number(base.getAttribute('width')), height = Number(base.getAttribute('height'));
    const nodes = desired.filter(t=>cache.has(t.key)).map(t => {
      const image = document.createElementNS(ns, 'image');
      image.setAttribute('href', cache.get(t.key)); image.setAttribute('x', t.x*width); image.setAttribute('y', t.y*height);
      image.setAttribute('width', t.width*width); image.setAttribute('height', t.height*height);
      image.setAttribute('preserveAspectRatio','none'); image.dataset.tile=t.key;
      return image;
    });
    tiles.replaceChildren(...nodes);
    port.dataset.detailLevel = String(level.edge);
    port.dataset.detailState = nodes.length === desired.length ? 'ready' : 'fallback';
    port.dataset.detailTiles = String(nodes.length); evict();
  }
  async function load(tile) {
    active++; pending.add(tile.key);
    let url;
    try {
      const response = await fetch(new URL(`${art.assetHash}/${tile.key}.webp`, root), {signal:abort.signal});
      if (!response.ok) throw Error(`Map detail HTTP ${response.status}`);
      url = URL.createObjectURL(await response.blob());
      const image = new Image(); image.src = url; await image.decode();
      if (disposed) { URL.revokeObjectURL(url); return; }
      cache.set(tile.key,url); url = null;
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      if (!disposed) failed.add(tile.key);
    } finally {
      active--; pending.delete(tile.key);
      if (!disposed) { paint(); evict(); pump(); }
    }
  }
  function pump() {
    if (disposed || location.protocol === 'file:') return;
    for (const tile of desired) {
      if (active >= policy.concurrentLoads) break;
      if (!cache.has(tile.key) && !failed.has(tile.key) && !pending.has(tile.key)) load(tile);
    }
  }
  function update() {
    frame = 0; if (disposed || !base.isConnected) return;
    const rect = base.getBoundingClientRect(), view = port.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Keep engraving fine even when the underlying world is many screens wide.
    const matrix = base.getScreenCTM();
    if (matrix) for (const pattern of svg.querySelectorAll('.map-paper-pattern')) pattern.setAttribute('patternTransform', `scale(${1/Math.hypot(matrix.a,matrix.b)})`);
    level = detailLevel(art.levels,rect.width,rect.height,devicePixelRatio,level);
    desired = visibleTiles(level,{x0:(view.left-rect.left)/rect.width,y0:(view.top-rect.top)/rect.height,x1:(view.right-rect.left)/rect.width,y1:(view.bottom-rect.top)/rect.height});
    port.dataset.detailRequested = String(level.edge);
    // Only a small visible set can enter the decoded cache, even at Fit.
    if (location.protocol !== 'file:') { paint(); pump(); }
  }
  const schedule = () => { if (!disposed && !frame) frame=requestAnimationFrame(update); };
  const resize = new ResizeObserver(schedule); resize.observe(port);
  const geometry = new MutationObserver(schedule);
  geometry.observe(svg,{attributes:true,attributeFilter:['viewBox','style']});
  if (svg.parentElement) geometry.observe(svg.parentElement,{attributes:true,attributeFilter:['style']});
  port.addEventListener('scroll',schedule,{passive:true});
  const removal = new MutationObserver(() => { if (!port.isConnected) dispose(); });
  removal.observe(document.body,{childList:true,subtree:true});
  function dispose() {
    if (disposed) return; disposed=true; abort.abort(); cancelAnimationFrame(frame);
    resize.disconnect(); geometry.disconnect(); removal.disconnect(); port.removeEventListener('scroll',schedule);
    tiles.remove(); for (const url of cache.values()) URL.revokeObjectURL(url); cache.clear();
  }
  schedule(); return dispose;
}
