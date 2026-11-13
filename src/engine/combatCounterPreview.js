import { configuredModule } from '../model/profileModule.js';
import { armsAsCoreCounter, isSpellCounter, configuredStance } from '../model/profileStance.js';
import { profileDamageReceipt } from './gameProfileCombat.js';
import {
    previewDamageHits,
    damagePreviewState,
    previewAttackerView,
} from './combatDamagePreview.js';
import { expandedEnemyMove, enemyMoveCarrier } from './combatCardTactics.js';
import { CounterBlockGrant } from './combatMatchups.js';
import { counterCoversAttack } from './combatReactions.js';
import { rememberCombatStance } from './concurrentStances.js';
import {
    counterRuleActive,
    counterReturnSpent,
    counterBeats,
    counterStacksAfterCard,
    counterReturn,
} from './counterRule.js';
import { counterStackCount } from './guardStacks.js';

/** Forecasts a Counter from a revealed attack, using its committed move on detached combatants. */
export function CounterPreviewAgainst(ctx, enemy, intent, card = null, projected = null, baseHp = 0)
{
    if (
        !counterRuleActive(ctx) || !enemy?.alive || !intent || intent.hidden
        || intent.revealed === false || enemy.intent?.damage == null
    )
    {
        return null;
    }
    const maneuver = intent.profile?.maneuver;
    if (!maneuver)
    {
        return null;
    }
    // Distinguish a revealed but uncovered attack from one the observer cannot read.
    if (card && !counterCoversAttack(ctx, card, intent.profile, 'damage'))
    {
        return { uncovered: true };
    }
    if (card && configuredModule(ctx, 'stances') && !armsAsCoreCounter(ctx, card))
    {
        return { uncovered: true };
    }
    if (
        counterReturnSpent(ctx.player)
        && !(ctx.reactionRules?.contactPolicy === 'perHit' && ctx.phase === 'enemy' && card)
    )
    {
        return { uncovered: true, spent: true };
    }
    const move = expandedEnemyMove(
        enemy,
        ctx.registries.enemies.get(enemy.enemyId).moves[intent.moveId] || {},
        intent.moveId,
        ctx,
    );
    const carrier = enemyMoveCarrier(enemy, move, intent.moveId, ctx);
    // Price against the defender after the card's immediate defense and stance entry.
    const base = projected || ctx.player;
    const spell = card && isSpellCounter(card);
    const defender = {
        ...base,
        combatStance: spell
            ? {
                maneuver: configuredStance(card),
                camp: 'spell',
                range: card.combatProfile?.range || 'reach',
            }
            : { maneuver: 'counter', camp: 'physical', range: 'melee' },
    };
    // Many Forms retains the stance the defender leaves.
    rememberCombatStance(ctx, defender, base.combatStance);
    if (projected)
    {
        ctx = { ...ctx, player: projected };
    }
    const hits = ctx.reactionRules?.contactPolicy === 'perHit'
        ? 1
        : Math.max(1, Math.floor(enemy.intent.hits ?? 1));
    const advantaged = counterBeats(ctx, maneuver);
    const state = damagePreviewState(ctx, defender);
    const total = { hp: 0, poise: 0, block: 0 };
    let incoming = 0;
    // A new Counter adds its resulting Block as stacks before contact.
    const stacks = card
        ? counterStacksAfterCard(ctx.player, base.block)
        : counterStackCount(ctx.player);
    for (let hit = 0; hit < hits; hit++)
    {
        // Later contacts see earlier Reflect, Poise and stance changes on the detached state.
        const view = previewAttackerView(state, enemy);
        const seen = profileDamageReceipt(
            view.previewCtx,
            view.attacker,
            state.defender,
            enemy.intent.damage,
            carrier,
        ).damageReceipt?.hits?.[0]?.incoming ?? 0;
        const row = counterReturn(ctx, seen, advantaged, { stacks, base: hit === 0 ? baseHp : 0 });
        const granted = CounterBlockGrant(state.previewCtx, state.defender, row.block);
        state.defender.block = (state.defender.block || 0) + granted;
        const landed = previewDamageHits(
            ctx,
            enemy,
            defender,
            enemy.intent.damage,
            carrier.tags || [],
            carrier,
            1,
            state,
        );
        // An attacker killed by Reflect cannot receive the Counter.
        if (landed.attackerDead)
        {
            return { uncovered: true, attackerDies: true };
        }
        incoming += seen;
        total.hp += row.hp;
        total.poise += row.poise;
        total.block += granted;
    }
    return { incoming, advantaged, hits, stacks, base: baseHp, ...total };
}
