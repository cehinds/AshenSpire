import { resolveCard } from '../../model/registries.js';
import { subclassDeckPreview } from '../../model/subclasses.js';
import { startingAbilityPlan, startingAbilityProblem } from '../../model/startingAbilities.js';
import { creationAbilitySelection } from './CreationWorkspaceModel.js';

/** Creation always makes an explicit choice; legacy runs remain unmodified. */
export function creationSubclassSelection(options, selectedId) {
  return options.find(row => row.id === selectedId)?.id
    || options.find(row => row.default)?.id || options[0]?.id || null;
}

export const CREATION_DECK_SOURCES = Object.freeze(['subclass', 'class', 'weaponArt', 'basic']);

/** Drafts can be incomplete. Preserve the state for Cancel while refusing stale preview picks. */
export function creationDraftStartingDeck(registries, run, cardIds = [], settings = {}) {
  const plan = startingAbilityPlan(registries, run, settings);
  const eligible = creationAbilitySelection(cardIds, plan);
  const invalid = eligible.length !== cardIds.length
    || eligible.filter(id => plan?.elementIds.includes(id)).length > (plan?.maxElementPicks || 0)
    || (plan && cardIds.length === plan.count && startingAbilityProblem(registries, run, cardIds, settings));
  return subclassDeckPreview(registries, run, { startingAbilityIds: invalid ? [] : eligible, settings });
}

const ROLE_IDS = Object.freeze({ Smash: 'smash', Counter: 'counter', Power: 'power', Skill: 'skill', Sweep: 'sweep', Spell: 'spell', Class: 'class', 'Weapon Art': 'weaponArt', Strike: 'strike', Defend: 'defend' });

/** Preserve each copy and the engine's authored source/role, including spell substitutions. */
export function creationStartingDeckModel(registries, refs) {
  return Object.freeze(CREATION_DECK_SOURCES.map(source => Object.freeze({
    source,
    cards: Object.freeze(refs.filter(ref => ref.openingSource === source).map((ref, index) => Object.freeze({
      key: `${source}:${index}`, ref, definition: resolveCard(registries, ref),
      roleStringId: `creation.subclass.role.${ROLE_IDS[ref.openingRole] || 'skill'}`,
    }))),
  })));
}
