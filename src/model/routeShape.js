// The routes module's routeShape for a run. A profile pinned before routeShape existed keeps the
// branch shape it was built with, so retuning the defaults never moves an old save's maps.
import { gameModule } from './gameProfile.js';

const PRE_ROUTE_SHAPE = Object.freeze({
  placedTypes: Object.freeze([
    'rest',
    'boss',
  ]),
  firstBranchDepth: 2,
  earliestFullDepth: 3,
  fullDepthsBeforeBoss: 3,
  narrowDepthsBeforeBoss: 2,
  guaranteedShopDepths: Object.freeze({
    first: 4,
    last: 8,
  }),
});

export function RouteShapeOf(subject)
{
  const pinned = gameModule(subject, 'routes')?.routeShape;
  if (pinned)
  {
    return pinned;
  }
  return PRE_ROUTE_SHAPE;
}
