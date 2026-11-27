// An enemy row's hpOverride replaces its attribute and level HP on every Core path;
// the fight's HP multipliers still apply on top, and an enemy without one is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { ApplyEnemyHpOverrides, EnemyHpOverride } from '../src/model/enemyHpOverride.js';
import { projectEnemyKnowledge } from '../src/model/enemyKnowledgeView.js';
import {
    characterSettings,
    enemyFightLevel,
    enemyScalingHpFactor,
    gameDigest,
} from '../engine/kernel/gameConfig.js';

const MINION_ID = 'wanderingSoldier';
const ELITE_ID = 'wyrmAspirant';
const OVERRIDE_HP = 123;
const SEED = 5;
const CLASS_ID = 'reaver';
const HP_STREAM = 'enemyHP';
const PROBE_MAX = 1000000;
const DEEP_FLOOR = 7;
const ELITE_ACT = 2;
const CLIMB_HP_MULT = 2;
const STUDIED_POINTS = 6;
const KNOWLEDGE_TARGET = 30;
const BASE_HP_LABEL = 'Base HP';

const shippedProfile = Profile.resolveGameProfile('default');
const settings = characterSettings(shippedProfile.modules);

function profileWithOverrides(overrides)
{
    const profile = structuredClone(shippedProfile);
    for (const row of profile.content.enemies)
    {
        if (Object.hasOwn(overrides, row.id))
        {
            row.hpOverride = overrides[row.id];
        }
    }
    delete profile.hash;
    profile.hash = gameDigest(profile);
    return profile;
}

function registriesFor(profile)
{
    const content = Profile.applyGameProfileToContent(contentBundle, profile);
    return Profile.bindGameProfileRegistries(createRegistries(content), profile);
}

function fight(profile, enemyId, { act = 1, floor = 0, hpMult = 1 } = {})
{
    const registries = registriesFor(profile);
    const run = createRunState({ registries, classId: CLASS_ID, seed: SEED });
    run.actNumber = act;
    run.floor = floor;
    const rng = createRng(SEED);
    const combat = createRunCombat({ registries, run, rng, enemyIds: [enemyId], hpMult });
    const nextHpDraw = rng.int(HP_STREAM, 1, PROBE_MAX);
    return {
        enemy: combat.enemies[0],
        nextHpDraw,
        registries,
    };
}

function rowOf(enemyId)
{
    return shippedProfile.content.enemies.find(row => row.id === enemyId);
}

function scaled(hp, factor)
{
    return Math.max(1, Math.round(hp * factor));
}

function tierScale(enemyId)
{
    const tier = rowOf(enemyId).tier;
    return settings.hpScaleByTier?.[tier] ?? 1;
}

test('the test enemies sit on the rolled and the act-levelled HP paths', () =>
{
    assert.equal(rowOf(MINION_ID).tier, 'minion');
    assert.equal(rowOf(ELITE_ID).tier, 'elite');
    assert.equal(settings.effectiveLevelHp, true);
});

test('an override sets a normal enemy\'s HP and draws the HP roll the same', () =>
{
    const baseline = fight(shippedProfile, MINION_ID);
    const overridden = fight(profileWithOverrides({ [MINION_ID]: OVERRIDE_HP }), MINION_ID);
    const expected = scaled(OVERRIDE_HP, tierScale(MINION_ID));
    assert.equal(overridden.enemy.maxHp, expected);
    assert.equal(overridden.enemy.hp, expected);
    assert.notEqual(baseline.enemy.maxHp, expected);
    assert.equal(overridden.nextHpDraw, baseline.nextHpDraw);
    assert.deepEqual(overridden.registries.enemies.get(MINION_ID).hp, [OVERRIDE_HP, OVERRIDE_HP]);
});

test('an override sets an act-levelled elite\'s HP in place of its level row', () =>
{
    const options = { act: ELITE_ACT };
    const baseline = fight(shippedProfile, ELITE_ID, options);
    const overridden = fight(profileWithOverrides({ [ELITE_ID]: OVERRIDE_HP }), ELITE_ID, options);
    const expected = scaled(OVERRIDE_HP, tierScale(ELITE_ID));
    assert.equal(overridden.enemy.maxHp, expected);
    assert.notEqual(baseline.enemy.maxHp, expected);
    assert.equal(overridden.enemy.level, baseline.enemy.level);
});

test('Custom Climb hpMult, the floor step and the tier scale still apply on top', () =>
{
    const profile = profileWithOverrides({
        [MINION_ID]: OVERRIDE_HP,
        [ELITE_ID]: OVERRIDE_HP,
    });
    const deep = { floor: DEEP_FLOOR, hpMult: CLIMB_HP_MULT };
    const minion = fight(profile, MINION_ID, deep).enemy;
    const { step } = enemyFightLevel(rowOf(MINION_ID), settings, { act: 1, floor: DEEP_FLOOR });
    const stepFactor = enemyScalingHpFactor(rowOf(MINION_ID), settings, step);
    assert.ok(stepFactor > 1, 'the deep floor gives the minion a floor step');
    const climbed = scaled(OVERRIDE_HP, CLIMB_HP_MULT);
    assert.equal(minion.maxHp, scaled(scaled(climbed, stepFactor), tierScale(MINION_ID)));
    const elite = fight(profile, ELITE_ID, { act: ELITE_ACT, hpMult: CLIMB_HP_MULT }).enemy;
    assert.equal(elite.maxHp, scaled(climbed, tierScale(ELITE_ID)));
});

test('without an override every enemy keeps its HP', () =>
{
    const definitions = [{ id: MINION_ID, hp: [31, 36] }];
    assert.equal(ApplyEnemyHpOverrides(definitions, shippedProfile.content.enemies), definitions);
    assert.ok(shippedProfile.content.enemies.every(row => row.hpOverride === undefined));
    const baseline = fight(shippedProfile, ELITE_ID, { act: ELITE_ACT });
    const minionOnly = profileWithOverrides({ [MINION_ID]: OVERRIDE_HP });
    const unrelated = fight(minionOnly, ELITE_ID, { act: ELITE_ACT });
    assert.equal(unrelated.enemy.maxHp, baseline.enemy.maxHp);
    assert.equal(unrelated.nextHpDraw, baseline.nextHpDraw);
});

test('an unusable override is ignored at runtime', () =>
{
    const unusable = [
        0,
        -5,
        12.5,
        '40',
        null,
    ];
    for (const value of unusable)
    {
        assert.equal(EnemyHpOverride({ hpOverride: value }), null, JSON.stringify(value));
    }
    assert.equal(EnemyHpOverride({ hpOverride: 1 }), 1);
    assert.equal(EnemyHpOverride(undefined), null);
});

function studiedRecord()
{
    const receiptIds = Array.from({ length: STUDIED_POINTS }, (_, index) => `r${index}`);
    const receipts = receiptIds.map(id => [id, { bonus: false }]);
    return {
        target: KNOWLEDGE_TARGET,
        receipts: Object.fromEntries(receipts),
    };
}

test('the bestiary shows a pinned HP as one number', () =>
{
    const registries = registriesFor(profileWithOverrides({ [MINION_ID]: OVERRIDE_HP }));
    const view = projectEnemyKnowledge(registries.enemies.get(MINION_ID), studiedRecord());
    const baseHp = view.resources.find(row => row.label === BASE_HP_LABEL);
    assert.equal(baseHp.value, String(OVERRIDE_HP));
});
