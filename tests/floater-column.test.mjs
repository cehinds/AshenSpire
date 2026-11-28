// The floater column over one combatant (ui/fx.js floatNum and callout): sequenced spawns, one x,
// one font size, a rising list, a cap, Reduced motion and the combat-speed tie-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { floatNum, callout, clearCallouts, floaterLanesFit, setAnimSpeed } from '../src/ui/fx.js';
import {
    COMBAT_TIMING,
    floaterLifeMs,
    floaterStaggerMs,
    setCombatPacing,
} from '../src/ui/animationPace.js';
import { FLOATER_STACK } from '../src/ui/floaterStack.js';
import { AUTOMATION_DEFAULTS } from '../src/model/autoCombatPolicy.js';
import { flushMeasureJobs } from '../src/ui/frameMeasure.js';
import { withKitDom } from './helpers/dom.mjs';
import { setFloaterPolicyEnabled } from '../src/ui/models/FloaterPolicyModel.js';

// This file tests the floater mechanics for every kind; the allowlist is floater-policy.test.mjs.
setFloaterPolicyEnabled(false);

const GAP = FLOATER_STACK.floaterLineGapPx;
const STAGGER_MS = FLOATER_STACK.floaterStaggerMs;
const MAX_VISIBLE = FLOATER_STACK.floaterMaxVisible;
const EDGE_MARGIN_PX = FLOATER_STACK.floaterEdgeMarginPx;
const CALLOUT_PEAK = FLOATER_STACK.floaterCalloutPeak;
const DEFAULT_SPEED = AUTOMATION_DEFAULTS.combatSpeed;
const MAX_SPEED = AUTOMATION_DEFAULTS.speedMaximum;
const BASE_SPEED = 1;
const DOUBLE_SPEED = 2;
const PACE_NORMAL = 'normal';
const PACE_INSTANT = 'instant';
// Every fake element measures this box, so one line is NODE_HEIGHT_PX tall.
const NODE_WIDTH_PX = 40;
const NODE_HEIGHT_PX = 20;
const LINE_STEP_PX = NODE_HEIGHT_PX + GAP;
const LAYER_BOX = { left: 0, top: 0, width: 600, height: 700 };
const NARROW_LAYER_WIDTH_PX = 360;
const ANCHOR_TOP_PX = 200;
const ANCHOR_WIDTH_PX = 80;
const ANCHOR_HEIGHT_PX = 120;
const ANCHOR_LEFT_PX = 100;
const OTHER_ANCHOR_LEFT_PX = 300;
const HUD_HEIGHT_PX = 20;
// The slot-0 floater's bottom edge sits this far above the overhead HUD.
const HUD_CLEARANCE_PX = 4;
// With no room above the HUD the column starts this share of the way down the figure.
const FIGURE_START_SHARE = 0.25;
// floaterLanesFit's own defaults when no gap or edge reserve is passed.
const LANE_EDGE_RESERVE_PX = 40;
const LANE_GAP_SHARE = 0.35;
const LANE_STEP_PX = NODE_HEIGHT_PX * (1 + LANE_GAP_SHARE);
const EXPLICIT_LANE_GAP_PX = 6;
const EXPLICIT_LANE_EDGE_PX = 6;
const EARLY_FADE_WAIT_MS = 250;
const EXPIRY_SLACK_MS = 70;
const EMPTY_COLUMN_SLACK_MS = 100;
const LAYOUT_SETTLE_MS = 5;
const SIBLING_DELAY_MS = 100;
const WIDE_WORD_PX = 200;
const NEARLY_LAYER_WIDE_WORD_PX = 348;
const MOVED_FIGURE_TOP_PX = 400;
const PLAYER_EID = 'player';
const ENEMY_EID = 'e1';
const ENEMY_ROW_SELECTOR = '.enemy-row';
const PLAYER_SELECTOR_PART = 'data-eid="player"';
const CLASS_HEAL = 'heal';
const CLASS_BLOCK = 'blk';
const CLASS_DAMAGE = 'dmg';
const CLASS_EARLY_FADE = 'float-early';
const CLASS_REDUCED_MOTION = 'reduced-motion';
const LIFT_PROPERTY = '--float-lift';
const WORD_STAGGERED = 'staggered';
const WIDE_WORD_KIND = 'action:Poise absorbed 2';
const COMBAT_CSS_PATH = '../styles/combat.css';

// The floater life at the shipped default speed, read once before any test changes the pacing.
setCombatPacing({ combatSpeed: DEFAULT_SPEED });
const DEFAULT_LIFE_MS = floaterLifeMs();
setCombatPacing();

function staggerFor(life)
{
    return Math.max(1, Math.round(STAGGER_MS * life / DEFAULT_LIFE_MS));
}

function px(value)
{
    return `${value}px`;
}

function centreOf(left)
{
    return left + ANCHOR_WIDTH_PX / 2;
}

function staggerSteps(count, stagger = floaterStaggerMs())
{
    return Array.from({ length: count }, (unused, index) => index * stagger);
}

// The lift of each floater in a full column, oldest first.
function liftSteps(count)
{
    return Array.from({ length: count }, (unused, index) => (count - 1 - index) * LINE_STEP_PX);
}

function spawnTexts(spawns)
{
    return spawns.map(spawn => spawn.node.textContent);
}

function spawnTimes(spawns)
{
    return spawns.map(spawn => spawn.at);
}

function spawnNodes(spawns)
{
    return spawns.map(spawn => spawn.node);
}

function isFadingEarly(node)
{
    return node.className.includes(CLASS_EARLY_FADE);
}

function lift(node)
{
    return parseFloat(node.props[LIFT_PROPERTY] ?? '0');
}

function readCombatCss()
{
    return readFileSync(new URL(COMBAT_CSS_PATH, import.meta.url), 'utf8');
}

// Every created element measures one node box and records its custom properties in `props`.
function measuredElementFactory(document)
{
    const create = document.createElement.bind(document);
    return (name) =>
    {
        const node = Object.assign(create(name), {
            offsetWidth: NODE_WIDTH_PX,
            offsetHeight: NODE_HEIGHT_PX,
        });
        // A live combatant: its waiting floaters still spawn.
        Object.defineProperty(node, 'isConnected', { value: true });
        const props = node.props = {};
        const set = node.style.setProperty?.bind(node.style);
        const remove = node.style.removeProperty?.bind(node.style);
        node.style.setProperty = (key, value) =>
        {
            props[key] = value;
            return set?.(key, value);
        };
        node.style.removeProperty = (key) =>
        {
            delete props[key];
            return remove?.(key);
        };
        return node;
    };
}

// A layer and anchors with fixed boxes. `spawns` records each floater as it joins the layer.
function scene(document)
{
    document.createElement = measuredElementFactory(document);
    const layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.box = { ...LAYER_BOX };
    const makeAnchor = (left) =>
    {
        const anchorNode = document.createElement('div');
        anchorNode.box = {
            left,
            top: ANCHOR_TOP_PX,
            width: ANCHOR_WIDTH_PX,
            height: ANCHOR_HEIGHT_PX,
        };
        return anchorNode;
    };
    const spawns = [];
    const append = layer.appendChild.bind(layer);
    layer.appendChild = (node) =>
    {
        spawns.push({ node, at: Date.now() });
        return append(node);
    };
    return {
        layer,
        anchor: makeAnchor(ANCHOR_LEFT_PX),
        otherAnchor: makeAnchor(OTHER_ANCHOR_LEFT_PX),
        spawns,
        makeAnchor,
    };
}

// Gives the anchor an overhead HUD at `top`, the way a combatant's row holds one.
function attachHud(document, anchorNode, top, height = HUD_HEIGHT_PX)
{
    const hud = document.createElement('div');
    hud.box = {
        left: anchorNode.box.left,
        top,
        width: ANCHOR_WIDTH_PX,
        height,
    };
    anchorNode.closest = () => ({ querySelectorAll: () => [hud] });
    anchorNode.contains = () => false;
    return hud;
}

// A figure the screen rebuilds: a detached element whose row carries the player's data-eid.
function playerFigure(box)
{
    return {
        ...box,
        isConnected: true,
        closest: (selector) =>
            selector === ENEMY_ROW_SELECTOR
                ? null
                : { dataset: { eid: PLAYER_EID } },
    };
}

function setOwnerQuery(layer, querySelector)
{
    Object.defineProperty(layer, 'ownerDocument', { value: { querySelector } });
}

// The mocked clock jumps to the end of a tick before its timers run, so a long wait is taken in
// 1 ms steps; larger steps round each timer up and drift past the spawn times asserted.
function advance(testContext, ms)
{
    for (let left = ms; left > 0; left -= 1)
    {
        testContext.mock.timers.tick(1);
    }
}

function resetPacing()
{
    setAnimSpeed(PACE_NORMAL);
    setCombatPacing({ combatSpeed: BASE_SPEED });
}

function setup(testContext, body)
{
    testContext.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    setCombatPacing({ combatSpeed: BASE_SPEED });
    setAnimSpeed(PACE_NORMAL);
    try
    {
        withKitDom(({ document }) => body(scene(document), document));
    }
    finally
    {
        resetPacing();
    }
}

function floatAll(layer, anchorNode, labels, className)
{
    return labels.map(label => floatNum(layer, anchorNode, label, className));
}

function rebuiltPlayerBox(anchorNode)
{
    const { box } = anchorNode;
    return {
        getBoundingClientRect: () => ({
            ...box,
            right: box.left + box.width,
            bottom: box.top + box.height,
        }),
    };
}

// A callout given a fixed measured width, settled so its position is applied.
function settledWord(testContext, layer, anchorNode, eid, width)
{
    const word = callout(layer, anchorNode, eid, WIDE_WORD_KIND);
    Object.defineProperty(word, 'offsetWidth', { value: width });
    advance(testContext, LAYOUT_SETTLE_MS);
    flushMeasureJobs();
    return parseFloat(word.style.left) - width / 2;
}

test('floaters over one combatant spawn one stagger apart, in order, never two at once', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const stagger = floaterStaggerMs();
        assert.equal(
            stagger,
            staggerFor(floaterLifeMs()),
            'the stagger at Combat speed x1 scales from the shipped default',
        );
        const queued = [
            ['-11', CLASS_HEAL],
            ['+5', CLASS_BLOCK],
            ['+2', CLASS_HEAL],
            ['BURN', CLASS_HEAL],
        ];
        const nodes = queued.map(([text, className]) => floatNum(layer, anchor, text, className));
        assert.deepEqual(spawnTexts(spawns), ['-11'], 'only the first is in the layer yet');
        advance(testContext, stagger * (queued.length - 1));
        flushMeasureJobs();
        assert.deepEqual(spawnTexts(spawns), queued.map(([text]) => text));
        assert.deepEqual(spawnTimes(spawns), staggerSteps(queued.length, stagger));
        assert.deepEqual(spawnNodes(spawns), nodes, 'the returned element is the one that spawns');
    }));

test('floaters of two combatants spawn independently', (testContext) =>
    setup(testContext, ({ layer, anchor, otherAnchor, spawns }) =>
    {
        floatNum(layer, anchor, '-1', CLASS_HEAL);
        floatNum(layer, anchor, '-2', CLASS_HEAL);
        floatNum(layer, otherAnchor, '-3', CLASS_HEAL);
        assert.deepEqual(
            spawnTexts(spawns),
            ['-1', '-3'],
            'each combatant starts its own sequence',
        );
    }));

test('one column: the same x for every floater, earlier ones lifted a line plus the gap each, y strictly decreasing', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const queued = [
            ['-11', 'heal crit'],
            ['+5', 'blk small'],
            ['+2', CLASS_HEAL],
        ];
        for (const [text, className] of queued)
        {
            floatNum(layer, anchor, text, className);
        }
        advance(testContext, floaterStaggerMs() * (queued.length - 1));
        flushMeasureJobs();
        const nodes = spawnNodes(spawns);
        assert.equal(
            new Set(nodes.map(node => node.style.left)).size,
            1,
            'no side lanes and no jitter: one x',
        );
        assert.equal(nodes[0].style.left, px(centreOf(ANCHOR_LEFT_PX)), 'centred on the combatant');
        assert.deepEqual(nodes.map(node => node.dataset.floatSlot), ['2', '1', '0']);
        assert.deepEqual(nodes.map(lift), liftSteps(queued.length));
        const heights = nodes.map(node => parseFloat(node.style.top) - lift(node));
        assert.ok(
            heights.every((height, index) => index === 0 || !(height < heights[index - 1])),
            'newer floaters sit lower',
        );
        assert.ok(
            heights.every((height, index) => index === 0 || height > heights[index - 1]),
            'y strictly increases from the oldest (top) to the newest',
        );
    }));

test('the column only moves up: an expired floater leaves the newer ones where they are', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        floatNum(layer, anchor, '-1', CLASS_HEAL);
        floatNum(layer, anchor, '-2', CLASS_HEAL);
        advance(testContext, floaterStaggerMs());
        flushMeasureJobs();
        const [first, second] = spawnNodes(spawns);
        assert.equal(lift(first), LINE_STEP_PX);
        advance(testContext, floaterLifeMs() + EXPIRY_SLACK_MS);
        assert.ok(!layer.children.includes(first), 'the first has expired');
        assert.equal(lift(second), 0);
    }));

test('the cap: a damage number past the cap makes the oldest fade early, and every floater still spawns', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        // Damage numbers spawn at once (never wait behind the column), so a burst reaches the cap.
        const burst = Array.from({ length: MAX_VISIBLE + 1 }, (unused, index) => `-${index + 1}`);
        const nodes = floatAll(layer, anchor, burst, CLASS_DAMAGE);
        assert.equal(spawns.length, burst.length, 'all spawn, none dropped');
        assert.ok(isFadingEarly(nodes[0]), 'the oldest fades early when one past the cap spawns');
        assert.ok(!isFadingEarly(nodes[1]));
        assert.ok(
            layer.children.filter(node => !isFadingEarly(node)).length <= MAX_VISIBLE,
            'never more than the cap showing',
        );
        advance(testContext, EARLY_FADE_WAIT_MS);
        assert.ok(!layer.children.includes(nodes[0]), 'the early-fading one is gone');
        const next = floatNum(layer, anchor, `-${burst.length + 1}`, CLASS_DAMAGE);
        assert.equal(spawns.length, burst.length + 1);
        assert.ok(isFadingEarly(nodes[1]));
        assert.ok(next);
    }));

test('Reduced motion: still sequenced and stacked (the CSS makes it fade only, with no glide)', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }, document) =>
    {
        document.body.classList.add(CLASS_REDUCED_MOTION);
        const queued = [
            ['-1', CLASS_HEAL],
            ['+2', CLASS_BLOCK],
            ['+3', CLASS_HEAL],
        ];
        for (const [text, className] of queued)
        {
            floatNum(layer, anchor, text, className);
        }
        advance(testContext, floaterStaggerMs() * (queued.length - 1));
        flushMeasureJobs();
        assert.deepEqual(spawnTimes(spawns), staggerSteps(queued.length));
        assert.deepEqual(spawnNodes(spawns).map(lift), liftSteps(queued.length));
        const css = readCombatCss();
        assert.match(
            css,
            /\.reduced-motion \.float-num \{ animation: num-life-still/,
            'no rise: a plain fade',
        );
        assert.match(
            css,
            /\.reduced-motion \.float-num, \.reduced-motion \.fx-callout \{ transition: none; \}/,
            'no glide when the column shifts',
        );
    }));

test('stagger scales with the Combat speed the way the lifetime does, and shortens on Instant', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        assert.equal(floaterStaggerMs(), staggerFor(floaterLifeMs()));
        setCombatPacing({ combatSpeed: DEFAULT_SPEED });
        assert.equal(floaterStaggerMs(), STAGGER_MS, 'the configured stagger at the default speed');
        setCombatPacing({ combatSpeed: BASE_SPEED });
        setCombatPacing({ combatSpeed: DOUBLE_SPEED });
        const halfLife = Math.round(COMBAT_TIMING.floaterLifeMs / DOUBLE_SPEED);
        assert.equal(floaterLifeMs(), halfLife);
        assert.equal(floaterStaggerMs(), staggerFor(halfLife), 'half the life, half the stagger');
        setCombatPacing({ combatSpeed: MAX_SPEED });
        const minLife = COMBAT_TIMING.floaterMinLifeMs;
        assert.equal(floaterLifeMs(), minLife, 'the life floors at the configured minimum');
        assert.equal(floaterStaggerMs(), staggerFor(minLife), 'and the stagger floors with it');
        setCombatPacing({ combatSpeed: BASE_SPEED });
        setAnimSpeed(PACE_INSTANT);
        const instantLife = COMBAT_TIMING.floaterInstantMs;
        assert.equal(floaterLifeMs(), instantLife);
        assert.equal(floaterStaggerMs(), staggerFor(instantLife));
        setAnimSpeed(PACE_NORMAL);
        setCombatPacing({ combatSpeed: DOUBLE_SPEED });
        floatNum(layer, anchor, '-1', CLASS_HEAL);
        floatNum(layer, anchor, '-2', CLASS_HEAL);
        const halfStagger = staggerFor(halfLife);
        advance(testContext, halfStagger);
        assert.deepEqual(spawnTimes(spawns), [0, halfStagger]);
    }));

test('words and numbers share one column and one clock', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const word = callout(layer, anchor, ENEMY_EID, WORD_STAGGERED);
        const number = floatNum(layer, anchor, '-9', CLASS_HEAL);
        assert.equal(word.textContent, WORD_STAGGERED.toUpperCase());
        assert.equal(
            callout(layer, anchor, ENEMY_EID, WORD_STAGGERED),
            null,
            'the same word is not repeated while it waits or shows',
        );
        advance(testContext, floaterStaggerMs());
        flushMeasureJobs();
        assert.deepEqual(spawnNodes(spawns), [word, number]);
        assert.deepEqual(spawnTimes(spawns), staggerSteps(2));
        assert.equal(word.dataset.calloutFor, ENEMY_EID);
        assert.equal(
            lift(word),
            LINE_STEP_PX,
            'the word is a slot above the number that followed it',
        );
        assert.equal(number.style.left, word.style.left, 'same x');
    }));

test('words waiting together spawn by priority; a number keeps its place', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        callout(layer, anchor, ENEMY_EID, WORD_STAGGERED);
        // BLOCKED no longer draws (screen-reader only), so another mid-rank word stands in.
        callout(layer, anchor, ENEMY_EID, 'countered');
        floatNum(layer, anchor, '-4', CLASS_HEAL);
        callout(layer, anchor, ENEMY_EID, 'status:burn');
        callout(layer, anchor, ENEMY_EID, 'resisted');
        advance(testContext, floaterStaggerMs() * 4);
        // Waiting ranks: countered 3, burn 6, resisted 1; the number keeps its own place.
        const spawnedKinds = spawns.map(spawn =>
            spawn.node.dataset.calloutKind ?? spawn.node.textContent
        );
        assert.deepEqual(spawnedKinds, [
            WORD_STAGGERED,
            'status:burn',
            '-4',
            'countered',
            'resisted',
        ]);
    }));

test('a skip drops the waiting floaters and the visible words; visible numbers keep their life', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const word = callout(layer, anchor, ENEMY_EID, 'critical');
        const number = floatNum(layer, anchor, '-3', CLASS_HEAL);
        floatNum(layer, anchor, '-4', CLASS_HEAL);
        clearCallouts(layer);
        assert.ok(!layer.children.includes(word));
        advance(testContext, floaterStaggerMs() * 3);
        assert.deepEqual(spawnTexts(spawns), ['CRITICAL'], 'nothing waiting survives the skip');
        assert.ok(number && !layer.children.includes(number));
        const kept = floatNum(layer, anchor, '-5', CLASS_HEAL);
        clearCallouts(layer);
        assert.ok(layer.children.includes(kept), 'a visible number keeps its lifetime');
    }));

test('the slot-0 floater sits just above the overhead HUD, at the same x, with no side lane', (testContext) =>
    setup(testContext, ({ layer, anchor }, document) =>
    {
        const hudTop = 230;
        attachHud(document, anchor, hudTop);
        const centre = px(centreOf(ANCHOR_LEFT_PX));
        const first = floatNum(layer, anchor, '+5', CLASS_BLOCK);
        flushMeasureJobs();
        assert.equal(
            first.style.top,
            px(hudTop - HUD_CLEARANCE_PX - NODE_HEIGHT_PX),
            'bottom edge just above the HUD top',
        );
        assert.equal(first.style.left, centre);
        const second = floatNum(layer, anchor, '+6', CLASS_BLOCK);
        advance(testContext, floaterStaggerMs());
        flushMeasureJobs();
        assert.equal(second.style.left, centre, 'every floater keeps the same x');
    }));

test('with no room above the HUD the column starts on the figure and rises over the HUD', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }, document) =>
    {
        attachHud(document, anchor, 40);
        const nodes = floatAll(layer, anchor, ['+1', '+2', '+3'], CLASS_BLOCK);
        advance(testContext, floaterStaggerMs() * (nodes.length - 1));
        flushMeasureJobs();
        assert.equal(
            nodes[0].style.top,
            px(ANCHOR_TOP_PX + ANCHOR_HEIGHT_PX * FIGURE_START_SHARE),
            'a quarter of the way down the figure, the old damage spot',
        );
        assert.equal(spawns.length, nodes.length);
        assert.ok(
            nodes.every(node => !isFadingEarly(node)),
            'there is room for the whole cap above the figure',
        );
        assert.deepEqual(nodes.map(lift), liftSteps(nodes.length));
    }));

test('little room above the figure caps the column, never below two on the figure, and drops none', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }, document) =>
    {
        const crampedTop = 20;
        anchor.box = { ...anchor.box, top: crampedTop };
        attachHud(document, anchor, crampedTop, 10);
        const nodes = floatAll(layer, anchor, ['+1', '+2', '+3', '+4'], CLASS_BLOCK);
        advance(testContext, floaterStaggerMs() * (nodes.length - 1));
        assert.equal(spawns.length, nodes.length, 'every queued floater still spawns');
        assert.ok(isFadingEarly(nodes[0]) && isFadingEarly(nodes[1]), 'only two show at once');
        assert.ok(!isFadingEarly(nodes[2]) && !isFadingEarly(nodes[3]));
    }));

test('lane fit: one line, then a line plus the gap per extra floater, minus the 40 px edge reserve', () =>
{
    const reserved = LANE_EDGE_RESERVE_PX + NODE_HEIGHT_PX;
    const laneCases = [
        { room: reserved - 1, expected: 0 },
        { room: reserved, expected: 1 },
        { room: reserved + LANE_STEP_PX, expected: 2 },
        { room: reserved + 2 * LANE_STEP_PX, expected: 3 },
        {
            room: reserved + NODE_HEIGHT_PX + EXPLICIT_LANE_GAP_PX,
            gap: EXPLICIT_LANE_GAP_PX,
            expected: 2,
            label: 'an explicit gap replaces the 35% default',
        },
        {
            room: EXPLICIT_LANE_EDGE_PX + 2 * NODE_HEIGHT_PX + EXPLICIT_LANE_GAP_PX,
            gap: EXPLICIT_LANE_GAP_PX,
            edge: EXPLICIT_LANE_EDGE_PX,
            expected: 2,
            label: 'an explicit edge reserve replaces the 40 px default',
        },
    ];
    for (const { room, gap, edge, expected, label } of laneCases)
    {
        assert.equal(floaterLanesFit(room, NODE_HEIGHT_PX, gap, edge), expected, label);
    }
});

test('one font size for every floater: damage, heal, Block, words and crits differ by colour and weight only', () =>
{
    const css = readCombatCss().replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/(?:^|\n)([^{}\n@][^{}]*?)\{([^}]*)\}/g)].map(match => ({
        selector: match[1].trim(),
        body: match[2],
    }));
    const floaterRules = rules.filter(rule =>
        /(^|,)\s*\.(float-num|fx-callout)\b/.test(rule.selector)
    );
    const sized = floaterRules.filter(rule => /(^|[;\s])font-size\s*:/.test(rule.body));
    assert.deepEqual(
        sized.map(rule => rule.selector),
        ['.float-num', '.fx-callout'],
        'only the two base rules set a size',
    );
    for (const rule of sized)
    {
        assert.match(rule.body, /font-size: var\(--floater-font, 2\.8rem\)/);
    }
    assert.doesNotMatch(css, /\.float-num\.(crit|heavy|small|pct\d+|burst)\s*\{[^}]*font-size/);
    assert.doesNotMatch(css, /\.fx-callout\[data-callout-kind\^='action:'\]\s*\{[^}]*font-size/);
});

test('a measured line that differs from the fallback keeps one strictly ordered column (text 20 px, HUD top 70, figure top 200)', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }, document) =>
    {
        attachHud(document, anchor, 70);
        const nodes = floatAll(layer, anchor, ['+1', '+2', '+3'], CLASS_BLOCK);
        advance(testContext, floaterStaggerMs() * (nodes.length - 1));
        flushMeasureJobs();
        assert.equal(spawns.length, nodes.length);
        const bases = nodes.map(node => parseFloat(node.style.top));
        assert.equal(
            new Set(bases).size,
            1,
            `every floater shares one base (${
                bases.join(', ')
            }), so the column never splits in two`,
        );
        const heights = nodes.map((node, index) => bases[index] - lift(node));
        assert.ok(
            heights.every((height, index) => index === 0 || height > heights[index - 1]),
            `older floaters sit strictly above newer ones (${heights.join(', ')})`,
        );
    }));

test('a damage number spawns at once at the bottom of the column; sibling floaters stagger after it', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const stagger = floaterStaggerMs();
        const firstWord = floatNum(layer, anchor, '+1', CLASS_BLOCK);
        const secondWord = floatNum(layer, anchor, '+2', CLASS_BLOCK);
        advance(testContext, SIBLING_DELAY_MS);
        const damage = floatNum(layer, anchor, '-9', CLASS_DAMAGE);
        assert.deepEqual(
            spawns.map(spawn => [spawn.node, spawn.at]),
            [[firstWord, 0], [damage, SIBLING_DELAY_MS]],
            'the number does not wait behind +2',
        );
        advance(testContext, stagger - 1);
        assert.equal(spawns.length, 2, '+2 waits a full stagger after the number');
        advance(testContext, 1);
        flushMeasureJobs();
        assert.deepEqual(spawnNodes(spawns), [firstWord, damage, secondWord]);
        assert.equal(lift(damage), LINE_STEP_PX, 'the number took a slot and +2 is below it');
    }));

test("a floater's sound plays when it spawns, not when it queued", (testContext) =>
    setup(testContext, ({ layer, anchor }) =>
    {
        const played = [];
        const playOnSpawn = (label) => ({ onSpawn: () => played.push([label, Date.now()]) });
        floatNum(layer, anchor, '+1', CLASS_BLOCK, undefined, playOnSpawn('one'));
        floatNum(layer, anchor, '+2', CLASS_BLOCK, undefined, playOnSpawn('two'));
        assert.deepEqual(played, [['one', 0]], 'the second sound waits for its floater');
        advance(testContext, floaterStaggerMs());
        assert.deepEqual(played, [['one', 0], ['two', floaterStaggerMs()]]);
    }));

test('a rebuilt figure (new element, same data-eid) receives the floaters that were waiting', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const first = playerFigure({ box: anchor.box });
        const second = playerFigure({ box: anchor.box });
        setOwnerQuery(layer, (selector) =>
            selector.includes(PLAYER_SELECTOR_PART)
                ? second
                : null);
        floatNum(layer, first, '+1', CLASS_BLOCK);
        floatNum(layer, first, '+2', CLASS_BLOCK);
        // The player is rebuilt before the second floater's turn.
        first.isConnected = false;
        advance(testContext, floaterStaggerMs());
        flushMeasureJobs();
        assert.equal(
            spawns.length,
            2,
            'the waiting floater was retargeted to the rebuilt figure, not dropped',
        );
    }));

test('a queued callout word survives a figure rebuild and spawns at the new sprite', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const figureAt = (left) =>
            playerFigure({
                getBoundingClientRect: () => ({
                    ...anchor.box,
                    left,
                    right: left + anchor.box.width,
                    bottom: anchor.box.top + anchor.box.height,
                }),
            });
        const first = figureAt(ANCHOR_LEFT_PX);
        const second = figureAt(OTHER_ANCHOR_LEFT_PX);
        setOwnerQuery(layer, (selector) =>
            selector.includes(PLAYER_SELECTOR_PART)
                ? second
                : null);
        floatNum(layer, first, '+1', CLASS_BLOCK);
        const word = callout(layer, first, PLAYER_EID, WORD_STAGGERED);
        first.isConnected = false;
        advance(testContext, floaterStaggerMs());
        flushMeasureJobs();
        assert.deepEqual(spawnNodes(spawns).pop(), word, 'the word spawned');
        assert.equal(
            word.style.left,
            px(centreOf(OTHER_ANCHOR_LEFT_PX)),
            'centred on the rebuilt sprite, not the detached one',
        );
    }));

test('after a rebuild the new sprite shares the old column: one sequence, not two', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const first = playerFigure(rebuiltPlayerBox(anchor));
        const second = playerFigure(rebuiltPlayerBox(anchor));
        setOwnerQuery(layer, () => second);
        floatNum(layer, first, '+1', CLASS_BLOCK);
        floatNum(layer, first, '+2', CLASS_BLOCK);
        first.isConnected = false;
        // Queued over the rebuilt figure while +2 still waits.
        floatNum(layer, second, '+3', CLASS_BLOCK);
        assert.equal(
            spawns.length,
            1,
            'the new sprite does not start a second, unsequenced column',
        );
        advance(testContext, floaterStaggerMs() * 2);
        assert.deepEqual(spawnTimes(spawns), staggerSteps(3));
    }));

test('a queued word is dropped when its combatant is gone for good', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        const figure = {
            ...rebuiltPlayerBox(anchor),
            isConnected: true,
            closest: () => ({ dataset: { eid: ENEMY_EID } }),
        };
        setOwnerQuery(layer, () => null);
        floatNum(layer, figure, '+1', CLASS_BLOCK);
        callout(layer, figure, ENEMY_EID, WORD_STAGGERED);
        figure.isConnected = false;
        advance(testContext, floaterStaggerMs() * 3);
        assert.equal(spawns.length, 1, 'only the floater that had already spawned');
    }));

test('a figure that moved while the column was empty gets a fresh base for the next sequence', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        floatNum(layer, anchor, '+1', CLASS_BLOCK);
        advance(testContext, floaterLifeMs() + EMPTY_COLUMN_SLACK_MS);
        flushMeasureJobs();
        // Resize or layout moved the figure.
        anchor.box = { ...anchor.box, top: MOVED_FIGURE_TOP_PX };
        spawns.length = 0;
        const word = floatNum(layer, anchor, '+2', CLASS_BLOCK);
        // An immediate number spawns beside the first floater of the sequence.
        const damage = floatNum(layer, anchor, '-9', CLASS_DAMAGE);
        flushMeasureJobs();
        assert.equal(spawns.length, 2);
        for (const node of [word, damage])
        {
            assert.ok(
                parseFloat(node.style.top) > MOVED_FIGURE_TOP_PX - NODE_HEIGHT_PX,
                `base follows the moved figure (${node.style.top})`,
            );
        }
    }));

test('the column forgets its measured line when it empties', (testContext) =>
    setup(testContext, ({ layer, anchor, spawns }) =>
    {
        floatNum(layer, anchor, '+1', CLASS_BLOCK);
        advance(testContext, floaterLifeMs() + EMPTY_COLUMN_SLACK_MS);
        flushMeasureJobs();
        const again = floatNum(layer, anchor, '+2', CLASS_BLOCK);
        flushMeasureJobs();
        assert.equal(again.dataset.floatSlot, '0');
        assert.equal(spawns.length, 2);
    }));

test('a wide word over a figure at the right edge stays fully inside the layer, edge margin kept', (testContext) =>
    setup(testContext, ({ layer, makeAnchor, spawns }) =>
    {
        layer.box = { ...LAYER_BOX, width: NARROW_LAYER_WIDTH_PX };
        const rightLimit = NARROW_LAYER_WIDTH_PX - EDGE_MARGIN_PX;
        const halfWidth = WIDE_WORD_PX / 2;
        // Centred unclamped, the word would reach past the layer's right edge.
        const edgeAnchor = makeAnchor(NARROW_LAYER_WIDTH_PX - ANCHOR_WIDTH_PX);
        const left = settledWord(testContext, layer, edgeAnchor, 1, WIDE_WORD_PX);
        assert.ok(left >= EDGE_MARGIN_PX, `left edge ${left} >= ${EDGE_MARGIN_PX}`);
        assert.ok(
            left + WIDE_WORD_PX <= rightLimit,
            `right edge ${left + WIDE_WORD_PX} <= ${rightLimit}`,
        );
        // The rise pops to the callout peak about the centre, after the width was measured.
        const centre = left + halfWidth;
        assert.ok(
            centre + halfWidth * CALLOUT_PEAK <= rightLimit + 1e-6,
            'the right edge at the pop peak stays inside the margin',
        );
        assert.ok(
            centre - halfWidth * CALLOUT_PEAK >= EDGE_MARGIN_PX - 1e-6,
            'the left edge at the pop peak stays inside the margin',
        );
        // A figure past the left edge pins the word to the margin, not off the screen.
        const leftEdgeAnchor = makeAnchor(-ANCHOR_WIDTH_PX / 2);
        const pinnedLeft = settledWord(testContext, layer, leftEdgeAnchor, 2, WIDE_WORD_PX);
        assert.ok(pinnedLeft >= EDGE_MARGIN_PX, 'left edge keeps the margin');
        assert.equal(spawns.length >= 2, true);
    }));

test('a word nearly as wide as the layer is centred, not pinned so its far edge leaves the layer', (testContext) =>
    setup(testContext, ({ layer, anchor }) =>
    {
        layer.box = { ...LAYER_BOX, width: NARROW_LAYER_WIDTH_PX };
        const width = NEARLY_LAYER_WIDE_WORD_PX;
        const left = settledWord(testContext, layer, anchor, 1, width);
        assert.ok(
            left >= 0 && left + width <= NARROW_LAYER_WIDTH_PX,
            `box ${left}..${left + width} lies inside 0..${NARROW_LAYER_WIDTH_PX}`,
        );
    }));
