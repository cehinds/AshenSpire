import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ATLAS,
  createAtlasIndex,
  generateJourney,
  journeyProblems,
  journeyGraph,
  journeyEncounter,
  travelJourney,
  completeJourneyNode,
  reachableJourneyNodes,
  questAction,
} from "../src/model/worldAtlas.js";
import { worldAtlas } from "../src/content/generated/worldAtlas.js";
import {
  createRunState,
  serializeRun,
  deserializeRun,
} from "../src/model/state.js";
import { createRegistries } from "../src/model/registries.js";
import { contentBundle } from "../src/content/index.js";
import { createSaveManager, createMemoryStorage } from "../src/engine/save.js";
import { createRng } from "../src/engine/rng.js";
import {
  validateAtlasData,
  atlasTables,
  exportAtlas,
  importAtlasCsv,
} from "../tools/world-atlas-data.mjs";
const reg = createRegistries(contentBundle),
  test = (name, fn) => {
    fn();
    console.log("PASS " + name);
  };
test("200 authored nodes, 11 local maps, IDs resolve through normalized owners", () => {
  assert.equal(worldAtlas.world_nodes.length, 200);
  assert.equal(worldAtlas.local_maps.length, 11);
  assert.equal(ATLAS.regionOf("crownfall/forge"), "ashen-crown");
  assert.equal(
    ATLAS.serviceTypes[ATLAS.services.smith.serviceTypeId].handlerId,
    "smith",
  );
});
test("300 seeded routes preserve budgets, anchors, gates and final reachability", () => {
  const hubs = new Set(),
    finals = new Set(),
    regions = new Set();
  for (const profileId of ["wanderer", "expedition"])
    for (let i = 0; i < 150; i++) {
      const j = generateJourney("ATLAS" + i, profileId);
      assert.deepEqual(journeyProblems(j), []);
      assert.equal(
        j.activeNodeIds.length,
        ATLAS.profiles[profileId].activeTarget,
      );
      hubs.add(j.anchors.hub);
      finals.add(j.anchors.final);
      for (const id of j.activeNodeIds) regions.add(ATLAS.regionOf(id));
    }
  assert.equal(hubs.size, 5);
  assert.equal(finals.size, 5);
  assert.equal(regions.size, 5);
});
test("same seed and revision replay exactly; changing one ID binding changes revision", () => {
  assert.deepEqual(generateJourney("SAME"), generateJourney("SAME"));
  const data = structuredClone(worldAtlas);
  data.nodes[0].description += " revised";
  assert.notEqual(createAtlasIndex(data).revision, ATLAS.revision);
});
test("travel rejects inactive and disconnected nodes; inspection grants no travel", () => {
  const j = generateJourney("TRAVEL"),
    before = structuredClone(j);
  assert.throws(() => travelJourney(j, j.anchors.final), /not available/);
  assert.deepEqual(j, before);
  const next = reachableJourneyNodes(j)[0];
  travelJourney(j, next);
  assert.equal(j.currentNodeId, next);
  assert.deepEqual(reachableJourneyNodes(j), []);
  completeJourneyNode(j);
  assert.ok(reachableJourneyNodes(j).length > 0);
  assert.ok(reachableJourneyNodes(j).includes(j.anchors.start));
});
test("every resolved combat references registered enemies; explicit bosses never fall back", () => {
  for (let i = 0; i < 15; i++) {
    const j = generateJourney("ENEMY" + i);
    for (const id of Object.keys(j.outcomes)) {
      const e = journeyEncounter(j, id, reg);
      for (const enemy of e.enemies) assert.ok(reg.enemies.get(enemy));
      if (id === j.anchors.final) assert.equal(e.pool, "boss");
    }
  }
});
test("run save roundtrip retains route, encounter outcomes, discovery and service claims", () => {
  const run = createRunState({ seed: 123, classId: "reaver", registries: reg });
  run.journey = generateJourney("SAVE");
  run.mapGraph = journeyGraph(run.journey);
  run.journey.serviceStates["crownfall/inn"] = { used: true };
  run.journey.localCompletedIds.push("crownfall/inn");
  assert.deepEqual(deserializeRun(serializeRun(run)).journey, run.journey);
  const stale = structuredClone(run);
  stale.journey.contentRevision = "old";
  assert.throws(
    () => deserializeRun(serializeRun(stale)),
    /route was not regenerated/,
  );
  const bad = structuredClone(run);
  bad.journey.outcomes[bad.journey.anchors.final] = {
    enemyId: "wanderingSoldier",
  };
  assert.throws(
    () => deserializeRun(serializeRun(bad)),
    /boss or explicit encounter changed/,
  );
});
test("impossible pins, budgets and excluded regions fail with named errors", () => {
  const data = structuredClone(worldAtlas);
  data.profile_anchor_pins.push({
    profileId: "wanderer",
    roleId: "final",
    nodeId: "crownfall",
  });
  assert.throws(
    () => generateJourney("BAD", "wanderer", createAtlasIndex(data)),
    /no eligible final/,
  );
  const d = structuredClone(worldAtlas);
  d.run_profiles[0].activeTarget = 201;
  d.run_profiles[0].maxAttempts = 2;
  assert.throws(
    () => generateJourney("BAD", "wanderer", createAtlasIndex(d)),
    /budget/,
  );
  const e = structuredClone(worldAtlas);
  for (const region of e.regions)
    e.profile_region_exclusions.push({
      profileId: "wanderer",
      regionId: region.regionId,
    });
  assert.throws(
    () => generateJourney("BAD", "wanderer", createAtlasIndex(e)),
    /no eligible start/,
  );
});
test("pinned anchors and exclusions are respected", () => {
  const d = structuredClone(worldAtlas);
  d.profile_anchor_pins.push(
    { profileId: "wanderer", roleId: "hub", nodeId: "emberhold" },
    { profileId: "wanderer", roleId: "final", nodeId: "dead-foundry" },
  );
  d.profile_region_exclusions.push({
    profileId: "wanderer",
    regionId: "hollow-weald",
  });
  const a = createAtlasIndex(d),
    j = generateJourney("PINNED", "wanderer", a);
  assert.equal(j.anchors.hub, "emberhold");
  assert.equal(j.anchors.final, "dead-foundry");
  assert.ok(j.activeNodeIds.every((id) => a.regionOf(id) !== "hollow-weald"));
});
test("quests activate only for selected objectives and claims cannot repeat", () => {
  let j, q;
  for (let i = 0; i < 30 && !q; i++) {
    j = generateJourney("QUEST" + i);
    q = Object.values(ATLAS.quests).find((q) =>
      j.activeNodeIds.includes(q.objectiveNodeId),
    );
  }
  if (!q) throw Error("No quest objective selected in fixture sweep");
  assert.equal(questAction(j, q.questId).next, "accepted");
  j.questStates[q.questId] = "accepted";
  completeJourneyNode(j, q.objectiveNodeId);
  assert.equal(questAction(j, q.questId).reward, q.rewardCinders);
  j.questStates[q.questId] = "claimed";
  assert.equal(questAction(j, q.questId).allowed, false);
});
test("SQL rejects duplicate keys, dangling references, mistyped fields and missing bosses", () => {
  const cases = [
    (d) => d.nodes.push({ ...d.nodes[0] }),
    (d) => (d.world_nodes[0].regionId = "missing"),
    (d) => (d.run_profiles[0].activeTarget = "20"),
    (d) => d.node_encounters.splice(0, 1),
  ];
  for (const edit of cases) {
    const d = structuredClone(worldAtlas);
    edit(d);
    assert.throws(() => validateAtlasData(d));
  }
});
test("CSV, JSON and editable SQLite projections roundtrip without changing content revision", () => {
  const dir = mkdtempSync(join(tmpdir(), "ashen-atlas-")),
    db = validateAtlasData(worldAtlas);
  try {
    exportAtlas(db, dir);
    const csv = importAtlasCsv(dir),
      roundtrip = validateAtlasData(csv);
    try {
      assert.deepEqual(atlasTables(roundtrip), atlasTables(db));
      assert.equal(createAtlasIndex(csv).revision, ATLAS.revision);
      assert.equal(
        createAtlasIndex(
          JSON.parse(readFileSync(join(dir, "content.json"), "utf8")),
        ).revision,
        ATLAS.revision,
      );
    } finally {
      roundtrip.close();
    }
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("editing region metadata once updates the derived local view without copied values", () => {
  const db = validateAtlasData(worldAtlas);
  try {
    db.prepare("UPDATE regions SET displayName=? WHERE regionId=?").run(
      "Renamed Crown",
      "ashen-crown",
    );
    const rows = db
      .prepare(
        "SELECT r.displayName FROM resolved_node_regions n JOIN regions r ON r.regionId=n.regionId WHERE n.nodeId=?",
      )
      .all("crownfall/forge");
    assert.equal(rows[0].displayName, "Renamed Crown");
  } finally {
    db.close();
  }
});
test("charter gates stay closed until their fixed local requirement is explored", () => {
  const j = generateJourney("GATE");
  for (const id of j.mainPath.slice(1, -1)) {
    travelJourney(j, id);
    completeJourneyNode(j);
  }
  assert.ok(!reachableJourneyNodes(j).includes(j.anchors.final));
  assert.throws(() => travelJourney(j, j.anchors.final), /not available/);
  j.localCompletedIds.push("crownfall/archive");
  assert.ok(reachableJourneyNodes(j).includes(j.anchors.final));
  travelJourney(j, j.anchors.final);
  assert.equal(j.currentNodeId, j.anchors.final);
});
test("the actual save manager reloads a journey from a new manager instance", () => {
  const storage = createMemoryStorage(),
    saves = createSaveManager(storage),
    run = createRunState({ seed: 123, classId: "reaver", registries: reg });
  run.journey = generateJourney("PERSIST");
  run.mapGraph = journeyGraph(run.journey);
  saves.ensureProfile();
  saves.saveRun(run, createRng(123), 1);
  const reopened = createSaveManager(storage).loadRun(reg, 1);
  assert.ok(reopened);
  assert.deepEqual(reopened.journey, run.journey);
});
console.log("World atlas: 14 test groups passed");
