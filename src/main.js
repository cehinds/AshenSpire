import { persistRewardChange as transactReward } from './model/rewardTransaction.js';
import { t } from './ui/strings.js';
import { gameProfileRewardOffers, GameProfileEliteRelicOffer, claimGameProfileReward, claimGameProfileRewardToDeck, rewardDeckAddRefusal, rewardInstanceId, gameProfileShopStock, purchaseGameProfileShopOffer, addPurchasedCardToDeck, shopCardDeckRefusal } from './model/gameProfileRewards.js';
import { mountGameProfileOffers } from './ui/components/gameProfileOffers.js';
import { VictorySpoils } from './ui/components/victorySpoils.js';
import { mountGameProfileLevelUp } from './ui/components/gameProfileLevelUp.js';
import { showRunReceipt } from './ui/components/whatChangedModal.js';
import { snapshotRunForDiff } from './model/runChangeReceipt.js';
import { configuredSkillProgression, configuredCharacterLevels, skillLevelNotices, acknowledgeSkillLevelNotices, acknowledgeVictoryReceipt, silenceVictoryLevelNotices, configuredCharacterXpMultiplier } from './model/gameProfileProgression.js';
import { announceSettingsSettled } from './ui/components/veil.js';
import { profileStarterCount } from './ui/models/GameProfileTitleModel.js';
import { readNewGameProfile } from './ui/components/gameProfileSelector.js';
import { beginGameProfileRest, createGameProfileRestDraft, commitGameProfileRest } from './model/gameProfileRest.js';
import { retiredProfileReason } from './model/retiredProfile.js';
import { resolveGameProfile, gameModule, gameContent, applyGameProfileToContent, bindGameProfileRegistries } from './model/gameProfile.js';
import { isConfiguredRun, gameProfileClassAvailable } from './model/gameProfileRun.js';
import { openRestRecord, recordRestConsumed, markRestLeft, restRevisitNodeId, clearRestRevisitOnTravel } from './model/restRevisit.js';
import { completedRunMeta, commitRunFinishAsync } from './model/runCompletion.js';
import { configureDisplaySettings, installDisplaySettings, installCardSizeResize, projectHudPresentation, applyDisplaySettings, applyUiScale } from './ui/displaySettings.js';
import { onArtSourceChange, builtInArtArrived, ART_REDRAW_EVENT } from './ui/highResArt.js';
import { whenBuiltInArtReady, musicHold, bootLine, packsPinned, builtInArtStatus, builtInArtSettled } from './ui/assetPacks.js';
import { onTierArrived, requestedTier, retryBuiltInArt, onRetryProgress } from './ui/artTier.js';
import { startBootArt, bootArtLine, bootArtRetried } from './ui/bootArt.js';
import { builtInSource } from './ui/assetmap.js';
import { mountArtLoadNotice } from './ui/components/artLoadNotice.js';
import { artLoadNoticeModel } from './ui/models/ArtLoadNoticeModel.js';
import { mountBootArtStatus } from './ui/components/bootArtStatus.js';
import { bootArtStatusModel } from './ui/models/BootArtStatusModel.js';
import { whenNoOverlay } from './ui/whenNoOverlay.js';
import { restoreArtPlaceholders } from './ui/artFallback.js';
import { resolveLocationPresentation } from './model/locationPresentation.js';
import { quickStartRunConfig } from './model/characterCreation.js';
import { mountDialogue } from './ui/screens/dialogue.js';
import { openShopCardChoice, openShopArmamentChoice } from './ui/components/shopBuyChoice.js';
// src/main.js — boot + run orchestrator (SPEC §7.1)
//
// M2 flow: Title → class select → act map → [combat | shrine | shop | event |
// treasure] → … → boss → game over. One rng is created from the seed and its
// stream counters are saved with the run after every committed choice, so a
// whole run is reproducible from its seed string. Explicit combat saves carry
// an exact committed-turn snapshot; the node-entry receipt remains the
// backward-compatible recovery path for older saves and interrupted sessions.

import { contentBundle } from './content/index.js';
import { validateContent } from './model/validate.js';
import { createRegistries } from './model/registries.js';
import { isPoolDeckMode } from './model/cardRemoval.js';
import { advancedConfigSnapshot, coreAdvancedConfigSnapshot, advancedConfigStructuralProblems, bringRunSnapshotForward, configuredContentBundle } from './model/advancedConfig.js';
import { configureTooltipGlossary } from './ui/components/tooltipGlossary.js';
import { characterLevelOf } from './model/state.js';
import { stampDeck, carriedIds } from './model/loadout.js';
import { grantSmithingReward, smithingRewardId } from './model/smithing.js';
import { applyNodeRefill, refillFlasksAtActChange } from './model/nodeRefill.js';
import { smithServicesAt } from './model/cardExtraction.js';
import { recordArmamentDiscovery } from './model/startingKits.js';
import { isCustomRun } from './model/customRun.js';
import { createRng, seedToString, seedFromString, seedProblem } from './engine/rng.js';
import { createRunCombat, runCombatEnd } from './engine/runCombat.js';
import { stampCombatPlaysEver, foldCombatPlaysEver } from './model/playsEver.js';
import { applyAfterCombatRecovery, restRecoveryBonus } from './model/recoveryRules.js';
import { skillXpReceipt, applySkillXp, settleConfiguredSkillProgression } from './engine/skillXp.js';
import { pendingRankUpRows, coreCardRanks, stampSkillBonuses } from './model/skills.js';
import { awardClassXp } from './model/classTree.js';
import { runClassIdentity } from './model/classCard.js';
import { peakClassLevel } from './model/classSwap.js';
import { allocateAttributePoint, awardLevelXp, combatXpReceipt } from './model/levelup.js';
import { combatXpGains } from './model/rewardprogress.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from './engine/combatSnapshot.js';
import { commitExpansionCandidate } from './engine/combatExpansionSave.js';
import { buildActMap, bossEncounterForNode } from './engine/actmap.js';
import { seatAtTier, seatTierHpMult, bossTierScale } from './model/seats.js';
import { createSaveManager, createMemoryStorage, META_KEY, META_BACKUP_KEY, isStorageFullError } from './engine/save.js';
import { createBrowserSaveManager } from './engine/browserSave.js';
import { createRunStartOwner } from './model/runStart.js';
import { CreateSaveTransfer } from './engine/saveTransfer.js';
import { LoadSavedRunContext } from './engine/savedRunContext.js';
import { CreateEntryCheckpoint } from './services/entryCheckpoint.js';
import { CreateProfileBoot } from './services/profileBoot.js';
import { CreatePreparedRun } from './services/runBirth.js';
import { CreateRunPersistence } from './services/runPersistence.js';
import { openOfflinePlay } from './ui/components/offlinePlay.js';
import { modalOpen, onModalsClosed } from './ui/modalState.js';
import { rollEncounter, rollRuneReward } from './engine/encounters.js';
import { configuredShopKind } from './model/gameProfileShopKind.js';
import { commitGameProfileShopSale } from './model/gameProfileShopSales.js';
import { blacksmithVisitStock } from './engine/shopKinds.js';
import { mountBlacksmith } from './ui/screens/blacksmith.js';
import { shopStockKind } from './model/shopKinds.js';
import { MAX_ENEMIES_PER_COMBAT } from './model/combatLimits.js';
import { createLocationVisit, arriveAt, leaveLocation } from './engine/locations.js';
import { CAMP_LOCATION } from './model/locations.js';
import { mountTitle, focusTitleDefault } from './ui/screens/title.js';
import { refreshHudQuickSettings } from './ui/components/hudQuickSettings.js';
import { mountProfileNotice } from './ui/screens/profileNotice.js';
import { openProfileArchive } from './ui/screens/profileArchive.js';
import { mountCustomize } from './ui/screens/customize.js';
import { mountDraft } from './ui/screens/draft.js';
import { executeRunEffects, drawCards, discardFromHand, executeAction } from './engine/actions.js';
import { mountMap } from './ui/screens/map.js';
import { mountCombat } from './ui/screens/combat.js';
import { mountRewards } from './ui/screens/reward.js';
import { mountRest } from './ui/screens/rest.js';
import { commitDeckEditDraft, deckEditBounds, deckEditingOn } from './model/deckRules.js';
import { mountDeckEditor } from './ui/screens/deckEditor.js';
import { deckEditorDoors } from './ui/models/DeckEditorModel.js';
import { armouryHasNew, armouryOpensDeckEditor, RestOpensDeckEditor, editingLocked, markArmourySeen } from './model/armouryRules.js';
import { armouryRoute } from './model/armouryPages.js';
import { mountConfiguredShop } from './ui/screens/shop.js';
import { mountEvent } from './ui/screens/event.js';
import { mountGameOver } from './ui/screens/gameover.js';
import { victoryBeat } from './ui/components/victoryBeat.js';
import { mountHistory } from './ui/screens/history.js';
import { mountCompendium } from './ui/screens/compendium.js';
import { mountBestiary } from './ui/screens/bestiary.js';
import { autoLoadProfile, autoLoadEnabled } from './ui/components/settingsSync.js';
import { seedAfterChange, SEED_KEY, needsSettingsChoice, keepLocalSettings, commitSettingsChoiceAsync } from './model/settingsDefaults.js';
import { BUILD_VERSION } from './buildversion.js';
import { openSettingsDefaultsChoice } from './ui/components/settingsDefaultsChoice.js';
import { SETTINGS_DEFAULTS } from './content/settingsDefaults.js';
import { pageDebug, promotionDebug } from './ui/buildChannel.js';
import { openCharacterSheet } from './ui/screens/characterSheet.js';
import { openSettings, dropUndoOffer, settingsRows, promotionFor, settingOn, resetKeys, allResettableKeys, showSettingsNotice, resolveGraceRefill, resolveLevelUpValue, fullscreenCapability, isFullscreen, toggleFullscreen, musicEnabledCondition } from './ui/screens/settings.js';
import { mountPrologue } from './ui/screens/prologue.js';
import { shouldPlayPrologue, runSupportsPrologue, pendingPrologueScene, migratePrologueState, PROLOGUE_STATE_VERSION } from './model/prologue.js';
import { mountEquipment, resetArmouryTraySession } from './ui/screens/equipment.js';
import { openOverlay, closeOverlay } from './ui/components/overlay.js';
import { showBossIntro } from './ui/components/intro.js';
import { openConfirmationModal } from './ui/components/confirmationModal.js';
import { runIdentity } from './ui/models/ConfirmationReviewModel.js';
import { openNewerSaveNotice, openRefusedSaveNotice, openReplaceSaveReview, openSaveSlotSelector, openSaveStatusReview, slotFacts } from './ui/components/saveSlotSelector.js';
import { loadOverRunReview } from './ui/models/ConfirmationReviewModel.js';
import { initInput, setBindings, setKeyBindings, setInputGate, hasGamepad } from './ui/input.js';
import { mountStartupGate } from './ui/components/startupGate.js';
import { startupGateModel } from './ui/models/StartupGateModels.js';
import { selectionGlowFilter } from './ui/models/SelectionEffectModel.js';
import { inspectControlCss } from './ui/models/InspectControlModel.js';
import { cardLevelCssProperties, cardShapeCssProperties, cardShelfCssProperties } from './ui/models/CardSizeModel.js';
import { classGlyph, setClassGlyphs } from './ui/assets.js';
import { mountQuitScreen } from './ui/quitGame.js';
import { anchorLocalBox, clampBox, floatNum as fxFloatNum, playEventCues } from './ui/fx.js';
import { sfx } from './ui/sfx.js';
import { initAudio, resolveMusicEnabled } from './ui/audio.js';
import { createHaptics, haptic } from './ui/haptics.js';
import { mapMusicContext } from './content/music.js';
import { regionForRun } from './model/environmentArt.js';
import { migrateEffectsSetting } from './ui/performance.js';
import { clearPosePreloads } from './ui/services/posePreloads.js';
import { installHoldBeat } from './ui/components/holdbeat.js';
import { surfaceReport } from './ui/surfaces.js';
// failureBanner is the ONE home for "the game says something is structurally
// wrong" — the two boot checks below used to build that element by hand, and a
// third hand-built copy is the defect this import exists to prevent.
import { dlog, failureBanner } from './ui/debuglog.js';
// The command log's chrome, on the kit (debuglog.js is a leaf; see debugChrome.js).
import { DEBUG_CHROME_READY } from './ui/components/debugChrome.js';
import { createContentValidationCache } from './model/contentValidationCache.js';
void DEBUG_CHROME_READY;

const app = document.getElementById('app');

// ---- content validation at boot (SPEC §3.14) — loud, on-screen -------------
// BOOT VALIDATES THE CONTENT IT PLAYS, ONCE, behind the boot splash: the first
// rebuildRegistries below checks the configured content (class mastery
// included) before the startup gate. The raw bundle is not validated a second
// time here; it is what the configured content is projected from, and CI's
// validateContent runs check it whole. Deferring the check to idle time moved a
// second of script onto the gate and title, where players (and the startup-gate
// probe) tap.
function reportContentValidationFailure(errors) {
  // The header said 34 and the list showed 12 and nothing said the list was cut
  // (#67, Sunna's D19). A tuning pass that sweeps one field wrong makes exactly
  // that shape: fix twelve, reload, get a fresh twelve, and never learn how
  // deep the hole goes or that the console has the rest. Same family as the
  // silent no-op — a number promising more than the screen shows. The
  // truncation is fine; hiding it was not.
  const shown = errors.slice(0, 12);
  const hidden = errors.length - shown.length;
  // Wording unchanged; the ELEMENT is no longer built here. failureBanner() is
  // the one home for "the game says something is structurally wrong", and this
  // banner now carries the Command log door the uncaught-error one does.
  failureBanner(
    'boot:content',
    `CONTENT VALIDATION FAILED (${errors.length} errors)`,
    shown.map((e) => ` · ${e.path}: ${e.msg}`).join('\n') +
      (hidden > 0 ? `\n · …and ${hidden} more — all ${errors.length} are in the browser console.` : '')
  );
  console.error('Content validation errors:', errors);
}

// ---- navigable surfaces: declared, and handled (#78) -----------------------
// The same shape as the block above and for the same reason. A surface declared
// in data with no handler used to render something PLAUSIBLE — a hybrid layout,
// an empty panel, a lone heading — so it never reached a banner or a console.
//
// It does NOT throw here, deliberately. `assertSurfaces()` throws for the suite
// and for tools/surfaces.mjs, where a hard exit is the point; on the boot path a
// throw is the blank screen #77 was about, and a blank screen is a worse failure
// than the one being reported. Banner, name, console — then the game runs.
{
  const missing = surfaceReport().filter((r) => r.missing.length);
  if (missing.length) {
    failureBanner(
      'boot:surfaces',
      'NAVIGABLE SURFACE DECLARED WITH NO HANDLER',
      missing.flatMap((r) => r.missing.map((m) => ` · ${r.id}${m.member ? ` · ${m.member}` : ''}`
        + ` ${m.why} — ${m.fix}`)).join('\n')
    );
    console.error('[surfaces]', missing);
  }
}

const profileQuery = new URLSearchParams(location.search);
const askedGameProfile = profileQuery.get('gameProfile') || profileQuery.get('wb.gameProfile') || globalThis.__ASHEN_GAME_PROFILE_PREVIEW__ || 'default';
// An unknown, malformed or retired ?gameProfile= falls back to the default profile; it never stops boot.
function resolveAskedGameProfile() {
  try {
    const asked = resolveGameProfile(askedGameProfile.trim().startsWith('{') ? JSON.parse(askedGameProfile) : askedGameProfile);
    const reason = retiredProfileReason(asked);
    if (!reason) return asked;
    console.warn(`[gameProfile] "${askedGameProfile.slice(0, 40)}" is retired (${reason}); using the default profile`);
  } catch (error) {
    console.warn(`[gameProfile] "${askedGameProfile.slice(0, 40)}" could not be resolved (${error.message}); using the default profile`);
  }
  return resolveGameProfile('default');
}
let selectedGameProfile = resolveAskedGameProfile();
let registryGameProfile = selectedGameProfile;
// The first rebuild below owns construction after saved profile/settings and
// promoted defaults have settled. It also installs that registry's vocabulary
// and class glyphs; an earlier provisional build has no screen to serve.
let registries;
let xpCombat = null;

const cachedContentValidation = createContentValidationCache((gameProfile, configuration, configured) => {
  const result = validateContent(configured);
  const structuralProblems = isConfiguredRun(gameProfile) ? [] : advancedConfigStructuralProblems(contentBundle, configuration?.overrides || configuration);
  return { result, structuralProblems };
});

// The last VALID build (before any per-run mastery overlay). The same profile and
// the same settings build the same registries, so a repeat rebuild (the title
// screen rebuilds on every arrival) returns it. A legacy build keys on the WHOLE
// settings object, so no setting that shapes content can be missed. A configured
// (Core 2) build is made from its profile alone, so it keys on the profile hash
// and the opening and presentation settings only: an unrelated setting (a stored
// legacy key, a volume) no longer rebuilds it. An unserialisable key never hits.
let lastRegistryBuild = null;
const CONFIGURED_KEY_PREFIXES = ['gameConfig.prologue.', 'gameConfig.presentation.'];
function registryBuildKey(configuration, gameProfile) {
  try {
    if (!isConfiguredRun(gameProfile)) return JSON.stringify(configuration ?? {});
    const entries = [...Object.entries(configuration ?? {}), ...Object.entries(configuration?.overrides ?? {})]
      .filter(([key]) => CONFIGURED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return JSON.stringify([gameProfile?.hash ?? gameProfile?.id ?? null, entries]);
  } catch { return null; }
}
function sameRegistryProfile(a, b) {
  return a === b || (typeof a?.hash === 'string' && a.hash === b?.hash);
}

function rebuildRegistries(configuration = {}, gameProfile = registryGameProfile) {
  registryGameProfile = gameProfile;
  const buildKey = registryBuildKey(configuration, gameProfile);
  if (buildKey !== null && lastRegistryBuild && lastRegistryBuild.key === buildKey && sameRegistryProfile(lastRegistryBuild.profile, gameProfile)) {
    registries = lastRegistryBuild.registries;
    configureTooltipGlossary(registries);
    setClassGlyphs(registries.classes.all());
    return registries;
  }
  const authored = applyGameProfileToContent(contentBundle, gameProfile);
  const configured = isConfiguredRun(gameProfile) ? authored : configuredContentBundle(authored, configuration);
  const { result, structuralProblems } = cachedContentValidation(gameProfile, configuration, configured);
  if (!result.ok || structuralProblems.length) {
    const first = structuralProblems[0] || `${result.errors[0].path}: ${result.errors[0].msg}`;
    const message = `Game configuration unchanged: ${first} Authored defaults remain active until the values form a valid configuration.`;
    console.warn('[advanced-config]', message, result.errors, structuralProblems);
    if (typeof document !== 'undefined') showSettingsNotice(message, 'game-config');
    if (isConfiguredRun(gameProfile)) {
      if (result.errors.length) reportContentValidationFailure(result.errors);
      throw new Error(`Invalid game profile ${gameProfile.id}: ${first}`);
    }
    // The fallback is the authored bundle itself: if that is what failed (no
    // user settings to blame), say so as loudly as boot always has.
    const authoredCheck = validateContent(contentBundle);
    if (!authoredCheck.ok) reportContentValidationFailure(authoredCheck.errors);
    registries = createRegistries(contentBundle);
  } else {
    registries = createRegistries(configured);
  }
  registries = bindGameProfileRegistries(registries, gameProfile);
  lastRegistryBuild = (result.ok && !structuralProblems.length && buildKey !== null) ? { key: buildKey, profile: gameProfile, registries } : null;
  configureTooltipGlossary(registries);
  setClassGlyphs(registries.classes.all());
  return registries;
}

// Dev screenshot hook (?shot=…). Read HERE, above pickStorage(), because storage
// selection depends on it; the hook that consumes it lives at the bottom of this
// file where the states are listed. One read, one home — parsing the query string
// twice would be the same fact in two places.
//
// ONE `URLSearchParams` construction in this file, deliberately, and every fact
// derives from it (`shot`, `shotSettings`). That collapse is Rune's and it is the
// thing that makes the gate below reach every state; keep the count at one.
const shotParams = new URLSearchParams(location.search);
const shotState = shotParams.get('shot');
// The dev-only photograph modules load lazily, and only for a ?shot= boot: a
// normal boot never fetches or evaluates them. Each path is a literal so the
// bundler can see it. Both are awaited before the first posed screen.
const devModules = shotState ? Promise.all([
  import('./dev/shotStates.js'),
  import('./dev/armamentKitPreview.js'),
]) : null;
let devKit = null;
// ?shotMaxPoise's parked value (see the shot=combat block): module-scoped so it
// reaches enterCombat without touching the run — a shot lever must not leak
// into a save. Null means "no override; derive from the loadout receipt".
let shotPoiseMaxOverride = null;
const shotEvidence = shotParams.get('shotEvidence');
if (shotEvidence) document.documentElement.dataset.shotEvidence = shotEvidence;
if (shotParams.get('shotArcane') === 'matrix') document.documentElement.dataset.shotArcane = 'matrix';

function pickStorage() {
  // A ?shot= boot NEVER touches durable storage. It used to: the hook wrote
  // settings.seenTutorial into sote_meta_v1, and then newRun({ slot: 1 }) →
  // startClimb() → persist() → saveRun(run, rng, 1) clobbered sote_run_v1. So a
  // URL meant only for tools/screenshot.mjs destroyed a player's in-progress run
  // — and it shipped in dist/, reachable by anyone who typed it.
  //
  // The gate is the storage SEAM, not a guard at each write, because there are
  // two writes today and the third one would not know to ask. Memory storage is
  // the module's own documented stub (engine/save.js), and the shot states are
  // ephemeral showcases that never wanted persistence — so this removes a
  // capability rather than adding a branch. tools/screenshot.mjs is unchanged.
  if (shotState) return createMemoryStorage();
  try {
    window.localStorage.setItem('sote_probe', '1');
    window.localStorage.removeItem('sote_probe');
    return window.localStorage;
  } catch (e) {
    return createMemoryStorage(); // e.g. blocked third-party storage
  }
}
const bootStorage = pickStorage();
// `?shot=crisis` — THE WORST MORNING, POSED BY THE DOOR IT ARRIVES BY. The
// profile-notice screen mounts only when profileStatus().ok is false, and no
// in-game act can make that true: corruption enters as bytes in storage, so
// that is where the pose enters. A REAL profile is written by the real writer
// (ensureProfile → saveMetaInternal, verify-then-rotate), then torn mid-write
// the way a killed tab tears one, and the mirror is removed — the player whose
// profile predates the backup, which is exactly who the corrupt state exists
// for. Everything downstream of this line — readMetaFrom's parse, archiveMeta,
// the quarantine, the screen — is the shipped path, untouched. Inside Rune's
// gate by construction: shotState is truthy, so this storage is the memory
// stub and no durable byte is ever involved.
if (shotState === 'crisis') {
  createSaveManager(bootStorage).ensureProfile();
  bootStorage.setItem(META_KEY, String(bootStorage.getItem(META_KEY)).slice(0, 24));
  bootStorage.removeItem(META_BACKUP_KEY);
}
// The cross-tab profile lock guards a storage other tabs share. Memory storage
// (blocked browser storage, e.g. the sandboxed branch preview, whose frame
// also refuses the Web Locks API) belongs to this tab alone, so it needs none:
// asking would make every run start fail.
let persistentStorage = false;
try { persistentStorage = bootStorage === window.localStorage; } catch { /* blocked browser storage */ }
const saves = shotState ? createSaveManager(bootStorage) : createBrowserSaveManager(bootStorage, { locks: persistentStorage ? navigator.locks : null });

// `?shotSettings=<json>` — display settings for a ?shot= boot, written into the
// EPHEMERAL store above. Read only when shotState is truthy, so a normal boot
// cannot reach this at all, and it writes through the memory stub, so Rune's gate
// is untouched and there is still no durable write. The gate line itself is
// deliberately not modified: tools/shotguard-probe.mjs --mutate matches it
// byte-for-byte and REFUSES to run if it has changed.
//
// WHY THIS EXISTS. A ?shot= boot has no durable settings by construction, so
// sote_meta_v1 is never read and every display setting resolves to its default.
// Correct for the gate — and it silently broke my own instrument.
// tools/contrast-audit.mjs seeded each profile into localStorage and then
// measured nine profiles rendering identically on every ?shot= screen, reporting
// `hi-contrast-off` map Act/Floor at 6.33 where the truth is 3.74: a PASS
// standing in for an AA failure, in the direction that flatters the change.
// Vira caught it reviewing #10 and made it a merge condition; the invariant she
// wrote is "the profile reported is the profile rendered."
//
// The settings go through saves.loadMeta() like any other boot, so what gets
// measured is the app's OWN resolution — settingOn(), resolveZoom(),
// applyDisplaySettings() — and never the instrument's copy of those rules. That
// is the whole reason this is a URL parameter rather than the audit reaching in
// and setting `body.hi-contrast` itself, which would have been three lines and
// would have measured my own mock.
if (shotState) {
  const raw = shotParams.get('shotSettings');
  if (raw) {
    try {
      const incoming = JSON.parse(raw);
      if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
        const meta = saves.loadMeta();
        saves.saveMeta({ ...meta, settings: { ...(meta.settings || {}), ...incoming } });
      } else {
        console.warn('?shotSettings ignored: not a JSON object');
      }
    } catch (e) {
      // Loud but harmless: a malformed value must not take the boot down, and it
      // must not silently look like "the defaults were what you asked for."
      console.warn('?shotSettings ignored (not JSON):', e && e.message);
    }
  }
}

// Stored settings are migrated before profile selection and registry construction.
const {
  BringStoredProfileForward: bringStoredProfileForward,
  SeedPromotedDefaults: seedPromotedDefaults,
  DropRetiredStoredSettings: dropRetiredStoredSettings,
} = CreateProfileBoot({
  contentBundle,
  saveMeta: meta => saves.saveMeta(meta),
  warn: line => console.warn('[advanced-config]', line),
  getPromotion: () => promotionFor(SETTINGS_DEFAULTS, promotionDebug()),
});
let activeMeta = saves.loadMeta();
let activeSettings = bringStoredProfileForward(activeMeta);
// Rendering quality folded into Effects: a saved explicit Full becomes Effects on, once.
if (migrateEffectsSetting(activeSettings)) { activeMeta.settings = activeSettings; saves.saveMeta(activeMeta); }
// Explicit preview URLs remain reproducible; otherwise use the saved rules for future runs.
if (!profileQuery.has('gameProfile') && !profileQuery.has('wb.gameProfile') && !globalThis.__ASHEN_GAME_PROFILE_PREVIEW__) {
  selectedGameProfile = readNewGameProfile(activeSettings, selectedGameProfile);
}
dropRetiredStoredSettings(activeMeta, activeSettings);
let settingsChoicePending = !shotState && saves.profileStatus().ok
  && needsSettingsChoice(activeMeta, BUILD_VERSION, settingsRows(), promotionFor(SETTINGS_DEFAULTS, promotionDebug()).values);
// A device with preferences gets its choice before a new promotion moves them.
if (!settingsChoicePending) {
  seedPromotedDefaults(activeMeta, activeSettings);
}
let settingsChoiceChecked = !!shotState;
// Build (and validate) the profile a new game will play, the one showTitle
// rebuilds with: a saved newGameProfile must not cost a second validation there.
rebuildRegistries(activeSettings, selectedGameProfile);
const audio = initAudio(activeSettings);
// Route existing sound cues through the procedural audio engine.
sfx.sink = (id) => audio.sfx(id);
// Haptics have their own seam (ui/haptics.js), played by the call sites that
// mean card play, damage taken and turn start; a moment with a pattern in
// content/haptics.js vibrates unless Settings → Audio → Haptics is off (read
// live, per cue). Not fed from sfx ids: equipment swaps share the card sound.
haptic.sink = createHaptics({ getSettings: () => activeSettings });

// Keyboard + gamepad navigation (SPEC §7.3). Bindings live in meta.settings.
initInput({ getSettings: () => activeSettings });

// All presentation config is data (content/balance.js → balance.ui): accent
// palettes, UI zoom scale, text sizes. Code never embeds these numbers.
const UI = registries.balance.ui;
const hudMaxViewportPct = Number(UI.hudBars?.main?.maxViewportPct);
if (!Number.isFinite(hudMaxViewportPct) || hudMaxViewportPct <= 0 || hudMaxViewportPct > 100) {
  throw new Error(`balance.ui.hudBars.main.maxViewportPct must be in (0, 100], got ${JSON.stringify(UI.hudBars?.main?.maxViewportPct)}`);
}
document.documentElement.style.setProperty('--hud-resource-max-vw', `${hudMaxViewportPct}vw`);
const hudAvailableWidthPct = Number(UI.hudBars?.main?.availableWidthPct);
if (!Number.isFinite(hudAvailableWidthPct) || hudAvailableWidthPct < 80 || hudAvailableWidthPct > 85) {
  throw new Error(`balance.ui.hudBars.main.availableWidthPct must be in [80, 85], got ${JSON.stringify(UI.hudBars?.main?.availableWidthPct)}`);
}
document.documentElement.style.setProperty('--hud-resource-available-pct', `${hudAvailableWidthPct}%`);
document.documentElement.style.setProperty('--hud-resource-available-vw', `${hudAvailableWidthPct}vw`);
// WCF3: every selected card and combatant wears this one glow (config-owned).
document.documentElement.style.setProperty('--selection-glow', selectionGlowFilter());
// WCB1: the one inspect control's size, label and rise (config-owned).
{
  const inspect = inspectControlCss();
  document.documentElement.style.setProperty('--inspect-size', inspect.size);
  document.documentElement.style.setProperty('--inspect-label', inspect.label);
  document.documentElement.style.setProperty('--inspect-gap', inspect.gap);
}
// How big a card is, at each of the three levels (config-owned). A surface
// whose width is decided by its container rather than by its render call reads
// these; a card that knows its own level carries `--epc-level-w` instead.
// ...and what SHAPE it is. The stylesheet used to write the ratio and the four
// face bands out a second time, so editing card.json moved the hand's geometry
// maths and left the card's own face untouched. Both halves read this now.
// ...and how many of them stand on one row. A shelf of resting cards — the
// merchant's shelves, a mount's deck list, a pile — is four across, and these
// are the three numbers `.card-shelf` lays them out with.
for (const [name, value] of Object.entries({ ...cardLevelCssProperties(), ...cardShapeCssProperties(), ...cardShelfCssProperties() })) {
  document.documentElement.style.setProperty(name, value);
}
projectHudPresentation(UI);
// Debug handle, same species as `window.__combat` in combat.js. EldenSpire#23's
// fit invariant is `appliedZoom x designW <= innerWidth`, and a probe that reads
// designW off disk is measuring the tree rather than the page in front of it —
// which is the whole difference for dist/, one inlined file. Read-only.
if (typeof window !== 'undefined') window.__uiScale = UI.uiScale;
// Same species, same reason, added at EldenSpire#41 for Vira's condition: a check
// that asks "is the opened Armoury view the one the table names" must READ the
// table off the page, not hold its own copy (Law 1 clause 2). A tool typing
// 'rack' would agree with a typo as happily as with the truth. Read-only.
if (typeof window !== 'undefined') window.__equipCfg = registries.balance.equipment;

// THE HOLD'S BEAT (ui/components/holdbeat.js). Installed once, here, and never
// mentioned again: it rides `data-hold` / `data-hold-progress`, the two facts
// armHold already publishes on every held control, so nothing at any call site
// wires it and a control that starts holding LATER is covered the day it does.
// `at` is the one home of the fractions; the sounds are content/sfx.js.
installHoldBeat({ root: document, at: (UI.holdBeat || {}).at || [] });

// Apply persisted display settings at boot (defaults: sprites on, motion normal).
// The music folder: in a build that pins packs (the web edition) it is first
// applied once the first screen is drawn, after the load has settled; a single
// file and the source tree apply it at once, as before (assetPacks.js musicHold).
const bootMusic = musicHold({ configureMusic: (opts) => audio.configureMusic(opts) });
// The display-settings cluster (UI scale, layout, tap size, card size,
// applyDisplaySettings) lives in ui/displaySettings.js; hand it what it needs.
configureDisplaySettings({ ui: UI, audio, bootMusic, saves, getActiveSettings: () => activeSettings });
installDisplaySettings();
// A new high-res source (Art quality) must not be undercut by pose preloads,
// which are keyed by pose, not URL, and would keep serving the old art.
// The pose preloads start over; reaverAttack.js and combatEffectSprites.js
// reset their own warmers through whenArtSourceChanges.
onArtSourceChange(() => clearPosePreloads());
applyDisplaySettings(activeSettings);
// The resting width follows the viewport (see installCardSizeResize).
installCardSizeResize();

/**
 * applyRestoredSettings(restored) — re-dress the running app in a profile that
 * has just been swapped underneath it (#68 D22).
 *
 * A restore replaces the whole profile, so every setting the app applied at
 * boot is now the OTHER profile's. Before this, renderProfileSection accepted
 * an `onRestored` callback, called it — and nobody ever passed one, on either
 * door. The screen kept the old profile's contrast, motion and text size while
 * storage held the new ones: high contrast stored ON and off on screen,
 * reduced motion stored OFF and on on screen, root font-size unmoved.
 *
 * Marina's framing is the one worth building to: THE PLAYER WHO MOST NEEDS
 * THOSE SETTINGS IS THE PLAYER WHO JUST LOST A SAVE. Someone who restores a
 * profile because they cannot read the game without high contrast should not
 * have to find the toggle again from memory.
 *
 * Everything the boot path applies is re-applied here, from ONE list, so a new
 * setting cannot be applied at boot and forgotten on restore.
 */
function applyRestoredSettings(restored) {
  const settings = restored || {};
  // An Undo taken from the profile this replaces must never land in it.
  dropUndoOffer();
  for (const key of Object.keys(activeSettings)) delete activeSettings[key];
  Object.assign(activeSettings, settings);
  activeMeta.settings = activeSettings;
  applyDisplaySettings(settings); // sprites, contrast, motion, text size, shake, motif
  applyUiScale(settings);         // UI zoom / Auto fit
  if (settings.bindings) setBindings(settings.bindings);
  if (settings.keyBindings) setKeyBindings(settings.keyBindings);
  refreshHudQuickSettings(app, settings);
}


// ONE HOME for the quarantine sentence (#68 D21). I wrote "ONE sentence, both
// doors — two doors with two strings is how they drift" and then pasted the
// string into both doors, which is the drift I was naming. Copy: Sunna,
// 2026-08-07; her tail now names the crisis screen's own route, so it is true
// wherever it is shown rather than only where Profile happens to sit below.
const QUARANTINE_NOTICE =
  'This works right now, but it won\u2019t survive a restart \u2014 your profile is set aside and we\u2019re not writing over it. You can restore it or save a copy from Profile on the title screen, whenever you want to.';

// ---- run state ----------------------------------------------------------------
let run = null;
let rng = null;
let activeSlot = 1; // which save slot the current run persists to (SPEC §3.12 + slots)
let rewardDoneCount = 0; // shot/read receipt: each mounted reward callback increments once

// Accepted play survives an autosave failure. Explicit Save has its own retry.
const SAVE_WARNING_REPEAT_MS = 30000;
const SAVE_WARNING_SHOWN_MS = 9000;
let lastSaveWarningAt = -Infinity;
function reportAutosaveFailure(error, now = Date.now()) {
  const full = isStorageFullError(error);
  dlog('save', full ? 'autosave refused: browser storage is full' : 'autosave failed', error && error.message);
  console.warn('[save] autosave failed; play continues:', error && error.message);
  if (now - lastSaveWarningAt < SAVE_WARNING_REPEAT_MS) return false;
  lastSaveWarningAt = now;
  const body = full
    ? ' \u00b7 Couldn\u2019t save \u2014 browser storage is full. Your game continues, but closing or reloading now returns you to your last saved point; delete an old save slot from the title screen to free space.'
    : ` \u00b7 Couldn\u2019t save (${(error && error.message) || 'storage error'}). Your game continues.`;
  const key = full ? 'save:storage-full' : 'save:failed';
  const banner = failureBanner(key, 'COULDN\u2019T SAVE', body);
  // A full banner stack can return another banner. Only remove the one we own.
  if (banner && banner.dataset?.failureKey === key) {
    if (banner.style) Object.assign(banner.style, { position: 'fixed', top: '0', left: '0', right: '0', margin: '0', zIndex: '1000', backgroundColor: '#17110a' });
    if (typeof setTimeout === 'function') setTimeout(() => banner.remove?.(), SAVE_WARNING_SHOWN_MS);
  }
  return true;
}

const {
  Persist: persist, PersistOrWarn: persistOrWarn, PersistContinuing: persistContinuing,
  SaveCombatCandidate: saveCombatCandidate,
} = CreateRunPersistence({
  readCurrent: () => ({ registries, run, rng, slot: activeSlot }),
  stampSkillBonuses,
  saveRun: (value, sourceRng, slot) => saves.saveRun(value, sourceRng, slot),
  reportFailure: reportAutosaveFailure,
});

// The run the way its save slot names it (W2e's target line, W1r's, W2d's).
function runIdentityParts() {
  return {
    className: run && registries.classes.has(run.class) ? registries.classes.get(run.class).name : run?.class,
    slot: activeSlot,
    facts: run ? slotFacts({ actNumber: run.actNumber, floor: run.floor, hp: run.hp, maxHp: run.maxHp }) : '',
  };
}

// W1r: an EXPLICIT Save says what happened. Autosave (persist) keeps throwing,
// so a boot path never hides a failure; the Save row lands here instead, keeps
// the run, and opens the status door whose Retry saves again — the save, never
// the play. Returns the slot it wrote, or false when the door is open.
function saveNow({ returnFocusElement = null } = {}) {
  try {
    persist();
    return activeSlot;
  } catch (error) {
    openSaveStatusReview({
      ...runIdentityParts(),
      savedAt: run?.savedAt ?? null,
      error,
      onRetry: () => saveNow({ returnFocusElement }),
      returnFocusElement,
    });
    return false;
  }
}

function randomSeedString() {
  return seedToString((Math.random() * 0xffffffff) >>> 0);
}

const runStartOwner = createRunStartOwner();
function newRun(config) {
  config = { ...config, gameProfile: config.gameProfile || selectedGameProfile };
  const asked = config.seedString || randomSeedString();
  const why = seedProblem(asked);
  if (why) {
    failureBanner('run:seed', 'THIS SEED CANNOT START A RUN', ` · ${JSON.stringify(String(config.seedString))} — ${why}`);
    console.error('[seed] refused at newRun:', { seedString: config.seedString, why });
    return Promise.resolve({ ok: false, reason: why });
  }
  // Screenshot boot composes its fixture immediately after this call. Its
  // memory profile is synchronous and must preserve that same-stack contract.
  if (shotState) {
    const profile = saves.ensureProfile();
    if (!profile.ok) throw new Error(`Profile could not be saved: ${profile.reason}`);
    return beginPreparedRun({ ...config, seedString: asked });
  }
  const surface = app.firstElementChild, previousRun = run;
  return runStartOwner.start({
    prepare: () => saves.ensureProfile(),
    isCurrent: () => app.firstElementChild === surface && run === previousRun,
    adopt: () => beginPreparedRun({ ...config, seedString: asked }),
    onFailure: error => {
      const message = `Profile could not be saved: ${error.message}`;
      console.error('[run] start refused:', error);
      // The command log keeps the reason even when the banner is folded into
      // its overflow; keying by reason lets a new reason raise its own banner.
      dlog('ERROR', `run start refused: ${error.message}`);
      if (!showSettingsNotice(message, 'profile')) failureBanner(`run:start:${error.message}`, 'THIS RUN COULD NOT START', ` · ${error.message}`);
    },
  });
}

function beginPreparedRun({ classId, seedString, customization, custom, startingKitId, startingHands, startingArmourId, startingRelicId, startingAbilityIds, attributeMode, attributes, slot = 1, skipOpening = false, quickStart = false, gameProfile = selectedGameProfile, deckEdit = null }) {
  resetArmouryTraySession();
  // A caller that bypassed the seed field still gets a refusal without a reroll.
  const asked = seedString || randomSeedString();
  const why = seedProblem(asked);
  if (why) {
    failureBanner('run:seed', 'THIS SEED CANNOT START A RUN',
      ` · ${JSON.stringify(String(seedString))} — ${why}\n`
      + ' · No run was started, and nothing was rerolled: a different map under the same seed is the defect this refuses.');
    console.error('[seed] refused at newRun:', { seedString, why });
    return;
  }
  // Profile creation has succeeded. Select the slot only after validating its seed.
  activeSlot = slot;
  const seed = seedFromString(asked);
  const legacyArcaneShot = shotState === 'combat' && shotParams.get('shotArcane') === 'matrix';
  const shotCombatVersion = shotState === 'combat' ? shotParams.get('shotCombatVersion') : null;
  if (shotCombatVersion !== null && !['1', '2'].includes(shotCombatVersion)) {
    throw new Error('shotCombatVersion must be 1 or 2');
  }
  // The legacy shotCombatVersion / shotKnowledgeVersion / shotReactionVersion
  // overrides shape only a legacy profile's run; Core 2 owns its combat rules
  // (createRunState and createCombat), so they never reach a configured run.
  const configuredProfile = isConfiguredRun(gameProfile);
  const combatExpansionVersion = !configuredProfile && (legacyArcaneShot || shotCombatVersion === '1') ? 1 : 2;
  const shotKnowledgeVersion = shotState === 'combat' ? shotParams.get('shotKnowledgeVersion') : null;
  if (shotKnowledgeVersion !== null && !['0', '1'].includes(shotKnowledgeVersion)) {
    throw new Error('shotKnowledgeVersion must be 0 or 1');
  }
  // Checkpoint fixtures can disable knowledge independently of combat rules.
  // Normal runs and default expanded shots keep accepted knowledge durable.
  const enemyKnowledgeVersion = shotKnowledgeVersion === null
    ? legacyArcaneShot || shotCombatVersion === '1' ? null : 1
    : shotKnowledgeVersion === '0' ? null : 1;
  const shotReactionVersion = shotState === 'combat' ? shotParams.get('shotReactionVersion') : null;
  if (shotReactionVersion !== null && !['0', '1', '2'].includes(shotReactionVersion)) throw new Error('shotReactionVersion must be 0, 1 or 2');
  const reactionRulesVersion = shotReactionVersion === null
    ? legacyArcaneShot || shotCombatVersion === '1' || shotKnowledgeVersion === '0' ? null : 2
    : shotReactionVersion === '0' ? null : Number(shotReactionVersion);
  const configSnapshot = { ...(isConfiguredRun(gameProfile) ? coreAdvancedConfigSnapshot : advancedConfigSnapshot)(saves.loadMeta().settings || {}),
    breakMeterVersion: combatExpansionVersion === 2 ? 2 : 1 };
  // The Arcane matrix is a legacy-run visual fixture. It deliberately carries
  // the old Exposure states; the pose must also carry their older rules.
  // Core 2 keeps breakMeterVersion 2 (its run is expanded whatever the shot asks).
  if (legacyArcaneShot && !configuredProfile) delete configSnapshot.breakMeterVersion;
  rebuildRegistries(configSnapshot, gameProfile);
  xpCombat = null; // a fight belongs to the run that started it; the edit lock must not outlive that run
  const prepared = CreatePreparedRun({
    seed, registries, gameProfile, profileMeta: saves.loadMeta(), configSnapshot, combatExpansionVersion,
    enemyKnowledgeVersion: configuredProfile ? undefined : enemyKnowledgeVersion,
    reactionRulesVersion: configuredProfile ? undefined : reactionRulesVersion,
    classId, customization, custom, startingKitId, startingHands, startingArmourId,
    startingRelicId, startingAbilityIds, attributeMode, attributes, deckEdit, quickStart,
  });
  run = prepared.run;
  rng = prepared.rng;

  if (run.custom.deckMode === 'draft') return showDraft();
  startClimb({ skipOpening });
}

// After the deck is finalized (incl. any draft), generate the map and go.
// `skipOpening` is the Title's Quick start (characterCreation.quickStart): the
// player asked to be in the climb now, so this climb does not queue the opening.
// It records nothing as seen — the next ordinary climb still plays it.
function startClimb({ skipOpening = false } = {}) {
  // A dealt deck (Sealed, Draft, with any picks) was never stamped: give its
  // cards their equipment faces now, as the load door and every later restamp
  // do, so the first fight plays the same cards a reload would. A pool deck is
  // dealt no lent card by it (model/cardRemoval.js isPoolDeckMode).
  if (isPoolDeckMode(run)) stampDeck(registries, run, undefined, { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  run.mapGraph = buildActMap(registries, rng, currentSeat(), run.actNumber, null, { history: run.history });
  if (runSupportsPrologue(run) && !skipOpening && (!shotState || shotState === 'prologue') && shouldPlayPrologue(saves.loadMeta().settings, saves.loadMeta().settings?.prologueSeen === true)) {
    run.prologue = { version: PROLOGUE_STATE_VERSION, status: 'pending', scene: 0 };
  }
  persist();
  if (pendingPrologueScene(run) !== null) return showPrologue();
  showMap();
}

function showPrologue() {
  const openingRun = run;
  const settings = { ...saves.loadMeta().settings, ...run.advancedConfigSnapshot?.overrides };
  // The region's map context, so a prologue that keeps its music hands it to
  // showMap() unchanged instead of restarting it.
  audio.music(mapMusicContext(run.environmentRegionId || regionForRun(run)?.id));
  mountPrologue(app, {
    // The opening may take the music with it, scene by scene (Advanced →
    // Opening → Music); `map` above is what it starts over.
    settings, run, audio, startScene: pendingPrologueScene(run) ?? 0, onSettings: showSettings,
    onScene: scene => { if (run === openingRun) { run.prologue.scene = scene; persist(); } },
    onFinish: reason => {
      if (run !== openingRun || run.prologue.status !== 'pending') return;
      run.prologue = { ...run.prologue, status: 'complete', reason };
      persistSettingsChange({prologueSeen:true});
      persist(); showMap();
    },
  });
}

// Generate the current act's map and pre-roll every '?' node (stream
// 'events') so outcomes are seed-determined and the Sealstone Key can
// reveal them (SPEC §6).
// The SEAT climbed at the current tier (SPEC §13.1): content follows the seat,
// geometry and difficulty follow the tier. Endless loops the order with the act.
function currentSeat() {
  return seatAtTier(run.seatOrder, run.actNumber);
}

// The map-build sequence itself lives in engine/actmap.js (the one boot path,
// #54) — this file only decides which act and where the graph is stored.

// Between acts: ember holds the spire together a little longer.
function advanceAct() {
  run.actNumber += 1;
  run.floor = 0;
  run.mapNodeId = null;
  run.path = [];
  run.lastEncounters = [];
  // Full heal between acts.
  run.hp = run.maxHp;
  // Owner 2026-10-27: both flask pools refill at every act change (configured runs; legacy keeps its behaviour).
  refillFlasksAtActChange(run);
  run.mapGraph = buildActMap(registries, rng, currentSeat(), run.actNumber, null, { history: run.history });
  persistOrWarn(); // reached from a boss reward: a full store must not strand the climb
  showMap();
}

// A refused load lands on the title. A run from a NEWER build is refused AND
// kept (SPEC §3.12), so the landing says why, the way the profile's 'newer'
// notice does (ui/screens/profileNotice.js): the only way on is to leave it be.
// Nothing here writes; Delete stays the slot's own explicit, confirmed act.
function refusedRunLanding(slot) {
  showTitle();
  if (saves.runStatus().state !== 'newer') return;
  openNewerSaveNotice({ slot });
}

// A refusal keeps the current run and registries. The title is the default
// landing; the in-run Load door keeps the existing run on screen.
let terminalResume = null;
function resumeRun(slot = 1, { onRefused = refusedRunLanding, onLoaded = null } = {}) {
  if (terminalResume) return terminalResume;
  const refused = () => onRefused(slot);
  // A refusal lands first (the title, or the in-run Load door), then says why:
  // the Settings notice when a host is mounted, else the title's failure banner,
  // the same fallback the run-start path uses. The save is never touched.
  // A run from a retired game mode (legacy, Core 1, or no profile) is refused with its own sentence; its bytes stay.
  const refuseRetired = reason => {
    const message = t('save.retired.message');
    dlog('ERROR', `resume refused: retired game mode (${reason})`);
    const landed = refused();
    if (!showSettingsNotice(message, 'profile')) failureBanner(`run:resume:retired`, 'THIS SAVE COULD NOT BE RESTORED', ` · ${message}`);
    return landed;
  };
  const refuseWith = error => {
    const message = `Saved game configuration could not be restored: ${error.message}`;
    dlog('ERROR', `resume refused: ${error.message}`);
    const landed = refused();
    if (!showSettingsNotice(message, 'profile')) failureBanner(`run:resume:${error.message}`, 'THIS SAVE COULD NOT BE RESTORED', ` · ${error.message}`);
    return landed;
  };
  let context;
  try {
    context = LoadSavedRunContext(saves, slot, {
      validate: (profile, configuration, authored) => cachedContentValidation(profile, configuration, authored).result,
    });
  } catch (error) { return refuseWith(error); }
  if (!context.run) {
    const retired = context.retiredReason || (context.reason?.startsWith('retired game mode') && context.reason);
    return retired ? refuseRetired(retired) : refused();
  }
  const { run: loaded, gameProfile, configuration } = context;
  registries = context.registries;
  registryGameProfile = gameProfile;
  const buildKey = registryBuildKey(configuration, gameProfile);
  lastRegistryBuild = buildKey !== null ? { key: buildKey, profile: gameProfile, registries } : null;
  configureTooltipGlossary(registries);
  setClassGlyphs(registries.classes.all());
  // The load is certain from here; a caller that must tear down what the
  // refusal would have returned to (the in-run overlay) does it now, not before.
  onLoaded?.();
  resetArmouryTraySession();
  activeSlot = slot;
  xpCombat = null; // a fight belongs to the run that started it; the edit lock must not outlive that run
  run = loaded;
  rng = createRng(run.seed, run.streamCounters);
  // A snapshot still carrying the retired ×20 Cinder key: the bundle above
  // already left it out, so this only says so — on the channel boot uses for
  // a profile — and saves the cleaned run once, after `rng` (see below).
  for (const line of bringRunSnapshotForward(run, () => persist())) console.warn('[advanced-config]', line);
  // THE LOAD DOOR IS WHERE AN OLD OPENING STATE IS REWRITTEN. A version-1
  // `scene` indexes the six-scene order; `onScene` below writes the NEW order
  // back into the same field, so a state left marked version 1 would be read
  // one way and written another. Migrate before anything reads it, and persist
  // so the rewrite outlives this load — AFTER `rng`, because `persist` writes
  // this run's stream counters and the previous run's rng is still standing
  // until the line above.
  if (run.prologue?.version === 1) { migratePrologueState(run); persist(); }
  if (run.pendingFinish) {
    const victory = run.pendingFinish.victory;
    return resumeTerminal(() => showFinishedRun(victory));
  }
  if (run.combatPendingOutcome) {
    const pending = run.combatPendingOutcome;
    const ended = restoreCombatSnapshot({ registries, rng, expectedGameProfile: run.gameProfile, snapshot: pending.snapshot });
    const encounter = registries.encounters.get(pending.encounterId);
    return resumeTerminal(() => onCombatEnd(pending.result, ended, encounter));
  }
  if (pendingPrologueScene(run) !== null) return showPrologue();
  if (run.gameProfilePendingReward) {
    showGameProfileReward();
  } else if (run.gameProfileOpenShop) {
    showShop();
  } else if (run.combatEntered && run.combatEntered.encounterId) {
    // Current saves resume the exact committed turn. Older saves that only
    // carry the encounter receipt still use the deterministic restart path.
    enterCombat(run.combatEntered.nodeId, run.combatEntered.encounterId, { resuming: true });
  } else if (run.shopStock) {
    showShop();
  } else {
    showMap();
  }
}

function resumeTerminal(operation) {
  const previouslyInert = app.inert;
  app.inert = true;
  terminalResume = Promise.resolve().then(operation).finally(() => {
    app.inert = previouslyInert;
    terminalResume = null;
  });
  return terminalResume;
}

function saveSlotRecords() {
  return saves.listSlots().map(({ slot, summary }) => ({
    slot,
    summary: summary && {
      ...summary,
      className: registries.classes.has(summary.class) ? registries.classes.get(summary.class).name : summary.class,
    },
  }));
}

function confirmSlotLoad(slot, { returnFocusElement } = {}) {
  // A SLOT A NEWER BUILD WROTE IS REFUSED HERE, BEFORE ANYTHING IS DROPPED.
  // resumeRun's loadRun is null for it (SPEC §3.12: refused and kept), and by
  // then closeOverlay has run and `run` is overwritten — the climb in hand was
  // lost to a load that could never succeed. Say why and leave the run be.
  if (saves.slotSummary(slot)?.newer) return openNewerSaveNotice({ slot, returnFocusElement });
  // WHICH CLIMB, NOT JUST WHICH SLOT. This is the in-run door's only stop
  // before the load, and it named a number and nothing else. The title's list
  // hands the seed to a review door on the way through; this path has no
  // review door, so the receipt belongs here.
  const summary = saveSlotRecords().find((record) => record.slot === slot)?.summary || null;
  // W2d: the target is the saved climb, the consequence is exactly what the
  // current run loses (ui/models/ConfirmationReviewModel.js).
  const review = loadOverRunReview({
    slot,
    className: summary?.className ?? null,
    facts: summary ? slotFacts(summary) : null,
    seed: summary?.seedString ?? null,
  });
  openConfirmationModal({
    title: review.question,
    target: review.target,
    message: review.message,
    confirmLabel: review.confirmLabel,
    consequence: 'DISCARDS UNSAVED CHANGES',
    // Whether this reads as destructive is the ConfirmationRegistry's call.
    tone: registries.framework.confirmationTone('action.loadSlot'),
    returnFocusElement,
    onConfirm: () => {
      // AND AGAIN AT THE PRESS. Run saves share localStorage across tabs and
      // this confirmation can stay open indefinitely, so another tab can
      // rewrite the slot (a newer build), clear it or corrupt it after the
      // check above passed; content validation and migration refuse only
      // inside loadRun. resumeRun swaps the live run only after a successful
      // load, so every refusal lands here, on the run still in hand.
      //
      // THE OVERLAY CLOSES ONLY ONCE THE LOAD IS CERTAIN. Opened from the
      // in-run overlay's quick navigation, `returnFocusElement` is a button
      // inside that overlay; closing it before the outcome disconnected the
      // button, so a refusal's "Keep playing" had nowhere to return focus and
      // keyboard and gamepad players landed on <body> (Codex review, #1355).
      resumeRun(slot, {
        onLoaded: closeOverlay,
        onRefused: () => (saves.runStatus().state === 'newer'
          ? openNewerSaveNotice({ slot, returnFocusElement })
          : openRefusedSaveNotice({ slot, returnFocusElement })),
      });
    },
  });
}

function loadActiveSlot({ returnFocusElement } = {}) {
  openSaveSlotSelector({
    slots: saveSlotRecords(),
    registries,
    returnFocusElement,
    onRequestLoad: (slot) => confirmSlotLoad(slot, { returnFocusElement }),
  });
  return false;
}

function quitWithoutSaving({ returnFocusElement } = {}) {
  openConfirmationModal({
    title: 'Quit without saving?',
    // W2e: the run this leaves, named the way its save slot names it.
    target: run ? runIdentity({
      className: runClassIdentity(registries, run).name,
      slot: activeSlot,
      facts: slotFacts({ actNumber: run.actNumber, floor: run.floor, hp: run.hp, maxHp: run.maxHp }),
    }) : '',
    message: 'Changes since your last save will be lost. Your existing save slot will remain available.',
    confirmLabel: 'Quit without saving',
    consequence: 'LEAVES THE RUN',
    tone: registries.framework.confirmationTone('action.quitWithoutSaving'),
    returnFocusElement,
    onConfirm: () => {
      closeOverlay();
      audio.stopMusic();
      xpCombat = null; // a fight belongs to the run that started it; the edit lock must not outlive that run
      run = null;
      showCollapsedTitle();
    },
  });
  return false;
}

// ---- screens --------------------------------------------------------------------
// #67 property 3/5: a profile that could not be read is a NAMED, VISIBLE state
// with a reachable handle — never a fresh profile wearing the same filename.
// This sits in front of the title because the title is where a player would
// otherwise see "no saves" and draw their own conclusion.
let profileNoticeShown = false;
function showProfileNoticeIfNeeded() {
  if (profileNoticeShown) return false;
  const status = saves.profileStatus();
  if (status.ok) return false;
  profileNoticeShown = true;
  mountProfileNotice(app, {
    saves,
    status,
    onContinue: () => showTitle(),
  });
  return true;
}

let startupGatePending = !shotState;
let unmountStartupGate = null;

function startupInputFamily(forced = '') {
  if (['pointer', 'touch', 'keyboard', 'controller'].includes(forced)) return forced;
  if (hasGamepad()) return 'controller';
  if ((navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches) return 'touch';
  return 'keyboard';
}

function showStartupGate({ forcedFamily = '' } = {}) {
  if (unmountStartupGate) unmountStartupGate();
  audio.music('title');
  const family = startupInputFamily(forcedFamily);
  unmountStartupGate = mountStartupGate(app, {
    model: startupGateModel({ inputFamily: family, settings: activeSettings }),
    registerInputGate: setInputGate,
    onReveal: ({ family }) => {
      startupGatePending = false;
      unmountStartupGate = null;
      // The title draws only once the built-in art has settled (loaded, or
      // failed by BOOT_WAIT_MS): a press during the load finishes the reveal,
      // and the gate's line says "Loading art…" until then (step 5).
      afterBootArt(() => showTitle({
        skipStartup: true,
        focusDefault: true,
        focusCursor: family === 'keyboard' || family === 'controller',
      }));
    },
  });
  // The built-in art's status line (step 5), beside the gate, never inside it:
  // the gate's children are SPEC §7.1's, and it is one role="button". None
  // when nothing is pinned.
  const artLine = bootArtLine();
  if (artLine) mountBootArtStatus(app, bootArtStatusModel(artLine));
}

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
  retryBuiltInArt(activeSettings);
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

// Returning from a climb is a new arrival at the main menu, so it lands on the
// folded title threshold. Ordinary title sub-pages (Settings, Collection,
// character creation) still return to the already-open menu via showTitle().
function showCollapsedTitle() {
  startupGatePending = true;
  showTitle();
}

function showTitle({ skipStartup = false, focusDefault = false, focusCursor = true, reopen = null } = {}) {
  if (showProfileNoticeIfNeeded()) return;
  audio.music('title');
  resetArmouryTraySession();
  xpCombat = null; // a fight belongs to the run that started it; the edit lock must not outlive that run
  run = null;
  if (startupGatePending && !skipStartup) {
    showStartupGate();
    return;
  }
  rebuildRegistries(saves.loadMeta().settings || {}, selectedGameProfile);
  const slots = saveSlotRecords();
  mountTitle(app, {
    slots,
    reopen,
    // The delete beat rides the shared machinery now: the armer reads the
    // dial from meta.settings and the table from the registries.
    meta: saves.loadMeta(),
    registries,
    onContinue: (slot) => resumeRun(slot),
    onNew: (slot) => showCustomize(slot),
    // FINISH §6: authored defaults, a fresh seed, the first empty slot. A full
    // set of slots falls back to slot 1, where startRunInSlot asks before it
    // replaces the save there, as Begin does.
    onQuickStart: () => {
      rebuildRegistries(saves.loadMeta().settings || {});
      const empty = slots.find((s) => !s.summary);
      startRunInSlot({ ...quickStartRunConfig(registries), seedString: randomSeedString() }, empty ? empty.slot : 1);
    },
    // The Title updates in place from the returned list (no remount). The
    // snapshot below is this showTitle's own `slots`, which onQuickStart
    // reads, so it is refreshed too.
    onDelete: (slot, from = null) => {
      saves.clearRun(slot);
      const fresh = saveSlotRecords();
      slots.splice(0, slots.length, ...fresh);
      return fresh;
    },
    onHistory: showHistory,
    onCompendium: showCompendium,
    onBestiary: showBestiary,
    onProfile: showProfile,
    onSettings: showSettings,
    onOffline: showOfflinePlay,
    onSettingsChange: persistSettingsChange,
    onCollapse: showCollapsedTitle,
    onQuit: quitGame,
    artNotice: drawArtNotice,
  });
  if (focusDefault) focusTitleDefault(app, { showCursor: focusCursor });
  // Fullscreen-first stays first. Offer the choice only after the startup gate
  // and profile sync have settled, before the player starts or resumes a run.
  if (!settingsChoiceChecked && saves.profileStatus().ok) {
    settingsChoiceChecked = true;
    // Sync may have introduced or removed preferences while the gate was up.
    const meta = saves.loadMeta();
    settingsChoicePending = needsSettingsChoice(meta, BUILD_VERSION, settingsRows(), promotionFor(SETTINGS_DEFAULTS, promotionDebug()).values);
    if (!settingsChoicePending && meta.settingsChoiceBuild !== BUILD_VERSION) {
      try { saves.saveMeta({ ...meta, settingsChoiceBuild: BUILD_VERSION }); } catch { /* retry acknowledgement on the next boot */ }
    }
  }
  if (settingsChoicePending) {
    const choose = async (apply) => {
      const result = await commitSettingsChoiceAsync(saves.loadMeta(), BUILD_VERSION, {
        apply,
        load: () => saves.loadMeta(),
        save: meta => saves.saveMeta(meta),
        restore: meta => { activeMeta = meta; applyRestoredSettings(meta.settings); },
      });
      if (result.ok) { settingsChoicePending = false; activeMeta = saves.loadMeta(); }
      rebuildRegistries(activeSettings);
      return result;
    };
    openSettingsDefaultsChoice({
      returnFocusElement: document.activeElement,
      onLocal: () => choose(() => {
        const changes = keepLocalSettings(activeSettings, promotionFor(SETTINGS_DEFAULTS, promotionDebug()));
        return persistSettingsChange(changes);
      }),
      onDefaults: () => choose(async () => {
        const writes = [];
        resetKeys(activeSettings, changes => {
          const result = persistSettingsChange(changes);
          writes.push(Promise.resolve(result));
          return result;
        }, allResettableKeys(activeSettings));
        return { ok: (await Promise.all(writes)).every(result => result?.ok !== false) };
      }),
    });
  }
}

function showProfile() {
  openProfileArchive({
    saves,
    // Through boot's door first: a restored profile from before a key was
    // renamed must reach the rows, the bundle and storage already rewritten.
    onRestored: () => {
      // Through boot's promotion step too: an archive from before the current
      // promotion must start at its values, in play and in storage.
      const meta = saves.loadMeta();
      const settings = bringStoredProfileForward(meta);
      seedPromotedDefaults(meta, settings);
      applyRestoredSettings(settings);
    },
  });
}

async function persistSettingsChange(changed) {
  if (!saves.profileStatus().quarantined) {
    activeMeta = saves.loadMeta();
    activeSettings = activeMeta.settings || (activeMeta.settings = {});
  }
  const settingsBefore = structuredClone(activeSettings);
  // A value the player moves off a promoted one is theirs from now on.
  const seed = seedAfterChange(activeSettings, changed);
  Object.assign(activeSettings, changed);
  if (seed) activeSettings[SEED_KEY] = seed;
  activeMeta.settings = activeSettings;
  let res;
  try { res = await saves.saveMeta(activeMeta); }
  catch (error) { res = { ok: false, error: String(error?.message || error) }; }
  if (res?.ok === false) {
    activeSettings = settingsBefore;
    activeMeta.settings = settingsBefore;
    applyDisplaySettings(activeSettings);
    refreshHudQuickSettings(app, activeSettings);
    showSettingsNotice(QUARANTINE_NOTICE);
    announceSettingsSettled();
    return res;
  }
  if (Object.hasOwn(changed, 'newGameProfile')) selectedGameProfile = readNewGameProfile(activeSettings, resolveAskedGameProfile());
  applyDisplaySettings(activeSettings);
  refreshHudQuickSettings(app, activeSettings);
  remountMapIfShowing(changed);
  if (changed.bindings) setBindings(changed.bindings);
  if (changed.keyBindings) setKeyBindings(changed.keyBindings);
  if (res && res.ok === false) showSettingsNotice(QUARANTINE_NOTICE);
  announceSettingsSettled();
  return res;
}

const quickMenuControls = {
  fullscreen: {
    read: () => {
      const capability = fullscreenCapability(document);
      const checked = isFullscreen(document);
      return {
        checked,
        disabled: !capability.supported,
        condition: capability.supported ? `Fullscreen ${checked ? 'on' : 'off'}.` : 'Unavailable in this browser.',
      };
    },
    activate: async () => {
      const result = await toggleFullscreen(document);
      return result.ok || result.reason === 'unsupported'
        ? {}
        : { announcement: 'Fullscreen was refused by the browser. State is unchanged.' };
    },
  },
  music: {
    read: () => ({
      checked: resolveMusicEnabled(activeSettings),
      condition: musicEnabledCondition(activeSettings),
    }),
    activate: () => {
      const next = !resolveMusicEnabled(activeSettings);
      const persisted = persistSettingsChange({ musicEnabled: next });
      return { changed: { musicEnabled: next }, persisted };
    },
  },
};

// The Settings door showSettings opened, so an import, which replaces the profile
// under it, can close it. Its toggles read the stale DOM otherwise.
let settingsDoor = null;

function showSettings() {
  settingsDoor = openSettings({
    meta: activeMeta,
    previewAttributes: run?.attributes,
    previewLevel: run ? characterLevelOf(run) : null,
    previewClassId: run?.class || null,
    onChange: persistSettingsChange,
    onOffline: showOfflinePlay,
    gameProfile: { read: () => selectedGameProfile, active: () => run?.gameProfile || selectedGameProfile },
  });
}

// AFTER AN IMPORT, NO RELOAD. The restored profile is on disk; re-read it the way
// boot does (persistSettingsChange's order) and redraw the title over the same page.
// It goes through the Profile door's restore (onRestored in showProfile): the
// stored profile is brought forward, then the same defaults choice as boot is
// decided before any promoted value is seeded. With no choice pending the
// promoted defaults are seeded; otherwise the imported values remain intact
// for Keep local. applyRestoredSettings then re-applies display, UI scale, pad
// and key bindings, drops a stale Undo, and fills activeSettings IN PLACE
// (other owners hold that object).
function refreshAfterImport() {
  activeMeta = saves.loadMeta();
  const settings = bringStoredProfileForward(activeMeta);
  settingsChoicePending = saves.profileStatus().ok
    && needsSettingsChoice(activeMeta, BUILD_VERSION, settingsRows(), promotionFor(SETTINGS_DEFAULTS, promotionDebug()).values);
  if (!settingsChoicePending) seedPromotedDefaults(activeMeta, settings);
  applyRestoredSettings(settings);
  selectedGameProfile = readNewGameProfile(settings, resolveAskedGameProfile());
  rebuildRegistries(activeSettings);
  settingsChoiceChecked = true;
  // The Settings door (opened from the title's Download & saves path) still shows the old profile.
  settingsDoor?.close?.(); settingsDoor = null;
  showTitle({ skipStartup: true });
}

function showOfflinePlay() {
  const transfer = CreateSaveTransfer(bootStorage);
  const ownedTransfer = { ...transfer, Restore: text => saves.withProfile
    ? saves.withProfile(() => transfer.Restore(text)) : transfer.Restore(text) };
  openOfflinePlay({ transfer: ownedTransfer, onImported: refreshAfterImport, assertImportAllowed: () => {
    if (run) throw new Error('Return to the title screen before importing saves.');
    let persistent = false;
    try { persistent = bootStorage === window.localStorage; } catch { /* blocked browser storage */ }
    if (!persistent) throw new Error('This browser is not keeping saves. Enable browser storage and reopen the game before importing.');
  } });
}

/**
 * The Armoury. Outside combat it edits the loadout directly and re-stamps the
 * deck; the chosen view is a setting so it survives the session.
 */
// `returnTo` is the screen the Armoury closes back onto. The map is the
// default; a room (merchant, Shrine, event) passes itself, because the band
// those rooms now carry opens the Armoury too and a close that went to the
// map would abandon the room mid-visit.
function showArmoury(request = '', returnTo = showMap) {
  // A glow cleared by looking must survive a reload even when nothing in the Armoury changes.
  if (armouryHasNew(run)) { markArmourySeen(run); persist(); } else markArmourySeen(run);
  const armouryMeta = saves.loadMeta();
  const route = armouryRoute(request, { stored: armouryMeta.settings.equipView, deckDoor: deckDoors().armoury });
  // THE LAST MENU IS REMEMBERED: the Armoury button (no named view) reopens on the tab the player left it on.
  // Character and Armory live in `equipView`; the Deck tab is the editor, saved there as 'deck'.
  if (route.open === 'deck') {
    showDeckEditor(returnTo, true);
    return;
  }
  const { view: initialView, destination, equipItemId } = route;
  // An explicit tab the player navigated to (the editor's Character / Armory tabs, quick-nav) is the new last menu.
  if (route.saveView) {
    const meta = saves.loadMeta();
    meta.settings.equipView = route.saveView;
    saves.saveMeta(meta);
  }
  if (initialView) armouryMeta.settings.equipView = initialView;
  mountEquipment(document.body, {
    registries,
    run,
    meta: armouryMeta,
    destination,
    equipItemId,
    inCombat: false,
    onChange: (loadout, settingChange) => {
      if (settingChange) {
        const meta = saves.loadMeta();
        Object.assign(meta.settings, settingChange);
        saves.saveMeta(meta);
      }
      run.loadout = loadout;
      stampDeck(registries, run);
      persist();
    },
    onClose: returnTo,
    onEditDeck: deckDoors().armoury ? () => showDeckEditor(returnTo, true) : null,
    onCharacterSheet: (opener, tab, onClose, onRewards) => showCharacterSheet(opener, { tab, onClose, onRewards }),
  });
}

// The Progression hub opens over the current screen. Which character-level rewards it lists are the player's own
// Settings → Advanced → Rewards answers, the ones the level door reads.
function showCharacterSheet(opener, options = {}) {
  if (!run) return null;
  const settings = saves.loadMeta().settings || {};
  return openCharacterSheet({
    registries, run, opener, settings, onChange: persist,
    ...options,
    offers: {
      statPoints: settingOn(settings, 'rewardLevelStatPoints'),
      levelCards: settingOn(settings, 'rewardLevelCards'),
      pointsPerLevel: resolveLevelUpValue(settings),
    },
  });
}

// ---- the deck editor (SPEC §14.1) --------------------------------------------
// Which doors open it is the settings' answer (DeckEditorModel.deckEditorDoors):
// under `free` the Armoury, under `restOnly` the
// Rest screen of a place carrying `deckEdit`, and none with deck editing off.
// These navigation doors use the ordinary location policy; combat uses the
// separate draft door below at a safe action boundary.
function deckDoors(services = null) {
  const settings = saves.loadMeta().settings || {};
  const doors = deckEditorDoors({ settings, inCombat: false, services });
  // Core 2 (editorWhere 'rest'): the deck is edited only at a rest site, whatever the player's location setting says.
  if (RestOpensDeckEditor(run)) return Object.freeze({ armoury: false, rest: deckEditingOn(settings) });
  // D10/D15: an older Core edits the deck at will outside combat, from the Armoury, whatever the Current-profile location setting says.
  return armouryOpensDeckEditor(run, settings) ? Object.freeze({ ...doors, armoury: true }) : doors;
}

// `place` names where Back leads (common.place.*): the exit reads "Back to {place}" instead of Cancel.
function showDeckEditor(returnTo = showMap, hub = true, focusCard = null, place = '') {
  if (!run) return;
  mountDeckEditor(document.body, {
    registries,
    run,
    focusCard,
    backLabel: place ? t('common.backTo', { place: t(`common.place.${place}`) }) : '',
    settings: saves.loadMeta().settings || {},
    onNavigate: hub ? destination => {
      persist(); showArmoury(destination === 'character' ? 'grid' : 'rack', returnTo);
      document.querySelector(`.armoury-head [data-modal-tab="${destination}"]`)?.focus({ preventScroll: true });
    } : null,
    // A confirmed edit is written at once; a cancelled one restored the run
    // exactly (cancelDeckEdit), so there is nothing to write.
    onDone: () => { persist(); returnTo(); },
    onCancel: () => returnTo(),
  });
}

// The combat screen opens this door only at an idle action boundary. The
// editor owns a draft; committing it changes the next encounter's deck while
// the active hand/draw/discard/exhaust piles retain their instance identities.
function showCombatDeckEditor(combat, nodeId, encounterId) {
  if (!run || combat.result || combat.pendingReaction) return;
  const owner = run;
  const draft = structuredClone(owner);
  const settings = saves.loadMeta().settings || {};
  mountDeckEditor(document.body, {
    registries, run: draft, settings,
    onDone: () => {
      if (run !== owner || combat.result) return;
      const before = structuredClone(owner);
      try {
        commitDeckEditDraft(registries, owner, draft, settings);
        commitCombatSnapshot({ run: owner, combat, nodeId, encounterId });
        entryCheckpoint.Supersede();
        persist();
        showSettingsNotice('Deck saved. Changes apply next encounter; current combat piles stay unchanged.');
      } catch (error) {
        for (const key of Object.keys(owner)) delete owner[key];
        Object.assign(owner, before);
        showSettingsNotice(error.message || 'Deck changes could not be saved.');
      }
    },
    onCancel: () => {},
  });
}

function showHistory() {
  mountHistory(app, { meta: saves.loadMeta(), onBack: showTitle });
}

/**
 * The Compendium — every armament the Spire keeps, most of it withheld.
 * A PROFILE surface: no run, no class, so `meta.found` is the whole of "yours".
 */
function showBestiary() {
  mountBestiary(app, { registries, meta: saves.loadMeta(), onBack: () => { showTitle(); document.getElementById('bestiary')?.focus(); } });
}

function showCompendium() {
  mountCompendium(app, { registries, meta: saves.loadMeta(), onBack: showTitle });
}

// Quit the game entirely. In a real browser tab window.close() is usually
// blocked (the tab wasn't script-opened), so we stop the game and show a
// graceful "safe to close" screen; in a standalone/launcher window the close
// succeeds. Any in-progress run is persisted first, so nothing is lost.
function quitGame() {
  const savedRun = !!run;
  // Use the existing save failure/retry door; a failed save must keep the run.
  if (run && saveNow({ returnFocusElement: document.activeElement }) === false) return;
  closeOverlay();
  audio.stopMusic();
  xpCombat = null; // a fight belongs to the run that started it; the edit lock must not outlive that run
  run = null;
  mountQuitScreen(app, { savedRun, onBack: showCollapsedTitle });
}

// The in-run overlay keeps only Settings and Controls. Armoury owns inventory,
// equipment, deck, relics, flasks, and run stats.
function showOverlay(initialTab = 'settings') {
  if (!run) return;
  openOverlay({
    gameProfile: { read: () => selectedGameProfile, active: () => run?.gameProfile || selectedGameProfile },
    onOffline: showOfflinePlay,
    registries,
    run,
    meta: activeMeta,
    initialTab,
    // The overlay gets the save manager too (#67, Sunna's D18). Without it this
    // door discarded saveMeta's {ok:false} exactly as the modal used to, and
    // this is the WORSE door: the settings people change mid-run are the
    // comfort ones — pacing, reduced motion, flashes — and the person quietly
    // turning those down mid-fight is the one who most needs them to still be
    // there tomorrow.
    saves,
    onSettingsChange: persistSettingsChange,
    quickControls: quickMenuControls,
    // D15: the overlay opened from a fight shares the combat edit lock, so its equipment rows are not dead doors.
    editLocked: () => editingLocked(run, xpCombat),
    onArmoury: (view) => {
      const combatArmoury = app.querySelector('#combat-armoury');
      closeOverlay();
      if (!combatArmoury) return showArmoury(view);
      combatArmoury.dataset.equipView = view;
      combatArmoury.click();
      delete combatArmoury.dataset.equipView;
    },
    onLoad: loadActiveSlot,
    onQuitWithoutSave: quitWithoutSaving,
    onSave: () => saveNow(),
    onQuit: () => {
      persist(); // the run is resumable from its slot via Continue
      showCollapsedTitle();
    },
  });
}

// A run-history record (SPEC §3.12) — enriched so the history screen can show
// class, progress, and per-class win rates.
function runResult(victory) {
  return {
    victory,
    seed: run.seedString,
    class: run.class,
    className: runClassIdentity(registries, run).name,
    act: run.actNumber,
    floor: run.floor,
    fightsWon: run.stats.fightsWon,
    damageDealt: run.stats.damageDealt,
    damageTaken: run.stats.damageTaken,
    name: run.customization && run.customization.name,
    custom: isCustomRun(run.custom),
    ascension: (run.custom && run.custom.ascension) || 0,
    // Which bosses fell. beatBoss unlocks need this, and a run that ends in
    // act 3 has already earned the act 1 and 2 kills whatever happens next.
    bosses: [...(run.bossesBeaten || [])],
    // Plan phase 5c: the class-card unlock conditions read these.
    maxClassLevel: peakClassLevel(run),
    bossGroups: structuredClone(run.bossGroups || {}),
  };
}

// Called only after a committed trader purchase stored the item.
function recordCollectedArmament(id, source) {
  if (!carriedIds(run.loadout).includes(id)) return;
  if ((registries.balance.equipment.drops || {}).permanentOnFind) {
    const meta = saves.loadMeta();
    if (!(meta.found || []).includes(id)) {
      meta.found = [...(meta.found || []), id];
      const progressionMode = shotState ? 'showcase' : isCustomRun(run.custom) ? 'custom' : 'normal';
      const recorded = recordArmamentDiscovery(meta, id, {
        progressionMode, source, runSeed: run.seedString,
        receiptLimit: registries.balance.equipment.startingKitDiscovery.receiptLimit,
      });
      saves.saveMeta(recorded.meta);
    }
  }
  // The reward screen persists this mutation together with its Taken state.
  // Saving inside this collector would create an interruption window where
  // storage changed but the resumable reward checkpoint still said pending.
  return true;
}

/**
 * Close out a run: record it, advance the durable progress tally, and hand back
 * anything newly earned. Kept in one place so a defeat and a victory can never
 * disagree about what counts.
 */
async function finishRun(victory) {
  const finishedRun = run, finishedSlot = activeSlot, finishedRegistries = registries, finishedRng = rng;
  const owned = () => run === finishedRun && activeSlot === finishedSlot;
  const checkpoint = () => {
    if (!owned()) throw new Error('The active run changed while completion was pending.');
    stampSkillBonuses(finishedRegistries, finishedRun);
    saves.saveRun(finishedRun, finishedRng, finishedSlot);
  };
  const resultRecord = { ...runResult(victory), gameProfile: finishedRun.gameProfile, runId: finishedRun.runId };
  return commitRunFinishAsync(finishedRun, {
    victory,
    finishId: finishedRun.runId || crypto.randomUUID(),
    checkpoint,
    bank: async () => {
      const knowledge = saves.bankEnemyKnowledge ? await saves.bankEnemyKnowledge(finishedRun) : { ok: true };
      if (!knowledge.ok) throw new Error(`Enemy learning was not saved: ${knowledge.reason}`);
      checkpoint();
    },
    complete: (pending) => saves.withProfile ? saves.withProfile(writer => {
      if (!owned()) throw new Error('The active run changed while completion was pending.');
      const result = { ...resultRecord, victory: pending.victory, finishId: pending.id };
      const completed = completedRunMeta(finishedRegistries, writer.loadMeta(), result);
      const saved = writer.saveMeta(completed.meta);
      if (!saved.ok) throw new Error(`Run results were not saved: ${saved.reason}`);
      return completed.unlocked.map((id) => finishedRegistries.unlocks.find((u) => u.id === id)).filter(Boolean);
    }) : (() => {
      if (!owned()) throw new Error('The active run changed while completion was pending.');
      const result = { ...resultRecord, victory: pending.victory, finishId: pending.id };
      const completed = completedRunMeta(finishedRegistries, saves.loadMeta(), result);
      const saved = saves.saveMeta(completed.meta);
      if (!saved.ok) throw new Error(`Run results were not saved: ${saved.reason}`);
      return completed.unlocked.map((id) => finishedRegistries.unlocks.find((u) => u.id === id)).filter(Boolean);
    })(),
    clear: () => {
      if (!owned()) throw new Error('The active run changed while completion was pending.');
      saves.clearRun(finishedSlot);
      if (saves.hasRun(finishedSlot)) throw new Error('The completed run could not be cleared from its slot.');
    },
  });
}

async function showFinishedRun(victory) {
  const finishedRun = run, finishedSlot = activeSlot, finishedRegistries = registries;
  const result = await finishRun(victory);
  if (run !== finishedRun || activeSlot !== finishedSlot) return result;
  const retry = () => showFinishedRun(victory);
  // Run again is a NEW climb: same class and choices, a new random seed (a
  // rematch is not a replay). It waits for the finished run to be saved away.
  const again = finishedRun.beginChoices ? () => {
    if (run !== finishedRun || activeSlot !== finishedSlot) return undefined;
    return startRunInSlot({ ...structuredClone(finishedRun.beginChoices), gameProfile: finishedRun.gameProfile, seedString: randomSeedString() }, finishedSlot);
  } : null;
  mountGameOver(app, { registries: finishedRegistries, game: finishedRun, victory, earned: result.earned,
    onTitle: showTitle, onHistory: showHistory, onRetry: result.ok ? null : retry, onRunAgain: result.ok ? again : null });
  if (!result.ok) openSaveStatusReview({
    ...runIdentityParts(), savedAt: run.savedAt ?? null, error: result.error, onRetry: retry,
  });
}

function showCustomize(slot = 1, catalog = false) {
  rebuildRegistries(saves.loadMeta().settings || {}, selectedGameProfile);
  if (isConfiguredRun(selectedGameProfile) && !gameModule(selectedGameProfile, 'class-selection')) {
    const defaultClass = gameContent(selectedGameProfile, 'classes')[0];
    return startRunInSlot({ classId: defaultClass.id, seedString: randomSeedString(), gameProfile: selectedGameProfile }, slot);
  }
  mountCustomize(app, {
    gameProfile: selectedGameProfile,
    fixedClasses: isConfiguredRun(selectedGameProfile) ? gameContent(selectedGameProfile, 'classes') : null,
    profileStarterCount: gameModule(selectedGameProfile, 'cards') ? profileStarterCount(gameContent(selectedGameProfile, 'starterDeck')) : 0,
    profileClassUnlocks: gameModule(selectedGameProfile, 'progression')?.classUnlocks === true,
    classAvailable: id => gameProfileClassAvailable(selectedGameProfile, saves.loadMeta(), id),
    registries,
    meta: saves.loadMeta(),
    // A ?shot= boot gets a fixed seed so the field photographs identically on
    // every capture; a real boot still gets a random one.
    defaultSeedString: shotState === 'customize' || shotState === 'components' ? 'SHOWCASE' : randomSeedString(),
    // ?shotClass= / ?shotTint= pose the class figure for a capture. Without
    // them this screen only ever photographs the FIRST class in the first tint,
    // so evidence for a change touching every class × tint showed one of twenty.
    // Unknown values are ignored rather than throwing: a capture list is not a
    // place to fail a boot, and the shot then simply shows the default.
    shotPose: shotState === 'customize'
      ? { classId: shotParams.get('shotClass'), tint: shotParams.get('shotTint') }
      : null,
    onBack: showTitle,
    slot,
    onSettings: showSettings,
    onQuit: quitGame,
    // W2c REPLACE, AT THE WRITE BOUNDARY (FRONTEND-WIREFRAMES W1l/W2c): choosing
    // an occupied slot on the title touched nothing; Begin is where the old
    // climb would be written over, so this is where it is asked, naming both
    // the save that goes and the character that replaces it.
    onStart: (config) => startRunInSlot(config, slot),
    catalog,
  });
}

// W2c REPLACE, AT THE WRITE BOUNDARY: the one gate every new climb passes
// before it writes a slot. An empty slot starts at once; an occupied one asks,
// naming the save that goes and the character that replaces it.
function startRunInSlot(config, slot) {
  // The title's own slot record: the class NAME, as the slot list prints it.
  const existing = saveSlotRecords().find((record) => record.slot === slot)?.summary || null;
  if (!existing) return newRun({ ...config, slot });
  openReplaceSaveReview({
    slot,
    existing: { className: existing.className, facts: slotFacts(existing) },
    replacement: { className: registries.classes.get(config.classId)?.name ?? config.classId, seed: config.seedString },
    tone: (policyAction) => registries.framework.confirmationTone(policyAction),
    returnFocusElement: document.activeElement,
    onConfirm: () => newRun({ ...config, slot }),
  });
  return undefined;
}

// Draft deck builder (Custom Climb): pick cards, then start the climb.
function showDraft() {
  mountDraft(app, {
    registries,
    classId: run.class,
    rng,
    onDone: (picks) => {
      run.deck.push(...picks);
      startClimb();
    },
  });
}

/**
 * SETTINGS THAT ONLY THE MAP CAN SHOW YOU — redraw it under the open menu.
 *
 * Both settings doors apply their change immediately (`applyDisplaySettings`),
 * and that reaches everything expressed as a class or a custom property. The map
 * is not: its zoom and now its reveal mode are read ONCE, at mount, by
 * `mountMap`. So flipping Map reveal used to take effect on the next screen
 * change — which for the one setting whose whole purpose is a side-by-side is
 * the same as not working.
 *
 * Marina's ruling put the toggle in Settings precisely because that is the only
 * surface reachable while you are looking at the thing you are judging. This
 * function is what makes that sentence true. The overlay and the modal both
 * mount on `document.body`, so the map re-renders behind them and is there when
 * they close.
 *
 * NAMED KEYS, NOT "any settings change": a blanket re-mount would redraw the act
 * on every volume nudge, and `mountMap` re-runs the framing camera. The list is
 * the map's own reads — grep `meta.settings` in ui/screens/map.js and
 * model/map/mapknowledge.js and mapboard.js, and they are the keys below.
 *
 * AND "Use flasks outside combat", which the map's Potions control
 * (components/runPotions.js) and the run HUD's flask icons read at mount. A
 * change here replaces `activeMeta`, so without the redraw the map kept
 * refusing Drink after the player had turned it on, and its own redraw after a
 * Potions action re-read the meta it was mounted with
 * (tools/flask-menu-probe.mjs, persistence).
 */
const MAP_REMOUNT_KEYS = ['mapMode', 'mapZoom', 'mapFreePan'];
// Only where a flask surface reads it.
const FLASK_REMOUNT_KEYS = ['useRestorativeFlasksOutsideCombat'];
// A remount that lands while a modal is open (Settings over the map) waits for
// the modal to close. One deferred remount is kept; later changes merge into it.
let deferredMapRemount = null;
function remountMapIfShowing(changed) {
  if (!run || !changed) return;
  if (modalOpen()) {
    if (deferredMapRemount) { Object.assign(deferredMapRemount, changed); return; }
    const pending = { ...changed };
    deferredMapRemount = pending;
    onModalsClosed(() => {
      if (deferredMapRemount === pending) deferredMapRemount = null;
      remountMapIfShowing(pending);
    });
    return;
  }
  const screen = app.querySelector('.mapscreen');
  if (!screen) return;
  const mapKey = MAP_REMOUNT_KEYS.some((k) => k in changed);
  const flaskKey = FLASK_REMOUNT_KEYS.some((k) => k in changed) && !!screen.querySelector('.map-potions, .hud-potions');
  // The flask key only changes what the Potions control offers, so the redraw
  // keeps the destination the player had selected (#1474 review).
  const selectedId = !mapKey && flaskKey ? screen.querySelector('.map-node.selected')?.dataset.node || null : null;
  if (mapKey || flaskKey) showMap({ selectedId });
}

function showMap(opts) {
  if (run.mapGraph?.activityLauncher) {
    app.replaceChildren();
    const screen = document.createElement('section'); screen.className = 'screen game-profile-activities';
    screen.style.cssText = 'max-width:42rem;margin:auto;padding:2rem;display:flex;flex-direction:column;gap:1rem';
    const title = document.createElement('h1'); title.textContent = 'Choose an activity'; screen.append(title);
    for (const id of run.mapGraph.startIds) {
      const node = run.mapGraph.nodes[id], control = document.createElement('button');
      control.textContent = node.label || ({ monster: 'Fight', shrine: 'Rest', merchant: 'Shop', boss: 'Challenge boss' })[node.type] || node.type;
      control.onclick = () => enterNode(id); screen.append(control);
    }
    const menu = document.createElement('button'); menu.textContent = 'Menu'; menu.onclick = () => showOverlay(); screen.append(menu);
    app.append(screen); return;
  }
  // Quick start previews its first fight after the required tree choice.
  // Enter still confirms travel, and every other reachable route can be chosen.
  const suggested = run.quickStart && !run.mapNodeId
    ? run.mapGraph.startIds.find(id => run.mapGraph.nodes[id].type === 'monster') : null;
  const selectedId = typeof opts?.selectedId === 'string' ? opts.selectedId : suggested;
  // The map's music follows the region it stands in (content/music.js).
  audio.music(mapMusicContext(run.environmentRegionId || regionForRun(run)?.id));
  mountMap(app, {
    registries,
    run,
    meta: activeMeta,
    selectedId,
    // A left classic rest site stays enterable until a new node is chosen.
    revisitId: restRevisitNodeId(run),
    onPick: enterNode,
    onSettings: showSettings,
    onSettingsChange: persistSettingsChange,
    onMenu: showOverlay,
    onArmoury: showArmoury,
    onLoad: loadActiveSlot,
    onQuitWithoutSave: quitWithoutSaving,
    quickControls: quickMenuControls,
    onSave: () => saveNow(),
    onQuit: () => {
      persist(); // the run is resumable from its slot via Continue
      showCollapsedTitle();
    },
  });
}

function enterNode(nodeId) {
  // A fight is being entered (startFight's one-frame yield): no second travel.
  if (fightEntryPending) return;
  // Re-entering the node the player stands on is not travel, so no travel sound.
  if (nodeId !== run.mapNodeId) sfx.play('nodeTravel');
  const node = run.mapGraph.nodes[nodeId];
  // Travelling to another node ends a left rest site's re-entry (restRevisit.js).
  clearRestRevisitOnTravel(run, nodeId);
  run.mapNodeId = nodeId;
  const firstVisit = !run.path.includes(nodeId);
  if (firstVisit) run.path.push(nodeId);
  run.floor = node.floor;
  // The destination owns its checkpoint: combat saves the refill together with
  // its encounter receipt, and a failed autosave must not prevent entry.
  if (firstVisit) applyNodeRefill(run, node, { healMult: 1 });

  let kind = node.type;
  if (kind === 'event') {
    const res = node.resolved || { kind: 'fight' };
    if (res.kind === 'event') {
      run.seenEvents.push(res.eventId);
      persist();
      return afterEntryPaint(() => showEvent(res.eventId));
    }
    kind = res.kind; // fight | shrine | treasure
  }

  switch (kind) {
    case 'monster':
    case 'fight':
      return startFight('normal', nodeId);
    case 'elite':
      return startFight('elite', nodeId);
    case 'boss':
      return startFight('boss', nodeId);
    case 'shrine':
      persist();
      // An Unknown node's rest outcome is the field camp (proposal §7.4): a
      // small rest and no services. A shrine node is the Shrine.
      return afterEntryPaint(() => showRest(null, node.type === 'event' ? CAMP_LOCATION : 'shrine'));
    case 'merchant': {
      if (!gameModule(run, 'shops')) { persist(); return showMap(); }
      run.gameProfileOpenShop = `${run.actNumber}:${nodeId}`; persist(); return afterEntryPaint(() => showShop());
    }
    case 'treasure': {
      return afterEntryPaint(() => beginGameProfileReward({ source: 'treasure', after: 'map' }));
    }
    default:
      throw new Error(`Unknown node kind '${kind}'`);
  }
}

// ---- combat ------------------------------------------------------------------------
// Combat options (enemy HP/damage scaling) for a given pool.
function combatMods(pool, encounter = null) {
  let hpMult = 1;
  const enemyStatuses = [];
  const playerStatuses = [];
  // SPEC §13.3: a seat climbed off its authored baseline scales by the tier
  // ratio — exactly 1 at the baseline, so every existing seed's fights roll
  // the HP they always did.
  // A BOSS is scaled by the tier it is MET at (balance.bossTiers): its own
  // seat's tier ratio on HP and move damage, × that tier's boss row — the seat
  // order is drawn per run, so a boss's difficulty cannot be authored.
  let damageMult = 1;
  if (Array.isArray(run.seatOrder)) {
    const boss = bossTierScale(registries, { encounter, tier: run.actNumber });
    hpMult *= boss ? boss.hp : seatTierHpMult(registries, currentSeat(), run.actNumber);
    if (boss) damageMult = boss.damage;
  }
  return { hpMult, damageMult, enemyStatuses, playerStatuses };
}

// The Enter tap paints before the fight is built: building and mounting the
// battlefield is one long synchronous task, so the tap yields a frame first
// (aria-busy marks the wait) and a second tap in that gap is ignored. Capture
// states stay synchronous.
let fightEntryPending = false;
function afterEntryPaint(action) {
  if (shotState || typeof requestAnimationFrame !== 'function') return action();
  const owner = run;
  fightEntryPending = true;
  app.setAttribute('aria-busy', 'true');
  requestAnimationFrame(() => setTimeout(() => {
    fightEntryPending = false;
    app.removeAttribute('aria-busy');
    if (run !== owner) return;
    action();
  }, 0));
  return undefined;
}
function startFight(pool, nodeId) {
  if (fightEntryPending) return;
  return afterEntryPaint(() => startFightNow(pool, nodeId));
}

function startFightNow(pool, nodeId) {
  const encounterId = pool === 'boss'
    ? bossEncounterForNode(registries, run.mapGraph, nodeId, { seat: currentSeat(), tier: run.actNumber })
    : rollEncounter(registries, rng, { pool, seat: currentSeat(), exclude: run.lastEncounters });
  if (pool === 'normal') {
    run.lastEncounters.push(encounterId);
    if (run.lastEncounters.length > 2) run.lastEncounters.shift();
  }
  enterCombat(nodeId, encounterId);
}

function enterCombat(nodeId, encounterId, { resuming = false } = {}) {
  const storedSnapshot = resuming ? run.combatEntered?.snapshot : null;
  // SAVES IN THE WILD ALREADY CARRY THE POISONED SHAPE. Saving during the
  // victory hand-off wrote a checkpoint whose `result` was 'victory', and
  // restoring it mounts a fight that can never end — the run is stuck at a
  // cleared battlefield. commitCombatSnapshot now refuses to write one, but
  // that does nothing for a slot already holding it, so an ended snapshot is
  // dropped here and the run takes the deterministic restart path the
  // encounter receipt alone has always supported. A refought encounter is a
  // far smaller loss than an unplayable slot.
  const savedSnapshot = storedSnapshot && !storedSnapshot.result ? storedSnapshot : null;
  run.combatEntered = { nodeId, encounterId, ...(savedSnapshot ? { snapshot: savedSnapshot } : {}) };
  // The entry receipt is a deterministic recovery checkpoint. An explicit Save
  // Game replaces it with an exact committed-turn snapshot below.
  if (!resuming) persistOrWarn(); // a full store must not block the next fight
  const enc = registries.encounters.get(run.combatEntered.encounterId);
  audio.music(enc.pool === 'boss' ? 'boss' : enc.pool === 'elite' ? 'elite' : 'combat');
  const cm = combatMods(enc.pool, enc);
  const entryRng = run.combatExpansionVersion === 2 && !savedSnapshot ? createRng(rng.seed, rng.getCounters()) : rng;
  let enemyIds = shotState === 'combat' && shotParams.get('shotReaction') === 'counter' ? ['wanderingSoldier', 'wanderingSoldier'] : enc.enemies;
  // Screenshot-only population fixture: initialize real enemies through the
  // normal combat factory; never add actors to a running fight or its DOM.
  // ?shotEnemies=briarHermit,eclipseCantor names the fixture's enemies (sprite-size captures).
  const shotEnemies = shotState === 'combat' ? shotParams.get('shotEnemies') : null;
  if (shotEnemies) {
    const named = shotEnemies.split(',').filter(Boolean);
    if (!named.length || named.some(id => !registries.enemies.get(id))) throw new Error('?shotEnemies: expected known enemy ids, comma separated');
    if (named.length > MAX_ENEMIES_PER_COMBAT) throw new Error(`?shotEnemies: at most ${MAX_ENEMIES_PER_COMBAT} enemies`);
    enemyIds = named;
  }
  const shotEnemyCount = shotState === 'combat' ? shotParams.get('shotEnemyCount') : null;
  if (shotEnemyCount !== null) {
    const count = Number(shotEnemyCount);
    if (!Number.isInteger(count) || count < 1 || count > MAX_ENEMIES_PER_COMBAT) throw new Error(`?shotEnemyCount: expected a whole number from 1 to ${MAX_ENEMIES_PER_COMBAT}`);
    enemyIds = Array.from({ length: count }, (_, index) => enemyIds[index % enemyIds.length]);
  }
  const combat = savedSnapshot ? restoreCombatSnapshot({ registries, rng, expectedGameProfile: run.gameProfile, snapshot: savedSnapshot, fallbackAttackSlotCount: run.equipmentAttackSlotCount, fallbackRemovedAttackSlotIds: run.removedAttackSlotIds, fallbackDerivedStatRuleSnapshot: run.derivedStatRuleSnapshot, fallbackAttributeMode: run.attributeMode, fallbackPoolDeck: isPoolDeckMode(run) }) : createRunCombat({
    registries,
    rng: entryRng,
    run,
    settings: saves.loadMeta().settings || {},
    enemyKnowledgeProfile: saves.loadMeta().enemyKnowledge,
    // The shot door's override, when parked (null otherwise — createCombat
    // then derives the threshold from the loadout receipt, the real path).
    player: shotPoiseMaxOverride != null ? { poiseMax: shotPoiseMaxOverride } : {},
    enemyIds,
    encounter: enc,
    hpMult: cm.hpMult,
    enemyDamageMult: cm.damageMult,
    enemyStatuses: cm.enemyStatuses,
    playerStatuses: cm.playerStatuses,
  });
  stampCombatPlaysEver(run, combat); // pile copies carry the deck copy's lifetime plays (Honed cards)
  if (combat.combatExpansionVersion === 2) {
    const durable = candidate => {
      const committed = commitExpansionCandidate({ run, candidate, nodeId, encounterId,
        saveCandidate: saveCombatCandidate });
      if (committed.ok && (committed.durable !== false || committed.knowledge) && run.enemyKnowledgeState && saves.bankEnemyKnowledge) {
        const learningRun = run, learningSlot = activeSlot;
        saves.bankEnemyKnowledge(learningRun).then(result => {
          // The accepted action already saved the complete pending ledger.
          // A failed profile bank keeps it intact; successful acknowledgments
          // are checkpointed without reopening the encounter or rolling reads.
          // No rng: the saved counters stay those of the combat checkpoint,
          // which ordinary unsaved actions never move (SPEC §3.12).
          if (run === learningRun) { try { saves.saveRun(learningRun, null, learningSlot); } catch (error) { reportAutosaveFailure(error); } }
          if (!result.ok) showSettingsNotice(`Enemy learning remains pending: ${result.reason}`, 'profile');
        }).catch(error => showSettingsNotice(`Enemy learning remains pending: ${error.message}`, 'profile'));
      }
      return committed;
    };
    if (!savedSnapshot) {
      // The entry checkpoint serializes and validates the whole fight (~430 ms
      // at 4x CPU). It is queued until after the battlefield has painted, and
      // is flushed before the first action commits, on page hide, and within
      // 500 ms regardless, so it is always on disk before the player can act
      // (SPEC §3.12: abandoning restarts from it). Captures and a fight that
      // already ended save at once.
      if (shotState || combat.result || typeof requestAnimationFrame !== 'function') {
        durable(combat);
        rng.restoreCounters(entryRng.getCounters());
        combat.rng = rng;
      } else {
        // Same counters the synchronous path stamps: entryRng, frozen here.
        const checkpointRng = createRng(rng.seed, entryRng.getCounters());
        rng.restoreCounters(entryRng.getCounters());
        combat.rng = rng;
        entryCheckpoint.Queue({ run, combat, durable, checkpointRng, nodeId, encounterId });
      }
    }
    combat.beforeCombatCommit = candidate => {
      entryCheckpoint.Flush();
      return durable(candidate);
    };
    if (combat.result) return onCombatEnd(combat.result, combat, enc);
  }
  // A restored combat owns the live loadout copy from its snapshot. Rejoin it
  // to the run so later swaps and the post-combat receipt share one object.
  xpCombat = combat;
  if (savedSnapshot) run.loadout = combat.loadout;
  // `?shotHand=<n>` — STAND WITH A FULLER HAND.
  //
  // A REACH STATE, the same shape and reason as ?shotMaxHp beside it: the
  // hand-layout word (C2) is a claim about how the hand behaves ACROSS hand
  // sizes, and no instrument could pose one — every capture of the combat hand
  // was taken at the opening draw, so "ten cards fit with zero travel" had no
  // photograph and no measurement. The cards enter through drawCards, the door
  // every real draw enters (reshuffle and the handMax overflow included), not
  // through the renderer or the piles directly.
  //
  // LOUD at both edges: a non-integer or out-of-band ask refuses by name, and
  // a deck too small to reach the asked hand refuses rather than photograph an
  // eight-card hand labelled ten — a silent shortfall here would quietly turn
  // every downstream sliver measurement into a fact about a different hand.
  if (shotState === 'combat' && shotParams.get('shotKit') === '1') devKit.drawArmamentKitPreview(combat);
  if (shotState === 'combat' && shotParams.has('shotExpansion')) {
    // Memory-only QA pose. Cards still play through the production interpreter.
    const ids = ['emberDart', 'barrageCounter', 'rimeNeedle', 'drowsingMote', 'shieldBash', 'dodgeRoll', 'blightedTransmute', 'shatterOpportunity'];
    combat.piles.draw.push(...combat.piles.hand);
    combat.piles.hand = ids.map((cardId, index) => ({ cardId, instanceId: `expansion-shot-${index}`, upgraded: false }));
    combat.player.energy = Math.max(combat.player.energy, 6);
    combat.player.energyMax = Math.max(combat.player.energyMax, 6);
    combat.player.maxStamina = combat.player.energyMax;
    combat.player.mana = combat.player.maxMana = Math.max(combat.player.maxMana, 8);
    const control = shotParams.get('shotExpansion');
    if (['sleep', 'paralysis', 'dazed'].includes(control)) {
      combat.enqueue({ effect: { op: 'applyStatus', target: 'self', status: control, stacks: 2 }, source: combat.player, owner: combat.player, target: combat.player });
      while (combat.queue.length) executeAction(combat, combat.queue.shift());
    }
  }
  if (shotState === 'combat' && shotParams.get('shotReaction') === 'counter') {
    if (!(combat.reactionRulesVersion >= 1)) throw new Error('shotReaction=counter requires reaction rules');
    // Memory-only validation pose; choices, payment and returns use production commands.
    combat.piles.draw.push(...combat.piles.hand);
    combat.piles.hand = ['guardCounter', 'sweepingBlow', 'strike'].map((cardId, index) => ({ cardId, instanceId: `reaction-shot-${index}`, upgraded: false }));
    combat.player.energy = combat.player.energyMax = combat.player.maxStamina = 8;
    combat.player.block = 40;
    for (const enemy of combat.enemies) {
      enemy.hp = enemy.maxHp = 100;
      enemy.intent = { kind: 'attack', moveId: 'slash', damage: 7, hits: 1,
        combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single' } };
      enemy.intentRevealed = false;
    }
  }
  if (shotState === 'combat' && shotParams.has('shotHand')) {
    const wantHand = Number(shotParams.get('shotHand'));
    if (!Number.isInteger(wantHand) || wantHand < 1 || wantHand > combat.handMax) {
      throw new Error(`?shotHand=${shotParams.get('shotHand')}: needs a whole number from 1 to handMax (${combat.handMax}).`);
    }
    if (combat.piles.hand.length < wantHand) drawCards(combat, wantHand - combat.piles.hand.length);
    // Reaching DOWN goes through the discard op's own body (discardFromHand) —
    // the same splice, pile and event a played-down hand produces, so a small
    // posed hand carries its honest receipt: the discard pile shows where the
    // cards went.
    if (combat.piles.hand.length > wantHand) discardFromHand(combat, combat.piles.hand.length - wantHand);
    if (combat.piles.hand.length !== wantHand) {
      throw new Error(`?shotHand=${wantHand}: the deck ran out at ${combat.piles.hand.length} cards — this pose cannot reach the asked hand.`);
    }
  }
  if (shotState === 'combat' && shotParams.get('shotArcane') === 'matrix') {
    // A host-state visual fixture, before the renderer receives the combat.
    // It covers all three schema states without client mutation: two configured
    // meters (zero and nonzero) plus one enemy whose config is absent.
    const authored = registries.enemies.get('wanderingSoldier').arcaneExposure;
    if (combat.enemies.length < 3 || !authored || authored.mode !== 'configured') {
      throw new Error('?shotArcane=matrix needs three enemies and the authored Wandering Soldier Arcane Exposure row');
    }
    combat.enemies[0].arcaneExposure = { ...structuredClone(authored), value: 0 };
    combat.enemies[1].arcaneExposure = { ...structuredClone(authored), value: Math.max(1, Math.floor(authored.threshold / 2)) };
    delete combat.enemies[2].arcaneExposure;
  }
  if (shotState === 'combat' && shotParams.get('shotEnemyContext') === 'status') {
    // Dev-only rendered-evidence pose for the contextual enemy tooltip. The
    // shot boot uses memory storage, and this host-state fixture is applied
    // before mount so the browser proves real status presentation without
    // fabricating or editing DOM after render.
    const subject = combat.enemies.find((enemy) => enemy.alive);
    if (!subject || !registries.statuses.has('crimsonBlight')) {
      throw new Error('?shotEnemyContext=status needs a living enemy and Crimson Blight');
    }
    subject.statuses.crimsonBlight = { stacks: 3, duration: 3 };
  }
  // Boss fights open on a name splash (skippable; not repeated on reload-resume).
  const bossIntro = enc.pool === 'boss' && !resuming;
  // The setup log as it stands at mount: what a boss splash sounds on close.
  const openingLog = combat.eventLog.slice();
  mountCombat(app, {
    registries,
    run,
    combat,
    // A fight created here sounds its opening draw and turn stinger; one
    // restored from a save does not replay its history (fx playEventCues).
    // Under a boss splash the cues wait for the splash to close.
    opening: !savedSnapshot && !bossIntro,
    readSettings: () => activeSettings,
    // The second-beat dial lives in meta.settings, and combat has two actions
    // in the table (End Turn, drinking a flask). Same read as the event screen.
    meta: activeMeta,
    onEnd: (result, endedCombat) => onCombatEnd(result, endedCombat, enc),
    onSettings: showSettings,
    onSettingsChange: persistSettingsChange,
    onEditDeck: () => showCombatDeckEditor(combat, nodeId, encounterId),
    onMenu: showOverlay,
    onLoad: loadActiveSlot,
    onQuitWithoutSave: quitWithoutSaving,
    quickControls: quickMenuControls,
    onSave: () => {
      commitCombatSnapshot({ run, combat, nodeId, encounterId });
      entryCheckpoint.Supersede();
      return saveNow();
    },
    onQuit: () => {
      commitCombatSnapshot({ run, combat, nodeId, encounterId });
      entryCheckpoint.Supersede();
      persist();
      showCollapsedTitle();
    },
    showTutorial: !saves.loadMeta().settings.seenTutorial,
    onTutorialDone: () => {
      const meta = saves.loadMeta();
      meta.settings.seenTutorial = true;
      saves.saveMeta(meta);
    },
  });
  if (bossIntro) {
    showBossIntro(
      { name: registries.enemies.get(enc.enemies[0]).name, act: run.actNumber },
      {
        // `?shot=boss` freezes the splash for captures; `&shotBossHold=0`
        // lets it run and close as a player sees it (tools/sound-opening.mjs).
        hold: shotState === 'boss' && shotParams.get('shotBossHold') !== '0',
        onClose: !savedSnapshot ? () => playEventCues(openingLog) : null,
      }
    );
  }
  entryCheckpoint.Schedule();
}

const entryCheckpoint = CreateEntryCheckpoint({
  getRun: () => run,
  clearTimer: timer => clearTimeout(timer),
  setTimer: (callback, delay) => setTimeout(callback, delay),
  requestFrame: callback => requestAnimationFrame(callback),
  reportFailure: error => showSettingsNotice(error.message || 'The combat could not be saved.'),
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') entryCheckpoint.FlushSafely(); });
window.addEventListener('pagehide', entryCheckpoint.FlushSafely);

/**
 * THE FIGHT'S TITLE, ONE HOME: the spoils door is headed with it and the
 * victory beat stands it over the battlefield first. A boss falls by name.
 */
function victoryTitle(enc) {
  if (enc.pool === 'boss') return `${registries.enemies.get(enc.enemies[0]).name.toUpperCase()} FALLS`;
  return enc.pool === 'elite' ? 'ELITE VANQUISHED' : 'VICTORY';
}

async function onCombatEnd(result, combat, enc) {
  const learningRun = run, learningSlot = activeSlot;
  const owned = () => run === learningRun && activeSlot === learningSlot;
  if (saves.bankEnemyKnowledge) {
    const learning = await saves.bankEnemyKnowledge(learningRun);
    if (!owned()) return;
    if (!learning.ok) showSettingsNotice(`Enemy learning remains pending: ${learning.reason}`, 'profile');
    persistOrWarn(); // a full store must not strand the victory
  }
  // Keep the exact terminal replay receipt through every asynchronous bank
  // and animation. Ordinary XP, room completion and the reward/finish receipt
  // are then installed synchronously before the next durable checkpoint.
  if (result === 'victory') await victoryBeat(app.querySelector('.combat'), { title: victoryTitle(enc), ms: registries.balance.ui.victoryBeat.ms });
  if (!owned()) return;
  // A repeated callback for the same terminal combat cannot pay progression
  // twice. Reloads resume the persisted reward receipt after this settlement.
  if (configuredSkillProgression(run)) {
    if (combat.configuredProgressionSettled) return;
    combat.configuredProgressionSettled = true;
  }
  delete run.combatPendingOutcome;
  if (xpCombat === combat) xpCombat = null;
  runCombatEnd(run, combat); // pools, flasks and deficits, as every simulator settles them
  foldCombatPlaysEver(run, combat); // lifetime plays per deck card, for Honed cards
  const xpBefore = {
    character: { ...run.level },
    tracks: Object.fromEntries(Object.entries(run.skills || {}).map(([id, row]) => [id, { level: row.level || 0, xp: row.xp || 0 }])),
  };
  // THE SKILL TRACKS ARE PAID HERE, ONCE (plan phase 4a): the fight kept a
  // receipt of every hit, block, evade and buildup by track; the run's ledger
  // takes it now, win or loss, and climbs whatever the XP buys.
  const configuredProgression = isConfiguredRun(run);
  const skillProgression = configuredSkillProgression(run);
  const trackReceipt = configuredProgression && !skillProgression ? {} : skillXpReceipt(combat);
  for (const [skillId, amount] of Object.entries(trackReceipt)) {
    trackReceipt[skillId] = Math.floor(amount);
  }
  const configuredAwards = skillProgression ? settleConfiguredSkillProgression(registries, run, combat, {
    receipt: trackReceipt, victory: result === 'victory', pool: enc.pool, classMultiplier: 1,
  }) : null;
  const trackAwards = configuredAwards?.trackAwards || (!configuredProgression
    ? applySkillXp(registries, run, trackReceipt) : []);
  // The class track (plan phase 5b) is paid by the run's owner, who knows
  // the door's pool: a won fight, more for a boss; a lost one nothing.
  const classAward = configuredAwards?.classAward || (configuredProgression ? null : awardClassXp(registries, run, { victory: result === 'victory', pool: enc.pool, multiplier: 1 }));
  const progression = skillProgression ? skillLevelNotices(registries, [classAward, ...trackAwards], {
    run,
    usedArmaments: combat.skillXp?.[combat.playerKey || 'player']?.usedArmaments || [],
  }) : [];
  // Character XP is paid now; the level and its stat points wait for the blue
  // Level Up button. Excess XP remains on the ledger after each claim.
  const xpReceipt = combatXpReceipt(registries, {
    victory: result === 'victory', pool: enc.pool, enemies: combat.enemies,
    characterMultiplier: configuredCharacterLevels(run) ? configuredCharacterXpMultiplier(run) : 1,
  });
  const levelXp = isConfiguredRun(run) && !configuredCharacterLevels(run) ? 0 : xpReceipt.total;
  const levelAward = awardLevelXp(registries, run, levelXp, {
    pointsPerLevel: gameModule(run, 'progression')?.attributePointsPerLevel || 0,
    grantStats: !!gameModule(run, 'stats'),
  });
  const levelsEarned = levelAward.levelUps;
  // A weapon swapped mid-fight stays swapped: combat works on copies of the
  // deck's instances, so the run's own copies need the new numbers stamped in.
  if (!configuredProgression) stampDeck(registries, run, undefined, { adoptEquipmentBonuses: combat.equipmentChanged });

  if (result !== 'victory') {
    audio.stopMusic();
    sfx.play('youDied');
    run.hp = 0;
    if (skillProgression) {
      run.combatEntered = null;
      return beginGameProfileReward({ after: 'defeat', progression, noticeOnly: true });
    }
    return showFinishedRun(false);
  }
  // A won fight restores its authored after-combat
  // percent of each pool (0 at the defaults, model/recoveryRules.js).
  applyAfterCombatRecovery(run);

  // A breath between the last blow and the spoils (components/victoryBeat.js):
  // the combat screen is still mounted here, so the beat stands over it and
  // the door opens when it lifts. Reduced motion resolves at once.
  run.stats.fightsWon += 1;
  run.combatEntered = null;
  // The claim id is the one this door has always written (smithingRewardId);
  // a partial rewardChancePct rolls once on the `smith` stream (SPEC §15.3).
  const smithingStoneReceipt = grantSmithingReward(registries, run, enc.pool, smithingRewardId(run, enc.pool), rng);
  // The Stone, its idempotent claim, the cleared combat receipt, every RNG
  // counter used to roll the offer, and the offer itself cross one persistence
  // boundary below. A reload therefore resumes the reward menu instead of
  // losing either the Stone or the other spoils.

  // The receipt reflects the settled (rate-scaled) awards, never raw combat XP.
  // The cinders won are paid here and written into the receipt with the new total, so the spoils line (and a reload of it)
  // shows the number that was paid and never a live recomputation.
  const cindersGained = Math.floor(rollRuneReward(registries, rng, enc.pool, run.relics));
  run.cinders += cindersGained;
  const victoryReceipt = { title: victoryTitle(enc), xpBefore, ...(smithingStoneReceipt ? { smithingStoneReceipt } : {}),
    cinders: { gained: cindersGained, total: run.cinders },
    xpGains: combatXpGains({ awards: [classAward, ...trackAwards], levelGained: levelAward.gained }) };
  const boss = enc.pool === 'boss';
  if (boss) run.bossesBeaten = [...new Set([...(run.bossesBeaten || []), ...enc.enemies])];
  if (boss && run.actNumber >= (gameModule(run, 'routes')?.acts || 3)) return beginGameProfileReward({ after: 'victory', progression, noticeOnly: true, victoryReceipt });
  return beginGameProfileReward({ source: 'combat', after: boss ? 'advanceAct' : 'map', levelOffers: levelsEarned, progression, victoryReceipt, eliteRelic: enc.pool === 'elite' && !!gameContent(run, 'rewards')?.eliteRelic });
}

// ---- non-combat nodes -----------------------------------------------------------------
// THE BAND EVERY ROOM CARRIES (components/runHud.js). The same callbacks the
// map hands its HUD, with the Armoury closing back onto the room that opened
// it. One bag, three rooms, so the merchant cannot offer a menu the Shrine
// does not.
function roomHud(returnTo) {
  return {
    onMenu: showOverlay,
    onArmoury: (view) => showArmoury(view, returnTo),
    onLoad: loadActiveSlot,
    onQuitWithoutSave: quitWithoutSaving,
    quickControls: quickMenuControls,
    onSettingsChange: persistSettingsChange,
    onSave: () => saveNow(),
    onQuit: () => {
      persist(); // the run is resumable from its slot via Continue
      showCollapsedTitle();
    },
  };
}

// The place the Rest screen stands at, kept across its own re-mounts (the
// HUD's remount passes no location). The door that enters a place names it.
let restLocationId = 'shrine';
// THE OPEN VISIT (engine/locations.js): one per stay. A HUD remount re-uses
// it rather than arriving again, so an `arrived` rule fires once per stay
// whatever the screen does; leaving closes it.
let openVisit = null;

function showRest(openPanel = null, locationId = null) {
  if (isConfiguredRun(run) && gameModule(run, 'rest')) {
    audio.music('rest');
    const record = openRestRecord(run, { multiUse: false });
    const visit = beginGameProfileRest(run, `${run.actNumber}:${run.mapNodeId}`);
    persist();
    const leave = () => { markRestLeft(run); persist(); showMap(); };
    const commit = (service, payload) => {
      const before = snapshotRunForDiff(run);
      commitGameProfileRest(registries, run, service, payload);
      if (record) recordRestConsumed(run, service);
      persist(); showRest();
      // The what-changed receipt for the services that change gear or cards. Level-up already ends in its own
      // reward door, so it is skipped. It opens after the screen re-mounts, so the page lock covers the new screen.
      if (service === 'smith' || service === 'upgradeCard') {
        showRunReceipt({ run, registries, before, title: t(service === 'smith' ? 'whatChanged.rest.smith' : 'whatChanged.rest.upgradeCard') });
      }
    };
    const strategize = () => {
      if (!gameModule(run, 'cards')) return commit('strategize', {});
      const draft = createGameProfileRestDraft(run);
      mountDeckEditor(document.body, {
        registries, run: draft, settings: saves.loadMeta().settings || {},
        onDone: () => commit('strategize', { draft }), onCancel: () => showRest(),
      });
    };
    return mountRest(app, { registries, run, meta: saves.loadMeta(), onDone: leave, hud: roomHud(() => showRest()),
      gameProfileRest: { visit, onStrategize: strategize,
        // Core 2: the deck door is free and is not a service, so it never touches the visit's one pick.
        deckEditor: deckDoors().rest ? { onOpen: () => showDeckEditor(() => showRest(), true, null, 'shrine') } : null,
        onCommit: commit, onLeave: leave } });
  }
  if (locationId) restLocationId = locationId;
  audio.music('rest');
  const healMult = 1;
  // THE PLACE IS A CARRIER (plan phase 7, engine/locations.js): its tags'
  // rules mount for the visit, `arrived` fires here and `rested` when the
  // player takes the Rest, and what the place restores is the sum of its
  // tags. The refill is one of those rules (`restFlasks` on `arrived`) —
  // AUTOMATIC, AND BEFORE THE CHOICE. Constantine: "flasks should refill
  // automatically at graces". Arriving is the trigger, so a run that comes to
  // smith is refilled exactly like a run that comes to rest. The counts come
  // from balance.graceRefill through the Advanced debug rows; `bad` is a
  // stored override that is not on the ladder, and it is named in the
  // command log rather than swallowed.
  const { counts, bad } = resolveGraceRefill(saves.loadMeta().settings || {});
  for (const b of bad) {
    dlog('ERROR', `settings.${b.key}: stored value ${JSON.stringify(b.stored)} is not one of the counts this row offers — using ${b.used}.`);
  }
  // The classic map's rest site keeps its own record (restRevisit.js), which
  // stands in for the service state so a re-entry does not refill again.
  const classicRest = true;
  const priorRevisit = run.restRevisit;
  // The Multi-use setting is read once; a record opened now keeps it for the visit.
  const multiUseSetting = settingOn(saves.loadMeta().settings, 'shrineMultiUse');
  const record = classicRest ? openRestRecord(run, { multiUse: multiUseSetting }) : null;
  if (record !== priorRevisit) persist();
  const restState = record;
  if (!openVisit || openVisit.locationId !== restLocationId || openVisit.ctx.run !== run) {
    openVisit = createLocationVisit({ run, registries, rng }, restLocationId, { healMult, refillCounts: counts, restBonus: restRecoveryBonus() });
    // A resumed classic shrine arrives again, and the refill is a top-up so
    // that pours nothing twice. The arrival's effects — the refill, or any
    // rule a later row authors on `arrived` — are written the moment they
    // land, so a reload before the next action does not lose them.
    if (!restState?.refilled) {
      arriveAt(openVisit);
      if (restState) restState.refilled = true;
      persist();
    }
  }
  const visit = openVisit;
  const refill = visit.refill;
  // The smith's services are rolled once per classic visit and kept on the
  // record, so a re-entry shows the same offer. A plain copy saves as JSON.
  let smithServices = null;
  if (visit.services.smith) {
    if (record) {
      if (!record.smithServices) {
        const roll = smithServicesAt(registries, 'shrine', rng);
        record.smithServices = { ...roll, services: [...roll.services] };
        persist();
      }
      smithServices = record.smithServices;
    } else smithServices = smithServicesAt(registries, 'shrine', rng);
  }
  mountRest(app, {
    registries,
    run,
    visit,
    hud: roomHud(() => showRest()),
    openPanel,
    healMult,
    refill,
    meta: saves.loadMeta(),
    // Which smith services this place offers — the table's word, resolved
    // here so the screen reads one answer (a chance of 100 consumes no roll),
    // and only where the place carries the `smith` tag.
    services: smithServices,
    // The deck editor under Rest sites only (SPEC §14.1): where the place
    // carries `deckEdit`; it closes back onto this visit.
    deckEditor: deckDoors(visit.services).rest ? { onOpen: () => showDeckEditor(() => showRest(), true, null, 'shrine') } : null,
    // The classic rest site's re-entry record and its consumed-choice hook.
    revisit: record,
    onConsumed: (kind) => { if (record) { recordRestConsumed(run, kind); persist(); } },
    onReallocate: () => persist(),
    // An assigned point is permanent. It persists the moment it is assigned,
    // not when the player leaves the shrine, for the same reason the
    // reallocation above does: a closed tab must not be able to un-assign it.
    // (His level-value dial is read where the level is reached — onCombatEnd —
    // since the points a level grants are decided there, not here.)
    onLevelUp: () => persist(),
    // E13's toggle: with it on, Rest and Smith re-open the Shrine instead of
    // leaving it, and the screen carries its own LEAVE.
    multiUse: record && typeof record.multiUse === 'boolean' ? record.multiUse : multiUseSetting,
    onDone: () => {
      leaveLocation(visit);
      openVisit = null;
      if (classicRest) markRestLeft(run);
      persist();
      showMap();
    },
  });
}

function beginGameProfileReward({ source = 'combat', after = 'map', levelOffers = 0, progression = [], noticeOnly = false, victoryReceipt = null, eliteRelic = false } = {}) {
  noticeOnly ||= !gameModule(run, 'rewards');
  if (noticeOnly && !progression.length && !victoryReceipt) { persistOrWarn(); return after === 'victory' ? showFinishedRun(true) : after === 'defeat' ? showFinishedRun(false) : after === 'advanceAct' ? advanceAct() : showMap(); }
  const offerId = `${run.actNumber}:${run.mapNodeId}:${source}`;
  if (!noticeOnly) gameProfileRewardOffers(registries, run, rng, { offerId, source });
  run.gameProfilePendingReward = { offerId, source, after, levelOffers, ...(progression.length ? { progression } : {}), ...(noticeOnly ? { noticeOnly } : {}), ...(victoryReceipt ? { victoryReceipt } : {}), ...(eliteRelic ? { eliteRelic } : {}) };
  persistOrWarn(); return showGameProfileReward();
}

function showGameProfileReward() {
  const pending = run.gameProfilePendingReward;
  // ONE SCREEN FOR A WON FIGHT (owner requirement: victory to map in two clicks). A combat reward that carries both a victory
  // receipt and its offer opens the offer door with the spoils strip above the choice: no receipt screen, no Continue first.
  // Receipt-only cases (the final boss, a profile with no rewards module, a receipt with no offer) keep the receipt screen.
  const combined = !!(pending.victoryReceipt && !pending.noticeOnly && !pending.offerDone && pending.source === 'combat'
    && run.gameProfileRewardOffers?.[pending.offerId]);
  if (combined) return mountGameProfileOfferDoor(pending, { combined: true });
  if (pending.victoryReceipt) return mountRewards(app, { registries, run,
    rewards: pending.victoryReceipt, saves, receiptOnly: true,
    // Owner, 2026-10-27: earned attribute points are spent here too; each spend is saved at once.
    onAllocateStat: attributeId => allocateAttributePoint(registries, run, attributeId),
    onPersist: persistContinuing,
    onDone: () => {
      acknowledgeVictoryReceipt(pending, persistContinuing);
      showGameProfileReward();
    },
  });
  if (silenceVictoryLevelNotices(pending)) persistOrWarn();
  if (pending.progression?.length) return mountGameProfileLevelUp(app, { rows: pending.progression, registries, run, onContinue: () => {
    acknowledgeSkillLevelNotices(pending);
    persistOrWarn();
    showGameProfileReward();
  } });
  if (pending.noticeOnly) {
    delete run.gameProfilePendingReward;
    persistOrWarn();
    return pending.after === 'victory' ? showFinishedRun(true) : pending.after === 'defeat' ? showFinishedRun(false) : pending.after === 'advanceAct' ? advanceAct() : showMap();
  }
  // Card ranks (SPEC 13.4o, Core): the rank-ups this victory's track levels queued are offered once, on the
  // existing reward door's rank-up picker, before the reward offer. Skipping one keeps it queued for the next victory.
  if (!pending.rankUpsOffered && coreCardRanks(run)) {
    // The door's rows are fixed the first time it opens and saved with its claim state (rankUpCheckpoint), so a
    // reload after a claim resumes the same door instead of rebuilding rows from the remaining ledger.
    const rankUps = pending.rankUpRows || pendingRankUpRows(registries, run);
    if (!rankUps.length) { pending.rankUpsOffered = true; persistOrWarn(); }
    else return mountRewards(app, { registries, run, saves, rng,
      rewards: { title: 'Rank up', xpGains: { level: 0, tracks: {} }, skillRankUps: (pending.rankUpRows = rankUps) },
      checkpoint: (pending.rankUpCheckpoint ||= {}),
      onPersist: persistContinuing,
      // Rows and claims are saved at once; Continue marks the door done.
      onDone: () => { pending.rankUpsOffered = true; persistOrWarn(); showGameProfileReward(); } });
  }
  // The combined door already took its choice (offerDone): what is left of it is the exit chain, with no second door.
  if (pending.offerDone) return leaveRewardDoor(pending);
  return mountGameProfileOfferDoor(pending, { combined: false });
}

// What follows a taken (or skipped) offer: Elite spoils, then level offers, then the map or the next act. Offer ids and order are fixed.
function leaveRewardDoor(pending) {
  const persistRewardChange = change => transactReward(run, pending.offerId, change, persistContinuing);
  persistRewardChange(() => {
    const live = run.gameProfilePendingReward || pending;
    const { offerDone, ...rest } = live;
    void offerDone;
    delete run.gameProfilePendingReward;
    // Elite spoils (rewards.json eliteRelic): a relic choice after the combat door, before any level offers; an empty pool skips it.
    const eliteId = rest.eliteRelic ? `${rest.offerId}:elite` : '';
    if (eliteId && GameProfileEliteRelicOffer(registries, run, rng, { offerId: eliteId })) {
      run.gameProfilePendingReward = { ...rest, offerId: eliteId, source: 'elite', eliteRelic: false };
    } else if (rest.levelOffers > 0) {
      const offerId = `${rest.offerId}:level:${rest.levelOffers}`;
      gameProfileRewardOffers(registries, run, rng, { offerId, source: 'level' });
      run.gameProfilePendingReward = { ...rest, offerId, source: 'level', levelOffers: rest.levelOffers - 1 };
    }
  });
  if (run.gameProfilePendingReward) return showGameProfileReward();
  if (pending.after === 'advanceAct') return advanceAct();
  showMap();
}

// The offers door. `combined` heads it with the victory title and the spoils strip (cinders, stone, XP, points to spend).
// The receipt is acknowledged in the same save that leaves the door, so a reload on it shows the same strip and nothing is paid twice
// (XP, cinders and stones are paid at combat resolution, before any door opens; the receipt is only their record).
function mountGameProfileOfferDoor(pending, { combined }) {
  const offer = run.gameProfileRewardOffers[pending.offerId];
  const persistRewardChange = change => transactReward(run, pending.offerId, change, persistContinuing);
  const settings = saves.loadMeta().settings || {};
  const receipt = combined ? pending.victoryReceipt : null;
  const spoils = receipt ? VictorySpoils(registries, run, receipt, {
    settings, onPersist: persistContinuing,
    onAllocateStat: attributeId => allocateAttributePoint(registries, run, attributeId),
  }) : null;
  mountGameProfileOffers(app, { registries, run, settings, offer, spoils,
    title: receipt ? (receipt.title || t('reward.title.victory')) : pending.source === 'level' ? 'Level reward' : pending.source === 'elite' ? 'Elite spoils' : 'Victory rewards',
    onTake: index => persistRewardChange(() => claimGameProfileReward(registries, run, pending.offerId, index)),
    // Owner 2026-10-18: a won card may go straight into the deck, or open the editor with it ready; a won item opens the Armoury.
    // Both doors return into the same exit as Continue, and the claim is already persisted, so a reload mid-editor lands back here.
    onAddToDeck: index => persistRewardChange(() => claimGameProfileRewardToDeck(registries, run, pending.offerId, index, saves.loadMeta().settings || {})),
    addRefusal: index => rewardDeckAddRefusal(registries, run, pending.offerId, index, saves.loadMeta().settings || {}),
    deckMax: deckEditBounds(saves.loadMeta().settings || {}).max,
    canEditDeck: !!deckDoors().armoury,
    onEditDeck: (index, back) => showDeckEditor(back, false, run.sideboard.find(card => card.instanceId === rewardInstanceId(pending.offerId, index)) || null, 'rewards'),
    canEditEquipment: !!gameModule(run, 'equipment'),
    // Owner 2026-11-06: the Armoury opened from a reward carries the item, so choosing a slot equips THAT item (no second picker).
    onEditEquipment: (index, back) => showArmoury({ equipItemId: run.gameProfileRewardOffers[pending.offerId]?.options?.[index]?.id || '' }, back),
    onContinue: () => {
      if (!combined) return leaveRewardDoor(pending);
      // The choice is made: drop the receipt and mark the door done in one save, then run what follows (level notices, rank-ups, exit chain).
      persistRewardChange(() => {
        const live = run.gameProfilePendingReward || pending;
        delete live.victoryReceipt;
        live.offerDone = true;
      });
      showGameProfileReward();
    } });
}

// Owner 2026-11-05: after a shop purchase a card may go to the deck (else it stays in the library, as before) and an
// armament may be equipped through the Armoury's own equip flow (else it stays in the inventory, as before).
function offerShopCardDestination(receipt) {
  if (['weapons', 'armor'].includes(receipt?.kind)) return offerShopEquip(receipt.id);
  if (!['combatCards', 'weaponArts'].includes(receipt?.kind) || !receipt.instanceId) return;
  const settings = saves.loadMeta().settings || {};
  openShopCardChoice({
    name: registries.cards.get(receipt.id)?.name || receipt.id,
    refusal: (code => !code ? '' : code === 'full' ? t('reward.configured.deckFull', { max: deckEditBounds(settings).max }) : t('reward.configured.deckLimit'))(shopCardDeckRefusal(registries, run, receipt.instanceId, settings)),
    onDeck: () => { addPurchasedCardToDeck(registries, run, receipt.instanceId, settings); persist(); showShop(); },
  });
}
function shopArmamentBought(id) { recordCollectedArmament(id, 'shop'); offerShopEquip(id); }
function offerShopEquip(id) {
  if (isConfiguredRun(run) && !gameModule(run, 'equipment')) return;
  const def = (registries.equipment.armaments || []).find(row => row.id === id) || (registries.equipment.armour || []).find(row => row.id === id);
  openShopArmamentChoice({ name: def?.name || id, onEquip: () => showArmoury({ equipItemId: id }, showShop) });
}

function showShop() {
  if (!gameModule(run, 'shops')) return showMap();
  const shopId = run.gameProfileOpenShop || `${run.actNumber}:${run.mapNodeId}`;
  run.gameProfileOpenShop = shopId;
  // Core (owner ruling 2026-10-28): a share of shop nodes is a Blacksmith, decided from the run seed and the node.
  // The kind rides run.shopStock, so a reload and the ?shot=blacksmith door reach the same screen.
  if (configuredShopKind(run, shopId) === 'blacksmith') {
    if (shopStockKind(run.shopStock) !== 'blacksmith') run.shopStock = blacksmithVisitStock(registries, rng, run, { });
    persist(); audio.music('shop');
    return mountBlacksmith(app, { registries, run, meta: saves.loadMeta(), hud: roomHud(showShop),
      onChanged: () => persist(), onArmamentPurchased: shopArmamentBought, onCardPurchased: offerShopCardDestination,
      onLeave: () => { run.shopStock = null; delete run.gameProfileOpenShop; persist(); showMap(); } });
  }
  const offer = gameProfileShopStock(registries, run, rng, { shopId }); persist();
  audio.music('shop');
  return mountConfiguredShop(app, { registries, run, offer, meta: saves.loadMeta(), hud: roomHud(showShop),
    onTake: (index, quote) => {
      const receipt = purchaseGameProfileShopOffer(registries, run, shopId, index, rng, quote); persist(); showShop();
      offerShopCardDestination(receipt);
    },
    onSell: quote => { commitGameProfileShopSale(registries, run, shopId, quote); persist(); showShop(); },
    onLeave: () => { delete run.gameProfileOpenShop; persist(); showMap(); } });
}

function showEvent(eventId) {
  mountEvent(app, {
    registries,
    run,
    hud: roomHud(() => showEvent(eventId)),
    // The hold-to-confirm dial lives in meta.settings; the screen reads it the
    // same way every other screen reads a display setting.
    meta: saves.loadMeta(),
    rng,
    eventId,
    onDone: () => {
      if (run.combatEntered) {
        // A startCombat effect stored the encounter id (string form).
        const encounterId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
        run.combatEntered = null;
        return enterCombat(run.mapNodeId, encounterId);
      }
      persist();
      showMap();
    },
  });
}

// Dev screenshot hook (?shot=map|combat|fx|death): boot straight into a seeded
// showcase run so headless captures (tools/screenshot.mjs) can photograph
// deeper screens without interaction. `fx` poses the combat FX frozen
// mid-animation (negative animation-delay + paused) so the transient slash /
// glyph / spark / recoil effects are photographable. `death` mounts the game-over
// screen on a spent run — added because YOU PERISHED was the one screen no tool
// could photograph, so its contrast could only ever be inferred from the
// stylesheet, and an inferred number is the adjacent thing, not the thing.
// Normal boots unaffected.
//
// `shotState` is declared beside pickStorage() near the top of this file, not
// here, because storage selection reads it: a ?shot= boot runs on memory storage
// so it cannot touch the player's save. See the comment there for what it broke.
// That gate is `if (shotState)` — truthy, not a list of states — so `death` is
// inside it by construction and needs no guard of its own. Do not re-read
// location.search down here to add a state: the single const IS the gate's reach.

function poseFxShowcase() {
  const layer = document.querySelector('.fx-layer');
  const enemies = [...document.querySelectorAll('.combatant.enemy .sprite')];
  const player = document.querySelector('.combatant.player .sprite');
  if (!layer || !enemies.length || !player) return;
  // Container: THE FX LAYER — these are `position: absolute` children of
  // `.fx-layer`, so the layer is the containing block and the bound, NOT the
  // viewport (the layer is `inset: 0` over the combat board only).
  //
  // EldenSpire#15 listed this site as "already differences a rect against the
  // layer's own rect — may be correct." It was not. Differencing two visual rects
  // gives a visual delta, and `style.left` reads local: byte-for-byte the deviant
  // removed from tutorial.js in 3a0def9, missing only the `/ z`. Measured at seven
  // viewports: the miss runs from −400 local px at zoom 0.62 to +822 at 1.70, dead
  // on only at 1.00, and at 1.48 and above two of the five elements sat outside the
  // layer entirely. Dev-only (`?shot=fx`) — so no player saw it, and every
  // screenshot this repo has ever used as evidence did.
  //
  // `anchorLocalBox` is exactly this arithmetic with the conversion in it, so the
  // hand-rolled copy goes and the one home takes it. The dx/dy extras were already
  // local px, authored in the same space as fx.js floatNum's own −14, and stay.
  const view = anchorLocalBox(layer, layer);
  const put = (cls, text, anchor, atMs, extra) => {
    const b = anchorLocalBox(layer, anchor);
    const el = document.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    const at = clampBox(
      {
        left: b.left + b.width / 2 + ((extra && extra.dx) || 0),
        top: b.top + b.height * 0.4 + ((extra && extra.dy) || 0),
        width: 0, // a point, not a box: these elements are centred by their own CSS
        height: 0,
      },
      view,
      { pad: 0 }
    );
    el.style.left = `${at.left}px`;
    el.style.top = `${at.top}px`;
    el.style.animationDelay = `-${atMs}ms`; // jump mid-animation…
    el.style.animationPlayState = 'paused'; // …and hold the frame
    layer.appendChild(el);
  };
  const e0 = enemies[0];
  const e1 = enemies[1] || enemies[0];
  put('fx-slash', '', e0, 120);
  put('float-num crit', '-26', e0, 200, { dy: -34 });
  put('fx-spark', '*', e1, 140);
  put('float-num blk small', 'BLOCKED', e1, 220, { dy: -30 });
  put('fx-glyph', '*', player, 170);
  // Victim recoil held mid-knockback; the second enemy teeters (stagger).
  e0.classList.add('hitflash', 'hit-heavy');
  if (e0.firstElementChild) {
    e0.firstElementChild.style.animationDelay = '-95ms';
    e0.firstElementChild.style.animationPlayState = 'paused';
  }
  if (e1 !== e0) {
    e1.classList.add('wobble');
    if (e1.firstElementChild) {
      e1.firstElementChild.style.animationDelay = '-110ms';
      e1.firstElementChild.style.animationPlayState = 'paused';
    }
  }
}

// Dev-only float probe (#69). Screenshot modes are already dev-only, and this
// hands the harness the REAL floatNum so a clipping assertion measures the
// shipped path — including the multi-codepoint strings, where any width GUESS
// lies worst. Never reachable without a ?shot= URL.
if (shotState) {
  // Read-only debug handle, same species as `window.__combat` and `__uiScale`:
  // tools/holdconfirm.mjs measures the profile beats (deleteSave's arm, the
  // restore confirm, the fresh-profile confirm), and "the confirm committed"
  // is a claim about STORAGE STATE, not about which screen happens to be
  // mounted next — navigation after `.go` is unconditional, so the screen
  // alone cannot witness the write. This reads the manager's own named state
  // (profileStatus), never a copy of it. Shot boots only; a player never has it.
  window.__profile = () => saves.profileStatus();
  // The DRAWER, read-only, same species. profileStatus().archiveId is a
  // READ-TRANSIENT — loadMeta() re-derives the whole status on every clean
  // read (save.js), and mounting the title now performs such a read (the
  // delete beat's dial). So "the old bytes are KEPT" is not a claim that
  // pointer can carry across a navigation; the archive list is where the
  // promise actually lives, and this hands the harness that list.
  window.__archives = () => saves.listArchives();
  // THE RUN'S named state — the exact twin of __profile above, same species
  // again: read the manager's own runStatus(), never a copy. It exists because
  // the run door was the silent one. A save missing its allocation, loadout or
  // flask ledger came back healed with a plausible substitute and nothing
  // downstream could tell it from a clean load. This hands a harness the door's
  // own account of what it did and what it overwrote. Read-only, shot boots only.
  // NOT a player-facing surface: what a PLAYER should be told when their save
  // was repaired is wording, and wording is not this seat's to write.
  window.__runstatus = () => saves.runStatus();
  window.__rewardStateForShot = () => {
    const snapshot = row => row ? structuredClone({
      deckIDs: (row.deck || []).map(card => card.cardId),
      sideboardIDs: (row.sideboard || []).map(card => card.cardId),
      cinders: row.cinders,
      loadout: row.loadout,
      flasks: row.flasks,
      relics: row.relics,
      sigils: row.sigils,
      consumables: row.consumables,
      pendingReward: row.gameProfilePendingReward || null,
      offers: row.gameProfileRewardOffers || null,
    }) : null;
    return { live: snapshot(run), saved: snapshot(saves.loadRun(registries, activeSlot)) };
  };
  // Rest QA reads the live transaction and its actual persisted slot. No
  // mutable references escape, and this handle exists only in shot boots.
  if (shotState === 'rest' || shotState === 'smith') window.__restStateForShot = () => {
    const snapshot = row => row ? structuredClone({
      hp: row.hp, maxHp: row.maxHp, mana: row.mana, maxMana: row.maxMana,
      stamina: row.stamina, maxStamina: row.maxStamina,
      flaskCharges: row.flaskCharges, visitId: row.gameProfileRestVisitId,
      visit: row.gameProfileRestVisits?.[row.gameProfileRestVisitId] || null,
      deck: row.deck, sideboard: row.sideboard, attributes: row.attributes, level: row.level,
      itemUpgradeLevels: row.itemUpgradeLevels, smithingStones: row.smithingStones,
      loadout: row.loadout, mapNodeId: row.mapNodeId, restRevisit: row.restRevisit,
    }) : null;
    return { live: snapshot(run), saved: snapshot(saves.loadRun(registries, activeSlot)) };
  };
  // The creation probe reads both the live deck and the shot's memory save.
  window.__startingAbilities = () => {
    const saved = saves.loadRun(registries, activeSlot);
    const cards = row => (row?.deck || []).filter(inst => inst.abilityRank === 1).map(inst => ({ cardId: inst.cardId, abilityRank: inst.abilityRank }));
    return { live: cards(run), saved: cards(saved) };
  };
  // THE FLASKS, read-only, same species: the live run's flask ledger and
  // carried potions beside the slot's saved copy, and the stored "Use flasks
  // outside combat" setting. tools/flask-menu-probe.mjs proves a map Potions
  // action and a setting change are SAVED, which a shot boot's memory storage
  // hides from any localStorage read. Shot boots only; a player never has it.
  window.__flasks = () => {
    const saved = saves.loadRun(registries, activeSlot);
    const charges = (r) => (r && r.flaskCharges ? { hp: r.flaskCharges.hpCurrent, mana: r.flaskCharges.manaCurrent } : null);
    const carried = (r) => (r ? (r.flasks || []).map((f) => f.flaskId) : null);
    return {
      charges: charges(run), savedCharges: charges(saved),
      carried: carried(run), savedCarried: carried(saved),
      savedOutsideCombat: ((saves.loadMeta() || {}).settings || {}).useRestorativeFlasksOutsideCombat ?? null,
    };
  };
  // THE SPOILS, read-only, same species again — a shot boot runs on MEMORY storage
  // (pickStorage above), so no localStorage read can witness those writes —
  // holdconfirm's own sentence applies: "it committed" is a claim about
  // storage state, not about which screen is mounted. This reads the manager's
  // own loadMeta and the live run, never a copy. The map slice is the drive's
  // door finder: it needs a real treasure node to click, and the graph is run
  // state. Read-only, shot boots only; a player never has it.
  window.__spoils = () => {
    const saved = saves.loadRun(registries, activeSlot);
    return {
    found: [...((saves.loadMeta() || {}).found || [])],
    storage: [...(((run || {}).loadout || {}).storage || [])],
    savedStorage: [...((((saved || {}).loadout || {}).storage) || [])],
    // Receipt COUNT only. Boundary, stated: a shot boot's progressionMode is
    // 'showcase', in which recordArmamentDiscovery deliberately writes no
    // receipt — so through this door the count is structurally 0 and proves
    // ordering nothing on its own; found-unchanged is the real witness,
    // because found and receipts ride the same gated saveMeta.
    receipts: ((saves.loadMeta() || {}).discoveryReceipts || []).length,
    liveDeck: [...((run || {}).deck || [])].map((card) => card.cardId),
    savedDeck: [...((saved || {}).deck || [])].map((card) => card.cardId),
    smithingStones: run?.smithingStones ?? null,
    savedSmithingStones: saved?.smithingStones ?? null,
    pendingReward: run?.gameProfilePendingReward ? structuredClone(run.gameProfilePendingReward) : null,
    savedPendingReward: saved?.gameProfilePendingReward ? structuredClone(saved.gameProfilePendingReward) : null,
    done: rewardDoneCount,
    map: run && run.mapGraph
      ? Object.values(run.mapGraph.nodes).map((n) => ({ id: n.id, floor: n.floor, type: n.type, next: [...(n.next || [])] }))
      : [],
    };
  };
  // `which` picks the anchor: 'last' is the RIGHTMOST combatant, which is where
  // the clipping lives — a probe anchored to the leftmost cannot reproduce the
  // defect and would be a green that can't fail.
  window.__fxProbe = (text, cls = 'dmg', which = 'last') => {
    const layer = document.querySelector('.fx-layer');
    const all = [...document.querySelectorAll('[data-eid]')]
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const host = which === 'first' ? all[0] : all[all.length - 1];
    const anchorEl = host && (host.querySelector('.sprite') || host);
    if (layer && anchorEl) fxFloatNum(layer, anchorEl, text, cls);
  };
}

// THE FIRST SCREEN WAITS FOR THE BUILT-IN ART (docs/EXTERNAL-ASSETS-PLAN.md
// §3, step 3a). The web edition carries no art inside it: src/ui/assetPacks.js
// loads the pack index the HTML pins, and a screen drawn before that would ask
// for `assets/…` paths that are not beside the page, and the images' own error
// handlers would swap in placeholders for good. So the first screen is drawn
// once the load has SETTLED — loaded, or failed (placeholders), which it is by
// BOOT_WAIT_MS at the latest; a late index is dropped, never laid over a screen
// already drawn on placeholders. A single file and the source tree pin
// nothing, and this calls showFirstScreen() at once.
function showFirstScreen() {
  if (!shotState) return showFirstScreenNow(null);
  // A posed `?shot=` state waits for the lazily loaded dev modules.
  devModules.then(([shots, kit]) => { devKit = kit; showFirstScreenNow(shots.createShotStates); });
}
function showFirstScreenNow(createShotStates) {
  // The posed `?shot=` states live in src/dev/shotStates.js. The table is built
  // here, on each call, so the ctx getters see the bindings as they stand now.
  const shotStates = shotState ? createShotStates({
    saves, shotParams, bootStorage, app,
    newRun, showMap, enterCombat, startFight, showEvent, persist, showRest, showShop,
    beginGameProfileReward, poseFxShowcase, showTitle, showHistory, showProfile,
    showSettings, showStartupGate, showCustomize,
    getRun: () => run, getRng: () => rng, getRegistries: () => registries,
    setActiveMeta: (value) => { activeMeta = value; },
    setActiveSettings: (value) => { activeSettings = value; },
    setShotPoiseMaxOverride: (value) => { shotPoiseMaxOverride = value; },
  }) : null;
  const pose = shotStates && Object.hasOwn(shotStates, shotState) ? shotStates[shotState] : null;
  if (pose) {
    pose();
    return;
  }
if (pageDebug() && autoLoadEnabled()) {
  // YOUR DEFAULTS FROM GITHUB (Settings → Advanced → Defaults & sync). Only on
  // a debug build, only when this device opted in, and never for a photograph
  // (a posed ?shot= state takes the branches above). The title — Continue and
  // New Game — waits for it, at most PROFILE_WAIT_MS, so no run starts on the
  // settings the profile is about to replace; a profile later than that is
  // left for the next start rather than applied mid-session.
  const PROFILE_WAIT_MS = 3000;
  let waiting = true;
  const loaded = autoLoadProfile({ settings: activeSettings, onChange: persistSettingsChange, rows: settingsRows(), stillWanted: () => waiting,
    promoted: promotionFor(SETTINGS_DEFAULTS, promotionDebug()).values })
    .then((result) => { if (result.applied) console.info(`settings profile: ${result.applied} setting(s) loaded from GitHub.`); })
    .catch((error) => console.warn(`settings profile: not loaded — ${error.message}`));
  const profileSettled = Promise.race([loaded, new Promise((settle) => setTimeout(settle, PROFILE_WAIT_MS))])
    .finally(() => { waiting = false; });
  if (gateFirst) {
    // A pack build's cold boot draws the gate at once (step 5): the profile
    // keeps loading behind it, and the title waits for it as well as the art.
    holdTitleFor(profileSettled);
    showTitle();
  } else {
    profileSettled.finally(() => showTitle());
  }
} else {
  showTitle();
}
}
// THE COLD BOOT DRAWS THE GATE AT ONCE (step 5). The startup gate shows no
// pack art through an <img> (its backdrops are ASSET_CSS, which arrive with the
// load), so in a pack build the gate is drawn before the load settles, with its
// status line; every other first screen (a ?shot= state) still waits for the
// load, behind the static boot line, as step 3a made it.
const gateFirst = packsPinned() && (!shotState || shotState === 'startup');
const dropBootLine = gateFirst ? () => {} : bootLine(app);
// The boot load asks for the tier Art quality names (Auto decides from the
// layout applyUiScale has already written); a switch later re-points the
// images on screen the same way the first load does.
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
}, { onSource: builtInArtArrived, tier: requestedTier(activeSettings) });
if (gateFirst) {
  startBootArt({ settled: builtInArtSettled(), source: builtInSource });
  showFirstScreen();
}
