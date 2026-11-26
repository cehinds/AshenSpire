import { getEntity } from '../../engine/combat.js';
import { enemyMoveCarrier } from '../../engine/combatCardTactics.js';
import { reconcileWardBlock } from '../../model/blockPresentation.js';
import { enemyStanceCategory } from '../../model/enemyStancePose.js';
import { applyCombatDisplayReceipt } from './CombatDisplayReceiptModel.js';
import { applyCombatIntentReceipt } from './CombatIntentProjectionModel.js';
import { applyRangeRankEvent, rangeRankSnapshot } from './CombatRangeRankModel.js';
import { followUpPlan } from './IntentFollowUpModel.js';
import { enemyDefinitionOf, enemyEventMoveOf } from '../../model/enemyMoveSet.js';

function captureEntity(combat, e, alive, projectCombatIntent)
{
    const statuses = {};
    for (const [sid, inst] of Object.entries(e.statuses || {}))
    {
        statuses[sid] = {
            stacks: inst.stacks,
            duration: inst.duration,
            meter: inst.meter ? { value: inst.meter.value, max: inst.meter.max } : null,
        };
    }
    return {
        id: e.id,
        kind: e.kind,
        tags: e.tags ? [...e.tags] : undefined,
        mechanicTags: e.mechanicTags ? [...e.mechanicTags] : undefined,
        mechanicBindings: e.mechanicBindings ? structuredClone(e.mechanicBindings) : undefined,
        ratingSources: e.ratingSources ? structuredClone(e.ratingSources) : undefined,
        ...(e.kind === 'enemy'
            ? {
                intentPreview: projectCombatIntent(combat, e.id),
                presentationStance: enemyStanceCategory(e.intent),
            }
            : {}),
        hp: e.hp,
        maxHp: e.maxHp,
        energy: e.energy,
        energyMax: e.energyMax,
        stamina: e.stamina,
        maxStamina: e.maxStamina,
        maxMana: e.maxMana,
        mana: e.mana,
        block: e.block,
        ...(e.wardHp !== undefined ? { wardHp: e.wardHp } : {}),
        persistentWard: e.persistentWard ? { ...e.persistentWard } : null,
        persistentPoise: e.persistentPoise ? { ...e.persistentPoise } : null,
        combatStance: e.combatStance ? { ...e.combatStance } : null,
        // W25-F: the caster's elemental flux (the second stance icon), advanced by `elementFluxChanged`.
        elementFlux: e.elementFlux || null,
        // Wave 3: a Poise break makes the owner Broken (poise.breakRule "broken") until `brokenEnded`.
        broken: !!e.broken,
        combatEvade: e.combatEvade ? { ...e.combatEvade } : null,
        // The Counter and Reflect badges are paced like every other badge: without these the HUD read the live fight, which End Turn
        // has already advanced to the next player turn, so a held Counter vanished the moment the turn ended (owner playtest 2026-11-19).
        counterStacks: e.counterStacks || 0,
        reflectStacks: e.reflectStacks || 0,
        combatOwnerCycle: e.combatOwnerCycle,
        ...(e.wardBlock !== undefined ? { wardBlock: e.wardBlock } : {}),
        alive,
        statuses,
        stanceId: e.stanceId,
        poiseMeter: e.poiseMeter ? { value: e.poiseMeter.value, max: e.poiseMeter.max } : null,
        wardMeter: e.wardMeter ? { value: e.wardMeter.value, max: e.wardMeter.max } : null,
        arcaneExposure: e.arcaneExposure ? structuredClone(e.arcaneExposure) : undefined,
    };
}

/** Captures the display state before the engine advances the fight. */
export function CaptureCombatDisplay(combat, {
    registries,
    projectCombatIntent,
    previewCard,
    followMemo,
    paintedHandQuotes,
    upcastRanksByCard,
})
{
    const ents = { player: captureEntity(combat, combat.player, true, projectCombatIntent) };
    for (const e of combat.enemies)
    {
        ents[e.id] = captureEntity(combat, e, e.alive, projectCombatIntent);
    }
    // A reaction pause keeps the turn's existing plan.
    const followPlans = {};
    for (const e of combat.enemies)
    {
        const plan = followMemo.plan(e.id, {
            resuming: !!combat.reactionCursor,
            build: () =>
                e.alive && e.plannedMoves?.length
                    ? followUpPlan({
                        queue: e.plannedMoves,
                        def: enemyDefinitionOf(registries, e),
                        enemyId: e.id,
                        combat,
                        offset: combat.reactionCursor ? combat.followTrace?.[e.id]?.length || 0 : 0,
                    })
                    : null,
        });
        if (plan)
        {
            followPlans[e.id] = plan;
        }
    }
    const handPreviews = new Map();
    // An inert reaction hand retains the quotes already painted.
    const paintedQuotes = combat.pendingReaction ? paintedHandQuotes : null;
    for (const inst of combat.piles.hand)
    {
        const painted = paintedQuotes?.get(inst.instanceId)?.plain?.pv;
        if (painted)
        {
            handPreviews.set(inst.instanceId, painted);
            continue;
        }
        try
        {
            handPreviews.set(
                inst.instanceId,
                previewCard(
                    combat,
                    inst.instanceId,
                    undefined,
                    upcastRanksByCard.get(inst.instanceId),
                ),
            );
        }
        catch
        {
            // An unavailable card quote does not block display capture.
        }
    }
    return {
        ents,
        followPlans,
        hand: [...combat.piles.hand],
        handPreviews,
        pileCounts: {
            draw: combat.piles.draw.length,
            discard: combat.piles.discard.length,
            exhaust: combat.piles.exhaust.length,
        },
        arcaneEvents: [],
        logLength: combat.eventLog.length,
        rangeRanks: rangeRankSnapshot(combat),
    };
}

const PLAY_COST_EVENTS = new Set(['energySpent', 'staminaSpent', 'manaSpent']);

/** The cost receipts a play paid: the player's spend events emitted before its first cardPlayed. */
export function PlayCostEvents(events)
{
    const paid = [];
    for (const event of events)
    {
        if (event.type === 'cardPlayed')
        {
            break;
        }
        if (PLAY_COST_EVENTS.has(event.type))
        {
            paid.push(event);
        }
    }
    return paid;
}

/** Re-quotes the cards still held from the post-play fight; a card that cannot be quoted keeps its earlier quote. */
export function RequoteHeldHand(disp, combat, previewCard, upcastRanksByCard)
{
    const next = new Map(disp.handPreviews);
    for (const inst of disp.hand)
    {
        if (
            disp.leftHand?.has(inst.instanceId)
            || !combat.piles.hand.some(card => card.instanceId === inst.instanceId)
        )
        {
            continue;
        }
        try
        {
            next.set(
                inst.instanceId,
                previewCard(
                    combat,
                    inst.instanceId,
                    undefined,
                    upcastRanksByCard.get(inst.instanceId),
                ),
            );
        }
        catch
        {
            // A card the engine cannot quote keeps the face it had.
        }
    }
    disp.handPreviews = next;
}

// The turn-start refresh (playtest 2026-11-17): the receipts that return the last hand. The returned cards leave the
// shown hand here, so the screen discards them visibly before the new hand is drawn; a retained card stays.
const TURN_RETURN_SHUFFLES = new Set(['configuredRoundRefresh', 'handRefresh']);
const isTurnReturn = (event) =>
    (event.type === 'deckShuffled' && TURN_RETURN_SHUFFLES.has(event.reason))
    || (event.type === 'cardDiscarded' && event.reason === 'turnEnd');

/** The cards drawn after `index` until the next player turn starts: the new hand. */
function turnDrawIds(playbackEvents, index)
{
    const drawn = new Set();
    for (const event of (playbackEvents || []).slice(index + 1))
    {
        if (event.type === 'playerTurnStart')
        {
            break;
        }
        if (event.type === 'cardDrawn')
        {
            drawn.add(event.cardInstanceId);
        }
    }
    return drawn;
}

/**
 * Marks the shown hand for a turn-start refresh. A shuffle that returns the hand to the draw pile emits no
 * per-card receipt, so every shown card the new turn did not keep leaves now: a kept card is still in the hand
 * and is not drawn again this turn.
 */
export function ApplyTurnReturn(disp, event, { combat, playbackEvents })
{
    const at = playbackEvents?.indexOf(event) ?? -1;
    const drawnIds = turnDrawIds(playbackEvents, at);
    disp.turnRefresh = { drawnIds: new Set([...(disp.turnRefresh?.drawnIds || []), ...drawnIds]) };
    if (event.type !== 'deckShuffled')
    {
        return;
    }
    const held = new Set(combat.piles.hand.map((card) => card.instanceId));
    disp.hand = disp.hand.filter((card) =>
        held.has(card.instanceId) && !drawnIds.has(card.instanceId)
    );
}

/** Applies a paced beat and reports whether the screen should release the held hand. */
export function ApplyCombatBeat(disp, events, {
    combat,
    registries,
    projectCombatIntent,
    findInst,
    playbackEvents,
    reduceFollowRows,
})
{
    if (!disp)
    {
        return false;
    }
    reduceFollowRows(events, disp, combat.followTrace);
    if (disp.rangeRanks)
    {
        for (const event of events)
        {
            applyRangeRankEvent(disp.rangeRanks, event);
        }
    }
    let releaseHeldTurnHand = false;
    for (const e of events)
    {
        const eventIndex = combat.eventLog.indexOf(e);
        if (eventIndex >= 0)
        {
            disp.logLength = Math.max(disp.logLength, eventIndex + 1);
        }
        const t = e.targetId && disp.ents[e.targetId];
        // Defer an acting enemy's intent clear until the beat resolves.
        const at = playbackEvents?.indexOf(e) ?? -1;
        applyCombatIntentReceipt(
            disp.ents,
            e,
            disp.intentClears ||= new Map(),
            at >= 0 ? playbackEvents.slice(at + 1) : null,
        );
        if (isTurnReturn(e))
        {
            ApplyTurnReturn(disp, e, { combat, playbackEvents });
        }
        if (applyCombatDisplayReceipt(disp.ents, e))
        {
            continue;
        }
        switch (e.type)
        {
            case 'enemyMoveStarted':
            {
                // Reactions return to the planned hold; pooled follow-ups replace it.
                if (e.reaction)
                {
                    break;
                }
                const actor = disp.ents[e.sourceId];
                const enemy = combat.enemies.find(row => row.id === e.sourceId);
                const move = enemyEventMoveOf(registries, { enemy, enemyId: e.enemyId || enemy?.enemyId, moveId: e.moveId });
                if (actor && enemy && move)
                {
                    actor.presentationStance = enemyStanceCategory({
                        kind: e.kind || move.intent,
                        combatProfile:
                            enemyMoveCarrier(enemy, move, e.moveId, combat).combatProfile,
                    });
                }
                break;
            }
            case 'enemyActorTurnStarted':
            {
                const actor = disp.ents[e.sourceId];
                if (actor)
                {
                    actor.presentationStance = enemyStanceCategory(e.intent);
                }
                break;
            }
            case 'playerTurnStart':
                // Unused Evade charges expire as the player's turn starts.
                if (disp.ents.player)
                {
                    disp.ents.player.combatEvade = null;
                }
                for (const enemy of combat.enemies)
                {
                    if (disp.ents[enemy.id])
                    {
                        disp.ents[enemy.id].intentPreview = projectCombatIntent(combat, enemy.id);
                        disp.ents[enemy.id].presentationStance = enemyStanceCategory(enemy.intent);
                    }
                }
                break;
            case 'persistentWardChanged':
            case 'combatWardStripped':
                if (t?.persistentWard && Number.isFinite(e.value))
                {
                    t.persistentWard.value = e.value;
                    if (Number.isFinite(e.max))
                    {
                        t.persistentWard.max = e.max;
                    }
                }
                break;
            case 'wardHpChanged':
                if (t && Number.isFinite(e.value))
                {
                    t.wardHp = Math.max(0, Math.floor(e.value));
                }
                break;
            case 'wardBroken':
                if (t)
                {
                    t.wardHp = 0;
                }
                break;
            case 'persistentPoiseChanged':
                if (t?.persistentPoise)
                {
                    t.persistentPoise.value = e.value;
                    if (Number.isFinite(e.max))
                    {
                        t.persistentPoise.max = e.max;
                    }
                    // Bonus Poise (Barrier stacks) above the base maximum drives the blue bonus segment of the bar.
                    if (Number.isFinite(e.barrierBonus))
                    {
                        if (e.barrierBonus > 0)
                        {
                            t.persistentPoise.barrierBonus = e.barrierBonus;
                        }
                        else
                        {
                            delete t.persistentPoise.barrierBonus;
                        }
                    }
                }
                break;
            case 'combatStanceChanged':
                if (t && e.broken)
                {
                    t.broken = true;
                }
                break;
            case 'elementFluxChanged':
                if (t)
                {
                    t.elementFlux = e.element || null;
                }
                break;
            case 'brokenEnded':
                if (t)
                {
                    t.broken = false;
                }
                break;
            case 'arcaneExposureChanged':
                if (t && t.arcaneExposure)
                {
                    t.arcaneExposure.value = e.value;
                }
                disp.arcaneEvents.push(e);
                break;
            case 'arcaneBreak':
                if (t && t.arcaneExposure)
                {
                    t.arcaneExposure.value = 0;
                }
                disp.arcaneEvents.push(e);
                break;
            case 'arcaneExposureRefused':
                disp.arcaneEvents.push(e);
                break;
            case 'damageDealt':
                if (t)
                {
                    t.block = e.blockRemaining ?? Math.max(0, t.block - e.blocked);
                    if (e.wardBlockRemaining !== undefined)
                    {
                        t.wardBlock = e.wardBlockRemaining;
                    }
                    if (e.poiseRemaining !== undefined && t.persistentPoise)
                    {
                        t.persistentPoise.value = e.poiseRemaining;
                    }
                    if (e.wardHpRemaining !== undefined)
                    {
                        t.wardHp = Math.max(0, Math.floor(e.wardHpRemaining));
                    }
                    if (e.wardRemaining !== undefined && t.persistentWard)
                    {
                        t.persistentWard.value = e.wardRemaining;
                    }
                    reconcileWardBlock(t);
                }
                break;
            case 'impactDealt':
                if (t && e.poiseMeter)
                {
                    t.poiseMeter = { ...e.poiseMeter };
                }
                break;
            case 'ratingImpact':
                if (t)
                {
                    t[e.meter + 'Meter'] = { value: e.value, max: e.max };
                }
                break;
            case 'hpLost':
                if (t)
                {
                    t.hp = Math.max(0, t.hp - e.amount);
                }
                break;
            case 'healed':
                if (t)
                {
                    t.hp = Math.min(
                        t.hp + e.amount,
                        (getEntity(combat, e.targetId) || {}).maxHp || t.hp + e.amount,
                    );
                }
                break;
            case 'blockGained':
                if (t)
                {
                    t.block += e.amount;
                    if (e.wardBlockRemaining !== undefined)
                    {
                        t.wardBlock = e.wardBlockRemaining;
                    }
                    reconcileWardBlock(t);
                }
                break;
            case 'energySpent':
                if (disp.ents.player)
                {
                    disp.ents.player.energy = Math.max(0, disp.ents.player.energy - e.amount);
                }
                break;
            case 'energyGained':
                if (disp.ents.player)
                {
                    disp.ents.player.energy = Math.min(
                        disp.ents.player.energyMax,
                        disp.ents.player.energy + e.amount,
                    );
                }
                break;
            case 'enemyStaminaSpent':
                // The enemy's SP meter follows the payment (shown from fixCoreStaminaRemaining ?? stamina, see the SP row).
                if (t === undefined && disp.ents[e.sourceId])
                {
                    disp.ents[e.sourceId].fixCoreStaminaRemaining = e.remaining;
                    disp.ents[e.sourceId].stamina = e.remaining;
                }
                break;
            case 'staminaSpent':
                if (disp.ents.player && Number.isFinite(disp.ents.player.stamina))
                {
                    disp.ents.player.stamina = Math.max(0, disp.ents.player.stamina - e.amount);
                }
                break;
            case 'manaSpent':
                if (disp.ents.player)
                {
                    disp.ents.player.mana = Math.max(0, disp.ents.player.mana - e.amount);
                }
                break;
            case 'manaRestored':
                if (disp.ents.player)
                {
                    disp.ents.player.mana = Math.min(
                        combat.player.maxMana,
                        disp.ents.player.mana + e.amount,
                    );
                }
                break;
            case 'enemyDied':
                if (t)
                {
                    t.alive = false;
                    t.hp = 0;
                }
                break;
            // Keep meter and status changes on the beat that caused them.
            case 'statusApplied':
                if (t)
                {
                    const cur = t.statuses[e.status]
                        || (t.statuses[e.status] = { stacks: 0, duration: undefined, meter: null });
                    const live = getEntity(combat, e.targetId);
                    const liveInst = live && live.statuses && live.statuses[e.status];
                    if (liveInst && liveInst.meter)
                    {
                        // Meter row: `total` is the meter value (getStacks), and the max
                        // is whatever the live row carries (constant for proc rows).
                        cur.meter = cur.meter || { value: 0, max: liveInst.meter.max };
                        cur.meter.max = liveInst.meter.max;
                        cur.meter.value = e.total;
                    }
                    else
                    {
                        cur.stacks = e.total;
                        if (liveInst && liveInst.duration != null)
                        {
                            cur.duration = liveInst.duration;
                        }
                    }
                }
                break;
            case 'procBurst':
                // The burst drains its status meter on this beat.
                if (t && t.statuses[e.status] && t.statuses[e.status].meter)
                {
                    t.statuses[e.status].meter.value = 0;
                }
                // The burst receipt also carries its Poise gain.
                if (t && t.poiseMeter && e.poiseDamage > 0)
                {
                    t.poiseMeter.value = Math.min(
                        t.poiseMeter.max,
                        t.poiseMeter.value + e.poiseDamage,
                    );
                }
                break;
            case 'meterFilled':
                if (t && e.meter === 'poise' && t.poiseMeter)
                {
                    t.poiseMeter.value = 0;
                }
                break;
            case 'stanceEntered':
                if (disp.ents.player)
                {
                    disp.ents.player.stanceId = e.stance;
                }
                break;
            case 'evadeGained':
            {
                // Only the expansion's prepared Evade; the foundation Evade has its own row.
                if (!e.combatEvade)
                {
                    break;
                }
                const actor = disp.ents[e.sourceId];
                const live = e.sourceId === 'player'
                    ? combat.player
                    : combat.enemies.find(enemy => enemy.id === e.sourceId);
                if (actor)
                {
                    actor.combatEvade = {
                        ...(live?.combatEvade || {}),
                        charges: e.charges,
                        expiresOnOwnerCycle: live?.combatEvade?.expiresOnOwnerCycle
                            ?? (actor.combatOwnerCycle || 0) + 1,
                    };
                }
                break;
            }
            case 'combatAvoidanceResolved':
                if (t?.combatEvade && e.evade)
                {
                    t.combatEvade = {
                        ...t.combatEvade,
                        charges: Math.max(0, t.combatEvade.charges - 1),
                    };
                }
                break;
            case 'statusExpired':
                if (t)
                {
                    delete t.statuses[e.status];
                }
                break;
            case 'cardDrawn':
            {
                disp.pileCounts.draw = Math.max(0, disp.pileCounts.draw - 1);
                // The new hand starts arriving on the first draw beat.
                releaseHeldTurnHand = true;
                const inst = findInst(e.cardInstanceId);
                if (inst && !disp.hand.some((c) => c.instanceId === inst.instanceId))
                {
                    disp.hand.push(inst);
                }
                break;
            }
            case 'cardPlayed':
            case 'cardDiscarded':
            case 'cardExhausted':
            {
                if (e.type === 'cardDiscarded')
                {
                    disp.pileCounts.discard++;
                }
                if (e.type === 'cardExhausted')
                {
                    disp.pileCounts.exhaust++;
                }
                const i = disp.hand.findIndex((c) => c.instanceId === e.cardInstanceId);
                if (i >= 0)
                {
                    disp.hand.splice(i, 1);
                }
                break;
            }
        }
    }
    return releaseHeldTurnHand;
}
