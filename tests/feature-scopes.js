// Browser and Node share the authored feature state through generated UI config.
// Re-enable behavior.coopEnabled in content/config/ui/screens/title.json and
// regenerate content to restore the dedicated co-op test lanes automatically.
import { uiConfig } from '../src/config/generated/ui.js';

export const COOP_TESTS_ENABLED = uiConfig.screens.title.behavior.coopEnabled === true;
export const COOP_TEST_SKIP_REASON = 'Co-op is disabled by content/config/ui/screens/title.json (behavior.coopEnabled=false).';
