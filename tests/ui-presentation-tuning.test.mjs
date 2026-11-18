import assert from 'node:assert/strict';
import test, { after } from 'node:test';
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

function createListenerTarget()
{
    const listeners = [];
    return {
        addEventListener: (type, handler) => listeners.push({ type, handler }),
        removeEventListener: (type, handler) =>
        {
            const at = listeners.findIndex((entry) => entry.type === type && entry.handler === handler);
            if (at >= 0) listeners.splice(at, 1);
        },
        fire(type, event)
        {
            for (const entry of listeners.filter((item) => item.type === type)) entry.handler(event);
        },
    };
}

const pageWindow = createListenerTarget();
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
globalThis.window = pageWindow;
after(() =>
{
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
});
const { ArmLongPress } = await import('../src/ui/pressable.js');

function extract(name, uiConfig, bindings)
{
    return runInNewContext(`${extractFunction(name)}\n${name}`, { ...bindings, uiConfig });
}

function inspectionHarness(uiConfig, { selected = null, modalShown = false } = {})
{
    const opened = [];
    const box = {
        ...createListenerTarget(),
        dataset: { eid: 'e1' }, isConnected: true,
        matches: () => false,
    };
    const wire = extract('wireCombatantContext', uiConfig, {
        ArmLongPress, configuredArt: true, combat: {}, selected, selectedFlask: null, selfArm: null,
        modalOpen: () => modalShown,
        selectedCombatantId: null, refreshCombatantContext() {}, selectCombatant() {},
        getEntity: () => ({ id: 'e1', kind: 'enemy' }),
        combatantSubject: (kind, entity) => ({ kind, id: entity.id }),
        openCombatantDoor: (subject) => opened.push(subject.id),
    });
    wire(box, 'Wandering Soldier');
    const pointer = { pointerId: 1, currentTarget: box };
    const press = (event) => box.fire('pointerdown', { ...pointer, button: 0, clientX: 0, clientY: 0, ...event });
    const move = (event) => pageWindow.fire('pointermove', { ...pointer, ...event });
    const release = () => pageWindow.fire('pointerup', pointer);
    return { box, opened, press, move, release };
}

test('combat inspection uses generated hold and pointer tolerance values', (t) =>
{
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const uiConfig = compileVariant({ holdMs: 450, movementTolerancePx: 12 });
    const held = inspectionHarness(uiConfig);
    held.press();
    t.mock.timers.tick(449);
    assert.deepEqual(held.opened, []);
    t.mock.timers.tick(1);
    assert.deepEqual(held.opened, ['e1']);
    held.release();

    const withinSlop = inspectionHarness(uiConfig);
    withinSlop.press();
    t.mock.timers.tick(100);
    withinSlop.move({ clientX: 12, clientY: 0 });
    t.mock.timers.tick(350);
    assert.deepEqual(withinSlop.opened, ['e1'], 'movement exactly at configured slop keeps the hold armed');
    withinSlop.release();

    const pastSlop = inspectionHarness(uiConfig);
    pastSlop.press();
    t.mock.timers.tick(100);
    pastSlop.move({ clientX: 12.01, clientY: 0 });
    t.mock.timers.tick(350);
    assert.deepEqual(pastSlop.opened, [], 'movement beyond configured slop cancels inspection');
    pastSlop.release();
});

// Playtest 2026-11-17: a phone's long-press raises the context menu (and its pointercancel) before the hold fires,
// so the menu itself reads the fighter, and a right-click does the same with a mouse.
test('a context menu on a combatant opens its reading unless a card is armed or a reading is open', () =>
{
    const uiConfig = compileVariant({ holdMs: 450, movementTolerancePx: 12 });
    const menu = () => { const event = { prevented: false, preventDefault() { this.prevented = true; } }; return event; };

    const idle = inspectionHarness(uiConfig);
    const idleEvent = menu();
    idle.box.fire('contextmenu', idleEvent);
    assert.deepEqual(idle.opened, ['e1']);
    assert.equal(idleEvent.prevented, true, 'the browser menu never shows over a fighter');

    const armed = inspectionHarness(uiConfig, { selected: 'card-1' });
    const armedEvent = menu();
    armed.box.fire('contextmenu', armedEvent);
    assert.deepEqual(armed.opened, [], 'an armed card keeps right-click as cancel targeting');
    assert.equal(armedEvent.prevented, false);

    const alreadyOpen = inspectionHarness(uiConfig, { modalShown: true });
    alreadyOpen.box.fire('contextmenu', menu());
    assert.deepEqual(alreadyOpen.opened, [], 'a reading already open is not opened twice');
});
