// The pause between steps and the auto-combat speed are player settings, persisted with the other
// profile rows, and presentation-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, resetKeys, commitNumberRow } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';
import {
    COMBAT_TIMING,
    actionPacing,
    floaterStaggerMs,
    setAnimSpeed,
    setCombatPacing,
} from '../src/ui/animationPace.js';
import {
    ACTION_PACING,
    AUTOMATION_DEFAULTS,
    combatPacingChanges,
} from '../src/model/autoCombatPolicy.js';
import { FLOATER_STACK } from '../src/ui/floaterStack.js';

const NEAR_TOLERANCE = 1e-9;
const DEFAULT_SPEED = AUTOMATION_DEFAULTS.combatSpeed;
const DEFAULT_PAUSE_MS = ACTION_PACING.stageGapMs;
const DEFAULT_STEP_MS = ACTION_PACING.animationStepDefaultMs;
const PLAYER_STAGGER_MS = FLOATER_STACK.floaterStaggerMs;
const MOBILE_FAST = AUTOMATION_DEFAULTS.mobileFastPreset;
const BASE_SPEED = 1;
const DOUBLE_SPEED = 2;
const FASTER_SPEED = 2.5;
const SAVED_PAUSE_MS = 1000;
const CUSTOM_STEP_MS = 400;
const OUT_OF_RANGE_HIGH = 99999;
const OUT_OF_RANGE_LOW = -5;
const OLD_ACTION_DELAYS = [
    0,
    5000,
];
const ENEMY_ATTACK_FACTOR = 2;
const SCALED_ENEMY_ATTACK_MS = ENEMY_ATTACK_FACTOR * ACTION_PACING.enemyAttackDefaultMs;
const ENEMY_INTERVAL_SETTING_MS = ACTION_PACING.enemyFloaterIntervalDefaultMs / 2;
const SAVED_STEP_MS = 1000;
const PACE_NORMAL = 'normal';
const PACE_INSTANT = 'instant';
const PRESET_MOBILE_FAST = 'mobile-fast';
const PRESET_CUSTOM = 'custom';
const RESET_REASON = 'Timing reset';
const COMBAT_CATEGORY = 'Combat';
const NUMBER_TYPE = 'number';
const PAUSE_KEY = 'combatStepPause';
const STEP_KEY = 'animationStepDuration';
const PRESET_KEY = 'combatPacingPreset';
const ROW_RANGES = {
    combatStepPause: {
        def: DEFAULT_PAUSE_MS,
        min: AUTOMATION_DEFAULTS.stageGapMinimumMs,
        max: AUTOMATION_DEFAULTS.stageGapMaximumMs,
    },
    autoCombatSpeed: {
        def: AUTOMATION_DEFAULTS.autoCombatSpeed,
        min: AUTOMATION_DEFAULTS.autoSpeedMinimum,
        max: AUTOMATION_DEFAULTS.autoSpeedMaximum,
    },
    animationStepDuration: {
        def: DEFAULT_STEP_MS,
        min: AUTOMATION_DEFAULTS.animationStepMinimumMs,
        max: AUTOMATION_DEFAULTS.animationStepMaximumMs,
    },
    enemyAttackMs: {
        def: ACTION_PACING.enemyAttackDefaultMs,
        min: AUTOMATION_DEFAULTS.enemyPacingMinimumMs,
        max: AUTOMATION_DEFAULTS.enemyPacingMaximumMs,
    },
    enemyFloaterIntervalMs: {
        def: ACTION_PACING.enemyFloaterIntervalDefaultMs,
        min: AUTOMATION_DEFAULTS.enemyPacingMinimumMs,
        max: AUTOMATION_DEFAULTS.enemyPacingMaximumMs,
    },
};
const ENEMY_PACING_KEYS = [
    'enemyAttackMs',
    'enemyFloaterIntervalMs',
];
const PERSISTED_PACING_KEYS = [
    PAUSE_KEY,
    'autoCombatSpeed',
    'combatSpeed',
    'autoCombat',
];
const STAGE_WAIT_KEYS = [
    'gapMs',
    'wordMs',
    'afterSpriteMs',
    'resultMs',
    'reactionMs',
    'damageMs',
    'resetMs',
];
const REDUCED_WAIT_KEYS = [
    'gapMs',
    'wordMs',
    'resultMs',
    'damageMs',
    'resetMs',
];
const MILLISECOND_KEY = /Ms$/;
const MOBILE_FAST_SETTINGS = {
    combatPacingPreset: PRESET_MOBILE_FAST,
    combatStepPause: MOBILE_FAST.combatStepPause,
    animationStepDuration: MOBILE_FAST.animationStepDuration,
};

function row(key)
{
    return settingsRows().find(settingRow => settingRow.key === key);
}

function assertNear(actual, expected, message = '')
{
    assert.ok(Math.abs(actual - expected) < NEAR_TOLERANCE, `${message} ${actual} vs ${expected}`);
}

function assertRowRange(key)
{
    const { def, min, max } = row(key);
    assert.deepEqual({ def, min, max }, ROW_RANGES[key], key);
}

function assertPersisted(keys)
{
    const persisted = profileKeys(settingsRows());
    for (const key of keys)
    {
        assert.ok(persisted.includes(key), key);
    }
}

function lungeMs(options)
{
    return actionPacing(options).spriteSpeed.lungeMs;
}

// Runs a body at the normal pace and always restores the shipped pacing afterwards.
function withPacing(body)
{
    setAnimSpeed(PACE_NORMAL);
    try
    {
        return body();
    }
    finally
    {
        setAnimSpeed(PACE_NORMAL);
        setCombatPacing();
    }
}

test('Pause between steps defaults to 0.5 s and ranges 0 to 2 s', () =>
{
    assertRowRange(PAUSE_KEY);
    assert.equal(row(PAUSE_KEY).type, NUMBER_TYPE);
    assert.match(row(PAUSE_KEY).label, /Pause between steps/);
});

test('Auto combat speed defaults to ×1.5 and ranges ×1 to ×3, beside the manual Combat speed', () =>
{
    assertRowRange('autoCombatSpeed');
    assert.equal(row('autoCombatSpeed').type, NUMBER_TYPE);
    assert.match(row('autoCombatSpeed').label, /Auto combat speed/);
    assert.equal(
        row('combatSpeed').def,
        DEFAULT_SPEED,
        'the manual multiplier default comes from actionPacing.json',
    );
});

test('both rows persist and export with the settings profile', () =>
{
    assertPersisted(PERSISTED_PACING_KEYS);
});

test('saved values reach the pacing, and a cleared value falls back to the defaults', () =>
    withPacing(() =>
    {
        setCombatPacing({
            combatStepPause: DEFAULT_PAUSE_MS,
            autoCombatSpeed: DOUBLE_SPEED,
            autoCombat: true,
        });
        assert.equal(actionPacing().gapMs, DEFAULT_PAUSE_MS / DOUBLE_SPEED, 'the pause at ×2');
        setCombatPacing({
            autoCombat: true,
            autoCombatSpeed: undefined,
            combatStepPause: undefined,
        });
        assertNear(actionPacing().gapMs, DEFAULT_PAUSE_MS / AUTOMATION_DEFAULTS.autoCombatSpeed);
        setCombatPacing({});
        assertNear(
            actionPacing().gapMs,
            DEFAULT_PAUSE_MS / DEFAULT_SPEED,
            'the default pause at the manual default speed',
        );
    }));

test('reduced motion and the Instant pace still drop every pause', () =>
    withPacing(() =>
    {
        setCombatPacing({ combatStepPause: AUTOMATION_DEFAULTS.stageGapMaximumMs });
        const reduced = actionPacing({ reduced: true });
        const reducedTotal = REDUCED_WAIT_KEYS.reduce((sum, key) => sum + reduced[key], 0);
        assert.equal(reducedTotal, 0);
        setAnimSpeed(PACE_INSTANT);
        assert.equal(actionPacing().gapMs, 0);
    }));

test('the shorter default preserves an explicitly saved pause and authored sprite duration', () =>
    withPacing(() =>
    {
        setCombatPacing({ combatSpeed: BASE_SPEED });
        const defaultClip = lungeMs();
        setCombatPacing({ combatSpeed: BASE_SPEED, combatStepPause: SAVED_PAUSE_MS });
        assert.equal(actionPacing().gapMs, SAVED_PAUSE_MS);
        assert.equal(lungeMs(), defaultClip);
        assert.equal(defaultClip, DEFAULT_STEP_MS);
    }));

test('a saved pre-D11 combatActionDelay (old Action delay) does not carry into the new pause', () =>
    withPacing(() =>
    {
        for (const combatActionDelay of OLD_ACTION_DELAYS)
        {
            setCombatPacing({ combatActionDelay });
            assertNear(actionPacing().gapMs, DEFAULT_PAUSE_MS / DEFAULT_SPEED);
        }
    }));

test('animation duration and combat interval independently control their timeline paths', () =>
    withPacing(() =>
    {
        const quickStep = MOBILE_FAST.animationStepDuration;
        const atStep = animationStepDuration => ({
            combatSpeed: BASE_SPEED,
            animationStepDuration,
        });
        setCombatPacing({ combatSpeed: BASE_SPEED });
        const baseline = actionPacing();
        setCombatPacing(atStep(quickStep));
        const quickSprite = actionPacing();
        assert.equal(quickSprite.spriteSpeed.lungeMs, quickStep);
        for (const key of [...STAGE_WAIT_KEYS, 'stepMs'])
        {
            assert.equal(quickSprite[key], baseline[key], key);
        }
        setCombatPacing({ ...atStep(quickStep), combatStepPause: SAVED_PAUSE_MS });
        assert.equal(actionPacing().gapMs, SAVED_PAUSE_MS);
        assert.deepEqual(actionPacing().spriteSpeed, quickSprite.spriteSpeed);
        setCombatPacing(atStep(Infinity));
        assert.equal(lungeMs(), DEFAULT_STEP_MS);
        // The shortest step is lifted to the frame-hold floor, so a lunge is never under one frame.
        setCombatPacing(atStep(OUT_OF_RANGE_LOW));
        assertNear(lungeMs(), COMBAT_TIMING.frameHoldMinMs);
        setCombatPacing(atStep(OUT_OF_RANGE_HIGH));
        assert.equal(lungeMs(), AUTOMATION_DEFAULTS.animationStepMaximumMs);
    }));

test('mobile fast preset writes visible persisted controls, manual edits return to custom', () =>
{
    const saved = {
        combatStepPause: AUTOMATION_DEFAULTS.stageGapMaximumMs,
        animationStepDuration: SAVED_STEP_MS,
        combatSpeed: DOUBLE_SPEED,
    };
    Object.assign(saved, combatPacingChanges(PRESET_KEY, PRESET_MOBILE_FAST));
    assert.equal(saved.combatStepPause, MOBILE_FAST.combatStepPause);
    assert.equal(saved.animationStepDuration, MOBILE_FAST.animationStepDuration);
    assert.equal(saved.combatSpeed, DOUBLE_SPEED);
    Object.assign(saved, combatPacingChanges(STEP_KEY, CUSTOM_STEP_MS));
    assert.equal(saved.combatPacingPreset, PRESET_CUSTOM);
    assert.equal(saved.combatStepPause, MOBILE_FAST.combatStepPause);
    assert.equal(saved.animationStepDuration, CUSTOM_STEP_MS);
    assertPersisted([
        STEP_KEY,
        PRESET_KEY,
    ]);
    assertRowRange(STEP_KEY);
});

test('zero pause is a valid committed value and preserves normal sprite duration', () =>
    withPacing(() =>
    {
        const committed = commitNumberRow({}, row(PAUSE_KEY), '0');
        assert.deepEqual(committed, { value: 0, refusal: null });
        setCombatPacing({ combatSpeed: BASE_SPEED, combatStepPause: committed.value });
        const timing = actionPacing();
        for (const key of STAGE_WAIT_KEYS)
        {
            assert.equal(timing[key], 0, key);
        }
        assert.equal(
            timing.spriteSpeed.lungeMs,
            DEFAULT_STEP_MS,
            'turning pauses off retains normal animation',
        );
    }));

test('resetting either timing row updates the saved preset in the same transaction', async () =>
{
    for (
        const [key, untouched] of [
            [PAUSE_KEY, STEP_KEY],
            [STEP_KEY, PAUSE_KEY],
        ]
    )
    {
        const settings = { ...MOBILE_FAST_SETTINGS };
        const writes = [];
        const recordWrite = changes =>
        {
            writes.push(changes);
            return { ok: true };
        };
        const snapshot = await resetKeys(settings, recordWrite, [key], RESET_REASON, {
            promoted: {},
        });
        assert.equal(settings.combatPacingPreset, PRESET_CUSTOM);
        assert.equal(writes[0].combatPacingPreset, PRESET_CUSTOM);
        assert.equal(
            snapshot.combatPacingPreset,
            PRESET_MOBILE_FAST,
            'undo retains the original preset',
        );
        assert.equal(settings[key], undefined);
        assert.equal(settings[untouched], MOBILE_FAST_SETTINGS[untouched]);
    }
});

test('a failed timing reset restores both the preset and control value', async () =>
{
    const settings = { ...MOBILE_FAST_SETTINGS };
    let calls = 0;
    const failFirstWrite = () => ({ ok: ++calls !== 1 });
    await resetKeys(settings, failFirstWrite, [PAUSE_KEY], RESET_REASON, { promoted: {} });
    assert.deepEqual(settings, MOBILE_FAST_SETTINGS);
});

test('enemy pacing is its own pair of settings, both 750 ms by default, and moves only enemy timing', () =>
    withPacing(() =>
    {
        const turn = ACTION_PACING.enemyTurn;
        const floaterShare = turn.floaterIntervalMs / ACTION_PACING.enemyFloaterIntervalDefaultMs;
        const clipShare = ACTION_PACING.spritePlaybackRate / turn.spritePlaybackRate;
        const enemyStagger = intervalMs => Math.round(intervalMs * floaterShare);
        setCombatPacing();
        assert.equal(floaterStaggerMs(), PLAYER_STAGGER_MS);
        assert.equal(
            floaterStaggerMs({ enemy: true }),
            enemyStagger(PLAYER_STAGGER_MS),
            "the enemies act on motion.enemyTurn: a shorter floater interval than the player's",
        );
        assert.equal(
            Math.round(lungeMs({ enemy: true })),
            Math.round(lungeMs() * clipShare),
            'the same animation step, played at the enemy clip rate',
        );
        setCombatPacing({
            enemyAttackMs: SCALED_ENEMY_ATTACK_MS,
            enemyFloaterIntervalMs: ENEMY_INTERVAL_SETTING_MS,
        });
        assert.equal(floaterStaggerMs({ enemy: true }), enemyStagger(ENEMY_INTERVAL_SETTING_MS));
        assert.equal(floaterStaggerMs(), PLAYER_STAGGER_MS, 'the player interval is untouched');
        assert.equal(
            Math.round(lungeMs({ enemy: true })),
            Math.round(ENEMY_ATTACK_FACTOR * lungeMs() * clipShare),
        );
        setCombatPacing({ enemyAttackMs: 1, enemyFloaterIntervalMs: OUT_OF_RANGE_HIGH });
        assert.equal(lungeMs({ enemy: true }) > 0, true);
        assert.equal(
            floaterStaggerMs({ enemy: true }),
            enemyStagger(AUTOMATION_DEFAULTS.enemyPacingMaximumMs),
            'the setting is bounded before the enemy turn pacing scales it',
        );
    }));

test("the enemies' turn runs on its own, shorter stage gaps; the player's plays keep the pinned stages", () =>
    withPacing(() =>
    {
        setCombatPacing();
        const turn = ACTION_PACING.enemyTurn;
        const player = actionPacing();
        const enemy = actionPacing({ enemy: true });
        assertNear(
            player.gapMs,
            ACTION_PACING.stageGapMs / DEFAULT_SPEED,
            'the player stage gap is the JSON gap at the default speed',
        );
        assertNear(
            enemy.gapMs,
            turn.stageGapMs / DEFAULT_SPEED,
            'the enemy stage gap is motion.enemyTurn.stageGapMs at the same speed',
        );
        const enemyIsQuicker = enemy.gapMs < player.gapMs && enemy.bannerMs < player.bannerMs;
        const onlyEnemyTelegraphs = enemy.telegraphMs > 0 && player.telegraphMs === 0;
        assert.ok(enemyIsQuicker && onlyEnemyTelegraphs);
        setCombatPacing({ combatStepPause: SAVED_PAUSE_MS });
        assert.equal(
            actionPacing({ enemy: true }).gapMs,
            (SAVED_PAUSE_MS / DEFAULT_PAUSE_MS) * enemy.gapMs,
            'the Pause between steps row still scales the enemy gap',
        );
        setCombatPacing({ combatSpeed: FASTER_SPEED });
        assert.ok(
            actionPacing({ enemy: true }).gapMs < enemy.gapMs,
            'a faster Combat speed is still faster for the enemies',
        );
        setCombatPacing();
        const reducedEnemy = actionPacing({ reduced: true, enemy: true });
        const remainingWaits = Object.keys(reducedEnemy).filter(key =>
            MILLISECOND_KEY.test(key) && reducedEnemy[key] !== 0
        );
        assert.deepEqual(remainingWaits, [], 'reduced motion removes every enemy wait too');
    }));

test('the enemy pacing rows are persisted Combat settings with 750 ms defaults', () =>
{
    assertPersisted(ENEMY_PACING_KEYS);
    for (const key of ENEMY_PACING_KEYS)
    {
        assertRowRange(key);
        assert.equal(row(key).cat, COMBAT_CATEGORY);
    }
});
