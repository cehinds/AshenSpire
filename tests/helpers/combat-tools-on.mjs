// Core with the Grid checkbox and Reaction switch back (formation.gridOption, reactions.playerToggle),
// for browser checks that need the overlay or the switch. The profile lives in the fixture.
import { readFileSync } from 'node:fs';

const FIXTURE = JSON.parse(readFileSync(
  new URL('../fixtures/combat-tool-options.json', import.meta.url),
  'utf8',
));

/** The `gameProfile` query value: Core with both combat tool options on. */
export const TOOLS_ON_PROFILE = encodeURIComponent(JSON.stringify(FIXTURE.toolsOnProfile));
