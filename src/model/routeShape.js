// The routes module's routeShape for a run; a profile pinned before it existed gets the default.
import { gameModule } from './gameProfile.js';
import { gameProfileCatalog } from '../content/generated/gameProfiles.js';

export function RouteShapeOf(subject)
{
  const pinned = gameModule(subject, 'routes')?.routeShape;
  if (pinned)
  {
    return pinned;
  }
  return gameProfileCatalog.modules.routes.defaults.routeShape;
}
