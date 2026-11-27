// routes.floorTypes pins every node on a depth to one room type, in every act. This module reads
// the table and checks each entry; room types come from the route's visibleTypes and hiddenTypes,
// the types the builder places itself from routeShape.placedTypes.
export const ELITE_ROOM = 'elite';
export const SHOP_ROOM = 'shop';
const WHOLE_NUMBER = /^[0-9]+$/;

export function IsPlainObject(value)
{
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// The route's room types, and those a depth can be pinned to.
export function RouteRoomTypes(routeContent, shape)
{
  const hiddenTypes = routeContent.hiddenTypes || [];
  const visibleTypes = routeContent.visibleTypes || [];
  const all = [...new Set([...hiddenTypes, ...visibleTypes])];
  const pinnable = all.filter(type => !shape.placedTypes.includes(type));
  return { all, pinnable };
}

// The pinned depths as a Map of depth number to room type; empty when floorTypes is absent.
export function PinnedFloorTypes(floorTypes)
{
  if (!IsPlainObject(floorTypes))
  {
    return new Map();
  }
  return new Map(Object.entries(floorTypes).map(([depthKey, type]) => [Number(depthKey), type]));
}

export function HasPinnedRoom(pinned, room, first, last)
{
  for (const [depth, type] of pinned)
  {
    if (type === room && depth >= first && depth <= last)
    {
      return true;
    }
  }
  return false;
}

function depthProblem(depthKey, lastDepth)
{
  const depth = Number(depthKey);
  if (WHOLE_NUMBER.test(depthKey) && depth >= 1 && depth <= lastDepth)
  {
    return null;
  }
  return `depth "${depthKey}" must be a whole number from 1 to ${lastDepth}`;
}

function typeProblem(depth, type, types)
{
  if (!types.all.includes(type))
  {
    return `depth ${depth}: "${type}" is not a room type this route uses`;
  }
  if (types.pinnable.includes(type))
  {
    return null;
  }
  return `depth ${depth} cannot be "${type}": the route places that room itself`;
}

function placeProblem(depth, type, routes, restDepths)
{
  if (restDepths.has(depth))
  {
    return `depth ${depth} is or can become a rest floor`;
  }
  if (type === ELITE_ROOM && depth < routes.minimumThreatFloor)
  {
    return `depth ${depth}: an elite needs depth ${routes.minimumThreatFloor} or later`;
  }
  const firstFloor = routes.firstFloor ?? null;
  if (depth === 1 && firstFloor !== null)
  {
    return 'depth 1 is already set by firstFloor';
  }
  return null;
}

// Every problem with one floorTypes entry, as plain sentences.
export function FloorEntryProblems(floorTypes, routes, types, restDepths)
{
  const problems = [];
  for (const [depthKey, type] of Object.entries(floorTypes))
  {
    const depth = Number(depthKey);
    const problem = depthProblem(depthKey, routes.prebossNodes)
      ?? typeProblem(depth, type, types)
      ?? placeProblem(depth, type, routes, restDepths);
    if (problem !== null)
    {
      problems.push(problem);
    }
  }
  return problems;
}
