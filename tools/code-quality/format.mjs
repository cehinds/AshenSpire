import { readFileSync } from 'node:fs';
import { createContext } from '@dprint/formatter';
import { getPath } from '@dprint/typescript';

const MAX_FORMAT_PASSES = 4;
const pluginBytes = readFileSync(getPath());

export function CreateSourceFormatter(config)
{
    if (!config || typeof config !== 'object' || Array.isArray(config))
    {
        throw new Error('formatting.json must be an object of dprint options');
    }
    const formatter = createContext();
    const plugin = formatter.addPlugin(pluginBytes, config);
    const errors = plugin.getConfigDiagnostics();
    if (errors.length)
    {
        throw new Error(
            errors.map(error => `formatting.json.${error.propertyName}: ${error.message}`).join(
                '\n',
            ),
        );
    }
    return (filePath, fileText) =>
    {
        // A nested list can wrap after its containing expression is split.
        for (let pass = 0; pass < MAX_FORMAT_PASSES; pass++)
        {
            const formatted = formatter.formatText({ filePath, fileText });
            if (formatted === fileText)
            {
                return formatted;
            }
            fileText = formatted;
        }
        throw new Error(`Formatting did not stabilize for ${filePath}`);
    };
}

export const FormatSource = CreateSourceFormatter(
    JSON.parse(readFileSync(new URL('formatting.json', import.meta.url), 'utf8')),
);
