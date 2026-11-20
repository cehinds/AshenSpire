// src/ui/models/ArmouryStatsModel.js — the Armoury character-stats panel's
// data, derived without a DOM. components/armouryStatsPanel.js calls this, then
// builds the cards. Nothing here touches the document, a callback or a node.
import { statProjection } from '../../model/statProjection.js';
import { equipmentSurfaceReceipt } from '../../model/equipmentPresentation.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { runHandRules } from '../../model/handRules.js';
import { skillProgressRows, staleSkillTracks } from '../../model/progression.js';

/** The information card open at first: the attributes when the stats pane is expanded. */
export function armouryStatsInitiallyOpen(characterMode) {
  return characterMode === 'expanded' ? 'attributesCard' : null;
}

/**
 * Everything the panel derives from the run: the stat projection, the
 * equipment surface receipt, the in-combat attribute rows (marked compact) and
 * their one-line summary, the skill-progress rows and the ledger tracks content
 * no longer declares, and the equipment-cards summary.
 */
export function armouryStatsModel({ registries, run, meta = {}, inCombat = false, handRules = null, characterMode = 'folded' } = {}) {
  const projection = statProjection(registries, run);
  const surface = equipmentSurfaceReceipt(registries, run);
  let attributeRows = null;
  if (inCombat) {
    attributeRows = attributeCardModels(registries, run.attributes, {
      projection,
      equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
      // The hand a solo fight deals: mid-fight, that fight's own snapshot
      // (`handRules`, from ui/screens/combat.js — its `meta` is synthetic and
      // holds no hand settings, Codex #1294); otherwise the next fight's,
      // read from the run's rows and the profile the way engine/runCombat.js
      // reads them (`runHandRules`).
      hand: handRules || runHandRules(registries, run, meta.settings || {}),
    });
    for (const entry of attributeRows) entry.face = { ...entry.face, compact: true };
  }
  // A run always has its own class ladder (skillProgressRows refuses a class
  // the registry does not know, rather than returning a list without it), so
  // there is no empty case to draw here and none is pretended.
  const configuredFoundation = run.gameProfile?.foundation?.mode === 'configured';
  return {
    projection,
    surface,
    initiallyOpen: armouryStatsInitiallyOpen(characterMode),
    attributeRows,
    attributesSummary: attributeRows ? faceSummary(attributeRows.map((entry) => entry.face)) : '',
    configuredFoundation,
    skillRows: configuredFoundation ? [] : skillProgressRows(registries, run),
    // A ledger row whose track the content no longer declares cannot become a
    // bar — it has no label — but it may be holding drafts, so it is SAID
    // rather than dropped.
    staleTracks: staleSkillTracks(registries, run),
    equipmentCardsSummary: surface.roles.map((row) => `${row.profile.displayName} x${row.copies}`).join(' · '),
  };
}

/** `Label value · Label value` for a list of faces. */
export function faceSummary(faces) {
  return faces.map((face) => `${face.label} ${face.value}`).join(' · ');
}

/** The Relics card's one-line summary. */
export function relicsSummary(labels) {
  return labels.length ? `${labels.length} equipped · ${labels.join(' · ')}` : '0 equipped';
}
