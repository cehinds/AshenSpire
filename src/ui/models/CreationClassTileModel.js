// Class tiles read the same attribute, equipment and Evasion receipts as combat.
import { equippedIn } from '../../model/loadout.js';
import { playerPoiseThresholdReceipt } from '../../model/statProjection.js';
import { ratingReceipt } from '../../model/combatRatings.js';
import { ratingsConfigFor } from '../../model/statRows.js';
import { counterBaseEvasion } from '../../engine/counterReturn.js';
import { combatRoundsFor } from '../../model/combatRounds.js';
import { t } from '../strings.js';

export function creationClassTileCopy(classId) {
  return { lore: t(`creation.class.${classId}.lore`), playstyle: t(`creation.class.${classId}.style`) };
}

export function creationClassTileSummary(registries, run, projection, refs = run.deck) {
  const config = ratingsConfigFor(registries, run);
  const ratings = config?.ratings ? ratingReceipt(registries, run, config).totals
    : { poise: playerPoiseThresholdReceipt(registries, run).value };
  const player = { kind: 'player', classId: run.class, attributes: run.attributes };
  const evasion = counterBaseEvasion({ registries, player, loadout: run.loadout,
    combatExpansionRules: run.combatExpansionRules,
    combatRounds: combatRoundsFor(run.advancedConfigSnapshot?.overrides) }, player);
  const pools = Object.fromEntries(projection.derived.map(row => [row.id, row.value]));
  const values = { hp: pools.hp, stamina: pools.stamina, mana: pools.mana, ...ratings, evasion };
  const armaments = ['rightHand', 'leftHand'].map(slot => equippedIn(registries, run.loadout, run.class, slot)).filter(Boolean);
  const art = refs.find(ref => ref.openingRole === 'Weapon Art');
  return {
    ...creationClassTileCopy(run.class),
    // Stances are combat-scoped; no stance is active at creation.
    stance: t('creation.class.neutral'),
    ratings: ['hp', 'stamina', 'mana', 'ar', 'pr', 'dr', 'poise', 'ward', 'evasion'].map(id => ({
      id, name: ['ar', 'pr', 'dr', 'poise', 'ward'].includes(id)
        ? registries.derivedStatRules.presentation[id].label : t(`creation.class.stat.${id}`), value: values[id] ?? t('creation.class.unavailable'),
    })),
    armament: armaments.map(piece => piece.name).join(' + ') || t('creation.class.unarmed'),
    art: art ? registries.cards.get(art.cardId).name : null,
  };
}
