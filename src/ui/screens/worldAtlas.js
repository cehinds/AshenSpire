import { mountLocalMapCamera } from '../components/localMapCamera.js';
import { localServiceModel } from '../models/LocalServiceModel.js';
import { mountMapDetail } from '../components/mapDetail.js';
import { mapFogDefs } from '../components/mapFog.js';
import { MAP_PRESENTATION, MAP_CLOSE_NODE_SCALE } from '../../content/mapPresentation.js';
import {
  ATLAS,
  journeyEdges,
  reachableJourneyNodes,
  questAction,
  lockedJourneyRoads,
} from "../../model/worldAtlas.js";
import { esc } from "../components/tooltip.js";
import { assetUrl } from "../assetmap.js";
import { imageHintAttrs } from "../imageHints.js";
import { nodeIcon } from '../uiContent.js';
import { mapNodeInk } from '../components/mapNodeInk.js';
import { nodeRadius } from '../../model/mapview.js';
import { MAP_TERRAIN_REVEAL_RADIUS } from '../../content/environments.js';
import { atlasFocusCamera } from '../models/AtlasCameraModel.js';
// World-specific places project onto the established run-node vocabulary.
const traditionalType = type => ({start:'shrine',city:'merchant',dungeon:'boss',landmark:'event',service:'merchant',quest:'event',gate:'event'}[type] || type);
const uri = (id) => assetUrl(ATLAS.assets[id]?.uri);
const pct = (n) => `${(n * 100).toFixed(2)}%`;
const button = (label, attrs = "") =>
  `<button type="button" class="as-btn" ${attrs}>${esc(label)}</button>`;

export function mountWorldAtlas(
  app,
  {
    run,
    registries,
    serviceContext = {},
    onTravel,
    onAction,
    onSave,
    onMenu,
    onArmoury,
    onQuit,
    inspectNodeId = null,
    authoring = false,
  },
) {
  const j = run.journey,
    a = ATLAS,
    p = a.profiles[j.profileId],
    map = a.maps[j.mapId];
  j.view ||= {};
  if (j.view.cameraVersion !== 2) { j.view.cameraMode = "close"; j.view.cameraVersion = 2; }
  const pos = Object.fromEntries(
    a.data.world_map_nodes
      .filter((n) => n.mapId === j.mapId)
      .map((n) => [n.nodeId, n]),
  );
  const known = new Set(j.discoveredNodeIds),
    done = new Set(j.completedNodeIds),
    reachable = new Set(reachableJourneyNodes(j));
  const current = a.nodes[j.currentNodeId],
    art = uri(map.artAssetId);
  const coreArt = (id) => {
    const n = a.nodes[id],
      v = pos[id];
    return n.landmarkAssetId
      ? `<img${imageHintAttrs()} src="${esc(uri(n.landmarkAssetId))}" alt=""/>`
      : `<svg viewBox="${v.x * 1000 - 65} ${v.y * 1000 - 75} 130 130" aria-hidden="true"><image href="${esc(art)}" width="1000" height="1000"/></svg>`;
  };
  app.innerHTML = `<section class="mapscreen world-atlas-screen"><header class="atlas-header"><div><span class="atlas-eyebrow">WORLD JOURNEY · ${esc(p.displayName)}</span><h1>${esc(map.displayName)}</h1></div><div class="atlas-header-actions"><span class="atlas-vitals">${run.hp} / ${run.maxHp} HP · ${run.cinders} cinders</span>${button("Armoury", "data-atlas-armoury")}${button("Menu", "data-atlas-menu")}${button("Save & quit", "data-atlas-quit")}</div></header>
 <div class="atlas-layout"><div class="atlas-map-column"><div class="atlas-map-tools"><span>At <strong>${esc(current.displayName)}</strong></span><div>${button("−", 'data-atlas-zoom="-1" aria-label="Zoom out"')}${button("Fit", 'data-atlas-zoom="0"')}${button("You", 'data-atlas-center')}${button("+", 'data-atlas-zoom="1" aria-label="Zoom in"')}</div></div>
 <div class="atlas-scrollport" tabindex="0" aria-label="World map; scroll to explore"><div class="atlas-world" style="--atlas-zoom:${j.view?.zoom || 1}"><svg class="atlas-terrain" viewBox="0 0 1000 1000" aria-hidden="true"><defs>${mapFogDefs('atlas')}<radialGradient id="atlas-reveal"><stop offset="60%" stop-color="white"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient><mask id="atlas-fog" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000" style="mask-type:alpha">${[...known].map((id) => `<circle cx="${pos[id].x * 1000}" cy="${pos[id].y * 1000}" r="${p.revealRadius * 1000}" fill="url(#atlas-reveal)"/>`).join("")}</mask></defs>
 <rect width="1000" height="1000" fill="url(#atlas-paper)"/><g class="map-detail-surface" ${authoring ? "" : 'mask="url(#atlas-fog)"'}><image href="${esc(art)}" width="1000" height="1000" preserveAspectRatio="none"/></g>
 <g class="atlas-roads">${journeyEdges(j)
   .filter((e) => known.has(e.fromNodeId) && known.has(e.toNodeId))
   .map(
     (e) =>
       `<path class="map-route-outline" vector-effect="non-scaling-stroke" d="M${pos[e.fromNodeId].x * 1000} ${pos[e.fromNodeId].y * 1000} L${pos[e.toNodeId].x * 1000} ${pos[e.toNodeId].y * 1000}"/><path vector-effect="non-scaling-stroke" d="M${pos[e.fromNodeId].x * 1000} ${pos[e.fromNodeId].y * 1000} L${pos[e.toNodeId].x * 1000} ${pos[e.toNodeId].y * 1000}" class="${done.has(e.fromNodeId) && done.has(e.toNodeId) ? "traveled" : ""} ${[e.fromNodeId,e.toNodeId].includes(j.currentNodeId) && (reachable.has(e.fromNodeId)||reachable.has(e.toNodeId)) ? "available" : ""}"/>`,
   )
   .join(
     "",
   )}</g></svg><span class="atlas-compass" aria-hidden="true">N<br>✥</span>
 ${j.activeNodeIds
   .filter((id) => known.has(id))
   .map((id) => {
     const n = a.nodes[id],
       core = !!a.localByOwner[id], type = traditionalType(n.nodeTypeId), radius = nodeRadius(type);
     return `<button type="button" class="atlas-node map-node ${type} ${type === "event" ? "revealed" : ""} ${core ? "atlas-core" : ""} ${reachable.has(id) ? "reachable" : ""} ${done.has(id) ? "completed visited" : ""} ${id === j.currentNodeId ? "current" : ""}" style="left:${pct(pos[id].x)};top:${pct(pos[id].y)};--atlas-node-size:${radius * 2 * MAP_CLOSE_NODE_SCALE}px" data-atlas-node="${esc(id)}" aria-label="${esc(n.displayName)}${id === j.currentNodeId ? ", current location" : reachable.has(id) ? ", road available" : ""}"><svg class="atlas-node-face" viewBox="${-radius} ${-radius} ${radius * 2} ${radius * 2}" aria-hidden="true">${mapNodeInk({type, radius, reachable:reachable.has(id)})}</svg>${core ? `<span class="atlas-node-label">${esc(n.displayName)}</span>` : ""}</button>`;
   })
   .join("")}
 <span class="atlas-map-caption">THE FRACTURED REALM<br><small>Beyond the roads, the land remains uncharted</small></span></div></div><div class="atlas-legend"><span>◉ You are here</span><span>◌ Road available</span><span>Gold ring: visited</span><span>Inspect before traveling</span></div></div>
 <aside class="atlas-journal"><span class="atlas-eyebrow">YOUR JOURNEY</span><h2>${esc(current.displayName)}</h2><p>${esc(a.regions[a.regionOf(j.currentNodeId)].displayName)}</p>${button("Inspect current location", "data-atlas-inspect-current")}<div class="atlas-journal-rule"></div><h3>Three guiding lights</h3>${[
   ["start", "Starting city"],
   ["hub", "Major city"],
   ["final", "Legacy dungeon"],
 ]
   .map(
     ([role, label]) =>
       `<div class="atlas-objective"><span>${label}</span><strong>${known.has(j.anchors[role]) ? esc(a.nodes[j.anchors[role]].displayName) : "Beyond the mist"}</strong></div>`,
   )
   .join(
     "",
   )}<div class="atlas-journal-rule"></div><h3>Open roads</h3><div class="atlas-road-list">${[...reachable].map((id) => button(a.nodes[id].displayName, `data-atlas-node="${esc(id)}"`)).join("") || "<p>Complete this location to open the road ahead.</p>"}</div><p class="atlas-progress">${j.visitedNodeIds.length} visited · ${j.activeNodeIds.length} places in this journey</p><small class="atlas-seed">Seed ${esc(j.seed)}</small></aside></div></section>`;
  app.querySelector("[data-atlas-menu]").onclick = onMenu;
  app.querySelector("[data-atlas-armoury]").onclick = onArmoury;
  app.querySelector("[data-atlas-quit]").onclick = onQuit;
  for (const road of lockedJourneyRoads(j)) {
    const note = document.createElement("p");
    note.className = "atlas-action-note";
    note.textContent = `Sealed road: ${a.nodes[road.nodeId].displayName}. Explore ${a.nodes[road.requiredNodeId].displayName} to open it.`;
    app.querySelector(".atlas-road-list").append(note);
  }
  app
    .querySelectorAll("[data-atlas-node]")
    .forEach((b) => (b.onclick = () => inspect(b.dataset.atlasNode, b)));
  app.querySelector("[data-atlas-inspect-current]").onclick = (e) =>
    inspect(j.currentNodeId, e.currentTarget);
  const port = app.querySelector('.atlas-scrollport'), world = app.querySelector('.atlas-world');
  mountMapDetail(port, world.querySelector('.map-detail-surface'), map && a.assets[map.artAssetId].uri);
  const focusPoints = [j.currentNodeId, ...reachable].filter((id, i, ids) => known.has(id) && ids.indexOf(id) === i).map(id => pos[id]);
  let cameraFrame = 0;
  // Clip fog composition to the viewport, even when the world is zoomed close.
  const fitFogSurface = () => {
    const mask = world.querySelector('#atlas-fog');
    const scale = 1000 / world.offsetWidth;
    mask.setAttribute('x', String(port.scrollLeft * scale - 1));
    mask.setAttribute('y', String(port.scrollTop * scale - 1));
    mask.setAttribute('width', String(port.clientWidth * scale + 2));
    mask.setAttribute('height', String(port.clientHeight * scale + 2));
  };
  port.addEventListener('scroll', fitFogSurface, {passive:true});
  const center = () => {
    if (!port.isConnected || !port.clientWidth) return;
    const close = atlasFocusCamera(focusPoints, port.clientWidth, port.clientHeight);
    const automatic = j.view.cameraMode === 'close';
    if (automatic) j.view.zoom = close.zoom;
    world.style.setProperty('--atlas-zoom', j.view.zoom || 1);
    world.style.setProperty('--atlas-face-scale', String(Math.max(.52, Math.min(2, (j.view.zoom || 1) / close.zoom))));
    // Match the traditional map's visible reveal halo at close zoom. This only
    // frames terrain; the discovered-node set and travel permissions are intact.
    const revealRadius = Math.min(p.revealRadius * 1000, MAP_TERRAIN_REVEAL_RADIUS * MAP_CLOSE_NODE_SCALE * 1000 / world.offsetWidth);
    for (const circle of world.querySelectorAll('#atlas-fog circle')) circle.setAttribute('r', String(revealRadius));
    const target = automatic ? close : pos[j.currentNodeId];
    port.scrollLeft = target.x * world.offsetWidth - port.clientWidth / 2;
    port.scrollTop = target.y * world.offsetHeight - port.clientHeight / 2;
    fitFogSurface();
    port.dataset.cameraMode = j.view.cameraMode || 'manual';
    port.dataset.cameraZoom = String(j.view.zoom);
  };
  const schedule = () => { cancelAnimationFrame(cameraFrame); cameraFrame = requestAnimationFrame(center); };
  const resize = new ResizeObserver(schedule); resize.observe(port);
  const detached = new MutationObserver(() => {
    if (!port.isConnected) { resize.disconnect(); detached.disconnect(); cancelAnimationFrame(cameraFrame); port.removeEventListener('scroll', fitFogSurface); }
  });
  detached.observe(app, {childList:true});
  schedule();
  app.querySelector('[data-atlas-center]').onclick = () => { j.view.cameraMode = 'close'; center(); onSave?.(); };
  app.querySelectorAll('[data-atlas-zoom]').forEach(b => b.onclick = () => {
    j.view.cameraMode = 'manual';
    j.view.zoom = b.dataset.atlasZoom === '0' ? 1 : Math.max(1, Math.min(MAP_PRESENTATION.atlasZoomMax, (j.view.zoom || 1) * (Number(b.dataset.atlasZoom) > 0 ? 1.25 : .8)));
    center(); onSave?.();
  });
  function inspect(id, returnFocus) {
    if (!known.has(id)) return;
    const n = a.nodes[id],
      local = a.localByOwner[id],
      here = id === j.currentNodeId;
    const dialog = document.createElement("dialog");
    dialog.className = "atlas-dialog modal-veil";
    dialog.setAttribute("aria-labelledby", "atlas-location-title");
    dialog.innerHTML = `<div class="atlas-dialog-head"><div><span class="atlas-eyebrow">${esc(a.regions[a.regionOf(id)].displayName)}</span><h2 id="atlas-location-title">${esc(n.displayName)}</h2></div>${button("Close", 'data-atlas-close aria-label="Close location"')}</div><div class="atlas-location-body"><div class="atlas-local-wrap">${local ? localMapHtml(local) : `<div class="atlas-location-illustration">${coreArt(id)}</div>`}</div><section class="atlas-location-detail" aria-live="polite"></section></div><footer class="atlas-dialog-foot"><span>${here ? "You are here" : reachable.has(id) ? "A connected road leads here" : "Explore connecting roads to reach this place"}</span>${button(here ? "Return to world" : `Travel to ${n.displayName}`, `data-atlas-travel ${!here && !reachable.has(id) ? "disabled" : ""}`)}<div class="atlas-detail-actions"></div></footer>`;
    document.body.append(dialog);
    if (local) {
      const tools = dialog.querySelector('.atlas-local-tools');
      dialog.querySelector('.atlas-location-body').append(tools);
    }
    dialog.showModal();
    let disposeLocal = () => {};
    const close = () => {
      disposeLocal();
      dialog.close();
      dialog.remove();
      returnFocus?.focus();
    };
    dialog.querySelector("[data-atlas-close]").onclick = close;
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.querySelector("[data-atlas-travel]").onclick = () => {
      close();
      if (!here) onTravel(id);
    };

    dialog.querySelector(".atlas-location-detail").innerHTML =
      `<h3>${esc(n.displayName)}</h3><p>${esc(n.description)}</p><p>${local ? "Select a marked place to see its services, quests, or destination." : "Travel is separate from inspection."}</p>${!local && here && !done.has(id) ? button("Explore this place", "data-atlas-explore") : ""}`;
    const explore = dialog.querySelector("[data-atlas-explore]");
    if (explore)
      explore.onclick = () => {
        close();
        onAction({ kind: "explore", ownerId: id });
      };
    if (local) {
      j.view.localMaps ||= {};
      disposeLocal = mountLocalMapCamera(dialog, {
        mapId: local.mapId, source: a.assets[a.maps[local.mapId].artAssetId].uri,
        points: a.localPoints[local.mapId] || [], saved: j.view.localMaps[local.mapId],
        onSelect: detail,
        onSave: view => { j.view.localMaps[local.mapId] = view; onSave?.(); },
      });
    }
    function detail(pointId) {
      const point = a.nodes[pointId],
        services = a.nodeServices[pointId] || [],
        quests = a.nodeQuests[pointId] || [],
        gates = a.gates[pointId];
      const gate =
        gates?.find((g) => reachable.has(g.destinationNodeId)) || gates?.[0];
      dialog
        .querySelectorAll("[data-local-point]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(b.dataset.localPoint === pointId),
          ),
        );
      let html = `<span class="atlas-eyebrow">${esc(a.data.node_types.find((t) => t.nodeTypeId === point.nodeTypeId)?.displayName || "Location")}</span><h3>${esc(point.displayName)}</h3>${services.length ? "" : `<p>${esc(point.description)}</p>`}${!here ? '<p class="atlas-action-note">Travel here to use these services.</p>' : ""}`;
      for (const s of services) {
        const def = a.services[s.serviceId],
          used = j.serviceStates[pointId]?.used;
        const preview = localServiceModel({ handlerId: a.serviceTypes[def.serviceTypeId].handlerId,
          registries, run, state: j.serviceStates[pointId], ...serviceContext });
        html += `<div class="atlas-service-benefits">${def.displayName === point.displayName ? "" : `<h4>${esc(def.displayName)}</h4>`}<p class="atlas-service-benefit">${esc(preview.benefit)}</p><ul>${preview.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div>`;
        html += button(
          used ? "Visit used" : preview.action,
          `data-local-service="${esc(s.serviceId)}" ${!here || used ? "disabled" : ""}`,
        );
      }
      for (const q of quests) {
        const def = a.quests[q.questId],
          action = questAction(j, q.questId);
        html += `<h4>${esc(def.displayName)}</h4><p>${esc(def.description)}</p><p class="atlas-service-benefit">Reward: ${def.rewardCinders} cinders. Objective: ${esc(a.nodes[def.objectiveNodeId]?.displayName || "Explore the marked road")}.</p>${button(action.label, `data-local-quest="${esc(q.questId)}" ${!here || !action.allowed ? "disabled" : ""}`)}`;
      }
      if (gate) {
        const available = reachable.has(gate.destinationNodeId);
        html += `<p>${available ? `Road to ${esc(a.nodes[gate.destinationNodeId].displayName)}` : "This gate does not connect to an open road in this journey."}</p>${button("Take this road", `data-local-gate ${!here || !available ? "disabled" : ""}`)}`;
      }
      if (point.nodeTypeId === "boss")
        html += button(
          done.has(id) ? "Boss defeated" : "Enter the inner sanctum",
          `data-local-boss ${!here || done.has(id) ? "disabled" : ""}`,
        );
      if (
        !services.length &&
        !quests.length &&
        !gate &&
        point.nodeTypeId !== "boss"
      )
        html += button(
          j.localCompletedIds.includes(pointId) ? "Explored" : "Explore site",
          `data-local-explore ${!here || j.localCompletedIds.includes(pointId) ? "disabled" : ""}`,
        );
      const pane = dialog.querySelector(".atlas-location-detail");
      pane.innerHTML = `<div class="atlas-detail-scroll">${html}</div>`;
      const actions = dialog.querySelector('.atlas-detail-actions');
      actions.replaceChildren();
      pane.querySelectorAll('[data-local-service], [data-local-quest], [data-local-gate], [data-local-boss], [data-local-explore]').forEach(b => actions.append(b));
      actions.querySelectorAll("[data-local-service]").forEach(
        (b) =>
          (b.onclick = () => {
            close();
            onAction({
              kind: "service",
              ownerId: id,
              pointId,
              serviceId: b.dataset.localService,
            });
          }),
      );
      actions.querySelectorAll("[data-local-quest]").forEach(
        (b) =>
          (b.onclick = () => {
            onAction({
              kind: "quest",
              ownerId: id,
              pointId,
              questId: b.dataset.localQuest,
              stay: true,
            });
            detail(pointId);
          }),
      );
      const g = actions.querySelector("[data-local-gate]");
      if (g)
        g.onclick = () => {
          close();
          onTravel(gate.destinationNodeId);
        };
      const boss = actions.querySelector("[data-local-boss]");
      if (boss)
        boss.onclick = () => {
          close();
          onAction({ kind: "boss", ownerId: id, pointId });
        };
      const visit = actions.querySelector("[data-local-explore]");
      if (visit)
        visit.onclick = () => {
          onAction({ kind: "local", ownerId: id, pointId, stay: true });
          detail(pointId);
        };
    }
  }
  if (inspectNodeId)
    inspect(inspectNodeId, app.querySelector("[data-atlas-inspect-current]"));
}
function localMapHtml(local) {
  const map = ATLAS.maps[local.mapId],
    points = ATLAS.localPoints[local.mapId] || [];
  return `<div class="atlas-local-tools" role="group" aria-label="Map controls"><div class="atlas-local-pan-tools" role="group" aria-label="Pan map"><output data-local-zoom-value aria-label="Map zoom">150%</output>${[['up','↑'],['left','←'],['right','→'],['down','↓']].map(([dir,label])=>button(label,`data-local-pan="${dir}" aria-label="Pan map ${dir}"`)).join('')}</div><div class="atlas-local-zoom-tools">${button('−','data-local-zoom="out" aria-label="Zoom local map out"')}${button('Fit','data-local-zoom="fit"')}${button('+','data-local-zoom="in" aria-label="Zoom local map in"')}</div></div>
  <p class="atlas-local-help">Drag to explore · scroll or pinch to zoom · focus map for + / − and arrow keys</p>
  <div class="atlas-local-port" tabindex="0" role="group" aria-label="${esc(map.displayName)} interactive map"><div class="atlas-local-map"><svg viewBox="0 0 1000 1000" aria-hidden="true"><g class="map-detail-surface"><image href="${esc(uri(map.artAssetId))}" width="1000" height="1000" preserveAspectRatio="none"/></g></svg>${points
    .map((p) => {
      const n = ATLAS.nodes[p.nodeId];
      return `<button type="button" data-local-point="${esc(p.nodeId)}" aria-label="Inspect ${esc(n.displayName)}" aria-pressed="false" class="atlas-local-point" style="left:${pct(p.x)};top:${pct(p.y)}"><span>${nodeIcon(traditionalType(n.nodeTypeId))}</span><small>${esc(n.displayName)}</small></button>`;
    })
    .join("")}</div></div><label class="atlas-local-picker-label">Locations <select data-local-picker><option value="">Choose a place…</option>${points.map(p=>`<option value="${esc(p.nodeId)}">${esc(ATLAS.nodes[p.nodeId].displayName)}</option>`).join('')}</select></label>`;
}
