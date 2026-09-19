import { dungeonDefinition, dungeonNeighbors } from '../../model/legacyDungeon.js';
import { assetUrl } from '../assetmap.js';
import { esc } from '../components/tooltip.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { actRouteStripHtml } from '../components/actRouteStrip.js';
import { mountRunPotions } from '../components/runPotions.js';
import { button } from '../kit/index.js';
import { releaseMapScreen } from './map.js';

let releaseViewport = null;
export function mountLegacyDungeon(app, options) {
  releaseViewport?.();
  releaseMapScreen();
  const { run, registries, meta, hud, onTravel, onInspect, onLeave, onSave } = options;
  const d = dungeonDefinition(run), s = run.legacyDungeon;
  const nearby = dungeonNeighbors(run), known = new Set(s.visited);
  for (const id of s.visited) for (const other of dungeonNeighbors(run, id)) known.add(other);
  const canMove = s.cleared || s.resolved.includes(s.current);
  const points = Object.fromEntries(d.nodes.map(n => [n.id, n]));
  const routes = d.edges.map(e => {
    const path = [[points[e.a].x, points[e.a].y], ...(e.via || []), [points[e.b].x, points[e.b].y]];
    return `<polyline points="${path.map(([x,y]) => `${x*10},${y*10}`).join(' ')}" class="${s.visited.includes(e.a) && s.visited.includes(e.b) ? 'walked' : ''}"/>`;
  }).join('');
  app.innerHTML = `<section class="legacy-dungeon mapscreen" data-theme="${d.theme}" data-wireframe="W4b">
    ${runHudHtml({ registries, run, meta, place: 'map', headerClass: 'map-header' })}
    ${actRouteStripHtml({ title: d.name })}
    <div class="map-frame"><div class="map-scroll legacy-scroll"><div class="legacy-atlas"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <defs><radialGradient id="legacy-reveal"><stop offset=".45" stop-color="black"/><stop offset="1" stop-color="white"/></radialGradient>
      <mask id="legacy-fog"><rect width="1000" height="1000" fill="white"/>${s.visited.map(id => `<circle cx="${points[id].x*10}" cy="${points[id].y*10}" r="170" fill="url(#legacy-reveal)"/>`).join('')}</mask>
      <filter id="legacy-smoke" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".009 .016" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".3"/></feComponentTransfer></filter>
      <filter id="legacy-road-haze" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="12"/></filter></defs>
      <image href="${assetUrl(d.map)}" width="1000" height="1000" preserveAspectRatio="none"/>
      ${s.cleared ? '' : `<g mask="url(#legacy-fog)"><rect class="legacy-fog" width="1000" height="1000"/><rect class="legacy-smoke" width="1000" height="1000" filter="url(#legacy-smoke)"/><g class="legacy-path-haze" filter="url(#legacy-road-haze)">${routes}</g></g>`}
      <g class="legacy-roads">${routes}</g></svg>
      ${d.nodes.map(node => `<button type="button" class="legacy-node ${node.id === s.current ? 'current' : ''} ${s.resolved.includes(node.id) ? 'resolved' : ''} ${node.kind === 'boss' ? 'boss' : ''}" style="left:${node.x}%;top:${node.y}%" data-node="${node.id}" aria-label="${esc(node.name)}${node.id === s.current ? ', current location' : ''}" title="${esc(node.name)}" ${node.id === s.current || (canMove && nearby.includes(node.id)) ? '' : 'disabled'} ${known.has(node.id) || s.cleared ? '' : 'hidden'}>${node.kind === 'boss' ? '♛' : node.number}</button>`).join('')}
    </div></div><div class="map-zoom legacy-zoom" aria-label="Map view controls"></div><div class="map-potions"></div></div>
    <div class="map-tray legacy-tray" data-open="true" data-shown="true"><section class="map-context" aria-live="polite"></section><div class="map-tray-pair"></div><nav class="legacy-roads-list" aria-label="Connected roads"></nav></div></section>`;
  const remount = () => mountLegacyDungeon(app, options);
  wireRunHud(app, { registries, run, meta, ...hud, remount });
  mountRunPotions(app.querySelector('.map-potions'), { registries, run, meta, onChange: () => { onSave(); remount(); } });
  const context = app.querySelector('.map-context'), pair = app.querySelector('.map-tray-pair');
  const back = button({ label: 'Back', id: 'map-back' });
  const enter = button({ label: 'Enter location', id: 'map-enter', weight: 'primary' });
  enter.dataset.inspect = ''; pair.append(back, enter);
  if (s.cleared) { const leave = button({ label: 'Leave cleared dungeon', weight: 'primary' }); leave.dataset.leave = ''; leave.onclick = () => { releaseViewport?.(); onLeave(); }; pair.append(leave); }
  let selected = s.current;
  function select(id) {
    selected = id; const n = points[id];
    context.innerHTML = `<p class="as-eyebrow">${s.cleared ? 'Area cleared' : `${s.resolved.length} / 24 resolved`} · ${esc(n.kind)}</p><h2 class="map-context-title">${esc(n.name)}</h2><p class="map-context-line">${esc(n.lore)}</p>`;
    enter.textContent = id === s.current ? (s.resolved.includes(id) || s.cleared ? 'Revisit the memory' : 'Enter location') : `Travel to ${n.name}`;
    back.disabled = id === s.current;
    for (const b of app.querySelectorAll('.legacy-node')) b.classList.toggle('selected', b.dataset.node === id);
  }
  back.onclick = () => select(s.current);
  enter.onclick = () => { releaseViewport?.(); selected === s.current ? onInspect() : onTravel(selected); };
  for (const b of app.querySelectorAll('[data-node]')) b.onclick = () => select(b.dataset.node);
  const roads = app.querySelector('.legacy-roads-list');
  for (const id of nearby) { const b = button({ label: points[id].name, disabled: !canMove }); b.dataset.road = id; b.onclick = () => select(id); roads.append(b); }
  const scroll = app.querySelector('.legacy-scroll'), atlas = app.querySelector('.legacy-atlas');
  let zoom = 1;
  const fit = () => { if (atlas.isConnected) atlas.style.width = `${Math.max(280, Math.min(scroll.clientWidth - 24, (scroll.clientHeight - 24) * 1.5)) * zoom}px`; };
  for (const [label, change] of [['−', -.25], ['Recenter', 0], ['+', .25]]) {
    const b = button({ label }); b.setAttribute('aria-label', label === '+' ? 'Zoom in' : label === '−' ? 'Zoom out' : label);
    b.onclick = () => { zoom = change ? Math.max(1, Math.min(2.5, zoom + change)) : 1; fit(); if (!change) scroll.scrollTo(0, 0); };
    app.querySelector('.legacy-zoom').append(b);
  }
  const observer = new ResizeObserver(fit); observer.observe(scroll);
  releaseViewport = () => observer.disconnect();
  select(s.current); fit();
}
