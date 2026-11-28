import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_POSES } from '../src/content/enemyArt.js';
import { act1Enemies } from '../src/content/enemies/act1.js';
import { act2Enemies } from '../src/content/enemies/act2.js';
import { act3Enemies } from '../src/content/enemies/act3.js';
import { enemyExpansion } from '../src/content/enemyExpansion.js';
import {
    enemyStanceSprites,
    enemyStanceAssets,
    ENEMY_STANCE_FAMILIES,
} from '../src/content/enemyStanceSprites.js';
import { readFileSync } from 'node:fs';
import { enemyStanceCategory } from '../src/model/enemyStancePose.js';
import { concealIntent } from '../src/model/combatIntentVisibility.js';
import { enemyExpansionSprite } from '../src/ui/enemyExpansionStage.js';
import { stageFor } from '../src/ui/services/PoseAnimator.js';
import { installMockRaf, tickFrames } from './helpers/mock-raf.mjs';
import { frameHoldMs } from '../src/ui/animationPace.js';
import { ApplyCombatBeat } from '../src/ui/models/CombatPlaybackModel.js';

const ATTACK_CLIP_FRAMES = 4;
const FRAME_TICK_MARGIN_MS = 20;
// Every authored enemy action clip runs this long; held stances must not change it.
const ACTION_CLIP_TOTAL_MS = 260;
const HURT_CLIP_MS = 200;
const ENEMY_POSE_COUNT = 65;
const ENTITY_ID = 'e1';
const PROBE_ENEMY_ID = 'probe';
const MISSING_ID = 'missing';
const MOVE_STARTED = 'enemyMoveStarted';
const HOUND_ID = 'stitchedHound';
const HOUND_STANCES = enemyStanceSprites[HOUND_ID];
const STANCE_PREPARING = 'preparing';
const STANCE_SMASH = 'smash';
const STANCE_DEFEND = 'defend';
const STANCE_ATTACK = 'attack';
const PHYSICAL_MANEUVERS = [
    STANCE_SMASH,
    STANCE_ATTACK,
    'counter',
    'sweep',
    STANCE_DEFEND,
];
const PREPARING_CAMPS = [
    'skill',
    'power',
    'spell',
];
const SPELL_MOVE_ID = 'spell';
const PRIVATE_DAMAGE = 99;
const STANCE_ASSET_ROOT = 'assets/enemy-poses/expansion';
const STANCE_POSE_PREFIX = 'stance-';
const ART_TIERS = [
    'high',
    'light',
];
const UNSAFE_STANCES = [
    '__proto__',
    'constructor',
    'toString',
    'assets/private.png',
];
const NON_PLANS = [
    undefined,
    false,
    1,
    STANCE_ATTACK,
    [],
];
const PERSISTENCE_TEST_NAME = 'planned stance persists through status changes and reactions, '
    + 'then follows the next plan; defeat wins';

// Exercise the extracted paced reducer directly, without mounting screen DOM.
function applyMoveBeat(event, display, combat, registries)
{
    return ApplyCombatBeat(display, [event], {
        combat,
        registries,
        reduceFollowRows()
        {},
    });
}

function moveStarted(fields)
{
    return {
        type: MOVE_STARTED,
        sourceId: ENTITY_ID,
        ...fields,
    };
}

function probeRegistries(moves)
{
    return { enemies: new Map([[PROBE_ENEMY_ID, { moves }]]) };
}

function probeMoves()
{
    const moves = Object.fromEntries(
        PHYSICAL_MANEUVERS.map(
            maneuver => [maneuver, {
                intent: STANCE_ATTACK,
                tags: ['camp:physical', `maneuver:${maneuver}`],
            }],
        ),
    );
    moves[SPELL_MOVE_ID] = { intent: STANCE_ATTACK, tags: ['camp:spell'] };
    return moves;
}

function assertStanceFrame(poseId, category, pose)
{
    assert.equal(
        enemyStanceAssets[poseId][category],
        `${STANCE_ASSET_ROOT}/${poseId}/${pose}.webp`,
    );
    const committedPoses = enemyExpansion[poseId].poses;
    if (!pose.startsWith(STANCE_POSE_PREFIX))
    {
        assert.ok(committedPoses.includes(pose), `${poseId}: ${pose}`);
        return;
    }
    assert.equal(pose, `${STANCE_POSE_PREFIX}${category}`);
    assert.ok(
        !committedPoses.includes(pose),
        'additive hold does not replace a committed frame',
    );
}

// A minimal DOM so the sprite stage can mount; restored after the test.
function installSpriteDom(testContext, motion)
{
    const documentBefore = globalThis.document;
    const imageBefore = globalThis.Image;
    class Element
    {
        constructor()
        {
            this.dataset = {};
            this.style = {};
        }
        append()
        {}
        addEventListener()
        {}
        setAttribute()
        {}
    }
    globalThis.document = {
        createElement: () => new Element(),
        body: { classList: { contains: () => motion.reduced } },
    };
    globalThis.Image = Element;
    testContext.after(() =>
    {
        globalThis.document = documentBefore;
        globalThis.Image = imageBefore;
    });
}

test('paced pooled follow-ups use the performed move, not the final live intent', () =>
{
    const moves = probeMoves();
    const enemy = { id: ENTITY_ID, enemyId: PROBE_ENEMY_ID, intent: { kind: 'block' } };
    const combat = { enemies: [enemy], eventLog: [] };
    const hiddenPreview = { hidden: true };
    const display = {
        ents: { [ENTITY_ID]: { presentationStance: STANCE_DEFEND, intentPreview: hiddenPreview } },
    };
    const registries = probeRegistries(moves);
    for (const moveId of Object.keys(moves))
    {
        const expected = moveId === SPELL_MOVE_ID
            ? STANCE_PREPARING
            : moveId;
        applyMoveBeat(
            moveStarted({ enemyId: PROBE_ENEMY_ID, moveId }),
            display,
            combat,
            registries,
        );
        const entity = display.ents[ENTITY_ID];
        assert.equal(entity.presentationStance, expected);
        assert.deepEqual(
            entity.intentPreview,
            { hidden: true },
            'body pose does not reveal private intent',
        );
    }
});

test('reaction and unknown move receipts preserve the current planned hold', () =>
{
    const enemy = { id: ENTITY_ID, enemyId: PROBE_ENEMY_ID };
    const combat = { enemies: [enemy], eventLog: [] };
    const display = { ents: { [ENTITY_ID]: { presentationStance: STANCE_SMASH } } };
    const registries = probeRegistries({ [STANCE_DEFEND]: { intent: 'block' } });
    const receipts = [
        { moveId: STANCE_DEFEND, reaction: true },
        { moveId: MISSING_ID },
        { sourceId: MISSING_ID, moveId: STANCE_DEFEND },
    ];
    for (const receipt of receipts)
    {
        applyMoveBeat(moveStarted(receipt), display, combat, registries);
        assert.equal(display.ents[ENTITY_ID].presentationStance, STANCE_SMASH);
    }
});

test('all 33 enemies have six valid held stance frames without altering action clips', () =>
{
    const canonical = [
        ...act1Enemies,
        ...act2Enemies,
        ...act3Enemies,
    ]
        .map(enemy => enemy.id)
        .sort();
    const stancedIds = Object.keys(enemyStanceSprites).sort();
    assert.deepEqual(
        stancedIds,
        canonical,
        'new canonical enemies cannot silently lack held stances',
    );
    assert.equal(ENEMY_POSES.length, ENEMY_POSE_COUNT);
    assert.deepEqual(stancedIds, [...ENEMY_POSES].sort());
    for (const poseId of ENEMY_POSES)
    {
        assert.deepEqual(Object.keys(enemyStanceSprites[poseId]), ENEMY_STANCE_FAMILIES);
        for (const [category, pose] of Object.entries(enemyStanceSprites[poseId]))
        {
            assertStanceFrame(poseId, category, pose);
        }
        for (const clip of Object.values(enemyExpansion[poseId].actions))
        {
            const clipTotalMs = clip.reduce((sum, frame) => sum + frame.duration, 0);
            assert.equal(clipTotalMs, ACTION_CLIP_TOTAL_MS);
        }
    }
});

test('every held stance asset is published in both pinned art tiers', () =>
{
    const manifest = JSON.parse(
        readFileSync(new URL('../art-manifest.json', import.meta.url), 'utf8'),
    );
    for (const [poseId, stances] of Object.entries(enemyStanceAssets))
    {
        for (const [category, assetId] of Object.entries(stances))
        {
            const published = manifest.assets[assetId];
            for (const tier of ART_TIERS)
            {
                assert.ok(published?.[tier], `${poseId} ${category}: published ${tier} asset`);
            }
        }
    }
});

test('hidden and visible plans select the same category while exact intent remains concealed', () =>
{
    const maneuverStances = [
        ...PHYSICAL_MANEUVERS.map(maneuver => [maneuver, maneuver]),
        ['ranged', STANCE_ATTACK],
    ];
    for (const [maneuver, expected] of maneuverStances)
    {
        const intent = {
            kind: STANCE_ATTACK,
            moveId: 'privateMove',
            damage: PRIVATE_DAMAGE,
            combatProfile: { camp: STANCE_ATTACK, maneuver },
        };
        const hidden = concealIntent(intent, intent.combatProfile);
        assert.equal(enemyStanceCategory(intent), expected);
        assert.equal(enemyStanceCategory(hidden), expected);
        assert.equal(hidden.moveId, null);
        assert.equal(hidden.damage, undefined);
        assert.equal(hidden.hidden, true);
    }
    for (const camp of PREPARING_CAMPS)
    {
        const buff = { kind: 'buff', combatProfile: { camp } };
        assert.equal(enemyStanceCategory(buff), STANCE_PREPARING);
    }
    assert.equal(
        enemyStanceCategory({ kind: STANCE_ATTACK, combatProfile: { camp: 'spell' } }),
        STANCE_PREPARING,
    );
    assert.equal(
        enemyStanceCategory({
            kind: 'block',
            combatProfile: { camp: 'skill', maneuver: STANCE_DEFEND },
        }),
        STANCE_DEFEND,
    );
    assert.equal(enemyStanceCategory({ statuses: { prepared: { stacks: 1 } } }), null);
    assert.equal(enemyStanceCategory({ kind: 'unknown', moveId: null }), null);
    for (const stance of UNSAFE_STANCES)
    {
        assert.equal(enemyStanceCategory({ stance }), null);
    }
});

test('new and cleared enemy intents safely retain idle until a plan exists', () =>
{
    const initialEnemy = { intent: null, hp: 10, maxHp: 10 };
    assert.equal(enemyStanceCategory(initialEnemy.intent), null);
    for (const value of NON_PLANS)
    {
        assert.equal(enemyStanceCategory(value), null);
    }
    assert.equal(
        enemyStanceCategory({ kind: 'unknown', combatProfile: null, profile: null }),
        null,
    );
    assert.equal(enemyStanceCategory({ kind: 'block', combatProfile: null }), STANCE_DEFEND);
});

test(PERSISTENCE_TEST_NAME, testContext =>
{
    const motion = { reduced: false };
    installSpriteDom(testContext, motion);
    testContext.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    installMockRaf(testContext);
    const entity = {
        hp: 2,
        maxHp: 10,
        block: 5,
        statuses: { prepared: { stacks: 1 }, weak: { stacks: 1 } },
        presentationStance: STANCE_SMASH,
    };
    const sprite = enemyExpansionSprite({ id: HOUND_ID }, entity);
    const stage = stageFor(sprite);
    assert.equal(sprite.dataset.pose, HOUND_STANCES.smash);
    assert.equal(sprite.dataset.stance, STANCE_SMASH);
    stage.play('hurt', HURT_CLIP_MS);
    stage.setState({ ...entity, presentationStance: STANCE_DEFEND });
    assert.equal(sprite.dataset.pose, 'hit', 'plan update does not interrupt a live reaction');
    testContext.mock.timers.tick(HURT_CLIP_MS);
    assert.equal(sprite.dataset.pose, HOUND_STANCES.defend);
    stage.play(STANCE_ATTACK, ACTION_CLIP_TOTAL_MS);
    // The attack clip's frames at the shipped default frame hold, plus one tick of slack.
    tickFrames(testContext, ATTACK_CLIP_FRAMES * frameHoldMs() + FRAME_TICK_MARGIN_MS);
    assert.equal(sprite.dataset.pose, HOUND_STANCES.defend);
    stage.setState({ ...entity, presentationStance: STANCE_PREPARING });
    assert.equal(sprite.dataset.pose, HOUND_STANCES.preparing);
    motion.reduced = true;
    stage.play(STANCE_ATTACK, ACTION_CLIP_TOTAL_MS);
    assert.equal(
        sprite.dataset.pose,
        HOUND_STANCES.preparing,
        'reduced motion keeps the chosen held stance',
    );
    stage.setState({ ...entity, hp: 0, presentationStance: STANCE_ATTACK });
    assert.equal(sprite.dataset.pose, 'defeated');
    assert.equal(sprite.dataset.stance, undefined);
    stage.dispose();
});
