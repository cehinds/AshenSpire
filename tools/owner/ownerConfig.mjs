// Loads the owner tools' JSON config: the pipeline, every printed word, and change wording.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_ENCODING = 'utf8';
const PLACEHOLDER = /\{(\w+)\}/g;
const REPO_URL = new URL('../..', import.meta.url);

function readJson(fileName)
{
    const url = new URL(`./${fileName}`, import.meta.url);
    return JSON.parse(readFileSync(url, TEXT_ENCODING));
}

export const REPO_ROOT = resolve(fileURLToPath(REPO_URL));
export const OWNER_TOOLS = readJson('ownerTools.json');
export const OWNER_TEXT = readJson('ownerText.json');
export const OWNER_DIFF = readJson('ownerDiff.json');

/** Fills each {name} in a template from `values`; unknown names stay as written. */
export function FormatText(template, values = {})
{
    return template.replace(PLACEHOLDER, (match, key) =>
    {
        if (!(key in values))
        {
            return match;
        }
        return String(values[key]);
    });
}

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
