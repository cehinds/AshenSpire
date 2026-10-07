// src/ui/models/SmithWorkspaceModel.js — W1i Smith upgrade, W1j Extract card
// and W1k Install card, decided without a DOM.
//
// The three Smith services are W1 children with no categories, so they draw no
// category rail. Their LEFT column is the item list (W1i `candidates`, W1j/W1k
// `items`): the kit's rail on wide hosts, one `[Selection ▾]` selector above
// the pane on compact ones (components/w1Workspace.js). The pane shows the
// selected item and only the slots its service declares, in the wireframe's
// order.
//
// This file PROJECTS the read models the screen already builds
// (SmithSelectionModel.js, MountServiceModel.js). It invents no item, cost,
// mount or card, and mutates nothing it is handed.
import { wireframeUi } from '../../content/wireframeUi.js';

/** Every body slot a service may register, in the order its wireframe draws them. */
export const SMITH_SLOTS = Object.freeze({
  upgrade: Object.freeze(['selected', 'changes', 'cost']),
  extract: Object.freeze(['selected', 'mounts', 'extractionPreview', 'cost']),
  install: Object.freeze(['selected', 'mounts', 'cards', 'installPreview', 'cost']),
});

/** Which service a read model describes. The upgrade model carries no `service`. */
export function smithService(model) {
  const service = model?.properties?.service;
  return service === 'extract' || service === 'install' ? service : 'upgrade';
}

/**
 * The item column's share of the frame, as the W1 workspace's custom
 * properties (they override the category rail's 21.6vw).
 */
export function smithWorkspaceVars(spec = wireframeUi.smith) {
  const { candidatesWidth, candidatesMinRem, candidatesMaxRem } = spec || {};
  if (!(candidatesWidth > 0 && candidatesWidth < 1)) throw new Error('smith.candidatesWidth must be a fraction in (0, 1)');
  if (!(candidatesMinRem > 0 && candidatesMaxRem >= candidatesMinRem)) throw new Error('smith candidate column bounds are inverted');
  return Object.freeze({
    '--w1-rail': String(candidatesWidth),
    '--w1-rail-min': `${candidatesMinRem}rem`,
    '--w1-rail-max': `${candidatesMaxRem}rem`,
  });
}

/**
 * One row per candidate the plan offers, in its order. `status` is a string id
 * and its tokens: the upgrade row states the tier step (the owned count is the
 * row's own pill); a mount row states where the item is and how many mounts it
 * has.
 */
export function smithCandidateRows(model) {
  const service = smithService(model);
  const candidates = model?.properties?.candidates || [];
  return Object.freeze(candidates.map((item) => Object.freeze({
    member: item.itemRef,
    name: item.name,
    selected: Boolean(item.selected),
    status: Object.freeze(service === 'upgrade'
      ? { id: 'smith.row.tier', tokens: Object.freeze({ from: item.currentLevel, to: item.nextLevel }) }
      : {
        id: item.mounts.length === 1 ? 'smith.row.mountOne' : 'smith.row.mountMany',
        tokens: Object.freeze({ where: item.whereLabel, n: item.mounts.length }),
      }),
  })));
}

/** The compact selector's face: the selected item's name, or the prompt's id. */
export function smithSelectorFace(model) {
  const selected = model?.properties?.selected || null;
  return Object.freeze(selected ? { id: null, text: selected.name } : { id: 'smith.selector.none', text: null });
}

/**
 * The pane's body slots, in order. Nothing selected shows the idle slot. A
 * dependent slot appears only once the choice it depends on is made: the
 * extraction preview after a mount, the card selector after a mount, the
 * install preview after a card. The cost slot stands with any selection.
 */
export function smithPaneSlots(model) {
  const p = model?.properties || {};
  if (!p.selected) return Object.freeze(['idle']);
  const service = smithService(model);
  const present = {
    selected: true,
    changes: service === 'upgrade',
    mounts: service !== 'upgrade',
    extractionPreview: service === 'extract' && Boolean(p.selectedMount),
    cards: service === 'install' && Boolean(p.selectedMount),
    installPreview: service === 'install' && Boolean(p.selectedCard),
    cost: true,
  };
  return Object.freeze(SMITH_SLOTS[service].filter((slot) => present[slot]));
}
