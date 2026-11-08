// src/ui/bootArtFlow.js — the boot-art flow src/main.js used to own: the
// settle/wait state (afterBootArt, holdTitleFor), the title's art-load notice
// (with its Retry) and the boot wiring that starts the load (code review H4,
// seam e). src/ui/bootArt.js keeps the critical set, the phase and the gate's
// line; this module is what main.js calls around them. No import-time side
// effects: createBootArtFlow() subscribes to Retry progress, once, where
// main.js used to.

import { builtInArtArrived, ART_REDRAW_EVENT } from './highResArt.js';
import { whenBuiltInArtReady, builtInArtStatus, builtInArtSettled } from './assetPacks.js';
import { onTierArrived, requestedTier, retryBuiltInArt, onRetryProgress } from './artTier.js';
import { startBootArt, bootArtRetried } from './bootArt.js';
import { builtInSource } from './assetmap.js';
import { mountArtLoadNotice } from './components/artLoadNotice.js';
import { artLoadNoticeModel } from './models/ArtLoadNoticeModel.js';
import { whenNoOverlay } from './whenNoOverlay.js';
import { restoreArtPlaceholders } from './artFallback.js';

/**
 * createBootArtFlow({ app, getActiveSettings, showTitle }) → { afterBootArt,
 * holdTitleFor, drawArtNotice, artArrivedAfterFailure, start }.
 * getActiveSettings reads main.js's `activeSettings` (a reassigned let) when
 * used; showTitle is main.js's. start({ gateFirst, bootMusic, dropBootLine,
 * showFirstScreen }) is the boot wiring main.js ran at its bottom.
 */
export function createBootArtFlow({ app, getActiveSettings, showTitle }) {
  // ---- THE BUILT-IN ART, AS THE PLAYER SEES IT (docs/EXTERNAL-ASSETS-PLAN.md
  // step 5). A pack build (the web edition) loads its art behind the startup
  // gate. Until the load has SETTLED no screen but the gate is drawn, because a
  // screen drawn on placeholders cannot be re-pointed (step 3a); once it has,
  // afterBootArt runs what waited (the title, after a press). When the load
  // failed, the title carries a non-blocking notice with Retry; a Retry that
  // loads redraws the title on the new art. A single file and the source tree
  // settle at once and never show either.
  let bootArtSettledNow = false;
  const bootArtWaiters = [];
  // Anything else the title waits for once the gate is up (the debug profile
  // auto-load, below), so the gate need not wait for it before it is drawn.
  const titleHolds = [];
  function holdTitleFor(promise) { titleHolds.push(Promise.resolve(promise).catch(() => {})); }
  function afterBootArt(fn) {
    const go = () => (titleHolds.length ? Promise.all(titleHolds).then(fn) : fn());
    if (bootArtSettledNow) go();
    else bootArtWaiters.push(go);
  }
  // null (no notice), 'failed', 'retrying' or 'again' (a Retry failed too).
  let artNoticeState = null;
  function drawArtNotice(root) {
    if (!artNoticeState) { root.querySelector('.art-load-notice')?.remove(); return; }
    mountArtLoadNotice(root, { model: artLoadNoticeModel({ state: artNoticeState }), onRetry: retryArtFromTitle });
  }
  function refreshArtNotice() {
    const root = app.querySelector('.title-screen');
    if (root) drawArtNotice(root);
  }
  function retryArtFromTitle() {
    if (artNoticeState === 'retrying' || !artNoticeState) return;
    retryBuiltInArt(getActiveSettings());
  }
  // The notice follows every Retry, from the title or from Settings: busy while
  // it runs; then gone (onTierArrived), "still could not be loaded", or, for a
  // Retry the player replaced with a tier switch (null), what it said before.
  let artNoticeBefore = null;
  onRetryProgress(({ phase, result }) => {
    if (phase === 'start') {
      if (!artNoticeState || artNoticeState === 'retrying') return;
      artNoticeBefore = artNoticeState;
      artNoticeState = 'retrying';
      refreshArtNotice();
      return;
    }
    if (artNoticeState !== 'retrying') return; // loaded: artArrivedAfterFailure cleared it
    if (result?.state === 'loaded' || builtInArtStatus().state === 'loaded') return;
    artNoticeState = result ? 'again' : (artNoticeBefore || 'failed');
    if (result) bootArtRetried(result);
    refreshArtNotice();
  });
  // A load arrived after the boot load failed (a Retry from the title or from
  // Settings → Art quality, or a tier switch): the notice goes, and the title,
  // when it is on screen, is drawn again on the new art — once nothing is open
  // over it (Settings, the Load/New door), so the control a dialog returns focus
  // to is not replaced under it; the focused title control keeps the focus.
  let cancelTitleRedraw = () => {};
  function artArrivedAfterFailure() {
    if (!artNoticeState) return;
    artNoticeState = null;
    bootArtRetried(builtInArtStatus());
    // Read before the notice goes: a Retry pressed on it hands focus to the menu.
    const fromNotice = !!document.activeElement?.closest?.('.art-load-notice');
    refreshArtNotice();
    cancelTitleRedraw();
    cancelTitleRedraw = whenNoOverlay(() => {
      // Every art placeholder on the page (an enemy's, a portrait's, a glyph
      // that stood in for an item) is put back, whatever screen it is on
      // (src/ui/artFallback.js; review of #1471).
      restoreArtPlaceholders(document);
      const root = app.querySelector('.title-screen');
      // Any other screen (a Retry from the in-run Settings): it redraws its own
      // art from its own state (combat's enemy placeholders), keeping the rest.
      if (!root) { try { document.dispatchEvent(new CustomEvent(ART_REDRAW_EVENT)); } catch { /* no document */ } return; }
      const active = document.activeElement;
      const action = root.contains(active) ? active.closest?.('[data-title-action]')?.dataset.titleAction : null;
      const onNotice = fromNotice && !action;
      showTitle({ skipStartup: true, focusDefault: onNotice, focusCursor: onNotice });
      if (action) app.querySelector(`.title-screen [data-title-action="${action}"]`)?.focus({ preventScroll: true });
    });
  }

  // The boot wiring (main.js, after the first screen is defined).
  function start({ gateFirst, bootMusic, dropBootLine, showFirstScreen }) {
    // A tier switch (or a Retry) re-points the images on screen and, when the boot
    // load had failed, lets the shipped score be read through the new source and
    // takes the title's notice away.
    onTierArrived((map) => { builtInArtArrived(map); bootMusic.sourceArrived(); artArrivedAfterFailure(); });
    whenBuiltInArtReady(() => {
      bootArtSettledNow = true;
      if (builtInArtStatus().state === 'failed') artNoticeState = 'failed';
      // The music folder is applied once the load has settled (the shipped score
      // resolves through the index); the gate-first boot drew its screen already.
      bootMusic.firstScreen(() => { dropBootLine(); if (!gateFirst) showFirstScreen(); });
      for (const fn of bootArtWaiters.splice(0)) fn();
    }, { onSource: builtInArtArrived, tier: requestedTier(getActiveSettings()) });
    if (gateFirst) {
      startBootArt({ settled: builtInArtSettled(), source: builtInSource });
      showFirstScreen();
    }
  }

  return { afterBootArt, holdTitleFor, drawArtNotice, artArrivedAfterFailure, start };
}
