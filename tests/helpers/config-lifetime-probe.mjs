import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../../src/content/index.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../../src/engine/combatSnapshot.js';
import { dispatch } from '../../src/engine/combat.js';
import { counterStackReturn } from '../../src/engine/guardStacks.js';
import { createRng } from '../../src/engine/rng.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
import { createMemoryStorage, createSaveManager } from '../../src/engine/save.js';
import { CreateSaveTransfer } from '../../src/engine/saveTransfer.js';
import { LoadSavedRunContext } from '../../src/engine/savedRunContext.js';
import { effectiveEvasion } from '../../src/engine/stanceHit.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../../src/model/gameProfile.js';
import { configuredSkillXpMultiplier } from '../../src/model/gameProfileProgression.js';
import { createRegistries } from '../../src/model/registries.js';
import { createRunState } from '../../src/model/state.js';

const openingKey = 'gameConfig.prologue.scenes.warmth.text';
const storage = createMemoryStorage();
const manager = createSaveManager(storage);
const transfer = CreateSaveTransfer(storage);
const current = resolveGameProfile('default');

function createFight(profile, slot)
{
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const run = createRunState({
        registries, classId: 'reaver', seed: 510 + slot,
        profileMeta: { settings: { [openingKey]: `Saved opening for slot ${slot}`, rangeReachPrecisionBonus: 3 } },
    });
    const encounter = registries.encounters.get('a2_knight');
    const combat = createRunCombat({ run, registries, encounter, enemyIds: encounter.enemies, rng: createRng(run.seed) });
    return { combat, encounter, run };
}

function startSlot(profile, slot)
{
    const { combat, encounter, run } = createFight(profile, slot);
    if (slot === 1)
    {
        combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
        const strike = combat.piles.hand.find(card => card.cardId === 'core.strike');
        dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: combat.enemies[0].id });
        assert.ok(combat.pendingReaction, 'save at a real paid reaction prompt');
    }
    combat.player.counterStacks = 9;
    combat.player.reflectStacks = 7;
    commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: encounter.id });
    manager.saveRun(run, combat.rng, slot);
}

function inspectSlot(slot)
{
    const context = LoadSavedRunContext(manager, slot);
    assert.ok(context.run, context.reason);
    const { registries, run, gameProfile, configuration } = context;
    const fight = restoreCombatSnapshot({
        registries, expectedGameProfile: gameProfile,
        rng: createRng(run.seed, run.streamCounters),
        snapshot: run.combatEntered.snapshot,
    });
    return {
        pinned: {
            profile: gameProfile.hash,
            xp: configuredSkillXpMultiplier(gameProfile, 'class'),
            action: fight.core2ActionRulesVersion,
            opening: configuration.overrides[openingKey],
            range: fight.rangeState,
            fixCore: fight.fixCoreRules,
            pendingReaction: fight.pendingReaction,
            reactionRules: fight.reactionRules,
            rng: fight.rng.getCounters(),
        },
        live: {
            counter: counterStackReturn(fight.player.counterStacks, 10),
            reflect: fight.player.reflectStacks,
            evasion: effectiveEvasion(fight, fight.player),
        },
    };
}

// Each process loads one compiled configuration, just like a launched game.
if (process.argv[2] === 'save')
{
    const historical = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/dev-profile-73ef.json.gz', import.meta.url))));
    startSlot(current, 1);
    startSlot(resolveGameProfile(historical), 2);
    writeFileSync('variant-a.backup.json', transfer.CreateBackup());
}
else
{
    assert.deepEqual(transfer.Restore(readFileSync('variant-a.backup.json', 'utf8')), { ok: true });
}

const { combat: freshFight } = createFight(current, 1);
process.stdout.write(JSON.stringify({
    profile: current.hash,
    runtime: current.lock.runtimeHash,
    xp: configuredSkillXpMultiplier(current, 'class'),
    freshAction: freshFight.core2ActionRulesVersion,
    slots: [inspectSlot(1), inspectSlot(2)],
}));
