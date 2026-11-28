import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as policy from '../src/model/autoCombatPolicy.js';
import {
    ACTION_PACING,
    AUTOMATION_DEFAULTS,
    resolveCombatAutomation,
} from '../src/model/autoCombatPolicy.js';
import { settingsRows } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardChoicePlan } from '../src/engine/combat.js';
import { AutoCardChoice } from '../src/model/cardChoices.js';

const OFFENSE = 'offense';
const DEFENSE = 'defense';
const PLAYER_SEAT = 'player';
const KIND_ATTACK = 'attack';
const KIND_DEFEND = 'defend';
const KIND_EVADE = 'evade';
const KIND_SMASH = 'smash';
const OVER_MAXIMUM_SPEED = 999;
const STARTING_RESOURCE = 3;
const UNAFFORDABLE_COST = 4;
const REPEAT_CHOICES = 5;
const MATCHUPS = {
    attack: [KIND_EVADE],
    evade: [KIND_SMASH],
    smash: [KIND_DEFEND],
    defend: [KIND_ATTACK],
};
const RUN_SEED = 11;
const RUN_CLASS_ID = 'reaver';
const RUN_EXPANSION_VERSION = 2;
const RUN_ENEMY_ID = 'wanderingSoldier';
const AMPLE_RESOURCE = 9;
const COMBAT_SCREEN_PATH = '../src/ui/screens/combat.js';
const AUTOMATION_SETTING_KEYS = [
    'autoCombat',
    'combatSpeed',
    'combatStepPause',
];
const STALL_GUARDS = [
    'autoRejected',
    'autoEndTried',
    'pv.costIsX && combat.player.energy <= 0',
];
const MANUAL_PLAY_CALLS = [
    'playCard(',
    'commitEndTurn(',
    "type: 'playCard'",
    "type: 'endTurn'",
];
const AUTO_TEST_NAME = 'auto-combat plays cards and ends turns through the manual paths';
const NAMED_MODES_TEST_NAME = 'auto battle plays a card of named modes with its first mode '
    + 'and still leaves a stance choice to the player';

function card(id, kind, cost = 1, extra = {})
{
    return {
        id,
        kind,
        cost,
        manaCost: 0,
        staminaCost: 0,
        playable: true,
        ...extra,
    };
}

function pick(state, hand)
{
    const seatState = {
        energy: STARTING_RESOURCE,
        mana: STARTING_RESOURCE,
        stamina: STARTING_RESOURCE,
        matchups: MATCHUPS,
        ...state,
    };
    const chosen = policy.chooseCardPlay(seatState, PLAYER_SEAT, hand);
    return chosen?.id ?? null;
}

function pickOffense(hand, state = {})
{
    return pick({ preference: OFFENSE, ...state }, hand);
}

function settingRow(key)
{
    return settingsRows().find(row => row.key === key);
}

// The source between two named functions of the combat screen.
function combatScreenSection(fromFunction, toFunction)
{
    const screen = readFileSync(new URL(COMBAT_SCREEN_PATH, import.meta.url), 'utf8');
    return screen.slice(
        screen.indexOf(`function ${fromFunction}`),
        screen.indexOf(`function ${toFunction}`),
    );
}

function autoPlaySection()
{
    return combatScreenSection('autoPlayStep', 'scheduleAutoCombat');
}

function choiceTestCombat()
{
    const registries = createRegistries(contentBundle);
    const run = createRunState({
        registries,
        classId: RUN_CLASS_ID,
        seed: RUN_SEED,
        combatExpansionVersion: RUN_EXPANSION_VERSION,
    });
    return createRunCombat({
        registries,
        run,
        rng: createRng(RUN_SEED),
        enemyIds: [RUN_ENEMY_ID],
    });
}

test('policy defaults are off, the JSON speed, offense, 550 ms animation and a half-second delay', () =>
{
    const defaultSpeed = AUTOMATION_DEFAULTS.combatSpeed;
    assert.deepEqual(resolveCombatAutomation(), {
        enabled: AUTOMATION_DEFAULTS.autoCombat,
        speed: defaultSpeed,
        preference: AUTOMATION_DEFAULTS.combatPreference,
        autoSpeed: AUTOMATION_DEFAULTS.autoCombatSpeed,
        animationMs: ACTION_PACING.animationStepDefaultMs,
        enemyAttackMs: ACTION_PACING.enemyAttackDefaultMs,
        enemyFloaterIntervalMs: ACTION_PACING.enemyFloaterIntervalDefaultMs,
        delayMs: ACTION_PACING.stageGapMs,
    });
    assert.equal(resolveCombatAutomation({ combatSpeed: NaN }).speed, defaultSpeed);
    assert.equal(
        resolveCombatAutomation({ combatSpeed: OVER_MAXIMUM_SPEED }).speed,
        AUTOMATION_DEFAULTS.speedMaximum,
    );
});

test('chooseCardPlay prefers offense or defense by the combat preference', () =>
{
    const hand = [
        card('guard', KIND_DEFEND),
        card('slash', KIND_ATTACK),
        card('dodge', KIND_EVADE),
    ];
    assert.equal(pick({ preference: OFFENSE }, hand), 'slash');
    assert.equal(pick({ preference: DEFENSE }, hand), 'guard');
});

test('chooseCardPlay then counters the perceived incoming maneuver', () =>
{
    const hand = [
        card('slash', KIND_ATTACK),
        card(KIND_SMASH, KIND_SMASH),
    ];
    const incomingDefend = { maneuver: KIND_DEFEND };
    const seats = { player: { intent: { revealed: true, profile: incomingDefend } } };
    assert.equal(pickOffense(hand, { seats }), KIND_SMASH, 'smash beats defend');
    const hidden = { player: { intent: { hidden: true, profile: incomingDefend } } };
    assert.equal(
        pickOffense(hand, { seats: hidden }),
        'slash',
        'a hidden intent is unknown: hand order',
    );
});

test('chooseCardPlay takes the highest cost that fits, then hand order', () =>
{
    const mixedCosts = [
        card('cheap', KIND_ATTACK, 1),
        card('fits', KIND_ATTACK, STARTING_RESOURCE),
        card('tooDear', KIND_ATTACK, UNAFFORDABLE_COST),
    ];
    assert.equal(pickOffense(mixedCosts), 'fits');
    const equalCosts = [
        card('first', KIND_ATTACK, 2),
        card('second', KIND_ATTACK, 2),
    ];
    assert.equal(pickOffense(equalCosts), 'first');
});

test('chooseCardPlay returns null when nothing is playable or affordable', () =>
{
    const unplayableHands = [
        { hand: [] },
        { hand: [card('locked', KIND_ATTACK, 1, { playable: false })] },
        { hand: [card('basic', KIND_ATTACK, 1)], state: { energy: 0 } },
        {
            hand: [
                card('manaHeavy', KIND_ATTACK, 0, { manaCost: UNAFFORDABLE_COST }),
                card('staminaHeavy', KIND_ATTACK, 0, { staminaCost: UNAFFORDABLE_COST }),
            ],
        },
    ];
    for (const { hand, state } of unplayableHands)
    {
        assert.equal(pickOffense(hand, state), null);
    }
});

test('chooseCardPlay is deterministic and does not mutate its input', () =>
{
    const state = { preference: DEFENSE, energy: STARTING_RESOURCE, matchups: MATCHUPS };
    const hand = [
        card('guard', KIND_DEFEND, 2),
        card('dodge', KIND_EVADE, 2),
        card('slash', KIND_ATTACK, STARTING_RESOURCE),
    ];
    const before = JSON.stringify([state, hand]);
    const first = policy.chooseCardPlay(state, PLAYER_SEAT, hand);
    for (let attempt = 0; attempt < REPEAT_CHOICES; attempt++)
    {
        assert.equal(policy.chooseCardPlay(state, PLAYER_SEAT, hand), first);
    }
    assert.equal(JSON.stringify([state, hand]), before);
});

test(AUTO_TEST_NAME, () =>
{
    assert.equal(policy.chooseAutoCombatAction, undefined);
    const reaction = combatScreenSection('autoReactionChoice', 'autoPlayStep');
    assert.ok(reaction.includes('chooseReaction'));
    for (const call of MANUAL_PLAY_CALLS)
    {
        assert.ok(!reaction.includes(call), `reaction chooser: ${call}`);
    }
    const play = autoPlaySection();
    const usesManualPaths = play.includes('chooseCardPlay') && play.includes('playCard(')
        && play.includes('commitEndTurn(');
    assert.ok(usesManualPaths);
    assert.ok(
        !play.includes("type: 'playCard'") && !play.includes("type: 'endTurn'"),
        'no direct dispatch: the manual paths only',
    );
    assert.ok(play.includes('maxActionsPerTurn'));
    for (const guard of STALL_GUARDS)
    {
        assert.ok(play.includes(guard), `stall guard: ${guard}`);
    }
});

test('automation settings participate in durable profile export and reset rows', () =>
{
    const rows = settingsRows();
    const keys = profileKeys(rows);
    for (const key of AUTOMATION_SETTING_KEYS)
    {
        assert.ok(rows.some(row => row.key === key));
        assert.ok(keys.includes(key), key);
    }
});

test('the combat preference row is shown now that auto battle plays cards with it', () =>
{
    const row = settingRow('combatPreference');
    assert.ok(row && !row.retired);
    assert.equal(resolveCombatAutomation({ combatPreference: DEFENSE }).preference, DEFENSE);
});

test('the auto combat setting says it also plays cards and ends the turn', () =>
{
    const note = settingRow('autoCombat').note;
    assert.match(note, /reaction/i);
    assert.match(note, /plays your cards/i);
    assert.doesNotMatch(note, /never plays/i);
});

// Dodge Roll is the unarmed fallback offering Advance or Retreat; auto battle plays its first mode.
test(NAMED_MODES_TEST_NAME, () =>
{
    assert.deepEqual(AutoCardChoice(null), { playable: true, choice: null });
    assert.deepEqual(AutoCardChoice({ kind: 'stance', options: [{ id: 'a' }] }), {
        playable: false,
        choice: null,
    });
    const combat = choiceTestCombat();
    combat.piles.hand.push(
        { instanceId: 'dodge', cardId: 'dodgeRoll' },
        { instanceId: 'vow', cardId: 'warriorsVow' },
    );
    const dodge = AutoCardChoice(cardChoicePlan(combat, 'dodge'));
    assert.deepEqual(
        dodge,
        { playable: true, choice: 'advance' },
        'Dodge Roll is playable with its first mode, Advance',
    );
    combat.player.energy = AMPLE_RESOURCE;
    combat.player.stamina = AMPLE_RESOURCE;
    const outcome = dispatch(combat, {
        type: 'playCard',
        cardInstanceId: 'dodge',
        targetId: combat.player.id,
        choice: dodge.choice,
    });
    assert.ok(
        outcome.events.some(event => event.type === 'cardPlayed'),
        'the engine accepts the auto choice',
    );
    assert.equal(
        AutoCardChoice(cardChoicePlan(combat, 'vow')).playable,
        false,
        "Warrior's Vow asks for a stance, so auto battle leaves it",
    );
    const play = autoPlaySection();
    assert.ok(
        play.includes('AutoCardChoice(')
            && play.includes('playCard(picked.id, targetId, info.choice, info.rank)'),
        'the screen passes the auto choice to playCard',
    );
    assert.ok(
        !play.includes('!cardChoicePlan(combat, inst.instanceId)'),
        'a choice card is no longer skipped outright',
    );
});
