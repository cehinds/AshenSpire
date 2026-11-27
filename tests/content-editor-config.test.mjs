// The Game content editor's JSON config is complete: every section, field type, field set, file,
// button and class it names exists, so a config edit that breaks the tab fails here first.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { LookUpPath } from '../src/model/valuePath.js';
import { ResolveSections } from '../tools/score-studio/contentEditor/contentConfig.js';
import { CreateFieldRenderers } from '../tools/score-studio/contentEditor/fieldRenderers.js';
import { IsEditableContentPath, OWNER_TOOLS, REPO_ROOT } from '../tools/owner/ownerSteps.mjs';
import { API_CONFIG, EDITOR_CONFIG, UI_CONFIG } from './helpers/content-editor-config.mjs';

const SECTIONS = ResolveSections(EDITOR_CONFIG);
const RENDERERS = CreateFieldRenderers(UI_CONFIG);
const FOLDER_SEPARATOR = '/';

function readRepoJson(path)
{
    return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
}

function sectionFieldSets(section)
{
    const named = [
        section.fieldSet,
        ...(section.entries || []).map((group) => group.fieldSet),
    ];
    return named.filter(Boolean);
}

function allFields(fields)
{
    return fields.flatMap((field) => [
        field,
        ...allFields(field.fields || []),
    ]);
}

function sectionFields(section)
{
    const sets = sectionFieldSets(section).map((name) => EDITOR_CONFIG.fieldSets[name] || []);
    return allFields([
        ...(section.fields || []),
        ...sets.flat(),
    ]);
}

test('every section has a unique id, a label, and one file or folder the owner may edit', () =>
{
    const ids = SECTIONS.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const section of SECTIONS)
    {
        assert.ok(section.label, section.id);
        assert.notEqual(Boolean(section.file), Boolean(section.folder), section.id);
        const path = section.file || section.folder;
        assert.ok(existsSync(join(REPO_ROOT, path)), `${section.id}: ${path} is missing`);
        if (section.file)
        {
            assert.ok(IsEditableContentPath(section.file), section.file);
            continue;
        }
        const folder = `${section.folder}${FOLDER_SEPARATOR}`;
        assert.ok(OWNER_TOOLS.editableRoots.some((root) => folder.startsWith(root)), folder);
    }
});

test('every entry group of a file section points at data that is in the file', () =>
{
    for (const section of SECTIONS.filter((candidate) => candidate.file))
    {
        const data = readRepoJson(section.file);
        for (const group of section.entries)
        {
            const path = group.each ?? group.path;
            assert.ok(LookUpPath(data, path).found, `${section.id}: "${path}" in ${section.file}`);
        }
    }
});

test('every named field set exists and every field type has a renderer', () =>
{
    for (const section of SECTIONS)
    {
        for (const name of sectionFieldSets(section))
        {
            assert.ok(EDITOR_CONFIG.fieldSets[name], `${section.id}: field set ${name}`);
        }
        for (const field of sectionFields(section))
        {
            const types = [
                field.type,
                field.itemType,
                field.valueType,
            ].filter(Boolean);
            for (const type of types)
            {
                assert.ok(RENDERERS[type], `${section.id}: ${field.path} type ${type}`);
            }
            if (field.suggest?.file)
            {
                assert.ok(existsSync(join(REPO_ROOT, field.suggest.file)), field.suggest.file);
            }
        }
    }
});

test('the toolbar buttons, their classes and the check lock name only known things', () =>
{
    const actions = UI_CONFIG.buttons.map((button) => button.action);
    for (const button of UI_CONFIG.buttons)
    {
        assert.ok(UI_CONFIG.classes[button.className], button.className);
        assert.ok(button.text, button.action);
    }
    for (const action of [...UI_CONFIG.disabledDuringCheck, ...UI_CONFIG.disabledDuringSave])
    {
        assert.ok(actions.includes(action), action);
    }
    assert.ok(RENDERERS[UI_CONFIG.jsonField.type]);
});

test('every API route sits under the API prefix', () =>
{
    for (const route of Object.values(API_CONFIG.routes))
    {
        assert.ok(route.startsWith(API_CONFIG.prefix), route);
    }
});
