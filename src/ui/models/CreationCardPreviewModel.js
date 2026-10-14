// Display-only birth context. One detached empty encounter supplies the same
// initial player ratings, class mounts and weapon sources as real combat.
// Refs/registries remain authored data; only actually infused hits gain a live
// face receipt. Every other creation card keeps its established static face.
import * as RunCombat from '../../engine/runCombat.js';
import * as Combat from '../../engine/combat.js';
import * as Rng from '../../engine/rng.js';
import * as Actions from '../../engine/actions.js';
import * as Carriers from '../../engine/combatCardTactics.js';
import * as Sources from '../../model/weaponInfusion.js';
import * as Subclasses from '../../model/subclasses.js';
import { playingCardDefinition } from '../../model/playingCard.js';
import { combatProfileFor } from '../../model/combatCardProfile.js';
import { isPhysicalDamageType } from '../../model/combatRatings.js';

export function creationStartingCardPreviews(registries, run, refs, { rules = null, settings = {} } = {}) {
  const previews = new Map();
  if (!run || !refs.length || run.subclassId === undefined) return previews;
  const subclassId = Subclasses.effectiveSubclassId(registries, run);
  if (!subclassId || !registries.subclasses.get(subclassId).weaponInfusion) return previews;
  const candidate = structuredClone(run);
  candidate.deck = refs.map((ref, index) => ({ ...structuredClone(ref), instanceId: ref.instanceId || `creation-card-preview:${index}` }));
  // Creation receives current rules explicitly. This encounter owns its RNG
  // and all mutable run/combat state, and names no opponent or saved encounter.
  if (rules) Object.assign(candidate, rules);
  if (rules?.breakMeterVersion !== undefined) candidate.advancedConfigSnapshot = {
    ...candidate.advancedConfigSnapshot, breakMeterVersion: rules.breakMeterVersion,
  };
  delete candidate.enemyKnowledgeState;
  const combat = RunCombat.createRunCombat({ registries, run: candidate,
    rng: Rng.createRng(candidate.seed || 0), enemyIds: [], settings });
  refs.forEach((ref, index) => {
    const def = playingCardDefinition(registries, ref, { rules });
    if (!def.effects?.some(effect => effect.op === 'damage')) return;
    const carrier = { cardId: ref.cardId, sourceArmamentId: ref.sourceArmamentId || ref.weaponId,
      sourceHand: ref.sourceHand, tags: def.cardTags ?? def.tags, attack: def.attack, combatProfile: combatProfileFor(def) };
    if (!Sources.weaponSourceFor(combat, combat.player, carrier)?.weaponInfusion) return;
    const preview = Combat.previewCard(combat, candidate.deck[index].instanceId);
    if (preview.values.some(value => value.sourceInfusion)) {
      // Counter faces show potential reply values without an opponent. Their
      // source components still use the same attacker math as the reply hit.
      const resolvedCarrier = Carriers.tacticalCarrier(preview.resolvedDefinition, carrier, combat, combat.player);
      for (const value of preview.values) if (value.sourceInfusion) {
        if (!value.infusionComponents) value.infusionComponents = Actions.infusionDamageComponents(combat, combat.player, null, resolvedCarrier);
        const type = resolvedCarrier.physicalDamageType || resolvedCarrier.combatProfile?.damageType;
        if (!value.physicalDamageType && isPhysicalDamageType(type)) value.physicalDamageType = type;
      }
      previews.set(ref, preview);
    }
  });
  return previews;
}
