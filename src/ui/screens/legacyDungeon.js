import { dungeonDefinition, dungeonNeighbors } from '../../model/legacyDungeon.js';
import { mountMap } from './map.js';

// Only authored data and dungeon intent differ; W4b owns every map control.
export function mountLegacyDungeon(app, { run, registries, meta, hud, onTravel, onInspect, onLeave }) {
  const d = dungeonDefinition(run), s = run.legacyDungeon;
  const width = 1536, height = 1024;
  const kinds = { entrance: 'event', observation: 'event', dialogue: 'event', encounter: 'event', fight: 'monster', shrine: 'shrine', cache: 'treasure', gate: 'event', boss: 'boss' };
  const nodes = Object.fromEntries(d.nodes.map(n => [n.id, {
    ...n, type: kinds[n.kind], floor: n.number, col: 0,
    mapPosition: { x: n.x * width / 100, y: n.y * height / 100 },
    next: dungeonNeighbors(run, n.id), destinationLabel: n.kind === 'boss' ? d.boss : undefined,
  }]));
  const routes = d.edges.map(e => ({ a: e.a, b: e.b, points: [
    [nodes[e.a].mapPosition.x, nodes[e.a].mapPosition.y],
    ...(e.via || []).map(([x,y]) => [x*width/100,y*height/100]),
    [nodes[e.b].mapPosition.x, nodes[e.b].mapPosition.y],
  ] }));
  const reachable = [s.current, ...(s.cleared || s.resolved.includes(s.current) ? dungeonNeighbors(run) : [])];
  mountMap(app, { run, registries, meta, ...hud,
    onPick: id => {
      if (s.cleared && id === d.bossNode) onLeave();
      else if (id === s.current) onInspect();
      else onTravel(id);
    },
    mapAdapter: {
      graph: { nodes, columns: 20, startIds: [d.entrance], bossId: d.bossNode, bossIds: [d.bossNode] },
      art: { id: d.id, map: d.map, width, height, routes },
      current: s.current, reachable, path: s.visited, viewState: s.mapView,
      onViewStateChange: view => { s.mapView = view; },
      title: s.cleared ? `${d.name} · Area cleared` : d.name, theme: d.theme,
      mode: s.cleared ? 'path' : undefined,
      enterLabel: id => s.cleared && id === d.bossNode ? 'Leave cleared dungeon' : null,
    },
  });
}
