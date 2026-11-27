// Where the repo is and the settings in ownerTools.json.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_URL = new URL('../..', import.meta.url);
const SETTINGS_URL = new URL('./ownerTools.json', import.meta.url);

export const REPO_ROOT = resolve(fileURLToPath(REPO_URL));
export const OWNER_TOOLS = JSON.parse(readFileSync(SETTINGS_URL, 'utf8'));

/** True when this module file is the script node was started with. */
export function IsMainModule(moduleUrl)
{
    const started = process.argv[1];
    if (!started)
    {
        return false;
    }
    return fileURLToPath(moduleUrl) === resolve(started);
}
