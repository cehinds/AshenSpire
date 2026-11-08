// src/model/validate/handOverlap.js — the overlap-needs-its-reader refusal and the tap-size rules.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

export function handOverlapProblems(b, err, ctx) {
  // OVERLAP DOES NOT FLATTEN WITHOUT ITS READER (Sunna's ruling, 2026-08-14).
  // Two rows, each defensible alone: 'overlap' is a legal layout mode, and
  // inspectHold.ms 0 is the inspect gesture's legal off position. TOGETHER
  // they author a hand nobody can read — ten cards flattened to ~27-30
  // viewport px exposed slivers (measured, tools/handlayout.mjs, 390x844),
  // under the tap floor, with the one compensating reader turned off — from a
  // table edit that never fails a shape check, because each row's own shape is
  // fine (Law 1 clause 5: the failure a content edit can cause, not just the
  // rows it can malform). Ruled a REFUSAL, not a warning ("a warning that
  // boots is the fourth silent state") and not accept-in-writing.
  //
  // It binds the OFFERED set, not the default: offering 'overlap' at all puts
  // the sliver hand one legal settings write away, so the default being
  // 'paging' discharges nothing. Paging-only with ms 0 stays legal — the
  // strip needs no reader, and turning the gesture off is a tuning row this
  // check must not eat. The reader is resolved exactly as its consumer
  // resolves it (combat.js: `Number((ui.inspectHold || {}).ms) || 0`), so an
  // ABSENT inspectHold row is the same off position as ms: 0 and refuses too
  // — guarding on the entry would let deleting the entry silence the check
  // that watches it (the tapSize precedent below). A MALFORMED ms is not
  // handled here: it is already red by name in the inspectHold block above,
  // and a second error calling garbage "0" would misname the defect.
  // Corpus: tools/overlapreader.mjs — known-bads enter as content rows
  // through a real boot; observed red at b277ec2 before this block existed.
  if (b.balance && b.balance.ui) {
    const ui = b.balance.ui;
    const hp = ui.hudPresentation;
    if (!hp || typeof hp !== 'object' || Array.isArray(hp)) {
      err('balance.ui.hudPresentation', 'must be an object with shared HUD spacing, sizing, metadata, and mobile density tokens');
    } else {
      for (const [key, min, max] of [
        ['componentBackgroundOpacityPct', 0, 100],
        ['metadataFontPx', 8, 24],
        ['beltItemGapPx', 0, 12],
        ['portraitScale', 0.5, 1],
        ['primaryRowGapPx', 0, 24],
        ['controlGapPx', 0, 12],
        ['resourceRowGapPx', 0, 12],
        ['panelPadPx', 0, 12],
        ['mobilePanelPadPx', 0, 12],
        ['mobileControlGapPx', 0, 12],
        ['mobileOuterPadPx', 0, 12],
        ['mobileRowGapPx', 0, 12],
        ['cindersMaxWidthPct', 20, 40],
        ['metadataMaxWidthPct', 20, 40],
      ]) {
        const value = hp[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          err(`balance.ui.hudPresentation.${key}`, `must be a finite number in [${min}, ${max}] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof hp.metadataShowTotals !== 'boolean') {
        err('balance.ui.hudPresentation.metadataShowTotals', `must be boolean — got ${JSON.stringify(hp.metadataShowTotals)}`);
      }
    }
    const shrinePresentation = ui.shrinePresentation;
    if (!shrinePresentation || typeof shrinePresentation !== 'object' || Array.isArray(shrinePresentation)) {
      err('balance.ui.shrinePresentation', 'must be an object with optionLayout');
    } else if (!['list', 'grid'].includes(shrinePresentation.optionLayout)) {
      err('balance.ui.shrinePresentation.optionLayout', `must be 'list' or 'grid' — got ${JSON.stringify(shrinePresentation.optionLayout)}`);
    }
    const quickSettings = ui.hudQuickSettings;
    const quickPlaces = ['title', 'map', 'combat'];
    if (!quickSettings || typeof quickSettings !== 'object' || Array.isArray(quickSettings)) {
      err('balance.ui.hudQuickSettings', 'must be an object with places, spacing, visual sizing, background, and label settings');
    } else {
      if (!Array.isArray(quickSettings.places)
        || quickSettings.places.some((place) => !quickPlaces.includes(place))
        || new Set(quickSettings.places).size !== quickSettings.places.length) {
        err('balance.ui.hudQuickSettings.places', `must contain unique values from ${quickPlaces.join(', ')} — got ${JSON.stringify(quickSettings.places)}`);
      }
      for (const key of ['edgeGapPx', 'stackGapPx']) {
        const value = quickSettings[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 24) {
          err(`balance.ui.hudQuickSettings.${key}`, `must be a finite number in [0, 24] — got ${JSON.stringify(value)}`);
        }
      }
      for (const [key, min, max] of [
        ['cardSizePx', 32, 44],
        ['glyphSizePx', 16, 32],
        ['stateDotPx', 3, 12],
        ['activeTintPct', 0, 30],
      ]) {
        const value = quickSettings[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          err(`balance.ui.hudQuickSettings.${key}`, `must be a finite number in [${min}, ${max}] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof quickSettings.showCardBackground !== 'boolean') {
        err('balance.ui.hudQuickSettings.showCardBackground', `must be boolean — got ${JSON.stringify(quickSettings.showCardBackground)}`);
      }
      if (typeof quickSettings.showLabels !== 'boolean') {
        err('balance.ui.hudQuickSettings.showLabels', `must be boolean — got ${JSON.stringify(quickSettings.showLabels)}`);
      }
    }
    const combatantStage = ui.combatantStage;
    if (!combatantStage || typeof combatantStage !== 'object' || Array.isArray(combatantStage)) {
      err('balance.ui.combatantStage', 'must be an object with viewport clearances, intent gap, and center position');
    } else {
      for (const key of ['hudClearanceViewportPct', 'actionClearanceViewportPct']) {
        const value = combatantStage[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 25) {
          err(`balance.ui.combatantStage.${key}`, `must be a finite viewport percentage in [0, 25] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof combatantStage.intentGapPx !== 'number' || !Number.isFinite(combatantStage.intentGapPx)
        || combatantStage.intentGapPx < 0 || combatantStage.intentGapPx > 24) {
        err('balance.ui.combatantStage.intentGapPx', `must be a finite device-pixel gap in [0, 24] — got ${JSON.stringify(combatantStage.intentGapPx)}`);
      }
      if (typeof combatantStage.centerPct !== 'number' || !Number.isFinite(combatantStage.centerPct)
        || combatantStage.centerPct < 25 || combatantStage.centerPct > 75) {
        err('balance.ui.combatantStage.centerPct', `must be a finite center percentage in [25, 75] — got ${JSON.stringify(combatantStage.centerPct)}`);
      }
    }
    const tooltipPlacement = ui.tooltipPlacement;
    if (!tooltipPlacement || typeof tooltipPlacement !== 'object' || Array.isArray(tooltipPlacement)) {
      err('balance.ui.tooltipPlacement', 'must be an object with hover, fade, and safe-placement tokens');
    } else {
      for (const [key, min, max] of [
        ['hoverDelayMs', 0, 600000],
        ['autoFadeMs', 0, 600000],
        ['topBandViewportPct', 0, 50],
        ['sideBandViewportPct', 0, 50],
      ]) {
        const value = tooltipPlacement[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          err(`balance.ui.tooltipPlacement.${key}`, `must be a finite number in [${min}, ${max}] — got ${JSON.stringify(value)}`);
        }
      }
    }
    const offersOverlap = Array.isArray(ui.handLayoutModes) && ui.handLayoutModes.includes('overlap');
    const ih = ui.inspectHold;
    const wellFormedMs = ih != null && typeof ih === 'object' && !Array.isArray(ih)
      && typeof ih.ms === 'number' && Number.isFinite(ih.ms) && ih.ms >= 0;
    const readerOff = ih == null ? true : (wellFormedMs && ih.ms === 0);
    if (offersOverlap && readerOff) {
      const floor = ui.tapSize && typeof ui.tapSize.def === 'number' ? `the ${ui.tapSize.def} px tap floor` : 'the tap floor (balance.ui.tapSize.def)';
      err('balance.ui.handLayoutModes + balance.ui.inspectHold.ms',
        `'overlap' is offered while the inspect hold is off (${ih == null ? 'the inspectHold row is ABSENT, which the hand resolves to ms 0' : 'ms: 0'}) — refused. `
        + `Overlap flattens a full hand into ~27-30 px exposed slivers, under ${floor}, and hold-to-inspect is the one reader that makes a sliver legible; ms 0 turns that reader off. `
        + `These two entries conflict: drop 'overlap' from balance.ui.handLayoutModes, or give balance.ui.inspectHold.ms a non-zero hold. `
        + `Paging-only with ms 0 stays legal — the strip needs no reader.`);
    }
  }
}
