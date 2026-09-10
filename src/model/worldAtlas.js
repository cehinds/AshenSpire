import { worldAtlas } from "../content/generated/worldAtlas.js";

const index = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
const group = (rows, key) =>
  rows.reduce((o, r) => {
    (o[r[key]] ||= []).push(r);
    return o;
  }, Object.create(null));
function hash(text, initial = 2166136261) {
  let h = initial;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
export function atlasRevision(data) {
  const text = JSON.stringify(
    Object.keys(data)
      .sort()
      .map((table) => [
        table,
        data[table]
          .map((row) =>
            JSON.stringify(
              Object.keys(row)
                .sort()
                .map((k) => [k, row[k]]),
            ),
          )
          .sort(),
      ]),
  );
  return `atlas-1-${hash(text).toString(16)}-${hash(text, 2246822519).toString(16)}`;
}
export function createAtlasIndex(data = worldAtlas) {
  const nodes = index(data.nodes, "nodeId"),
    world = index(data.world_nodes, "nodeId"),
    localMaps = index(data.local_maps, "mapId");
  const localByOwner = index(data.local_maps, "ownerNodeId"),
    localPoints = group(data.local_map_nodes, "mapId");
  // The revision hashes every row of every table (a JSON pass plus two FNV
  // passes over the result). Nothing on the title screen reads it, so it is
  // computed on first use rather than on boot.
  let revision = null;
  return {
    data,
    get revision() {
      return (revision ??= atlasRevision(data));
    },
    nodes,
    world,
    maps: index(data.maps, "mapId"),
    assets: index(data.assets, "assetId"),
    regions: index(data.regions, "regionId"),
    profiles: index(data.run_profiles, "profileId"),
    localMaps,
    localByOwner,
    localPoints,
    placementsByMap: Object.fromEntries(
      Object.entries(group(data.world_map_nodes, "mapId")).map(
        ([mapId, rows]) => [mapId, index(rows, "nodeId")],
      ),
    ),
    edgeById: index(data.edges, "edgeId"),
    conditions: index(data.conditions, "conditionId"),
    services: index(data.services, "serviceId"),
    serviceTypes: index(data.service_types, "serviceTypeId"),
    nodeServices: group(data.node_services, "nodeId"),
    quests: index(data.quests, "questId"),
    nodeQuests: group(data.node_quests, "nodeId"),
    gates: group(data.local_gates, "nodeId"),
    regionOf(nodeId) {
      const own = world[nodeId];
      if (own) return own.regionId;
      const point = data.local_map_nodes.find((p) => p.nodeId === nodeId);
      return point ? world[localMaps[point.mapId].ownerNodeId].regionId : null;
    },
    servicesAt(owner) {
      return (localPoints[localByOwner[owner]?.mapId] || []).flatMap((p) =>
        data.node_services
          .filter((s) => s.nodeId === p.nodeId)
          .map(
            (s) =>
              data.services.find((v) => v.serviceId === s.serviceId)
                .serviceTypeId,
          ),
      );
    },
  };
}
export const ATLAS = createAtlasIndex();
function random(seed) {
  let x = hash(seed) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function weightedOrder(values, weight, rng) {
  return values
    .filter((v) => weight(v) > 0)
    .map((v) => ({ v, rank: -Math.log(Math.max(rng(), 1e-12)) / weight(v) }))
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.v);
}
const rowsFor = (data, name, profile) =>
  data[name].filter((r) => r.profileId === profile.profileId);

/** Bounded search over authored edges, independent of combat RNG. Never relaxes a profile. */
export function generateJourney(seed, profileId = "wanderer", atlas = ATLAS) {
  const p = atlas.profiles[profileId];
  if (!p) throw Error(`Unknown world profile ${profileId}`);
  const d = atlas.data,
    rng = random(
      `${seed}:${p.profileId}:${p.profileVersion}:${atlas.revision}`,
    );
  const excluded = new Set(
    rowsFor(d, "profile_node_exclusions", p).map((r) => r.nodeId),
  );
  const excludedRegions = new Set(
    rowsFor(d, "profile_region_exclusions", p).map((r) => r.regionId),
  );
  const weights = index(rowsFor(d, "profile_node_weights", p), "nodeId");
  const weight = (id) =>
    weights[id]?.weight ?? atlas.world[id]?.selectionWeight ?? 0;
  const eligible = new Set(
    d.world_map_nodes
      .filter(
        (n) =>
          n.mapId === p.mapId &&
          !excluded.has(n.nodeId) &&
          !excludedRegions.has(atlas.world[n.nodeId].regionId) &&
          weight(n.nodeId) > 0,
      )
      .map((n) => n.nodeId),
  );
  const edges = d.edges.filter(
    (e) =>
      e.mapId === p.mapId &&
      eligible.has(e.fromNodeId) &&
      eligible.has(e.toNodeId),
  );
  const outgoing = Object.create(null);
  for (const e of edges) {
    (outgoing[e.fromNodeId] ||= []).push(e.toNodeId);
    if (e.direction === "both")
      (outgoing[e.toNodeId] ||= []).push(e.fromNodeId);
  }
  const roles = rowsFor(d, "profile_anchors", p).sort(
    (a, b) => a.sequence - b.sequence,
  );
  const pins = index(rowsFor(d, "profile_anchor_pins", p), "roleId");
  const candidates = roles.map((role) => {
    const excludedForRole = new Set(
      rowsFor(d, "profile_anchor_exclusions", p)
        .filter((r) => r.roleId === role.roleId)
        .map((r) => r.nodeId),
    );
    const required = rowsFor(d, "profile_required_services", p)
      .filter((r) => r.roleId === role.roleId)
      .map((r) => r.serviceTypeId);
    const list = [...eligible].filter(
      (id) =>
        atlas.nodes[id].nodeTypeId === role.nodeTypeId &&
        !excludedForRole.has(id) &&
        (!pins[role.roleId] || pins[role.roleId].nodeId === id) &&
        required.every((s) => atlas.servicesAt(id).includes(s)),
    );
    if (!list.length)
      throw Error(
        `${profileId}: no eligible ${role.roleId} anchor; check pins, exclusions and required services`,
      );
    return list;
  });
  let last = "no connected anchor itinerary";
  for (let attempt = 0; attempt < p.maxAttempts; attempt++) {
    const chosen = candidates.map(
      (list) => weightedOrder(list, weight, rng)[0],
    );
    let operations = 0;
    function path(from, to, forbidden) {
      const visit = (id, trail) => {
        if (++operations > 10000) return null;
        if (id === to) return trail;
        if (trail.length >= p.mainMax) return null;
        for (const next of weightedOrder(outgoing[id] || [], weight, rng)) {
          if (trail.includes(next) || forbidden.has(next)) continue;
          if (
            next !== to &&
            ["start", "city", "dungeon"].includes(atlas.nodes[next].nodeTypeId)
          )
            continue;
          const found = visit(next, [...trail, next]);
          if (found) return found;
        }
        return null;
      };
      return visit(from, [from]);
    }
    const first = path(chosen[0], chosen[1], new Set(chosen.slice(2)));
    if (!first) continue;
    const second = path(chosen[1], chosen[2], new Set(first.slice(0, -1)));
    if (!second) continue;
    const main = [...first, ...second.slice(1)];
    if (main.length < p.mainMin || main.length > p.mainMax) {
      last = "main route length outside bounds";
      continue;
    }
    const selected = new Set(main);
    let branches = 0;
    // Add authored detours between two already-connected places. Every added
    // alternative has a way back toward the final boss by construction.
    while (selected.size < p.activeTarget) {
      const options = [...eligible].filter((id) => {
        if (
          selected.has(id) ||
          ["start", "city", "dungeon"].includes(atlas.nodes[id].nodeTypeId)
        )
          return false;
        const incoming = edges.filter(
            (e) => selected.has(e.fromNodeId) && e.toNodeId === id,
          ),
          exits = edges.filter(
            (e) => e.fromNodeId === id && selected.has(e.toNodeId),
          );
        if (!incoming.length || !exits.length) return false;
        const hub = main.indexOf(chosen[1]);
        const bypasses =
          incoming.some(
            (e) =>
              main.indexOf(e.fromNodeId) >= 0 &&
              main.indexOf(e.fromNodeId) < hub,
          ) && exits.some((e) => main.indexOf(e.toNodeId) > hub);
        return !bypasses;
      });
      if (!options.length) break;
      selected.add(weightedOrder(options, weight, rng)[0]);
      branches++;
    }
    if (
      selected.size !== p.activeTarget ||
      branches < p.branchesMin ||
      branches > p.branchesMax
    ) {
      last = "active node or alternative budget cannot be met";
      continue;
    }
    const activeEdges = edges.filter(
      (e) => selected.has(e.fromNodeId) && selected.has(e.toNodeId),
    );
    const manifest = {
      schemaVersion: 1,
      contentRevision: atlas.revision,
      profileId,
      profileVersion: p.profileVersion,
      seed: String(seed),
      mapId: p.mapId,
      activeNodeIds: [...selected],
      activeEdgeIds: activeEdges.map((e) => e.edgeId),
      mainPath: main,
      anchors: Object.fromEntries(roles.map((r, i) => [r.roleId, chosen[i]])),
      outcomes: {},
      currentNodeId: chosen[0],
      visitedNodeIds: [chosen[0]],
      completedNodeIds: [chosen[0]],
      discoveredNodeIds: [chosen[0]],
      localCompletedIds: [],
      questStates: {},
      serviceStates: {},
      view: { zoom: 1 },
    };
    const problems = manifestRouteProblems(manifest, atlas);
    if (problems.length) {
      last = problems.join("; ");
      continue;
    }
    const overrides = index(d.node_enemy_pool_overrides, "nodeId"),
      explicit = index(d.node_encounters, "nodeId");
    for (const id of manifest.activeNodeIds) {
      if (explicit[id])
        manifest.outcomes[id] = { encounterId: explicit[id].encounterId };
      else if (atlas.nodes[id].nodeTypeId === "fight") {
        const poolId =
          overrides[id]?.poolId ??
          atlas.regions[atlas.world[id].regionId].defaultPoolId;
        const pool = d.enemy_pool_members.filter((m) => m.poolId === poolId);
        if (!pool.length) throw Error(`${id}: empty enemy pool ${poolId}`);
        const member = weightedOrder(pool, (m) => m.weight, rng)[0];
        manifest.outcomes[id] = { enemyId: member.enemyId };
      }
    }
    revealJourney(manifest, atlas);
    return manifest;
  }
  throw Error(
    `${profileId}: no valid journey after ${p.maxAttempts} attempts (${last}); adjust anchors, paths or budgets`,
  );
}

export function manifestRouteProblems(j, atlas = ATLAS) {
  const problems = [],
    p = atlas.profiles[j.profileId];
  if (!p) return ["unknown profile"];
  const ids = new Set(j.activeNodeIds),
    edges = j.activeEdgeIds.map((id) => atlas.edgeById[id]);
  if (ids.size !== j.activeNodeIds.length || ids.size !== p.activeTarget)
    problems.push("active node count does not match profile");
  if (
    edges.some(
      (e) =>
        !e ||
        e.mapId !== p.mapId ||
        !ids.has(e.fromNodeId) ||
        !ids.has(e.toNodeId),
    )
  )
    return [...problems, "invalid active edge"];
  const roles = rowsFor(atlas.data, "profile_anchors", p).sort(
    (a, b) => a.sequence - b.sequence,
  );
  const pins = index(rowsFor(atlas.data, "profile_anchor_pins", p), "roleId");
  const excluded = rowsFor(atlas.data, "profile_node_exclusions", p).map(
      (r) => r.nodeId,
    ),
    excludedRegions = rowsFor(atlas.data, "profile_region_exclusions", p).map(
      (r) => r.regionId,
    );
  if (
    [...ids].some(
      (id) =>
        excluded.includes(id) ||
        excludedRegions.includes(atlas.world[id]?.regionId) ||
        !atlas.data.world_map_nodes.some(
          (n) => n.nodeId === id && n.mapId === p.mapId,
        ),
    )
  )
    problems.push("inactive or excluded content in manifest");
  let previous = -1;
  for (const role of roles) {
    const id = j.anchors[role.roleId],
      at = j.mainPath.indexOf(id);
    if (
      !ids.has(id) ||
      atlas.nodes[id]?.nodeTypeId !== role.nodeTypeId ||
      at <= previous ||
      (pins[role.roleId] && pins[role.roleId].nodeId !== id)
    )
      problems.push(`invalid ${role.roleId} anchor`);
    if (
      rowsFor(atlas.data, "profile_anchor_exclusions", p).some(
        (r) => r.roleId === role.roleId && r.nodeId === id,
      )
    )
      problems.push(`excluded ${role.roleId} anchor`);
    if (
      rowsFor(atlas.data, "profile_required_services", p).some(
        (r) =>
          r.roleId === role.roleId &&
          !atlas.servicesAt(id).includes(r.serviceTypeId),
      )
    )
      problems.push(`missing service at ${role.roleId}`);
    previous = at;
  }
  if (
    j.mainPath.length < p.mainMin ||
    j.mainPath.length > p.mainMax ||
    j.mainPath[0] !== j.anchors.start ||
    j.mainPath.at(-1) !== j.anchors.final ||
    new Set(j.mainPath).size !== j.mainPath.length
  )
    problems.push("invalid main route");
  for (let i = 1; i < j.mainPath.length; i++)
    if (
      !edges.some(
        (e) =>
          (e.fromNodeId === j.mainPath[i - 1] &&
            e.toNodeId === j.mainPath[i]) ||
          (e.direction === "both" &&
            e.toNodeId === j.mainPath[i - 1] &&
            e.fromNodeId === j.mainPath[i]),
      )
    )
      problems.push("main route uses an unauthored road");
  const reached = new Set([j.anchors.start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      const condition = e.conditionId && atlas.conditions[e.conditionId];
      const owner =
        condition &&
        atlas.data.local_map_nodes.find(
          (n) => n.nodeId === condition.requiredNodeId,
        );
      const requirement = owner
        ? atlas.localMaps[owner.mapId].ownerNodeId
        : condition?.requiredNodeId;
      if (requirement && !reached.has(requirement)) continue;
      if (reached.has(e.fromNodeId) && !reached.has(e.toNodeId)) {
        reached.add(e.toNodeId);
        changed = true;
      }
      if (
        e.direction === "both" &&
        reached.has(e.toNodeId) &&
        !reached.has(e.fromNodeId)
      ) {
        reached.add(e.fromNodeId);
        changed = true;
      }
    }
  }
  if ([...ids].some((id) => !reached.has(id)))
    problems.push("unreachable nodes or unsatisfied gates");
  const toFinal = new Set([j.anchors.final]);
  changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (toFinal.has(e.toNodeId) && !toFinal.has(e.fromNodeId)) {
        toFinal.add(e.fromNodeId);
        changed = true;
      }
      if (
        e.direction === "both" &&
        toFinal.has(e.fromNodeId) &&
        !toFinal.has(e.toNodeId)
      ) {
        toFinal.add(e.toNodeId);
        changed = true;
      }
    }
  }
  if ([...ids].some((id) => !toFinal.has(id)))
    problems.push("an alternative cannot reach the final dungeon");
  const withoutHub = new Set([j.anchors.start]);
  changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (e.toNodeId === j.anchors.hub || e.fromNodeId === j.anchors.hub)
        continue;
      if (withoutHub.has(e.fromNodeId) && !withoutHub.has(e.toNodeId)) {
        withoutHub.add(e.toNodeId);
        changed = true;
      }
      if (
        e.direction === "both" &&
        withoutHub.has(e.toNodeId) &&
        !withoutHub.has(e.fromNodeId)
      ) {
        withoutHub.add(e.fromNodeId);
        changed = true;
      }
    }
  }
  if (withoutHub.has(j.anchors.final))
    problems.push("a road bypasses the required major city");
  const counts = Object.create(null);
  for (const id of ids) {
    const r = atlas.world[id]?.regionId;
    counts[r] = (counts[r] || 0) + 1;
  }
  for (const q of rowsFor(atlas.data, "profile_region_quotas", p))
    if (
      (counts[q.regionId] || 0) < q.minNodes ||
      (counts[q.regionId] || 0) > q.maxNodes
    )
      problems.push(`region quota ${q.regionId}`);
  if (
    p.requireAllRegions &&
    atlas.data.regions.some((r) => !counts[r.regionId])
  )
    problems.push("not every required region is active");
  return problems;
}

export function journeyProblems(j, atlas = ATLAS) {
  if (!j || j.schemaVersion !== 1) return ["unknown World Journey save schema"];
  if (j.contentRevision !== atlas.revision)
    return [
      `World Journey uses content ${j.contentRevision}; this build provides ${atlas.revision}. Open the matching preview to resume; the route was not regenerated.`,
    ];
  const arrays = [
    "activeNodeIds",
    "activeEdgeIds",
    "mainPath",
    "visitedNodeIds",
    "completedNodeIds",
    "discoveredNodeIds",
    "localCompletedIds",
  ];
  if (
    arrays.some(
      (k) =>
        !Array.isArray(j[k]) ||
        j[k].some((id) => typeof id !== "string") ||
        new Set(j[k]).size !== j[k].length,
    ) ||
    !j.anchors ||
    !j.outcomes ||
    !j.questStates ||
    !j.serviceStates
  )
    return ["malformed World Journey manifest"];
  if (
    j.profileVersion !== atlas.profiles[j.profileId]?.profileVersion ||
    j.mapId !== atlas.profiles[j.profileId]?.mapId
  )
    return ["World Journey profile revision mismatch"];
  if (
    j.activeNodeIds.some((id) => !atlas.world[id]) ||
    !j.activeNodeIds.includes(j.currentNodeId)
  )
    return ["unknown World Journey node"];
  if (
    ["visitedNodeIds", "completedNodeIds", "discoveredNodeIds"].some((k) =>
      j[k].some((id) => !j.activeNodeIds.includes(id)),
    )
  )
    return ["progress references inactive nodes"];
  if (
    j.localCompletedIds.some(
      (id) => !atlas.data.local_map_nodes.some((n) => n.nodeId === id),
    )
  )
    return ["unknown completed local point"];
  for (const id of j.activeNodeIds) {
    const type = atlas.nodes[id].nodeTypeId,
      o = j.outcomes[id],
      explicit = atlas.data.node_encounters.find((n) => n.nodeId === id);
    if (
      ["fight", "dungeon"].includes(type) &&
      (!o || !(o.encounterId || o.enemyId))
    )
      return [`missing encounter outcome at ${id}`];
    if (explicit && o?.encounterId !== explicit.encounterId)
      return [`boss or explicit encounter changed at ${id}`];
    if (o?.encounterId && !explicit)
      return [`unauthored explicit encounter at ${id}`];
    if (o?.encounterId && o?.enemyId)
      return [`ambiguous encounter outcome at ${id}`];
    if (o?.enemyId) {
      const pool =
        atlas.data.node_enemy_pool_overrides.find((n) => n.nodeId === id)
          ?.poolId ?? atlas.regions[atlas.world[id].regionId].defaultPoolId;
      if (
        !atlas.data.enemy_pool_members.some(
          (m) => m.poolId === pool && m.enemyId === o.enemyId,
        )
      )
        return [`unknown enemy outcome at ${id}`];
    }
  }
  if (
    Object.entries(j.questStates).some(
      ([id, state]) =>
        !atlas.quests[id] || !["accepted", "claimed"].includes(state),
    )
  )
    return ["invalid quest state"];
  if (
    Object.entries(j.serviceStates).some(
      ([id, state]) =>
        !atlas.nodeServices[id] ||
        !state ||
        typeof state !== "object" ||
        (state.used !== undefined && typeof state.used !== "boolean"),
    )
  )
    return ["invalid service state"];
  if (
    j.activeService &&
    (!j.serviceStates[j.activeService.pointId] ||
      j.activeService.ownerId !== j.currentNodeId ||
      !["shop", "rest"].includes(j.activeService.handlerId))
  )
    return ["invalid active service"];
  if (Object.keys(j.outcomes).some((id) => !j.activeNodeIds.includes(id)))
    return ["encounter references inactive node"];
  if (j.activeService) {
    const point = atlas.data.local_map_nodes.find(
      (p) => p.nodeId === j.activeService.pointId,
    );
    if (
      !point ||
      atlas.localMaps[point.mapId].ownerNodeId !== j.currentNodeId ||
      !(atlas.nodeServices[point.nodeId] || []).some(
        (s) =>
          atlas.serviceTypes[atlas.services[s.serviceId].serviceTypeId]
            .handlerId === j.activeService.handlerId,
      )
    )
      return ["active service does not belong to current location"];
  }
  return manifestRouteProblems(j, atlas);
}
export function journeyEdges(j, atlas = ATLAS) {
  return j.activeEdgeIds.map((id) => atlas.edgeById[id]);
}
export function lockedJourneyRoads(j, atlas = ATLAS) {
  return journeyEdges(j, atlas)
    .filter((e) => e.fromNodeId === j.currentNodeId && !gateOpen(j, e, atlas))
    .map((e) => ({
      nodeId: e.toNodeId,
      requiredNodeId: atlas.conditions[e.conditionId].requiredNodeId,
    }));
}
function gateOpen(j, e, atlas) {
  const c = e.conditionId && atlas.conditions[e.conditionId];
  return (
    !c ||
    j.completedNodeIds.includes(c.requiredNodeId) ||
    j.localCompletedIds.includes(c.requiredNodeId)
  );
}
export function reachableJourneyNodes(j, atlas = ATLAS) {
  if (!j.completedNodeIds.includes(j.currentNodeId)) return [];
  const next = [];
  for (const e of journeyEdges(j, atlas)) {
    if (!gateOpen(j, e, atlas)) continue;
    if (e.fromNodeId === j.currentNodeId) next.push(e.toNodeId);
    if (
      e.toNodeId === j.currentNodeId &&
      (e.direction === "both" ||
        (atlas.profiles[j.profileId].allowBacktracking &&
          j.completedNodeIds.includes(e.fromNodeId)))
    )
      next.push(e.fromNodeId);
  }
  return [...new Set(next)];
}
export function revealJourney(j, atlas = ATLAS) {
  const known = new Set(j.discoveredNodeIds);
  known.add(j.currentNodeId);
  for (const e of journeyEdges(j, atlas))
    if (e.fromNodeId === j.currentNodeId) known.add(e.toNodeId);
  j.discoveredNodeIds = [...known];
  return j;
}
export function travelJourney(j, nodeId, atlas = ATLAS) {
  if (!reachableJourneyNodes(j, atlas).includes(nodeId))
    throw Error("That road is not available from your current location");
  j.currentNodeId = nodeId;
  if (!j.visitedNodeIds.includes(nodeId)) j.visitedNodeIds.push(nodeId);
  const type = atlas.nodes[nodeId].nodeTypeId;
  if (["start", "city", "landmark"].includes(type))
    completeJourneyNode(j, nodeId, atlas);
  revealJourney(j, atlas);
  return type;
}
export function completeJourneyNode(
  j,
  nodeId = j.currentNodeId,
  atlas = ATLAS,
) {
  if (!j.completedNodeIds.includes(nodeId)) j.completedNodeIds.push(nodeId);
  revealJourney(j, atlas);
}
export function journeyEncounter(j, nodeId, registries, atlas = ATLAS) {
  const outcome = j.outcomes[nodeId];
  if (!outcome) throw Error(`No encounter outcome at ${nodeId}`);
  if (outcome.encounterId)
    return registries.encounters.get(outcome.encounterId);
  registries.enemies.get(outcome.enemyId);
  return {
    id: `world:${nodeId}`,
    enemies: [outcome.enemyId],
    pool: "normal",
    act: atlas.world[nodeId].difficultyAct,
  };
}
export function journeyGraph(j, atlas = ATLAS) {
  const nodes = Object.create(null);
  for (const [i, id] of j.activeNodeIds.entries()) {
    const n = atlas.nodes[id];
    nodes[id] = {
      id,
      type: n.nodeTypeId === "dungeon" ? "boss" : n.nodeTypeId,
      floor: j.mainPath.includes(id) ? j.mainPath.indexOf(id) + 1 : i + 1,
      next: journeyEdges(j, atlas)
        .filter((e) => e.fromNodeId === id)
        .map((e) => e.toNodeId),
    };
  }
  return {
    nodes,
    startIds: [j.anchors.start],
    bossId: j.anchors.final,
    bossIds: [j.anchors.final],
    floors: j.mainPath.length,
    columns: 1,
  };
}
export function questAction(j, questId, atlas = ATLAS) {
  const q = atlas.quests[questId];
  if (!q || !j.activeNodeIds.includes(q.objectiveNodeId))
    return { allowed: false, label: "This road is not open in this journey" };
  const state = j.questStates[questId];
  if (state === "claimed") return { allowed: false, label: "Reward collected" };
  if (!state)
    return {
      allowed: true,
      label: "Accept quest",
      next: "accepted",
      reward: 0,
    };
  if (j.completedNodeIds.includes(q.objectiveNodeId))
    return {
      allowed: true,
      label: `Collect ${q.rewardCinders} cinders`,
      next: "claimed",
      reward: q.rewardCinders,
    };
  return { allowed: false, label: "Explore the marked road, then return" };
}
