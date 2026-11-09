import test from 'node:test';
import assert from 'node:assert/strict';
import { PendingCombatTargetPlan, ResolveTargetHudAction } from '../src/ui/models/CombatTargetingModel.js';

const enemies = [{ id: 'e1', alive: false }, { id: 'e2', alive: true }, { id: 'e3', alive: true }];

function input(overrides = {})
{
    return {
        combat: { phase: 'player' },
        busy: false,
        inputBusy: () => false,
        enemyPlayback: false,
        hasCardChoice: () => false,
        veilIsOpen: () => false,
        selected: 'strike',
        selfArm: null,
        selectedFlask: null,
        readTargetPlan: () => ({ legalIds: ['e2'] }),
        ...overrides,
    };
}

test('a selected card uses its current target plan and a flask keeps live enemy order', () =>
{
    const cardPlan = { mode: 'enemy', legalIds: ['e3'] };
    const cardTargets = id =>
    {
        assert.equal(id, 'strike');
        return cardPlan;
    };
    assert.equal(PendingCombatTargetPlan('strike', 0, enemies, cardTargets), cardPlan);
    assert.deepEqual(PendingCombatTargetPlan(null, 0, enemies, () => assert.fail('no card lookup')),
        { mode: 'enemy', legalIds: ['e2', 'e3'] });
});

test('a blocked target does not quote a card and an unarmed click is ignored', () =>
{
    const cases = [
        [{ busy: true, inputBusy: () => true }, 'busy'],
        [{ enemyPlayback: true }, 'enemy playback'],
        [{ combat: { phase: 'ended', result: 'victory' } }, 'combat over'],
        [{ combat: { phase: 'enemy' } }, 'phase enemy'],
        [{ combat: { phase: 'player', pendingReaction: {} } }, 'pending reaction'],
        [{ hasCardChoice: () => true }, 'pending card choice'],
        [{ veilIsOpen: () => true }, 'veil open'],
        [{ selected: null }, null],
    ];
    for (const [overrides, reason] of cases)
    {
        const state = input({ ...overrides, readTargetPlan: () => assert.fail('blocked input must not quote') });
        assert.deepEqual(ResolveTargetHudAction('e2', state), reason ? { type: 'refused', reason } : null);
    }
});

test('target activation rechecks the painted id and preserves card, self and slot-zero commands', () =>
{
    let legalIds = ['e2'];
    const state = input({ busy: true, readTargetPlan: () => ({ legalIds }) });
    assert.deepEqual(ResolveTargetHudAction('e2', state),
        { type: 'playCard', cardInstanceId: 'strike', targetId: 'e2' }, 'a queueable card can be busy');
    legalIds = ['e3'];
    assert.deepEqual(ResolveTargetHudAction('e2', { ...state, busy: false }),
        { type: 'refused', reason: 'not a legal target' });
    assert.deepEqual(ResolveTargetHudAction('e2', input({ selected: null, selfArm: 'defend', selectedFlask: 0 })),
        { type: 'playCard', cardInstanceId: 'defend', targetId: null });
    assert.deepEqual(ResolveTargetHudAction('e2', input({ selected: null, selectedFlask: 0 })),
        { type: 'useFlask', slot: 0, targetId: 'e2' });
});
