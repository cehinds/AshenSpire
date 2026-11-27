// Entry point for routes.floorTypes checks: the map build and the resolver both call it, with the
// routes settings, the route content (its room types) and the routes module's routeShape.
import { RouteDepths } from './routeDepths.js';
import {
  IsPlainObject,
  RouteRoomTypes,
  PinnedFloorTypes,
  FloorEntryProblems,
} from './routeFloorPins.js';
import { RouteRequirements, RequirementProblems } from './routeGuarantees.js';

const TABLE_PROBLEM = 'floorTypes must map a depth to a room type, like { "4": "shop" }';
const SHAPE_PROBLEM = 'floorTypes needs the routes routeShape settings';

// Every problem with routes.floorTypes, as plain sentences. Absent, null or {} has none.
export function RouteFloorTypeProblems(routes, routeContent, shape)
{
  const floorTypes = routes.floorTypes ?? null;
  if (floorTypes === null)
  {
    return [];
  }
  if (!IsPlainObject(floorTypes))
  {
    return [TABLE_PROBLEM];
  }
  if (!IsPlainObject(shape))
  {
    return [SHAPE_PROBLEM];
  }
  const types = RouteRoomTypes(routeContent, shape);
  const depths = RouteDepths(routes, shape);
  const entryProblems = FloorEntryProblems(floorTypes, routes, types, depths.restDepths);
  if (entryProblems.length)
  {
    return entryProblems;
  }
  const requirements = RouteRequirements(routes, shape, types);
  return RequirementProblems(requirements, depths, PinnedFloorTypes(floorTypes));
}
