// Card upgrade tunables from content/source/balanceCardUpgrades.json.
import { balance } from '../content/balance.js';

// A configured bundle's copy wins over the authored one.
export function CardUpgradeRules(registries)
{
  return registries?.balance?.cardUpgrades ?? balance.cardUpgrades;
}
