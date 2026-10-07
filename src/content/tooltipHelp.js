// Authored tooltip policy, settings rows, and combat help copy.
//
// All of it lives in content/config/ui/presentation/tooltipHelp.json — the
// delays and text-length rungs, the settings rows, the combat hover targets,
// and the message templates, whose {tokens} are filled by the reader.
import { uiConfig } from '../config/generated/ui.js';
import { thaw } from '../config/authored.js';

export const tooltipHelp = thaw(uiConfig.presentation.tooltipHelp.behavior.help);
