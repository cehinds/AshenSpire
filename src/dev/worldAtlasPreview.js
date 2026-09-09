import {
  ATLAS,
  generateJourney,
  journeyProblems,
} from "../model/worldAtlas.js";
import { mountWorldAtlas } from "../ui/screens/worldAtlas.js";
const $ = (id) => document.getElementById(id);
for (const p of Object.values(ATLAS.profiles)) {
  const o = new Option(p.displayName, p.profileId);
  $("preview-profile").append(o);
}
let run;
function render(inspectNodeId = null) {
  mountWorldAtlas($("preview"), {
    run,
    authoring: $("preview-view").value !== "fog",
    inspectNodeId,
    onTravel: () => {},
    onAction: () => {},
    onSave: () => {},
    onMenu: () => {},
    onArmoury: () => {},
    onQuit: () => {
      location.href = "index.html";
    },
  });
  // This page is an inspector, not a second game controller. Clearly disable
  // mutations even if the shared renderer considers a road reachable.
  $("preview")
    .querySelectorAll("[data-atlas-armoury],[data-atlas-menu]")
    .forEach((b) => (b.disabled = true));
}
function generate() {
  $("preview-error").textContent = "";
  try {
    const j = generateJourney(
        $("preview-seed").value,
        $("preview-profile").value,
      ),
      problems = journeyProblems(j);
    if (problems.length) throw Error(problems.join("\n"));
    const selected = [...j.activeNodeIds];
    if ($("preview-view").value === "catalog") {
      j.activeNodeIds = ATLAS.data.world_map_nodes
        .filter((n) => n.mapId === j.mapId)
        .map((n) => n.nodeId);
      j.activeEdgeIds = ATLAS.data.edges
        .filter((e) => e.mapId === j.mapId)
        .map((e) => e.edgeId);
    }
    if ($("preview-view").value !== "fog")
      j.discoveredNodeIds = [...j.activeNodeIds];
    run = { journey: j, hp: 62, maxHp: 62, cinders: 0 };
    $("preview-location").replaceChildren(
      new Option("Choose a location ID", ""),
    );
    for (const id of j.discoveredNodeIds.filter((id) => ATLAS.localByOwner[id]))
      $("preview-location").append(
        new Option(`${ATLAS.nodes[id].displayName} · ${id}`, id),
      );
    $("preview-diagnostics").textContent =
      `${ATLAS.revision}\nProfile: ${j.profileId} v${j.profileVersion}\nMap: ${j.mapId}\nAnchors: ${JSON.stringify(j.anchors)}\nSelected world nodes: ${selected.length}; local points excluded from budget\n${selected.join("\n")}`;
    render();
  } catch (e) {
    $("preview-error").textContent = e.message;
  }
}
$("preview-controls").onsubmit = (e) => {
  e.preventDefault();
  generate();
};
$("preview-view").onchange = generate;
$("preview-location").onchange = (e) => {
  if (e.target.value) render(e.target.value);
};
generate();
