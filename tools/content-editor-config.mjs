// The /__content/ API settings, shared with the Score Studio Game content tab.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FillTemplate } from '../src/model/textTemplate.js';

const API_CONFIG_PATH = fileURLToPath(
    new URL('./score-studio/contentEditor/contentApi.json', import.meta.url),
);

/** Routes, the body size limit and plain messages, from contentApi.json. */
export const CONTENT_API = JSON.parse(readFileSync(API_CONFIG_PATH, 'utf8'));

/** A configured message with `{name}` tokens filled from `values`. */
export function ApiMessage(name, values = {})
{
    return FillTemplate(CONTENT_API.messages[name], values);
}
