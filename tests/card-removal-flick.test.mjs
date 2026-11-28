import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { removeDeckCard, canRemoveDeckCard, retiredAttackSlots } from '../src/model/cardRemoval.js';
import { stampDeck } from '../src/model/loadout.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import {
    flickPreferences,
    flickVerdict,
    nearestFlickTarget,
} from '../src/ui/models/TouchFlickModel.js';
import { withWeaponRack } from './withWeaponRack.mjs';

const FLICK_CASES = JSON.parse(
    readFileSync(new URL('./fixtures/card-removal-flick-cases.json', import.meta.url), 'utf8'),
);
const RUN_SEED = 671;

function withoutNote(record)
{
    const { $note, ...values } = record;
    return values;
}

function verdictSettings(flickCase, rules)
{
    if (flickCase.settings)
    {
        return flickCase.settings;
    }
    if (flickCase.distanceRule)
    {
        return { touchFlickDistance: rules.distance[flickCase.distanceRule] };
    }
    return withoutNote(FLICK_CASES.referenceSettings);
}

function attackSlotIds(deck)
{
    return deck
        .filter(card => card.equipmentAttackSlotId)
        .map(card => card.equipmentAttackSlotId);
}

function runFlickCases(check, rules)
{
    const { start, end } = FLICK_CASES;
    const trail = [
        start,
        end,
    ];
    for (const flickCase of FLICK_CASES.verdictCases)
    {
        const release = flickCase.release ?? end;
        const settings = verdictSettings(flickCase, rules);
        const verdict = flickVerdict(start, release, trail, settings, rules);
        check(verdict.qualifies === flickCase.expected, flickCase.label);
    }
    for (const preferenceCase of FLICK_CASES.preferenceCases)
    {
        const preferences = flickPreferences(preferenceCase.settings, rules);
        const expectedDistance = rules.distance[preferenceCase.expectedDistanceRule];
        check(preferences.distance === expectedDistance, preferenceCase.label);
    }
    for (const targetCase of FLICK_CASES.targetCases)
    {
        const nearest = nearestFlickTarget(targetCase.targets, targetCase.point);
        const nearestId = nearest?.id ?? null;
        check(nearestId === targetCase.expectedId, targetCase.label);
    }
}

export function runCardRemovalFlickTests()
{
    let checks = 0;
    const check = (value, message) =>
    {
        assert.ok(value, message);
        checks++;
    };
    runFlickCases(check, contentBundle.balance.ui.touchFlick);

    const registries = createRegistries(withWeaponRack(contentBundle));
    // A Starseer: its bound cards leave three basic attacks under the cap, so a
    // middle one exists (a sword-and-shield Reaver's kits and Dodge Roll leave one).
    // This regression constructs the original headless combat/swap contract.
    const run = createRunState({
        seed: RUN_SEED,
        classId: 'starseer',
        registries,
        combatExpansionVersion: 1,
        enemyKnowledgeVersion: null,
    });
    const attacks = run.deck.filter(card => card.equipmentAttackSlotId);
    const retired = attacks[1];
    check(
        removeDeckCard(run, retired.instanceId, { keepOne: true }),
        'merchant can remove a middle basic attack',
    );
    check(!removeDeckCard(run, retired.instanceId), 'stale instance cannot be removed twice');
    const survivorIds = attackSlotIds(run.deck);
    run.loadout.sets.rightHand[1] = 'dagger';
    stampDeck(registries, run);
    check(
        JSON.stringify(attackSlotIds(run.deck)) === JSON.stringify(survivorIds),
        'restamp preserves surviving identities',
    );
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, createRng(RUN_SEED));
    const loaded = saves.loadRun(registries);
    check(
        loaded && loaded.removedAttackSlotIds.includes(retired.equipmentAttackSlotId),
        'run save/load retains removal',
    );
    stampDeck(registries, loaded);
    check(
        !loaded.deck.some(card => card.instanceId === retired.instanceId),
        'load does not resurrect removed copy',
    );
    const combat = createCombat({
        registries,
        rng: createRng(RUN_SEED),
        enemyIds: [contentBundle.enemies[0].id],
        player: {
            classId: loaded.class,
            attributes: loaded.attributes,
            maxHp: loaded.maxHp,
            hp: loaded.hp,
            maxMana: loaded.maxMana,
            mana: loaded.mana,
            maxStamina: loaded.maxStamina,
            stamina: loaded.stamina,
            energyMax: loaded.energyMax,
            drawPerTurn: loaded.drawPerTurn,
            damageBySchoolAdd: loaded.damageBySchoolAdd,
            equipmentProfileRuleSnapshot: loaded.equipmentProfileRuleSnapshot,
            equipmentAttackSlotCount: loaded.equipmentAttackSlotCount,
            removedAttackSlotIds: loaded.removedAttackSlotIds,
            equipmentPoolDeficits: loaded.equipmentPoolDeficits,
            itemUpgradeLevels: loaded.itemUpgradeLevels,
            deck: loaded.deck,
            relicIds: loaded.relics,
            flasks: loaded.flasks,
            flaskCharges: loaded.flaskCharges,
            loadout: loaded.loadout,
        },
    });
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    const snapshot = serializeCombatSnapshot(combat);
    loaded.combatEntered = { nodeId: 'n1', encounterId: 'e1', snapshot };
    saves.saveRun(loaded, createRng(RUN_SEED));
    const resumed = saves.loadRun(registries);
    const resumedStatus = saves.runStatus();
    check(
        !!resumed && resumed.removedAttackSlotIds.includes(retired.equipmentAttackSlotId),
        `saved fight passes the run migration and load door (${resumedStatus.state}: ${
            resumedStatus.reason ?? 'no reason'
        })`,
    );
    const restored = restoreCombatSnapshot({ registries, rng: createRng(RUN_SEED), snapshot });
    restored.player.energy = 10; // isolate slot persistence from the second swap's resource cost
    dispatch(restored, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 });
    const combatCards = Object.values(restored.piles).flat().filter(card =>
        card?.equipmentAttackSlotId
    );
    check(
        combatCards.length === attacks.length - 1
            && !combatCards.some(card =>
                card.equipmentAttackSlotId === retired.equipmentAttackSlotId
            ),
        'combat save and swaps keep the slot retired',
    );
    for (const card of [...loaded.deck].filter(card => card.equipmentAttackSlotId))
    {
        removeDeckCard(loaded, card.instanceId);
    }
    stampDeck(registries, loaded);
    check(
        loaded.deck.every(card => !card.equipmentAttackSlotId),
        'removing all attacks leaves an intentional zero',
    );
    check(
        !canRemoveDeckCard({ grantedBy: 'armament/sword' }),
        'item-owned grants remain protected',
    );
    check(
        !removeDeckCard({ deck: [{ instanceId: 'only' }] }, 'only', { keepOne: true }),
        'merchant cannot remove the final card',
    );
    check(
        validateRunShape({ ...loaded, removedAttackSlotIds: ['attack:999'] }).some(problem =>
            problem.includes('removedAttackSlotIds')
        ),
        'invalid retired slots are rejected at save validation',
    );
    assert.throws(() => retiredAttackSlots(4, ['attack:0', 'attack:0']));
    checks++;
    return { checks };
}
