// The Game content editor's JSON config, read once for tests that build expectations from it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_URL = new URL('../../tools/score-studio/contentEditor/', import.meta.url);
const CONFIG_FOLDER = fileURLToPath(CONFIG_URL);
const TEXT_ENCODING = 'utf8';

function readConfig(fileName)
{
    return JSON.parse(readFileSync(join(CONFIG_FOLDER, fileName), TEXT_ENCODING));
}

export const EDITOR_CONFIG = readConfig('contentEditor.json');
export const UI_CONFIG = readConfig(EDITOR_CONFIG.configFiles.ui);
export const API_CONFIG = readConfig(EDITOR_CONFIG.configFiles.api);
