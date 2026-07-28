// src/main.js — boot + run orchestrator (SPEC §7.1)
//
// M2 flow: Title → class select → act map → [combat | shrine | shop | event |
// treasure] → … → boss → game over. One rng is created from the seed and its
// stream counters are saved with the run after every committed choice, so a
// whole run is reproducible from its seed string and a reload restores
// exactly (mid-combat: the combat restarts from its start — StS behavior,
// because counters are saved BEFORE the combat begins).

import { contentBundle } from './content/index.js';
import { validateContent } from './model/validate.js';
import { createRegistries } from './model/registries.js';
import { createRunState, createDeck, createIdGen } from './model/state.js';
import { runMods, stampDeck, addToStorage, carriedIds } from './model/loadout.js';
import { recordProgress, evaluateUnlocks } from './model/unlocks.js';
import { activeMods, isCustomRun, endlessActInfo, ENDLESS_HP_PER_LOOP, ENDLESS_STR_PER_LOOP } from './content/customMods.js';
import { createRng, seedToString, seedFromString } from './engine/rng.js';
import { createCombat } from './engine/combat.js';
import { generateActMap } from './engine/mapgen.js';
import { createSaveManager, createMemoryStorage } from './engine/save.js';
import {
  rollEncounter,
  rollRuneReward,
  rollCardRewardIds,
  rollFlaskDrop,
  rollRelicReward,
  buildShopStock,
  resolveUnknownNode,
  rollArmamentDrop,
} from './engine/encounters.js';
import { mountTitle } from './ui/screens/title.js';
import { mountCustomize } from './ui/screens/customize.js';
import { mountCustomRun } from './ui/screens/customRun.js';
import { mountDraft } from './ui/screens/draft.js';
import { KEEPSAKES } from './content/keepsakes.js';
import { executeRunEffects } from './engine/actions.js';
import { mountMap } from './ui/screens/map.js';
import { mountCombat } from './ui/screens/combat.js';
import { mountRewards } from './ui/screens/reward.js';
import { mountRest } from './ui/screens/rest.js';
import { mountShop } from './ui/screens/shop.js';
import { mountEvent } from './ui/screens/event.js';
import { mountGameOver } from './ui/screens/gameover.js';
import { mountHistory } from './ui/screens/history.js';
import { openSettings } from './ui/screens/settings.js';
import { mountEquipment } from './ui/screens/equipment.js';
import { openOverlay } from './ui/components/overlay.js';
import { showBossIntro } from './ui/components/intro.js';
import { initInput, setBindings, setKeyBindings } from './ui/input.js';
import { setSpritesEnabled, classGlyph, setClassGlyphs } from './ui/assets.js';
import { mountLobby } from './ui/screens/lobby.js';
import { mountCoop } from './ui/screens/coop.js';
import { lanInfo } from './net/lan.js';
import { setAnimSpeed } from './ui/fx.js';
import { sfx } from './ui/sfx.js';
import { initAudio } from './ui/audio.js';

const app = document.getElementById('app');

// ---- content validation at boot (SPEC §3.14) — loud, on-screen -------------
const validation = validateContent(contentBundle);
if (!validation.ok) {
  const banner = document.createElement('div');
  banner.className = 'validation-banner';
  banner.textContent =
    `CONTENT VALIDATION FAILED (${validation.errors.length} errors)\n` +
    validation.errors.slice(0, 12).map((e) => ` · ${e.path}: ${e.msg}`).join('\n');
  document.body.prepend(banner);
  console.error('Content validation errors:', validation.errors);
}

const registries = createRegistries(contentBundle);
setClassGlyphs(registries.classes.all()); // class sigils are data (class defs)

// Dev screenshot hook (?shot=…). Read HERE, above pickStorage(), because storage
// selection depends on it; the hook that consumes it lives at the bottom of this
// file where the states are listed. One read, one home — parsing the query string
// twice would be the same fact in two places.
const shotState = new URLSearchParams(location.search).get('shot');

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
const saves = createSaveManager(pickStorage());

// Procedural audio engine (SPEC §7.4). The sink plugs into the existing sfx
// hook seam, so every sfx.play() call site makes sound with no change.
const audio = initAudio(saves.loadMeta().settings || {});
sfx.sink = (id) => audio.sfx(id);

// Keyboard + gamepad navigation (SPEC §7.3). Bindings live in meta.settings.
initInput({ getSettings: () => saves.loadMeta().settings || {} });

// All presentation config is data (content/balance.js → balance.ui): accent
// palettes, UI zoom scale, text sizes. Code never embeds these numbers.
const UI = registries.balance.ui;
const ACCENTS = UI.accents;

// Apply persisted display settings at boot (defaults: sprites on, motion normal).
let lastMusicFolder;
// UI size — the whole app is zoomed by `body.style.zoom` so every fixed-px
// element (cards, sprites, map nodes, menus) scales together. "Auto" flexes the
// zoom with the window against a design baseline so the board fills big screens
// and shrinks to fit small ones; S–XL are fixed overrides. Legacy numeric values
// ('90'/'100'…) still resolve. Clamped so it never gets unusably tiny/huge.
const UI_NAMED = UI.uiScale.named;

function computeAutoZoom() {
  if (typeof window === 'undefined') return 1;
  const z = UI.uiScale;
  const fit = Math.min(window.innerWidth / z.designW, window.innerHeight / z.designH);
  return Math.max(z.min, Math.min(z.max, Math.round(fit * 100) / 100));
}

function resolveZoom(uiScale) {
  const key = String(uiScale == null ? 'auto' : uiScale).toLowerCase();
  if (key === 'auto') return computeAutoZoom();
  if (UI_NAMED[key] != null) return UI_NAMED[key];
  // Anything else (incl. legacy numeric '90'/'100'/'110'/'125') is Auto: the
  // settings UI displays such values as Auto, so behaving as fixed zoom made
  // the control look dead ("scaling stopped working").
  return computeAutoZoom();
}

function applyUiScale(settings) {
  const z = resolveZoom(settings.uiScale);
  // Set as a CSS var so base.css can compensate the body's width/height for the
  // zoom (avoids the zoom×100vh overflow). Any leftover inline zoom is cleared.
  document.body.style.zoom = '';
  document.documentElement.style.setProperty('--ui-zoom', String(z));
}

// Re-flex Auto sizing whenever the window changes. Only recomputes for Auto and
// only touches the zoom, so it's cheap. Also re-applies shortly after boot and
// on `load` — some environments report tiny window dims until layout settles,
// which would otherwise freeze Auto at the clamp floor.
let uiResizeTimer = null;
function reflexAutoScale() {
  const s = (saves.loadMeta().settings) || {};
  if (String(s.uiScale == null ? 'auto' : s.uiScale).toLowerCase() === 'auto') applyUiScale(s);
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    clearTimeout(uiResizeTimer);
    uiResizeTimer = setTimeout(reflexAutoScale, 150);
  });
  window.addEventListener('load', reflexAutoScale);
  setTimeout(reflexAutoScale, 300);
}

function applyDisplaySettings(settings) {
  setSpritesEnabled(settings.useSprites !== false);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion === true);
  document.body.classList.toggle('hi-contrast', settings.highContrast === true);
  // Text size sets the root font-size %; because all type + component dimensions
  // are rem, one value rescales the whole UI (base.css). Legacy boolean largeText
  // maps to L. Stacks with --ui-zoom (which additionally scales px hairlines).
  const TEXT_SIZES = UI.textSize;
  const tKey = TEXT_SIZES[settings.textSize] ? settings.textSize
    : (settings.largeText === true ? 'L' : 'M');
  document.documentElement.style.fontSize = TEXT_SIZES[tKey];
  document.body.classList.toggle('no-shake', settings.screenShake === false);
  // Card colour motif: mode on the root as a data attr, wash depth as a var, so
  // switching is a re-paint with no re-render. Both defaults live in balance.ui.
  const motif = UI.cardMotifModes.includes(settings.cardMotif) ? settings.cardMotif : UI.cardMotif;
  document.documentElement.dataset.cardMotif = motif;
  const strengths = UI.cardMotifStrength;
  const sKey = strengths[settings.cardMotifStrength] != null ? settings.cardMotifStrength : 'normal';
  document.documentElement.style.setProperty('--card-motif-strength', String(strengths[sKey]));
  document.body.classList.toggle('cb-safe', settings.colorblindSafe === true);
  document.body.classList.toggle('reduce-flashes', settings.reduceFlashes === true);
  document.body.classList.toggle('readable-ui', settings.readableHeadings === true);
  document.body.classList.toggle('hide-hints', settings.controlHints === false);
  document.body.classList.toggle('map-compact', settings.mapHeaderDensity === 'compact');
  document.body.classList.toggle('hide-header-relics', settings.mapHeaderRelics === false);
  document.body.classList.toggle('hide-header-seed', settings.mapHeaderSeed === false);
  // Ambient effects level → data attr read by the title screen (ember count) + CSS.
  const amb = ['off', 'low', 'normal', 'high'].includes(settings.ambient) ? settings.ambient : 'normal';
  document.documentElement.dataset.ambient = amb;
  // Accent theme → CSS variables on the root (falls back to gold).
  const accent = ACCENTS[settings.accent] || ACCENTS.gold;
  const root = document.documentElement.style;
  root.setProperty('--gold', accent.hex);
  root.setProperty('--accent-rgb', accent.rgb);
  // UI size — zoom the whole app (see applyUiScale). Auto flexes with the window.
  applyUiScale(settings);
  setAnimSpeed(settings.animSpeed || 'normal');
  audio.setVolumes(settings);
  // Re-point external music only when the folder actually changed (avoids
  // re-fetching the manifest on every unrelated settings tweak).
  const folder = settings.musicFolder || '';
  if (folder !== lastMusicFolder) {
    lastMusicFolder = folder;
    audio.configureMusic({ folder });
  }
}
applyDisplaySettings(saves.loadMeta().settings);

// ---- run state ----------------------------------------------------------------
let run = null;
let rng = null;
let activeSlot = 1; // which save slot the current run persists to (SPEC §3.12 + slots)

// Autosave the current run to its slot (after every committed choice).
function persist() {
  saves.saveRun(run, rng, activeSlot);
  sendLanStatus();
}

// ---- Forsaken Together (LAN) -------------------------------------------------
// The run is server-authoritative (the launcher owns it via tools/session.mjs);
// the browser is a thin client that renders snapshots and sends intents. Solo
// play never touches any of this.
let inCoop = false;

// A no-op in solo (kept so persist() stays simple); the co-op client, not the
// orchestrator, owns the LAN socket and rendering.
function sendLanStatus() { /* server-authoritative co-op needs no client push */ }
function dropLanLink() { inCoop = false; }

function showLobby() {
  audio.music('title');
  mountLobby(app, {
    registries,
    defaultSeedString: randomSeedString(),
    onBack: () => showTitle(),
    onStart: ({ conn, myId, myIds }) => {
      inCoop = true;
      mountCoop(app, { registries, conn, myId, myIds, onLeave: () => showTitle() });
    },
  });
}

function randomSeedString() {
  return seedToString((Math.random() * 0xffffffff) >>> 0);
}

function newRun({ classId, seedString, customization, keepsakeId, custom, slot = 1 }) {
  activeSlot = slot;
  let seed;
  try {
    seed = seedFromString(seedString || randomSeedString());
  } catch (e) {
    seed = seedFromString(randomSeedString()); // invalid chars → fresh seed
  }
  run = createRunState({ seed, classId, registries });
  run.seedString = seedToString(seed);
  run.customization = customization || { name: 'Forsaken', glyph: '⚔', tint: 'gold' };
  run.custom = custom || { ascension: 0, mods: {}, deckMode: 'standard' };
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = [];
  run.seenEvents = [];
  run.lastEncounters = [];
  rng = createRng(seed);

  // Keepsake: a one-time bundle of run-level effects (content/keepsakes.js).
  const keepsake = KEEPSAKES.find((k) => k.id === keepsakeId);
  if (keepsake && keepsake.effects.length) {
    executeRunEffects({ run, registries, rng }, keepsake.effects);
  }

  // Custom Climb: alternate starting decks + start-of-run rule effects.
  const deckMode = run.custom.deckMode || 'standard';
  const mods = activeMods(run.custom);
  if (deckMode === 'sealed') {
    run.deck = createDeck(sealedDeckIds(classId), createIdGen('rc'));
  } else if (deckMode === 'draft') {
    run.deck = createDeck(draftBaseIds(), createIdGen('rc'));
  }
  if (mods.cursedStart) run.deck.push(...createDeck(['guilt'], createIdGen('cx')));
  if (mods.hoarder) run.cinders += registries.balance.customMods.hoarderCinders;

  if (deckMode === 'draft') return showDraft(); // picks, then proceeds to the map
  startClimb();
}

// After the deck is finalized (incl. any draft), generate the map and go.
function startClimb() {
  buildActMap();
  persist();
  showMap();
}

// Sealed: keep a small basic core, fill the rest with random pool cards.
function sealedDeckIds(classId) {
  const pool = registries.classes.get(classId).cardPool.slice();
  const ids = ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];
  for (let i = 0; i < 3 && pool.length; i++) {
    const id = rng.pick('misc', pool);
    pool.splice(pool.indexOf(id), 1);
    ids.push(id);
  }
  return ids;
}
function draftBaseIds() {
  return ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];
}

// Generate the current act's map and pre-roll every '?' node (stream
// 'events') so outcomes are seed-determined and the Sealstone Key can
// reveal them (SPEC §6).
// Endless Spire: acts past 3 loop back through acts 1-3 content, harder each
// cycle (combatMods). All content lookups go through contentAct(); the real
// run.actNumber keeps counting up for labels, saves, and history.
function endlessOn() {
  return !!(run.custom && activeMods(run.custom).endless);
}
function contentAct() {
  return endlessOn() ? endlessActInfo(run.actNumber).contentAct : run.actNumber;
}

function buildActMap() {
  run.mapGraph = generateActMap({ config: registries.mapConfig(contentAct()), rng });
  const assigned = [];
  for (const node of Object.values(run.mapGraph.nodes)) {
    if (node.type === 'event') {
      node.resolved = resolveUnknownNode(registries, rng, { seenEvents: assigned });
      if (node.resolved.kind === 'event') assigned.push(node.resolved.eventId);
    }
  }
}

// Between acts: ember holds the spire together a little longer.
function advanceAct() {
  run.actNumber += 1;
  run.floor = 0;
  run.mapNodeId = null;
  run.path = [];
  run.lastEncounters = [];
  // Full heal between acts — halved under the "Scarce Embers" custom rule.
  if (run.custom && activeMods(run.custom).lessHealing) {
    run.hp = Math.min(run.maxHp, run.hp + Math.floor((run.maxHp - run.hp) * registries.balance.customMods.lessHealingMult));
  } else {
    run.hp = run.maxHp;
  }
  buildActMap();
  persist();
  showMap();
}

function resumeRun(slot = 1) {
  activeSlot = slot;
  run = saves.loadRun(registries, slot);
  if (!run) return showTitle();
  rng = createRng(run.seed, run.streamCounters);
  if (run.combatEntered && run.combatEntered.encounterId) {
    // Mid-combat save: restart that combat from its start (SPEC §3.12).
    enterCombat(run.combatEntered.nodeId, run.combatEntered.encounterId, { resuming: true });
  } else if (run.shopStock) {
    showShop();
  } else {
    showMap();
  }
}

// ---- screens --------------------------------------------------------------------
function showTitle() {
  audio.music('title');
  run = null;
  dropLanLink(); // a LAN session spans one run; back at the title it's over
  const slots = saves.listSlots().map(({ slot, summary }) => ({
    slot,
    summary: summary && {
      ...summary,
      className: registries.classes.has(summary.class) ? registries.classes.get(summary.class).name : summary.class,
    },
  }));
  mountTitle(app, {
    slots,
    onContinue: (slot) => resumeRun(slot),
    onNew: (slot) => showCustomize(slot),
    onDelete: (slot) => {
      saves.clearRun(slot);
      showTitle();
    },
    onHistory: showHistory,
    onSettings: showSettings,
    onQuit: quitGame,
    onCustom: () => {
      const empty = slots.find((s) => !s.summary);
      showCustomRun(empty ? empty.slot : 1);
    },
    onLan: showLobby,
  });
  // Forsaken Together needs the launcher's server behind the page.
  lanInfo().then((info) => {
    const btn = app.querySelector('#lan-play');
    if (info && btn) btn.hidden = false;
  });
}

function showSettings() {
  openSettings({
    meta: saves.loadMeta(),
    onChange: (changed) => {
      const meta = saves.loadMeta();
      Object.assign(meta.settings, changed);
      saves.saveMeta(meta);
      applyDisplaySettings(meta.settings);
    },
  });
}

/**
 * The Armoury. Outside combat it edits the loadout directly and re-stamps the
 * deck; the chosen view is a setting so it survives the session.
 */
function showArmoury() {
  mountEquipment(document.body, {
    registries,
    run,
    meta: saves.loadMeta(),
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
    onClose: showMap,
  });
}

function showHistory() {
  mountHistory(app, { meta: saves.loadMeta(), onBack: showTitle });
}

// Quit the game entirely. In a real browser tab window.close() is usually
// blocked (the tab wasn't script-opened), so we stop the game and show a
// graceful "safe to close" screen; in a standalone/launcher window the close
// succeeds. Any in-progress run is persisted first, so nothing is lost.
function quitGame() {
  if (run) persist();
  audio.stopMusic();
  run = null;
  app.innerHTML = `
    <div class="screen farewell">
      <h1 class="title-big">THE EMBER GUTTERS</h1>
      <p class="subtitle" style="text-align:center">Your climb is saved. You may close this window.</p>
      <button class="subtle" id="farewell-back">Return to title</button>
    </div>`;
  const closeTimer = setTimeout(() => {
    try {
      window.close();
    } catch (e) {
      /* browser blocked it — the farewell screen stands in */
    }
  }, 120);
  const back = app.querySelector('#farewell-back');
  if (back) {
    back.addEventListener('click', () => {
      clearTimeout(closeTimer); // changed their mind before the window closed
      showTitle();
    });
  }
}

// The in-run tabbed overlay (Deck / Relics / Stats / Settings), shared by the
// map and combat screens via their onMenu callback.
function showOverlay(initialTab = 'deck') {
  if (!run) return;
  openOverlay({
    registries,
    run,
    meta: saves.loadMeta(),
    initialTab,
    onSettingsChange: (changed) => {
      const meta = saves.loadMeta();
      Object.assign(meta.settings, changed);
      saves.saveMeta(meta);
      applyDisplaySettings(meta.settings);
      if (changed.bindings) setBindings(changed.bindings);
      if (changed.keyBindings) setKeyBindings(changed.keyBindings);
    },
    onSave: () => {
      persist();
      return activeSlot;
    },
    onQuit: () => {
      persist(); // the run is resumable from its slot via Continue
      showTitle();
    },
    onExit: quitGame, // "Quit Game" — leave the app entirely
  });
}

// A run-history record (SPEC §3.12) — enriched so the history screen can show
// class, progress, and per-class win rates.
function runResult(victory) {
  return {
    victory,
    seed: run.seedString,
    class: run.class,
    className: registries.classes.get(run.class).name,
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
  };
}

/**
 * Close out a run: record it, advance the durable progress tally, and hand back
 * anything newly earned. Kept in one place so a defeat and a victory can never
 * disagree about what counts.
 */
/**
 * rollDrop(source) → armament id | null, and it is REMEMBERED.
 *
 * Finding a piece does two things at once, which is the whole bargain: it goes
 * into this run's storage so you can use it now, and into the profile's found
 * set so it stays available in every run after — a climb that ends badly still
 * widens the wardrobe.
 */
function rollDrop(source) {
  const meta = saves.loadMeta();
  const id = rollArmamentDrop(registries, rng, {
    source,
    found: meta.found || [],
    carried: carriedIds(run.loadout),
  });
  if (!id) return null;
  addToStorage(run.loadout, id, registries.balance.equipment.storageSlots || 8);
  if ((registries.balance.equipment.drops || {}).permanentOnFind) {
    meta.found = [...(meta.found || []), id];
    saves.saveMeta(meta);
  }
  return id;
}

function finishRun(victory) {
  const result = runResult(victory);
  const meta = saves.recordResult(result);
  meta.progress = recordProgress(meta.progress, result);
  const fresh = evaluateUnlocks(registries.unlocks, meta);
  if (fresh.length) meta.unlocked = [...(meta.unlocked || []), ...fresh];
  saves.saveMeta(meta);
  return fresh.map((id) => registries.unlocks.find((u) => u.id === id)).filter(Boolean);
}

function showCustomize(slot = 1) {
  mountCustomize(app, {
    registries,
    defaultSeedString: randomSeedString(),
    onBack: showTitle,
    onStart: (config) => newRun({ ...config, slot }),
  });
}

function showCustomRun(slot = 1) {
  mountCustomRun(app, {
    registries,
    defaultSeedString: randomSeedString(),
    onBack: showTitle,
    onStart: (config) => newRun({ ...config, slot }),
  });
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

function showMap() {
  audio.music('map');
  mountMap(app, {
    registries,
    run,
    meta: saves.loadMeta(),
    onPick: enterNode,
    onSettings: showSettings,
    onMenu: showOverlay,
    onArmoury: showArmoury,
    onSave: () => {
      persist();
      return activeSlot;
    },
  });
}

function enterNode(nodeId) {
  sfx.play('nodeTravel');
  const node = run.mapGraph.nodes[nodeId];
  run.mapNodeId = nodeId;
  run.path.push(nodeId);
  run.floor = node.floor;

  let kind = node.type;
  if (kind === 'event') {
    const res = node.resolved || { kind: 'fight' };
    if (res.kind === 'event') {
      run.seenEvents.push(res.eventId);
      persist();
      return showEvent(res.eventId);
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
      return showRest();
    case 'merchant': {
      const stock = buildShopStock(registries, rng, run);
      const pm = shopPriceMult();
      if (pm !== 1) {
        for (const kind of ['cards', 'relics', 'flasks']) {
          for (const item of stock[kind]) item.cost = Math.ceil(item.cost * pm);
        }
        stock.removeCost = Math.ceil(stock.removeCost * pm);
      }
      run.shopStock = stock;
      persist();
      return showShop();
    }
    case 'treasure': {
      const relicId = rollRelicReward(registries, rng, run.relics);
      const armamentId = rollDrop('treasure');
      return mountRewards(app, {
        registries,
        run,
        rewards: { relicId, armamentId, title: 'TREASURE' },
        onDone: () => {
          persist();
          showMap();
        },
      });
    }
    default:
      throw new Error(`Unknown node kind '${kind}'`);
  }
}

// ---- combat ------------------------------------------------------------------------
// Custom Climb combat rules → generic createCombat options for a given pool.
function combatMods(pool) {
  const mods = run.custom ? activeMods(run.custom) : {};
  let hpMult = 1;
  const enemyStatuses = [];
  const playerStatuses = [];
  const cm = registries.balance.customMods;
  if ((pool === 'elite' || pool === 'boss') && mods.toughElites) hpMult *= cm.toughElitesHpMult;
  if (pool === 'boss' && mods.bigBosses) hpMult *= cm.bigBossesHpMult;
  if (mods.deadlyEnemies) enemyStatuses.push({ status: 'strength', stacks: 1 });
  if (mods.glassCannon) playerStatuses.push({ status: 'glassCannon', stacks: 1 });
  if (mods.endless) {
    const { loop } = endlessActInfo(run.actNumber);
    if (loop > 0) {
      hpMult *= 1 + ENDLESS_HP_PER_LOOP * loop;
      enemyStatuses.push({ status: 'strength', stacks: ENDLESS_STR_PER_LOOP * loop });
    }
  }
  return { hpMult, enemyStatuses, playerStatuses };
}

function startFight(pool, nodeId) {
  // "Elite Gauntlet" chaos rule promotes ordinary monster nodes to elites.
  if (pool === 'normal' && run.custom && activeMods(run.custom).allElite) pool = 'elite';
  const encounterId = rollEncounter(registries, rng, { pool, act: contentAct(), exclude: run.lastEncounters });
  if (pool === 'normal') {
    run.lastEncounters.push(encounterId);
    if (run.lastEncounters.length > 2) run.lastEncounters.shift();
  }
  enterCombat(nodeId, encounterId);
}

function enterCombat(nodeId, encounterId, { resuming = false } = {}) {
  run.combatEntered = { nodeId, encounterId };
  if (!resuming) persist(); // counters BEFORE the combat → reload restarts it identically
  const enc = registries.encounters.get(encounterId);
  audio.music(enc.pool === 'boss' ? 'boss' : enc.pool === 'elite' ? 'elite' : 'combat');
  const cm = combatMods(enc.pool);
  const combat = createCombat({
    registries,
    rng,
    player: {
      classId: run.class,
      maxHp: run.maxHp,
      hp: run.hp,
      deck: run.deck,
      relicIds: run.relics,
      flasks: run.flasks,
      loadout: run.loadout,
    },
    enemyIds: enc.enemies,
    hpMult: cm.hpMult,
    enemyStatuses: cm.enemyStatuses,
    // `self.*` mods (Strength from an oathsworn set, Regen from a warm habit)
    // enter through the same door Custom Climb buffs already used — the engine
    // has no equipment code, only statuses applied at combat start.
    playerStatuses: [...cm.playerStatuses, ...runMods(registries, run.loadout, run.class).startStatuses],
  });
  const label =
    enc.pool === 'boss'
      ? registries.enemies.get(enc.enemies[0]).name.toUpperCase()
      : enc.pool === 'elite'
        ? `ELITE · FLOOR ${run.floor}`
        : `ACT ${run.actNumber} · FLOOR ${run.floor}`;
  mountCombat(app, {
    registries,
    run,
    combat,
    label,
    onEnd: (result, endedCombat) => onCombatEnd(result, endedCombat, enc),
    onSettings: showSettings,
    onMenu: showOverlay,
    showTutorial: !saves.loadMeta().settings.seenTutorial,
    onTutorialDone: () => {
      const meta = saves.loadMeta();
      meta.settings.seenTutorial = true;
      saves.saveMeta(meta);
    },
  });
  // Boss fights open on a name splash (skippable; not repeated on reload-resume).
  if (enc.pool === 'boss' && !resuming) {
    showBossIntro(
      { name: registries.enemies.get(enc.enemies[0]).name, act: run.actNumber },
      { hold: shotState === 'boss' }
    );
  }
}

function onCombatEnd(result, combat, enc) {
  run.flasks = combat.player.flasks; // drunk flasks stay drunk
  // A weapon swapped mid-fight stays swapped: combat works on copies of the
  // deck's instances, so the run's own copies need the new numbers stamped in.
  stampDeck(registries, run);

  if (result !== 'victory') {
    audio.stopMusic();
    sfx.play('youDied');
    run.hp = 0;
    sendLanStatus({ dead: true });
    saves.clearRun(activeSlot);
    const earnedOnDeath = finishRun(false);
    return mountGameOver(app, { registries, game: run, victory: false, earned: earnedOnDeath, onTitle: showTitle, onHistory: showHistory });
  }

  run.hp = combat.player.hp;
  run.stats.fightsWon += 1;
  run.combatEntered = null;

  if (enc.pool === 'boss') {
    run.bossesBeaten = run.bossesBeaten || [];
    for (const id of enc.enemies) if (!run.bossesBeaten.includes(id)) run.bossesBeaten.push(id);
    // Endless Spire: no summit — the climb loops until death.
    if (run.actNumber >= 3 && !endlessOn()) {
      // The Blighted Valkyrie falls: the Sovereign Ember is restored.
      audio.music('victory');
      sendLanStatus({ victory: true });
      saves.clearRun(activeSlot);
      const earned = finishRun(true);
      return mountGameOver(app, { registries, game: run, victory: true, earned, onTitle: showTitle, onHistory: showHistory });
    }
    // Act boss down: boss rewards, then the climb continues.
    // A boss always drops an armament — unless you already own every one it
    // could give, in which case it pays out instead of dropping nothing.
    const bossArmament = rollDrop('boss');
    const drops = registries.balance.equipment.drops || {};
    const bossRewards = {
      title: `${registries.enemies.get(enc.enemies[0]).name.toUpperCase()} FALLS`,
      cinders: rollRuneReward(registries, rng, 'boss', run.relics) + (bossArmament ? 0 : drops.consolationCinders || 0),
      cardIds: rollCardRewardIds(registries, rng, { classId: run.class, pool: 'boss', relicIds: run.relics, flatRarity: chaosRewardsOn() }),
      relicId: rollRelicReward(registries, rng, run.relics, { rarities: ['boss'] }),
      armamentId: bossArmament,
    };
    return mountRewards(app, {
      registries,
      run,
      rewards: bossRewards,
      onDone: () => advanceAct(),
    });
  }

  const rewards = {
    title: enc.pool === 'elite' ? 'ELITE VANQUISHED' : 'VICTORY',
    cinders: rollRuneReward(registries, rng, enc.pool, run.relics),
    cardIds: rollCardRewardIds(registries, rng, { classId: run.class, pool: enc.pool, relicIds: run.relics, flatRarity: chaosRewardsOn() }),
    flaskId: rollFlaskDrop(registries, rng, run),
    relicId: enc.pool === 'elite' ? rollRelicReward(registries, rng, run.relics) : null,
    // Elites are the mid-run source of armaments; ordinary fights are not
    // (balance.equipment.drops.chance has no 'normal' key, so the roll is a
    // no-op there rather than a hidden 0%).
    armamentId: rollDrop(enc.pool),
  };
  mountRewards(app, {
    registries,
    run,
    rewards,
    onDone: () => {
      persist();
      showMap();
    },
  });
}

// Custom Climb helpers used across nodes.
function chaosRewardsOn() {
  return !!(run.custom && activeMods(run.custom).chaosRewards);
}
function shopPriceMult() {
  const mods = run.custom ? activeMods(run.custom) : {};
  let m = 1;
  if (mods.expensiveShops) m *= registries.balance.customMods.expensiveShopsMult;
  if (mods.hoarder) m *= registries.balance.customMods.hoarderShopMult;
  return m;
}

// ---- non-combat nodes -----------------------------------------------------------------
function showRest() {
  audio.music('rest');
  const healMult = run.custom && activeMods(run.custom).lessHealing ? registries.balance.customMods.lessHealingMult : 1;
  mountRest(app, {
    registries,
    run,
    healMult,
    onDone: () => {
      persist();
      showMap();
    },
  });
}

function showShop() {
  audio.music('shop');
  mountShop(app, {
    registries,
    run,
    onChanged: () => persist(),
    onLeave: () => {
      run.shopStock = null;
      persist();
      showMap();
    },
  });
}

function showEvent(eventId) {
  mountEvent(app, {
    registries,
    run,
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

// Dev screenshot hook (?shot=map|combat|fx): boot straight into a seeded
// showcase run so headless captures (tools/screenshot.mjs) can photograph
// deeper screens without interaction. `fx` poses the combat FX frozen
// mid-animation (negative animation-delay + paused) so the transient slash /
// glyph / spark / recoil effects are photographable. Normal boots unaffected.
//
// `shotState` is declared beside pickStorage() near the top of this file, not
// here, because storage selection reads it: a ?shot= boot runs on memory storage
// so it cannot touch the player's save. See the comment there for what it broke.

function poseFxShowcase() {
  const layer = document.querySelector('.fx-layer');
  const enemies = [...document.querySelectorAll('.combatant.enemy .sprite')];
  const player = document.querySelector('.combatant.player .sprite');
  if (!layer || !enemies.length || !player) return;
  const put = (cls, text, anchor, atMs, extra) => {
    const lr = layer.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    el.style.left = `${ar.left - lr.left + ar.width / 2 + ((extra && extra.dx) || 0)}px`;
    el.style.top = `${ar.top - lr.top + ar.height * 0.4 + ((extra && extra.dy) || 0)}px`;
    el.style.animationDelay = `-${atMs}ms`; // jump mid-animation…
    el.style.animationPlayState = 'paused'; // …and hold the frame
    layer.appendChild(el);
  };
  const e0 = enemies[0];
  const e1 = enemies[1] || enemies[0];
  put('fx-slash', '', e0, 120);
  put('float-num crit', '-26', e0, 200, { dy: -34 });
  put('fx-spark', '✦', e1, 140);
  put('float-num blk small', 'BLOCKED', e1, 220, { dy: -30 });
  put('fx-glyph', '✦', player, 170);
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

// Co-op screenshot states (?shot=coop|coopmap): mount the LAN thin client with
// a canned server snapshot through a stub socket — no server/second player
// needed — so the co-op board/map can be photographed like the solo shots.
function coopStubMount(snapshot, myId) {
  const stub = { _h: null, setHandlers(h) { this._h = h; }, send() {}, close() {}, get open() { return false; } };
  mountCoop(app, { registries, conn: stub, myId, onLeave() {} });
  if (stub._h && stub._h.onMessage) stub._h.onMessage({ t: 'state', snapshot });
}
function coopCombatShot() {
  const hand = ['strike', 'rallyingBanner', 'defend', 'defend', 'stomp'].map((cardId, i) => ({ instanceId: `h${i}`, cardId, upgraded: i === 4 }));
  const party = [
    { id: 'p1', name: 'Wren', classId: 'starseer', connected: true, alive: true, hp: 61, maxHp: 72, cinders: 45, deckSize: 12, relics: 1, flasks: 1, catchup: 0, catchupQueue: [] },
    { id: 'p2', name: 'Fenn', classId: 'reaver', connected: true, alive: true, hp: 84, maxHp: 84, cinders: 30, deckSize: 10, relics: 1, flasks: 0, catchup: 0, catchupQueue: [] },
  ];
  return {
    actNumber: 1, floor: 3, seedString: 'SHOWCASE', endless: false,
    scene: {
      kind: 'combat', pool: 'normal', phase: 'player', turn: 2, headcount: 2,
      enemies: [
        { id: 'e1', enemyId: 'blightHound', hp: 13, maxHp: 30, block: 0, alive: true, intent: { kind: 'attack', moveId: 'bite', damage: 6, hits: 1, delayed: false }, statuses: { bleed: { meter: { value: 4, max: 12 } } }, poiseMeter: { value: 4, max: 10 } },
        { id: 'e2', enemyId: 'blightHound', hp: 30, maxHp: 30, block: 5, alive: true, intent: { kind: 'block', moveId: 'guard', block: 5 }, statuses: {}, poiseMeter: { value: 0, max: 10 } },
        { id: 'e3', enemyId: 'graveWisp', hp: 22, maxHp: 22, block: 0, alive: true, intent: { kind: 'attack', moveId: 'hex', damage: 4, hits: 2, delayed: true }, statuses: { vulnerable: { stacks: 1 } }, poiseMeter: { value: 0, max: 8 } },
      ],
      players: [
        { id: 'p1', hp: 61, maxHp: 72, block: 8, energy: 2, energyMax: 3, connected: true, alive: true, ended: false, statuses: { strength: { stacks: 1 } }, stanceId: null, hand, drawCount: 5, discardCount: 2, flasks: [{ flaskId: 'crimsonFlask' }] },
        { id: 'p2', hp: 84, maxHp: 84, block: 0, energy: 3, energyMax: 3, connected: true, alive: true, ended: true, statuses: {}, stanceId: null, hand: [], drawCount: 6, discardCount: 1, flasks: [] },
      ],
    },
    party,
  };
}
function coopMapShot() {
  newRun({ classId: 'reaver', seedString: 'SHOWCASE', slot: 1 });
  const g = run.mapGraph;
  const nodeType = (n) => (n.type === 'event' ? 'unknown' : n.type);
  return {
    actNumber: 1, floor: 0, seedString: 'SHOWCASE', endless: false,
    // Fenn has already voted for a start node; Wren (you) is still deciding.
    scene: { kind: 'map', votes: { p2: g.startIds[1] || g.startIds[0] } },
    reachableIds: g.startIds.slice(),
    map: { floors: g.floors, startIds: g.startIds, bossId: g.bossId, nodes: Object.values(g.nodes).map((n) => ({ id: n.id, type: nodeType(n), floor: n.floor, col: n.col, next: n.next })) },
    party: [
      { id: 'p1', name: 'Wren', classId: 'starseer', connected: true, alive: true, hp: 61, maxHp: 72, catchupQueue: [] },
      { id: 'p2', name: 'Fenn', classId: 'reaver', connected: true, alive: true, hp: 84, maxHp: 84, catchupQueue: [] },
    ],
  };
}

function coopShotParty() {
  return [
    { id: 'p1', name: 'Wren', classId: 'starseer', connected: true, alive: true, hp: 61, maxHp: 72, cinders: 45, deckSize: 12, relics: 1, flasks: 1, catchup: 0, catchupQueue: [] },
    { id: 'p2', name: 'Fenn', classId: 'reaver', connected: true, alive: true, hp: 84, maxHp: 84, cinders: 30, deckSize: 10, relics: 1, flasks: 0, catchup: 0, catchupQueue: [] },
  ];
}
function coopRewardShot() {
  return {
    actNumber: 1, floor: 4, seedString: 'SHOWCASE', endless: false,
    scene: { kind: 'reward', pool: 'elite', chosen: {}, afterReward: null, offers: { p1: { pool: 'elite', cardIds: ['stomp', 'executioner', 'crimsonCleave'], cinders: 32, flaskId: 'crimsonFlask', relicId: 'forsakenMedallion' } } },
    party: coopShotParty(),
  };
}
function coopShrineShot() {
  return { actNumber: 1, floor: 5, seedString: 'SHOWCASE', endless: false, scene: { kind: 'shrine', done: {} }, party: coopShotParty() };
}
function coopCatchupShot() {
  const party = coopShotParty();
  party[0].catchup = 2;
  party[0].catchupQueue = [
    { type: 'reward', act: 1, floor: 2, offer: { pool: 'normal', cardIds: ['guardCounter', 'rend', 'gildedOath'], relicId: 'forsakenMedallion' } },
    { type: 'treasure', act: 1, floor: 3, relicId: 'forsakenMedallion' },
  ];
  return { actNumber: 1, floor: 6, seedString: 'SHOWCASE', endless: false, scene: { kind: 'map' }, reachableIds: [], map: null, party };
}

if (shotState === 'map' || shotState === 'combat' || shotState === 'fx' || shotState === 'boss') {
  // Suppress the first-run tutorial so captures show a clean board.
  const shotMeta = saves.loadMeta();
  shotMeta.settings.seenTutorial = true;
  saves.saveMeta(shotMeta);
  newRun({ classId: 'reaver', seedString: 'SHOWCASE', slot: 1 });
  if (shotState === 'boss') {
    // Straight into the act-1 boss; the intro card is held for the camera.
    enterCombat(run.mapGraph.startIds[0], 'bossOmen');
  } else if (shotState === 'combat' || shotState === 'fx') {
    const g = run.mapGraph;
    const startId = g.startIds.find((id) => g.nodes[id].type === 'monster') || g.startIds[0];
    enterNode(startId);
    if (shotState === 'fx') setTimeout(poseFxShowcase, 1600);
  }
} else if (shotState === 'coop') {
  coopStubMount(coopCombatShot(), 'p1');
} else if (shotState === 'coopmap') {
  coopStubMount(coopMapShot(), 'p1');
} else if (shotState === 'coopreward') {
  coopStubMount(coopRewardShot(), 'p1');
} else if (shotState === 'coopshrine') {
  coopStubMount(coopShrineShot(), 'p1');
} else if (shotState === 'coopcatchup') {
  coopStubMount(coopCatchupShot(), 'p1');
} else {
  showTitle();
}
