// Loads the Game content tab's JSON config and resolves section templates (`extends`).
const EDITOR_CONFIG_FILE = 'contentEditor.json';
const EXTENDS_KEY = 'extends';

async function fetchJson(fileName)
{
    const response = await fetch(new URL(`./${fileName}`, import.meta.url));
    return response.json();
}

function resolveTemplate(templates, name, seen)
{
    if (seen.includes(name) || !templates[name])
    {
        throw new Error(`Section template "${name}" is missing or extends itself.`);
    }
    const template = templates[name];
    const base = template[EXTENDS_KEY]
        ? resolveTemplate(templates, template[EXTENDS_KEY], [...seen, name])
        : {};
    return {
        ...base,
        ...template,
    };
}

/** Each section merged over the template it `extends`, own keys winning, without `extends`. */
export function ResolveSections(editorConfig)
{
    const templates = editorConfig.sectionTemplates || {};
    return editorConfig.sections.map((section) =>
    {
        const base = section[EXTENDS_KEY]
            ? resolveTemplate(templates, section[EXTENDS_KEY], [])
            : {};
        const merged = {
            ...base,
            ...section,
        };
        delete merged[EXTENDS_KEY];
        return merged;
    });
}

/** { sections, fieldSets, ui, api, folderUrl } from the config files beside this module. */
export async function LoadContentConfig()
{
    const editorConfig = await fetchJson(EDITOR_CONFIG_FILE);
    const [ui, api] = await Promise.all([
        fetchJson(editorConfig.configFiles.ui),
        fetchJson(editorConfig.configFiles.api),
    ]);
    return {
        sections: ResolveSections(editorConfig),
        fieldSets: editorConfig.fieldSets,
        ui,
        api,
        folderUrl: new URL('./', import.meta.url),
    };
}
