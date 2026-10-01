// src/ui/screens/smithServices.js — the smith's card services, opened the
// same way from wherever a smith is standing (the Shrine, a merchant who
// rolled one). The screen that calls this owns the run and what happens
// after a commit; this module owns the reversible selection loop between
// the plan, the model and the modal, and the one commit call.
import { extractionPlan, installPlan, commitExtraction, commitInstall } from '../../model/cardExtraction.js';
import { mountServiceModel } from '../models/MountServiceModel.js';
import { mountMountServiceModal } from '../components/mountServiceModal.js';

/** How the screen decides whether to show a service at all. */
export function mountServiceOffer(registries, run, service) {
  const plan = service === 'extract' ? extractionPlan(registries, run) : installPlan(registries, run);
  return Object.freeze({
    service,
    plan,
    available: plan.candidates.length > 0,
    stones: plan.stones,
    cost: plan.cost,
    summary: plan.candidates.length
      ? `${plan.cost === 0 ? 'Free' : `${plan.cost} Smithing Stone${plan.cost === 1 ? '' : 's'}`} · ${plan.candidates.length} item${plan.candidates.length === 1 ? '' : 's'} to work on.`
      : (service === 'extract' ? 'Nothing you carry lends a card a smith can lift out.' : 'No item has an open mount, or no deck card would fit one.'),
  });
}

/**
 * openMountService(host, { service, registries, run, meta, ... }) -> modal
 *
 * Selection is presentation state until Confirm: Back and Escape return with
 * the run byte-for-byte untouched. Confirm is the one commit, revalidated
 * by the model through the same plan the modal was drawn from.
 */
export function openMountService(host, {
  service, registries, run, meta, returnFocusElement,
  multiUse = false, place = 'shrine', onCommitted, onBack = () => {},
  // A door with its own transaction (the blacksmith's quote-checked commit,
  // SPEC §14.4) hands it in; otherwise the smith's own commit runs.
  commit = null, quote = null, onError = null,
}) {
  const planner = service === 'extract' ? extractionPlan : installPlan;
  let selection = {};
  let displayedQuote = null;
  const model = () => {
    const view = mountServiceModel(registries, planner(registries, run), selection, { multiUse, place });
    const p = view.properties;
    displayedQuote = quote && p.canConfirm ? quote({
      itemRef: p.selected.itemRef, mountKey: p.selectedMount.mountKey,
      instanceId: p.selectedCard?.instanceId,
    }) : null;
    return view;
  };
  const modal = mountMountServiceModal(host, model(), {
    registries,
    meta,
    returnFocusElement,
    onSelectItem: (itemRef) => { selection = selection.itemRef === itemRef ? selection : { itemRef }; modal.update(model()); },
    onSelectMount: (mountKey) => { selection = { itemRef: selection.itemRef, mountKey }; modal.update(model()); },
    onSelectCard: (instanceId) => { selection = { ...selection, instanceId }; modal.update(model()); },
    onBack,
    onConfirm: (chosen) => {
      let receipt;
      try {
        receipt = commit ? commit(chosen, displayedQuote) : service === 'extract'
          ? commitExtraction(registries, run, chosen.itemRef, chosen.mountKey)
          : commitInstall(registries, run, chosen.itemRef, chosen.mountKey, chosen.instanceId);
      } catch (error) {
        if (!onError) throw error;
        onError(error);
        return;
      }
      onCommitted(receipt);
    },
  });
  return modal;
}

/** The one-line story of a receipt, for the map log and the merchant's counter. */
export function mountReceiptLine(receipt) {
  if (!receipt) return '';
  const cost = receipt.spent ? ` Spent ${receipt.spent} Stone.` : '';
  return receipt.service === 'extract'
    ? `Extracted ${receipt.cardName} from ${receipt.itemName}.${cost}`
    : `Seated ${receipt.cardName} in ${receipt.itemName}.${cost}`;
}
