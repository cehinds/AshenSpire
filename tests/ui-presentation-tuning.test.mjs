import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { compileEntries, readConfigTree } from '../tools/config-build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const combatText = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');

function extractFunction(name)
{
    const declaration = new RegExp(`\\bfunction ${name}\\s*\\(`).exec(combatText);
    assert.ok(declaration, `actual combat screen function ${name} exists`);
    const open = combatText.indexOf('{', declaration.index + declaration[0].length);
    assert.ok(open > declaration.index, `${name} has a function body`);
    let depth = 0;
    let quote = null;
    let lineComment = false;
    let blockComment = false;
    for (let i = open; i < combatText.length; i++)
    {
        const ch = combatText[i];
        const next = combatText[i + 1];
        if (lineComment)
        {
            if (ch === '\n') lineComment = false;
            continue;
        }
        if (blockComment)
        {
            if (ch === '*' && next === '/') { blockComment = false; i++; }
            continue;
        }
        if (quote)
        {
            if (ch === '\\') { i++; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
        if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
        if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return combatText.slice(declaration.index, i + 1);
    }
    assert.fail(`${name} has a balanced function body`);
}

function compileVariant({ holdMs, movementTolerancePx })
{
    const entries = readConfigTree(join(root, 'content'));
    for (const entry of entries)
    {
        if (entry.rel === 'ui/presentation/combatInspection.json') {
            const data = JSON.parse(entry.text);
            Object.assign(data.behavior, { holdMs, movementTolerancePx });
            entry.text = JSON.stringify(data, null, 2);
        }
    }
    const result = compileEntries(entries, { requireInteractionConfigs: true });
    assert.deepEqual(result.errors, []);
    return result.config;
}

function makeClock()
{
    let now = 0;
    let nextId = 0;
    const jobs = new Map();
    return {
        setTimeout(callback, delay)
        {
            jobs.set(++nextId, { callback, at: now + delay });
            return nextId;
        },
        clearTimeout(id) { jobs.delete(id); },
        advanceTo(target)
        {
            while (true)
            {
                const due = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
                if (!due || due[1].at > target) break;
                now = due[1].at;
                jobs.delete(due[0]);
                due[1].callback();
            }
            now = target;
        },
    };
}

function extract(name, uiConfig, bindings)
{
    return runInNewContext(`${extractFunction(name)}\n${name}`, { ...bindings, uiConfig });
}

function inspectionHarness(uiConfig)
{
    const clock = makeClock();
    const handlers = new Map();
    const opened = [];
    const box = {
        dataset: { eid: 'e1' }, isConnected: true,
        addEventListener: (name, handler) => handlers.set(name, handler),
        matches: () => false,
    };
    const wire = extract('wireCombatantContext', uiConfig, {
        ...clock, configuredArt: true, combat: {}, selected: null, selectedFlask: null,
        selectedCombatantId: null, refreshCombatantContext() {}, selectCombatant() {},
        getEntity: () => ({ id: 'e1', kind: 'enemy' }),
        combatantSubject: (kind, entity) => ({ kind, id: entity.id }),
        openCombatantDoor: (subject) => opened.push(subject.id),
    });
    wire(box, 'Wandering Soldier');
    const send = (type, event = {}) => handlers.get(type)(event);
    return { ...clock, box, opened, send };
}

test('combat inspection uses generated hold and pointer tolerance values', () =>
{
    const uiConfig = compileVariant({ holdMs: 450, movementTolerancePx: 12 });
    const held = inspectionHarness(uiConfig);
    held.send('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    held.advanceTo(449);
    assert.deepEqual(held.opened, []);
    held.advanceTo(450);
    assert.deepEqual(held.opened, ['e1']);

    const withinSlop = inspectionHarness(uiConfig);
    withinSlop.send('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    withinSlop.advanceTo(100);
    withinSlop.send('pointermove', { clientX: 12, clientY: 0 });
    withinSlop.advanceTo(450);
    assert.deepEqual(withinSlop.opened, ['e1'], 'movement exactly at configured slop keeps the hold armed');

    const pastSlop = inspectionHarness(uiConfig);
    pastSlop.send('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    pastSlop.advanceTo(100);
    pastSlop.send('pointermove', { clientX: 12.01, clientY: 0 });
    pastSlop.advanceTo(450);
    assert.deepEqual(pastSlop.opened, [], 'movement beyond configured slop cancels inspection');
});
