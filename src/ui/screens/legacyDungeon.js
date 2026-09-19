import { dungeonDefinition, dungeonNeighbors, dungeonNode } from '../../model/legacyDungeon.js';
import { assetUrl } from '../assetmap.js';
import { esc } from '../components/tooltip.js';

export function mountLegacyDungeon(app, { run, onTravel, onInspect, onLeave, onMenu, onSave }) {
  const d = dungeonDefinition(run), s = run.legacyDungeon, n = dungeonNode(run);
  const nearby = dungeonNeighbors(run), known = new Set(s.visited);
  for (const id of s.visited) for (const other of dungeonNeighbors(run, id)) known.add(other);
  const canMove = s.cleared || s.resolved.includes(s.current);
  const points = Object.fromEntries(d.nodes.map(n => [n.id, n]));
  const routes = d.edges.map(e => {
    const path = [[points[e.a].x, points[e.a].y], ...(e.via || []), [points[e.b].x, points[e.b].y]];
    return `<polyline points="${path.map(([x,y]) => `${x*10},${y*10}`).join(' ')}" class="${s.visited.includes(e.a) && s.visited.includes(e.b) ? 'walked' : ''}"/>`;
  }).join('');
  app.innerHTML = `<section class="legacy-dungeon mapscreen" data-theme="${d.theme}">
    <header><div><span class="legacy-eyebrow">Legacy dungeon · ${s.cleared ? 'Area cleared' : `${s.resolved.length} / 24 locations resolved`}</span><h1>${esc(d.name)}</h1></div>
    <div class="legacy-tools"><span>Health ${run.hp}/${run.maxHp} · ${run.cinders} cinders</span><button data-save>Save</button><button data-menu>Menu</button></div></header>
    <div class="legacy-layout"><div class="legacy-atlas"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <defs><radialGradient id="legacy-reveal"><stop offset=".55" stop-color="black"/><stop offset="1" stop-color="white"/></radialGradient><mask id="legacy-fog"><rect width="1000" height="1000" fill="white"/>${s.visited.map(id => `<circle cx="${points[id].x*10}" cy="${points[id].y*10}" r="175" fill="url(#legacy-reveal)"/>`).join('')}</mask></defs>
      <image href="${assetUrl(d.map)}" width="1000" height="1000" preserveAspectRatio="none"/>
      ${s.cleared ? '' : '<rect class="legacy-fog" width="1000" height="1000" mask="url(#legacy-fog)"/>'}
      <g class="legacy-roads">${routes}</g></svg>
      ${d.nodes.map(node => `<button class="legacy-node ${node.id === s.current ? 'current' : ''} ${s.resolved.includes(node.id) ? 'resolved' : ''} ${node.kind === 'boss' ? 'boss' : ''}" style="left:${node.x}%;top:${node.y}%" data-node="${node.id}" aria-label="${esc(node.name)}${node.id === s.current ? ', current location' : ''}" title="${esc(node.name)}" ${node.id === s.current || (canMove && nearby.includes(node.id)) ? '' : 'disabled'} ${known.has(node.id) || s.cleared ? '' : 'hidden'}>${node.kind === 'boss' ? '♛' : node.number}</button>`).join('')}
    </div><aside><span class="legacy-eyebrow">${esc(n.kind)} · ${n.number.toString().padStart(2,'0')}</span><h2>${esc(n.name)}</h2><p>${esc(n.lore)}</p>
      <button class="legacy-primary" data-inspect>${s.resolved.includes(n.id) || s.cleared ? 'Revisit the memory' : 'Enter location'}</button>
      <p class="legacy-hint">${s.cleared ? 'The boss has fallen. The fog lifts. Explore the remaining memories or continue your journey.' : canMove ? 'Choose a connected road to continue.' : 'Explore this location before taking the next road.'}</p>
      <nav aria-label="Connected roads">${nearby.map(id => `<button data-road="${id}" ${canMove ? '' : 'disabled'}>${esc(points[id].name)} <span>→</span></button>`).join('')}</nav>
      ${s.cleared ? '<button class="legacy-primary" data-leave>Leave cleared dungeon</button>' : ''}
      <footer>Roads from the entrance<br>${d.lanes.map(esc).join(' · ')}<br>Boss: ${esc(d.boss)}</footer>
    </aside></div></section>`;
  app.querySelector('[data-inspect]').onclick = onInspect;
  app.querySelector('[data-save]').onclick = onSave;
  app.querySelector('[data-menu]').onclick = onMenu;
  app.querySelector('[data-leave]')?.addEventListener('click', onLeave);
  for (const b of app.querySelectorAll('[data-node], [data-road]')) b.onclick = () => {
    const id = b.dataset.node || b.dataset.road;
    if (id === s.current) onInspect(); else onTravel(id);
  };
}
