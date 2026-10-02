// src/ui/screens/reward.js — post-combat / treasure rewards (SPEC §6, §7.1; E11/#256)
//
// Constantine, 2026-08-15: "the reward should start with an initial menu of
// reward types (card, potion, armament)" — Slay-the-Spire style. And his
// answer on the E11 card: Continue is ALWAYS pressable and a setting decides
// what it means — auto-collect ON takes everything, picking at random where
// there is a choice; OFF gives only what was chosen, no nagging.
//
// WHAT MOVED, and why it is the whole point: the old screen APPLIED cinders,
// relic and flask at mount — before the player saw anything — so a menu with
// inspect-before-collect and leaving untouched rewards behind was impossible by construction.
// Application now happens when a row is TAKEN (tap, or auto-collect at
// Continue), through one apply function per kind. WHAT the rows are, which
// are blocked and why, and what Continue means is model/rewardplan.js's one
// derivation (test 61) — this screen draws rows and forwards taps; it decides
// nothing (the rest.js/levelUpPlan precedent).
//
// The menu rows reuse `.class-pick` (the B9 uniform-card pattern from the
// shrine fold) — same focus rules (input.js already lists
// `.class-pick:not(.locked)`), same locked treatment for a blocked row, no
// second card-button pattern in the tree. AND THE SAME MARKUP GRAMMAR: the
// narrow layout's shared rule composes glyph + one `.cp-body` text column
// (ui.css — "the card is auto, the text column is 1fr"), so everything but
// the glyph rides inside `.cp-body`. The first cut emitted four bare flex
// children and phone rows squeezed side-by-side — Codex 4989824448's
// composition finding at b6b7df0, measured by Saga (creation's text column
// 246.2px vs these rows' none).
//
// SEEN ('new' markers): "a 'new' marker on unseen cards/items/relics" — his
// words on the card. Unseen is DERIVED (model/rewardplan.js unseenIds) from
// what the run holds plus the profile's record: `meta.seen` (cards/relics/
// flasks, written here best-effort on take) and `meta.found` (armaments,
// written at COLLECTION through the handed-in collector — the roll is pure,
// so at mount time the found set is honestly pre-drop and a first discovery
// reads NEW; see main.js rollDrop/collectArmament and the f29d468 defect they
// correct). Boundary, stated: other acquisition paths (shop, events, drafts)
// do not write `meta.seen` yet, so a thing first met elsewhere can still read
// NEW here once — the marker errs toward showing.
//
// PROGRESSION, BESIDE THE CLAIM. Combat banks character XP and pays skill
// tracks before this door opens. The pending reward stores their XP receipt
// and starting values; the green underlay moves to the new total, then the
// yellow overlay catches it. A blue bar means the character can claim one
// level here, with any excess XP kept for later claims.
//
// `saves` and `rng` are optional: co-op stubs and old callers get the dial's
// default and a deterministic first-card pick, never a crash and never
// Math.random — a UI pick that desyncs a seeded run is a defect.

import { renderCard } from '../components/card.js';
import { sigilRuleText } from '../../model/sigils.js';
import { renderEquipmentInspection } from '../components/equipmentCard.js';
import { renderCollectibleInspection } from '../components/collectibleCard.js';
import { esc, attachTooltip, showTooltipFor } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';
import { flaskIdentityHtml, flaskDetailLines } from '../components/flask.js';
import { flaskSlotCap } from '../../model/gracerefill.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { rewardPlan, rewardClaimStatus, resolveContinue, unseenIds, rewardNotes, CARD_CHOICE_KINDS, smithingStonesPaid, smithingStoneRowCopy } from '../../model/rewardplan.js';
import { rewardProgress } from '../../model/rewardprogress.js';
import { levelUpPlan, pendingLevelCount } from '../../model/levelup.js';
import { victoryXpFormula, victoryXpPresentation, victoryXpTiming } from '../../model/victoryXpPresentation.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { modEffectLines } from '../../model/loadout.js';
import { skillTracks, skillLevel, skillUpgradesCards, spendSkillDraft, classSkillId, pendingSkillLevelCount } from '../../model/skills.js';
import { pickClassNode } from '../../model/classTree.js';
import { chooseFeat, featById } from '../../model/feats.js';
import { nodeTokens } from '../../model/tree.js';
import { el, modalHead, modalFooter, button, meter } from '../kit/index.js';
// Every sentence this screen says is a row in content/source/uiStrings.csv.
import { t, tFull, tTip } from '../strings.js';
import { reasonWhenDisabled } from '../components/refusal.js';
import { clearSelection } from '../components/cardSelection.js';
import { unusedInstanceId, ownedCopies } from '../../model/deckRules.js';

const KIND_GLYPHS = { cinders: '◉', smithingStone: '⚒', classDraft: '☉', skillDraft: '✦', card: '🂠', levelChoice: '✧', levelCard: '✧', flask: '⚗', armament: '⚔', relic: '◆', sigil: '◈' };

// `onCollectArmament` is the armament's whole persistence, handed in by the
// caller (main.js collectArmament): run storage + meta.found + the discovery
// receipt. Handed in rather than done here because the persistence needs the
// caller's run/shot context, and because a screen that decides nothing should
// also STORE nothing itself. A caller that hands none gets reveal-only rows —
// no such caller exists today; the boundary is named, not covered.
export function mountRewards(app, {
  registries, run, rewards, onDone, saves = null, rng = null,
  onCollectArmament = null, onPersist = null, checkpoint = null,
  onClaimLevel = null, onClaimSkill = null, onAllocateStat = null,
}) {
  // A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT. cardSelection is a
  // page-wide store, and nothing in production ever emptied it — so a card
  // whose `i` had been read kept its first beat for the life of the page, and
  // meeting the same logical id on a later surface handed that surface a card
  // already one beat in: its first touch acted instead of selecting.
  clearSelection();
  const plan = rewardPlan(rewards, {
    flaskSlotsFree: Math.max(0, flaskSlotCap(registries.balance) - run.flasks.length),
    // The bag's room, read from the same array addToStorage writes — one
    // home, two questions (the model asks "is there room", the collector's
    // own gate asks "did THIS store land"). Derived here so the ninth piece
    // against the cap is BLOCKED before any tap, the flask shape exactly.
    armamentSlotsFree: Math.max(
      0,
      (registries.balance.equipment.storageSlots || 8) - (((run.loadout || {}).storage) || []).length,
    ),
  });
  // The fight's progression reads the paid ledgers and is re-derived after a
  // claimed character level. ONLY WHERE THERE WAS A FIGHT — the
  // panel's whole claim is what this one moved, and a treasure room (or an
  // offer saved before the receipt existed) moved nothing, so it draws the
  // spoils alone rather than a heading with no gains under it.
  let progress = rewards.xpGains ? rewardProgress(registries, run, rewards.xpGains) : null;
  const settings = (saves && saves.loadMeta && (saves.loadMeta().settings || {})) || {};
  let xpAnimationDone = !progress || !rewards.xpBefore;
  let xpAnimationStarted = false;
  let refill = null;
  let claimedLevels = checkpoint?.levelClaims || 0;
  const claimedSkills = { ...(checkpoint?.skillClaims || {}) };
  const deferredLevelOffer = () => !!(onClaimLevel && progress?.character && (pendingLevelCount(registries, run) > 0 || claimedLevels > 0));
  const states = {
    ...(checkpoint?.states || {}),
    ...(smithingStonesPaid(rewards.smithingStoneReceipt) ? { smithingStone: 'taken' } : {}),
  }; // kind → 'taken'|'skipped' (absent = pending / implicitly left in manual mode)
  let chosenCardId = checkpoint?.chosenCardId || null;
  // The skill drafts' picks, keyed by ROW KEY (plan phase 4b): one offer may
  // carry several drafts, even for one track, so the card row's single
  // `chosenCardId` is not their record.
  const chosenDraftCardIds = { ...(checkpoint?.chosenDraftCardIds || {}) };
  // The class drafts' picks (plan phase 5b), keyed by row key: tree nodes.
  const chosenDraftNodeIds = { ...(checkpoint?.chosenDraftNodeIds || {}) };
  const pendingByKey = {}; // a chooser's unconfirmed selection, per row, so Back keeps it

  function persistProgress() {
    if (checkpoint) {
      checkpoint.states = { ...states };
      checkpoint.chosenCardId = chosenCardId;
      checkpoint.chosenDraftCardIds = { ...chosenDraftCardIds };
      checkpoint.chosenDraftNodeIds = { ...chosenDraftNodeIds };
      if (claimedLevels || checkpoint.levelClaims !== undefined) checkpoint.levelClaims = claimedLevels;
      if (Object.keys(claimedSkills).length || checkpoint.skillClaims !== undefined) checkpoint.skillClaims = { ...claimedSkills };
    }
    if (onPersist && onPersist() === false) throw new Error('Reward save was refused.');
  }

  // ---- the 'new' derivation: run inventory ∪ the profile's record ----------
  const meta = (saves && saves.loadMeta && saves.loadMeta()) || {};
  const seenStore = meta.seen || {};
  const marks = unseenIds(rewards, {
    cards: new Set([...run.deck.map((c) => c.cardId), ...(run.sideboard || []).map((c) => c.cardId), ...(seenStore.cards || [])]),
    relics: new Set([...run.relics, ...(seenStore.relics || [])]),
    flasks: new Set([...run.flasks.map((f) => f.flaskId), ...(seenStore.flasks || [])]),
    armaments: new Set([...(meta.found || [])]),
  });

  // Best-effort seen write on take. A quarantined profile refuses saveMeta —
  // correctly — and the marker is a convenience, so a refusal never blocks the
  // reward itself (the settings.js precedent for reading that result).
  function recordSeen(kind, ids) {
    if (!saves || !saves.saveMeta || !ids.length) return;
    const m = saves.loadMeta() || {};
    const seen = { ...(m.seen || {}) };
    const key = { card: 'cards', relic: 'relics', flask: 'flasks' }[kind];
    if (!key) return; // armaments already live in meta.found, one home
    seen[key] = [...new Set([...(seen[key] || []), ...ids])];
    saves.saveMeta({ ...m, seen });
  }

  // ---- one apply function per kind — tap and auto-collect share them -------
  const apply = {
    cinders(row) {
      run.cinders += row.amount;
      return true;
    },
    // Smithing Stones are granted and durably claimed at combat resolution,
    // before this presentation can be interrupted. This row is informational
    // and begins in Taken state; reaching this function would be a contract bug.
    smithingStone() { return false; },
    card(row) {
      run.deck.push({ instanceId: unusedInstanceId(run, 'r', row.cardId), cardId: row.cardId, upgraded: false });
      chosenCardId = row.cardId;
      return true;
    },
    // A level card (SPEC §15.1): taken exactly as the card offer is. Its pick
    // is kept by row key beside the skill drafts' (one offer may carry
    // several level cards), in the map the pending-reward save already checks.
    levelCard(row) {
      run.deck.push({ instanceId: unusedInstanceId(run, 'r', row.cardId), cardId: row.cardId, upgraded: false });
      chosenDraftCardIds[row.key] = row.cardId;
      return true;
    },
    levelChoice(row) {
      const choice = row.options.find((option) => `${option.kind}:${option.id}` === row.choiceId);
      if (!choice) return false;
      if (choice.kind === 'feat' ? !chooseFeat(run, choice.id)
        : !pickClassNode(registries, run, choice.id, { levelOverride: run.level?.level || 0 })) return false;
      chosenDraftCardIds[row.key] = row.choiceId;
      return true;
    },
    // A skill draft (plan phase 4b): the card joins the deck — upgraded when
    // the track has reached balance.skill.upgradeAt — and the track's queued
    // draft is spent, the one write the door makes to the ledger.
    // A class draft (plan phase 5b): the node joins the core card's tags and
    // the class track's queued draft is spent; a pick the tree no longer
    // allows (or a draft the ledger no longer holds) lands nothing.
    classDraft(row) {
      if (!pickClassNode(registries, run, row.nodeId)) return false;
      if (!spendSkillDraft(run, classSkillId(run.class))) { run.coreTags.pop(); return false; }
      chosenDraftNodeIds[row.key] = row.nodeId;
      return true;
    },
    skillDraft(row) {
      if (!spendSkillDraft(run, row.skillId)) return false;
      run.deck.push({ instanceId: unusedInstanceId(run, 'r', row.cardId), cardId: row.cardId, upgraded: skillUpgradesCards(registries, skillLevel(run, row.skillId)) });
      chosenDraftCardIds[row.key] = row.cardId;
      return true;
    },
    flask(row) {
      run.flasks.push({ flaskId: row.flaskId });
      recordSeen('flask', [row.flaskId]);
      return true;
    },
    relic(row) {
      run.relics.push(row.relicId);
      syncFlaskGrowth(registries, run); // growth chain: a relic source binds the moment it is held
      recordSeen('relic', [row.relicId]);
      return true;
    },
    armament(row) { return onCollectArmament ? onCollectArmament(row.armamentId) !== false : false; },
    // SPEC §15.4: a dropped legendary sigil joins the inventory, unattuned;
    // one the run already holds adds nothing.
    sigil(row) {
      if (!(run.sigils || []).includes(row.sigilId)) run.sigils = [...(run.sigils || []), row.sigilId];
      return true;
    },
  };

  function take(row, viaKind) {
    if (states[row.key]) return false;
    // A row may say Taken only after its persistence door says it landed. The
    // armament collector returns false at the storage/duplicate boundary; a
    // refusal therefore cannot become a claimed-looking row (E11 review P2).
    const cardBefore = CARD_CHOICE_KINDS.includes(row.kind) || row.kind === 'classDraft' || row.kind === 'levelChoice' ? {
      deck: [...run.deck], chosenCardId, chosenDraft: { ...chosenDraftCardIds }, chosenNode: { ...chosenDraftNodeIds },
      feats: [...(run.feats || [])],
      // A draft's take spends the ledger's queued draft; only a draft's rollback puts it back.
      skills: row.kind === 'skillDraft' || row.kind === 'classDraft' ? structuredClone(run.skills || {}) : null,
      coreTags: row.kind === 'classDraft' || row.kind === 'levelChoice' ? [...(run.coreTags || [])] : null,
      checkpoint: checkpoint ? structuredClone(checkpoint) : null,
    } : null;
    if (!apply[row.kind](row)) return false;
    states[row.key] = 'taken';
    // Reward state and the run mutation cross one save door. A reload can now
    // distinguish an already-applied row from an untouched one and cannot
    // duplicate a card, currency, flask, relic, or armament.
    try {
      persistProgress();
    } catch (error) {
      if (cardBefore) {
        run.deck.splice(0, run.deck.length, ...cardBefore.deck);
        chosenCardId = cardBefore.chosenCardId;
        for (const key of Object.keys(chosenDraftCardIds)) delete chosenDraftCardIds[key];
        Object.assign(chosenDraftCardIds, cardBefore.chosenDraft);
        if (cardBefore.skills) run.skills = cardBefore.skills;
        if (cardBefore.coreTags) run.coreTags = cardBefore.coreTags;
        run.feats = cardBefore.feats;
        for (const key of Object.keys(chosenDraftNodeIds)) delete chosenDraftNodeIds[key];
        Object.assign(chosenDraftNodeIds, cardBefore.chosenNode);
        delete states[row.key];
        if (checkpoint) {
          for (const key of Object.keys(checkpoint)) delete checkpoint[key];
          Object.assign(checkpoint, cardBefore.checkpoint);
        }
      }
      throw error;
    }
    if (CARD_CHOICE_KINDS.includes(row.kind)) recordSeen('card', [row.cardId]);
    sfx.play(`rewardTake_${row.kind}`); // exact → family 'rewardTake' → default
    renderMenu(viaKind || row.key);
    return true;
  }

  // ---- row copy: what a kind says in each state ----------------------------
  function rowBody(row) {
    const state = states[row.key];
    switch (row.kind) {
      case 'classDraft': {
        const cls = registries.classes.get(row.classId);
        const title = t('reward.classDraft.title', { class: esc((cls && cls.name) || row.classId), level: row.level });
        if (state === 'taken') {
          const node = (registries.nodes || []).find((n) => n && n.id === chosenDraftNodeIds[row.key]);
          return { title, body: t('reward.classDraft.joins', { name: esc((node && node.label) || chosenDraftNodeIds[row.key]) }) };
        }
        return { title, body: row.choice ? t('reward.card.chooseOne', { count: row.nodeIds.length }) : t('reward.card.offered') };
      }
      case 'skillDraft': {
        const skill = skillTracks(registries).find((track) => track.id === row.skillId);
        const label = esc((skill && skill.label) || row.skillId);
        if (state === 'taken') {
          const def = registries.cards.get(chosenDraftCardIds[row.key]);
          return { title: t('reward.skillDraft.title', { skill: label, level: row.level }), body: t('reward.card.joins', { name: esc((def && def.name) || chosenDraftCardIds[row.key]) }) };
        }
        return {
          title: t('reward.skillDraft.title', { skill: label, level: row.level }),
          body: row.choice ? t('reward.card.chooseOne', { count: row.cardIds.length }) : t('reward.card.offered'),
        };
      }
      case 'cinders':
        return {
          title: t('reward.cinders.title', { amount: row.amount }),
          body: state === 'taken' ? t('reward.cinders.taken', { total: run.cinders }) : tFull('reward.cinders.title'),
        };
      case 'smithingStone':
        // Ordinary stones, refined stones (SPEC §15.3), or both, on one row:
        // title and body each name only the purse that was paid.
        return smithingStoneRowCopy(row, t);
      case 'card': {
        if (state === 'taken') {
          const def = registries.cards.get(chosenCardId);
          return { title: t('reward.kind.card'), body: t('reward.card.joins', { name: esc((def && def.name) || chosenCardId) }) };
        }
        return {
          title: t('reward.kind.card'),
          body: row.choice ? t('reward.card.chooseOne', { count: row.cardIds.length }) : t('reward.card.offered'),
        };
      }
      case 'levelCard': {
        if (state === 'taken') {
          const def = registries.cards.get(chosenDraftCardIds[row.key]);
          return { title: t('reward.levelCard.title'), body: t('reward.card.joins', { name: esc((def && def.name) || chosenDraftCardIds[row.key]) }) };
        }
        return {
          title: t('reward.levelCard.title'),
          body: row.choice ? t('reward.card.chooseOne', { count: row.cardIds.length }) : t('reward.card.offered'),
        };
      }
      case 'levelChoice': {
        const chosen = chosenDraftCardIds[row.key];
        const option = row.options.find((entry) => `${entry.kind}:${entry.id}` === chosen);
        const feat = option?.kind === 'feat' ? featById(option.id) : null;
        const node = option?.kind === 'classNode' ? (registries.nodes || []).find((entry) => entry.id === option.id) : null;
        return { title: 'Level choice', body: state === 'taken'
          ? `${esc(feat?.name || node?.label || option?.id || '')} gained.`
          : `Choose one of ${row.options.length} feats or class upgrades.` };
      }
      case 'flask': {
        const def = registries.flasks.get(row.flaskId);
        if (row.blockedBy === 'slots') return { title: t('reward.kind.flask'), body: t('reward.flask.blocked', { name: esc(def.name) }) };
        // WHAT IT DOES, ON THE ROW (Constantine, 2026-09-04: "I have no idea
        // what this potion does"). The relic row has always carried its
        // sentence and the shop shows `textTemplate`; a flask offered as
        // spoils showed a name and an icon alone, and Take was a blind choice.
        // `flaskDetailLines` is that sentence's one home (components/flask.js),
        // the same lines the flask menu and its inspect door read — not a
        // tooltip: a player deciding whether to take it must SEE it.
        const lines = flaskDetailLines(def).map((line) => esc(line)).join('<br>');
        return { title: t('reward.kind.flask'), body: `<b>${flaskIdentityHtml(def)}</b>${lines ? `<br>${lines}` : ''}` };
      }
      case 'armament': {
        // The copy tracks the STATE, because the state is now true: nothing is
        // stored until the row is taken (the roll is pure — main.js rollDrop),
        // so "Carried" before a take would be the f29d468 lie re-worded.
        const a = (registries.equipment.armaments || []).find((x) => x.id === row.armamentId);
        // `a.mods` is the raw vocabulary (`strike.damage=+4`) and this line used
        // to print it verbatim — engine keys on the screen where a reward is
        // chosen. modEffectLines is the one home for turning them into a
        // sentence (src/model/loadout.js).
        const effects = modEffectLines(registries, a).join(', ');
        const name = a ? `<b>${esc(a.name)}</b> — ${esc(effects || t('reward.armament.plain'))}` : t('reward.armament.none');
        // A full bag reads its refusal in the flask's own idiom — the copy
        // switches on the model's token (blockedBy), never a re-derivation.
        if (row.blockedBy === 'storage') return { title: t('reward.kind.armament'), body: t('reward.armament.blocked', { name }) };
        return {
          title: t('reward.kind.armament'),
          body: state === 'taken'
            ? `${name}<br><span style="color:var(--muted)">${esc(t('reward.armament.carried'))}</span>`
            : name,
        };
      }
      case 'relic': {
        const def = registries.relics.get(row.relicId);
        return { title: t('reward.kind.relic'), body: `<b>${esc(def.icon || '◆')} ${esc(def.name)}</b> — ${esc(relicText(def, registries))}` };
      }
      case 'sigil': {
        const def = registries.sigils.get(row.sigilId);
        return {
          title: t('reward.kind.sigil'),
          body: `<b>${esc(def.name)}</b> — ${esc(sigilRuleText(registries, row.sigilId) || def.blurb)}<br><span style="color:var(--muted)">${esc(t('reward.sigil.note'))}</span>`,
        };
      }
      default:
        return { title: row.kind, body: '' };
    }
  }

  function isNew(row) {
    switch (row.kind) {
      case 'card':
      case 'levelCard':
      case 'skillDraft': return row.cardIds.some((id) => marks.cards.includes(id));
      case 'relic': return marks.relics.length > 0;
      case 'flask': return marks.flasks.length > 0;
      case 'armament': return marks.armaments.length > 0;
      default: return false;
    }
  }

  function collectMode() {
    const settings = (saves && saves.loadMeta && (saves.loadMeta().settings || {})) || {};
    const dial = registries.balance.ui.rewardCollect || { def: 'manual', modes: ['auto', 'manual'] };
    return dial.modes.includes(settings.rewardCollect) ? settings.rewardCollect : dial.def;
  }

  function claimLevel() {
    if (!xpAnimationDone || refill || pendingLevelCount(registries, run) < 1 || !onClaimLevel) return;
    const claim = onClaimLevel();
    if (!claim) return;
    claimedLevels += 1;
    persistProgress();
    progress = rewardProgress(registries, run, rewards.xpGains);
    const card = plan.rows.find((row) => ['levelChoice', 'levelCard'].includes(row.kind)
      && row.ordinal === claimedLevels - 1 && !states[row.key]);
    refillClaim('character', () => card ? renderChooser(card) : renderLevelReward(claim));
  }

  const draftTrackId = (row) => row.kind === 'classDraft' ? classSkillId(row.classId) : row.skillId;
  const draftUnlocked = (row) => !['skillDraft', 'classDraft'].includes(row.kind)
    || !row.claimOrdinal || (claimedSkills[draftTrackId(row)] || 0) >= row.claimOrdinal;

  function claimSkill(skillId) {
    if (!xpAnimationDone || refill || !onClaimSkill || pendingSkillLevelCount(registries, run, skillId) < 1) return;
    const claim = onClaimSkill(skillId);
    if (!claim) return;
    claimedSkills[skillId] = (claimedSkills[skillId] || 0) + 1;
    persistProgress();
    progress = rewardProgress(registries, run, rewards.xpGains);
    const draft = plan.rows.find((row) => ['skillDraft', 'classDraft'].includes(row.kind)
      && draftTrackId(row) === skillId && row.claimOrdinal === claimedSkills[skillId] && !states[row.key]);
    refillClaim(skillId, () => draft ? renderChooser(draft) : renderSkillReward(skillId, claim));
  }

  function refillClaim(id, after) {
    const row = id === 'character' ? progress?.character : progress?.skills.find((entry) => entry.id === id);
    const reduced = document.body.classList.contains('reduced-motion');
    const seconds = settings.levelUpRefillSeconds == null ? 0.8 : Number(settings.levelUpRefillSeconds);
    if (!row?.xp || row.capped || reduced || seconds === 0) { after(); return; }
    refill = { id, after, phase: 'filling' };
    xpAnimationDone = false;
    xpAnimationStarted = false;
    renderMenu();
  }

  function renderSkillReward(skillId, claim) {
    const label = skillTracks(registries).find((track) => track.id === skillId)?.label || skillId;
    const done = button({ label: 'Continue', weight: 'primary', id: 'reward-skill-done' });
    door({ eyebrow: 'Skill Level Up', title: `${label} · Level ${claim.after}`,
      body: el('p', { text: `Your ${label} skill is now level ${claim.after}.` }),
      foot: modalFooter({ primary: done, className: 'reward-foot', size: 'medium' }) });
    done.addEventListener('click', renderMenu);
  }

  function statAllocationSection() {
    if (settings.levelUpAllocateStats !== true || !onAllocateStat || !(run.level?.unspentPoints > 0)) return null;
    const host = el('section', { class: 'reward-stat-allocation', 'aria-label': 'Assign stats' });
    const draw = () => {
      const points = run.level?.unspentPoints || 0;
      const attrs = levelUpPlan(registries, run).attributes;
      host.replaceChildren(
        el('h3', { text: `Assign stats · ${points} point${points === 1 ? '' : 's'} available` }),
        ...attrs.map((attr) => {
          const id = attr.id;
          const add = button({ label: '+', className: 'reward-stat-add', disabled: points < 1, attrs: { 'aria-label': `Increase ${attr.label}` } });
          add.addEventListener('click', () => {
            if (!run.level?.unspentPoints) return;
            onAllocateStat(id);
            persistProgress();
            draw();
          });
          return el('div', { class: 'reward-stat-row' }, [
            el('span', { text: attr.label }),
            el('span', { text: String(run.attributes?.[id] ?? 0) }),
            add,
          ]);
        }),
      );
    };
    draw();
    return host;
  }

  function renderLevelReward(claim) {
    const done = button({ label: 'Continue', weight: 'primary', id: 'reward-level-done' });
    const body = el('div', { class: 'reward-level-claim' }, [
      el('p', { text: `Level ${claim.after} · ${claim.points} stat point${claim.points === 1 ? '' : 's'} earned` }),
      statAllocationSection(),
    ]);
    door({ eyebrow: 'Level Up', title: `Level ${claim.after}`, body,
      foot: modalFooter({ primary: done, className: 'reward-foot', size: 'medium' }) });
    done.addEventListener('click', () => renderMenu());
  }

  async function playXpAnimation(host) {
    const active = () => host?.isConnected && app.querySelector('.reward-claim-layout') === host;
    const pendingRefill = refill;
    const bars = [...app.querySelectorAll('.reward-claim-layout .rp-layered-bar[data-animate="1"]')];
    const requested = Number(pendingRefill ? settings.levelUpRefillSeconds : settings.victoryXpSeconds);
    const total = document.body.classList.contains('reduced-motion') ? 0
      : Math.max(0, Math.min(12000, (Number.isFinite(requested) ? requested : pendingRefill ? 0.8 : 3) * 1000));
    const skillCount = bars.filter((bar) => !['character', 'class'].includes(bar.dataset.kind)).length || 1;
    const weight = (kind) => {
      const key = kind === 'character' ? 'victoryXpCharacterWeight' : kind === 'class' ? 'victoryXpClassWeight' : 'victoryXpSkillWeight';
      const def = kind === 'character' ? 50 : 25;
      const value = Math.max(0, Number.isFinite(Number(settings[key])) ? Number(settings[key]) : def);
      return kind === 'character' || kind === 'class' ? value : value / skillCount;
    };
    const sum = bars.reduce((n, bar) => n + weight(bar.dataset.kind), 0) || bars.length || 1;
    for (const bar of bars) {
      const duration = pendingRefill ? total : total * (weight(bar.dataset.kind) || (sum ? 0 : 1)) / sum;
      const green = bar.querySelector('.rp-under');
      const yellow = bar.querySelector('.rp-over');
      if (!green || !yellow) continue;
      const target = `${bar.dataset.target}%`;
      if (duration > 0) {
        bar.getBoundingClientRect(); // commit the reset before starting the transition
        green.style.transition = `width ${duration * .45}ms linear`;
        green.style.width = target;
        await new Promise((resolve) => setTimeout(resolve, duration * .45));
        if (!active()) return;
        yellow.style.transition = `width ${duration * .55}ms linear`;
        yellow.style.width = target;
        await new Promise((resolve) => setTimeout(resolve, duration * .55));
        if (!active()) return;
      } else {
        green.style.width = target;
        yellow.style.width = target;
      }
    }
    if (!active()) return;
    xpAnimationDone = true;
    if (pendingRefill) {
      pendingRefill.phase = 'settled';
      renderMenu();
      const settled = app.querySelector('.reward-claim-layout');
      const delay = settings.levelUpRefillPauseMs == null ? 200 : Number(settings.levelUpRefillPauseMs);
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(2000, Number.isFinite(delay) ? delay : 200))));
      if (!settled?.isConnected || refill !== pendingRefill) return;
      refill = null;
      pendingRefill.after();
    } else renderMenu();
  }

  // ---- THE DOOR: a decision modal OVER whatever stands beneath ---------------
  // Constantine: victory is a modal over the battlefield, and the cinders are
  // granted on arrival. Each view (menu, detail, chooser) is the same md door
  // rebuilt: kit head (Eyebrow + Title, no way out but a choice), a body, and
  // a foot on the button ladder. It lives inside `app`, so the next screen's
  // own mount clears it exactly as it cleared the old full-screen menu.
  function door({ eyebrow, title, body, foot, attrs = {}, status = null }) {
    app.querySelector('.reward-veil')?.remove();
    if (!app.firstElementChild) app.appendChild(el('div', { class: 'screen reward-backdrop' }));
    const head = modalHead({ eyebrow, title, closeLabel: t('reward.close'), extras: status });
    head.querySelector('.modal-close').hidden = true;
    const modal = el('section', {
      class: 'modal reward-door', dataset: { size: 'md' }, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, ...attrs,
    }, [head, el('div', { class: 'modal-body reward-body' }, body), foot]);
    const veil = el('div', { class: 'modal-veil reward-veil' }, modal);
    app.appendChild(veil);
    return modal;
  }
  function grantCinders() {
    const row = plan.rows.find((r) => r.kind === 'cinders');
    if (!row || states.cinders || row.blockedBy) return;
    if (apply.cinders(row)) {
      states.cinders = 'taken';
      persistProgress();
    }
  }

  // ---- the menu ------------------------------------------------------------
  function renderMenu(focusKind = null) {
    const mode = collectMode();
    const pending = plan.rows.filter((r) => !states[r.key] && !r.blockedBy);
    // THE ONE-LINE NOTES (SPEC §15.1): a card chance that missed leaves no
    // card row, and the menu says so rather than leaving a silent gap.
    const notesHtml = rewardNotes(rewards).map((token) => `<p class="reward-note" data-note="${esc(token)}">${esc(t(`reward.note.${token}`))}</p>`).join('');
    // Level cards are claimed from the progression bar when it is present.
    // Older offers without an XP receipt still keep their normal reward row.
    const rowsHtml = plan.rows.filter((row) => draftUnlocked(row)
      && (!['levelChoice', 'levelCard'].includes(row.kind) || !deferredLevelOffer() || (row.ordinal < claimedLevels && !states[row.key]))).map((row) => {
      const state = states[row.key] || (row.blockedBy ? 'blocked' : 'pending');
      const { title, body } = rowBody(row);
      return `
        <div class="class-pick reward-kind${state === 'taken' || state === 'blocked' || state === 'skipped' ? ' locked' : ''}"
             data-kind="${esc(row.kind)}" data-key="${esc(row.key)}" data-state="${esc(state)}"
             data-blocked-by="${esc(row.blockedBy || '')}" data-new="${isNew(row) && state !== 'taken' ? '1' : '0'}">
          <div class="glyph">${KIND_GLYPHS[row.kind] || '?'}</div>
          <div class="cp-body">
            <h3>${esc(title)}${isNew(row) && state !== 'taken' ? ` <span class="chip reward-new">${esc(t('reward.card.new'))}</span>` : ''}</h3>
            <p>${body}</p>
            ${state === 'taken' ? `<span class="chip">${esc(t('reward.state.taken'))}</span>`
              : state === 'blocked' ? `<span class="chip">${esc(t('reward.state.blocked'))}</span>`
              : state === 'skipped' ? `<span class="chip">${esc(t('reward.state.skipped'))}</span>`
              : ''}
          </div>
          ${state === 'blocked' ? `<button class="subtle reward-skip" data-skip="${esc(row.key)}" data-focusable="true" aria-label="${esc(t('reward.skip.aria', { kind: title }))}">${esc(t('reward.skip'))}</button>` : ''}
        </div>`;
    }).join('');
    // The button is the verb; the FootNote says what the verb does here (the
    // E11 dial: auto-collect takes the rest, manual leaves it) and how to press.
    const cont = button({
      label: t('reward.continue'),
      weight: 'primary', id: 'reward-continue', attrs: {
        'aria-describedby': 'reward-hold-copy',
        'data-confirm-ready': String(plan.rows.every(row => states[row.key] === 'taken' || states[row.key] === 'skipped')),
      },
    });
    // A level waiting to be claimed holds Continue until the player claims it:
    // a lasting refusal, so its reason is a visible line under the footer
    // (D43), not only the title.
    const levelsPending = Boolean((progress?.character && pendingLevelCount(registries, run) > 0)
      || progress?.skills.some((row) => pendingSkillLevelCount(registries, run, row.id) > 0));
    if (levelsPending) {
      cont.disabled = true;
      cont.title = t('reward.continue.reason.levels');
    }
    const foot = modalFooter({
      note: cont.dataset.confirmReady === 'true' ? t('reward.hold.complete')
        : mode === 'auto' && pending.length ? t('reward.hold.takesRest') : t('reward.hold.leavesRest'),
      primary: cont, className: 'reward-foot', size: 'medium',
    });
    const note = foot.querySelector('.modal-foot-note');
    note.id = 'reward-hold-copy';
    note.setAttribute('aria-live', 'polite');
    // W1t: the choices beside their claim status, and the count in the head.
    const claim = rewardClaimStatus(plan, states);
    door({
      eyebrow: plan.rows.length ? t('reward.eyebrow.claim') : t('reward.eyebrow.spoils'),
      title: rewards.title || t('reward.title.victory'),
      // No live region: the door is rebuilt each render, and the footer note
      // already announces progress.
      status: plan.rows.length ? el('span', { class: 'as-status modal-head-status',
        text: t('reward.status.claimed', { claimed: claim.claimed, total: claim.total }) }) : null,
      body: el('div', { class: 'reward-claim-layout' }, [
        el('div', { class: 'class-row reward-menu', html: rowsHtml + notesHtml }),
        sideColumn(claim),
      ]),
      foot,
    });

    for (const levelButton of app.querySelectorAll('.reward-level-up')) {
      levelButton.addEventListener('click', () => levelButton.dataset.track === 'character'
        ? claimLevel() : claimSkill(levelButton.dataset.track));
    }
    if (refill) {
      app.querySelector('.reward-menu').inert = true;
      cont.disabled = true;
    }
    // A refill's hold clears by itself within a beat, so it shows no line.
    reasonWhenDisabled(cont, () => (levelsPending && !refill ? t('reward.continue.reason.levels') : null))();

    for (const el of app.querySelectorAll('.reward-kind')) {
      const row = plan.rows.find((r) => r.key === el.dataset.key);
      const state = el.dataset.state;
      // Law 3 clause 4: a real tooltip, for hover AND the pad/keyboard focus
      // cursor. The blocked row's tooltip carries the REASON (blockedBy), so
      // the label switches on the model's token, never on a re-derivation.
      attachTooltip(el, () => {
        if (state === 'blocked') {
          const blocked = row.blockedBy === 'storage' ? 'reward.blocked.storage' : 'reward.blocked.slots';
          return `<div class="tt-title">${esc(tTip(blocked))}</div>${esc(tFull(blocked))}`;
        }
        if (state === 'taken') return `<div class="tt-title">${esc(tTip('reward.state.taken'))}</div>`;
        const offer = CARD_CHOICE_KINDS.includes(row.kind) || row.kind === 'classDraft' ? (row.choice ? 'reward.card.choose' : 'reward.card.take') : 'reward.take';
        return `<div class="tt-title">${esc(tTip(offer))}</div>${esc(tFull(offer))}`;
      });
      if (state === 'taken' || state === 'blocked' || state === 'skipped') continue;
      el.addEventListener('click', (ev) => {
        if (CARD_CHOICE_KINDS.includes(row.kind) || row.kind === 'classDraft' || row.kind === 'levelChoice') return renderChooser(row);
        if (row.kind === 'flask' || row.kind === 'armament' || row.kind === 'relic') return renderDetail(row);
        take(row);
      });
    }
    for (const btn of app.querySelectorAll('[data-skip]')) {
      attachTooltip(btn, () => `<div class="tt-title">${esc(tTip('reward.skip'))}</div>${esc(tFull('reward.skip'))}`);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        states[btn.dataset.skip] = 'skipped';
        persistProgress();
        renderMenu(btn.dataset.skip);
      });
    }

    attachTooltip(cont, () => (mode === 'auto'
      ? `<div class="tt-title">Continue</div>${esc('Takes every pending reward; a card offer is picked for you.')}`
      : `<div class="tt-title">Continue</div>${esc('Done — only what you chose comes along.')}`));
    const finish = () => {
      // 'cardRewards' is the stream that rolled this offer (STREAM_NAMES is a
      // closed set); the auto pick advances the same stream, so a seeded run
      // resolves the same card every replay.
      const pickFn = rng ? (n) => rng.int('cardRewards', 0, n - 1) : () => 0;
      const { take: offered } = resolveContinue(plan, states, mode, pickFn);
      // Level cards belong to a level claim, never to auto-collect on Continue.
      const toTake = offered.filter((row) => draftUnlocked(row)
        && (!['levelChoice', 'levelCard'].includes(row.kind) || !deferredLevelOffer() || row.ordinal < claimedLevels));
      for (const row of toTake) {
        if (apply[row.kind](row)) {
          states[row.key] = 'taken';
          persistProgress();
        }
      }
      if (toTake.length) sfx.play('rewardTake');
      onDone(chosenCardId);
    };
    // The action is registered in secondbeat's enumerable table, so native
    // keyboard/gamepad presses enter the same shared armPress door as pointer
    // and touch; the configured dial remains the one duration authority.
    beatArmer(meta, registries)(cont, 'rewardContinue', {
      question: t('reward.leave.question'),
      confirmLabel: t('reward.leave.confirm'),
      onConfirm: finish,
    });

    if (!xpAnimationStarted && progress && (rewards.xpBefore || refill)) {
      xpAnimationStarted = true;
      // Bind the pending animation to this render, before another mount can
      // replace it. Looking up the host inside the timer captures a new run.
      const host = app.querySelector('.reward-claim-layout');
      setTimeout(() => {
        if (host?.isConnected && app.querySelector('.reward-claim-layout') === host) playXpAnimation(host);
      }, 0);
    }

    if (isEngaged()) {
      setTimeout(() => (focusKind && focusFirst(`.reward-kind[data-key="${focusKind}"]`))
        || focusFirst('.reward-kind:not(.locked)') || focusFirst('#reward-continue'), 0);
    }
  }

  // The W1t claim-status column: every row's state, then the one choice still
  // waiting. That optional slot collapses when nothing waits.
  // The right-hand column: what the fight moved, then what is left to claim.
  // One column so the two read as one ledger; null when it would be empty
  // (a preview scene's stub run with no offer and no ledgers).
  function sideColumn(claim) {
    const progression = progressPanel();
    const children = [progression, !progression && plan.rows.length ? claimStatusPanel(claim) : null].filter(Boolean);
    return children.length ? el('div', { class: 'reward-side' }, children) : null;
  }

  // ONE ROW OF THE PANEL: name · level · the bar · the level it fills toward ·
  // what this fight paid. The bar is the kit meter (one meter in the tree),
  // and its aria label is the sentence the numbers mean, because a bar with
  // no text is a picture of progress to a screen reader.
  function progressRow(row, label) {
    // A CAP is the only thing that leaves a row without a next level — the
    // model drops a track whose curve will not read rather than handing one
    // here, so `capped` alone decides this and no re-derivation guesses.
    const next = el('span', {
      class: 'rp-next',
      text: row.capped ? t('reward.progress.capped') : row.kind === 'character' ? `Level ${row.level + 1}` : t('reward.progress.next', { level: row.level + 1 }),
    });
    const ready = xpAnimationDone && (row.kind === 'character'
      ? pendingLevelCount(registries, run) > 0
      : !!onClaimSkill && pendingSkillLevelCount(registries, run, row.id) > 0);
    const target = row.fraction * 100;
    const before = row.kind === 'character' ? rewards.xpBefore?.character : rewards.xpBefore?.tracks?.[row.id];
    const old = !refill && before && before.level === row.level && row.xpToNext
      ? Math.max(0, Math.min(100, before.xp / row.xpToNext * 100)) : 0;
    const animate = refill ? refill.phase === 'filling' && refill.id === row.id
      : !xpAnimationDone && row.gained > 0 && !!before;
    const under = el('span', { class: 'rp-under' });
    const over = el('span', { class: 'rp-over' });
    under.style.width = `${animate ? old : target}%`;
    over.style.width = `${animate ? old : target}%`;
    const bar = el('div', {
      class: `rp-bar rp-layered-bar${ready ? ' rp-bar-ready' : ''}`,
      role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(row.xpToNext || 0),
      'aria-valuenow': String(Math.min(row.xp, row.xpToNext || row.xp)),
      'aria-label': `${label}: ${Math.min(row.xp, row.xpToNext || row.xp)} / ${row.xpToNext || row.xp} XP`,
      dataset: { animate: animate ? '1' : '0', target: String(target), old: String(old), track: row.id, kind: row.kind },
    }, [under, over, el('span', { class: 'rp-bar-text', text: `${Math.min(row.xp, row.xpToNext || row.xp)} / ${row.xpToNext || row.xp}` })]);
    const node = el('li', {
      class: `reward-progress-row${ready ? ' reward-level-ready' : ''}`,
      dataset: { kind: row.kind, track: row.id, gained: String(row.gained) },
    }, [
      row.kind === 'character' ? null : el('span', { class: 'rp-name', text: label }),
      el('span', { class: 'rp-level', text: row.kind === 'character' ? `Level ${row.level}` : t('reward.progress.level', { level: row.level }) }),
      bar,
      next,
      ready ? button({ label: 'Level', className: 'reward-level-up', disabled: !!refill, attrs: { 'data-track': row.id, 'aria-label': `Level up ${label}` } }) : null,
      row.kind !== 'character' && row.gained ? el('span', { class: 'rp-gain', text: t('reward.progress.gained', { xp: row.gained }) }) : null,
      // The per-fight level cap threw some of it away (SPEC §15.2): say how much.
      row.discarded ? el('span', { class: 'rp-discarded', title: tFull('reward.progress.discarded', { xp: row.discarded }), text: t('reward.progress.discarded', { xp: row.discarded }) }) : null,
    ]);
    // The exact XP is the tooltip, not the row: the row carries the shape of
    // the climb and the gain; the numbers are for the player who asks.
    attachTooltip(node, () => `<div class="tt-title">${esc(label)}</div>${esc(row.capped
      ? tFull('reward.progress.capped')
      : tFull('reward.progress.xp', { xp: Math.min(row.xp, row.xpToNext), next: row.xpToNext, level: row.level + 1 }))}`);
    return node;
  }

  function progressPanel() {
    if (!progress || (!progress.character && !progress.skills.length)) return null;
    const skills = progress.skills.map((row) => progressRow(
      row,
      row.kind === 'class' ? t('reward.progress.classTrack', { class: row.label }) : row.label,
    ));
    return el('section', { class: 'reward-progress', 'aria-label': t('reward.progress.heading') }, [
      el('h3', { class: 'as-eyebrow', text: t('reward.progress.heading') }),
      progress.character
        ? el('ul', { class: 'reward-progress-list' }, [progressRow(progress.character, progress.character.label || t('reward.progress.character'))])
        : null,
      skills.length ? el('ul', { class: 'reward-progress-list' }, skills) : null,
      progress.hidden
        ? el('p', { class: 'reward-progress-more', text: t('reward.progress.more', { count: progress.hidden, plural: progress.hidden === 1 ? '' : 's' }) })
        : null,
    ]);
  }

  function claimStatusPanel(claim) {
    const lines = claim.rows.map((entry) => el('li', { class: 'reward-claim-row', dataset: { kind: entry.kind, key: entry.key, state: entry.state } }, [
      el('span', { class: 'reward-claim-name', text: rowBody(plan.rows.find((row) => row.key === entry.key)).title }),
      el('span', { class: 'reward-claim-state', text: t(entry.state === 'blocked' ? 'reward.claim.blocked' : `reward.state.${entry.state}`) }),
    ]));
    const required = claim.requiredChoice ? el('p', { class: 'reward-claim-required', dataset: { required: claim.requiredChoice.kind } }, [
      el('span', { class: 'as-eyebrow', text: t('reward.claim.required') }),
      el('span', { text: t('reward.card.chooseOne', { count: claim.requiredChoice.count }) }),
    ]) : null;
    return el('aside', { class: 'reward-claim-status', 'aria-label': t('reward.claim.heading') }, [
      el('h3', { class: 'as-eyebrow', text: t('reward.claim.heading') }),
      el('ul', { class: 'reward-claim-list' }, lines),
      required,
    ]);
  }

  // Potions, armaments and relics are inspect-before-collect surfaces. Opening one
  // commits nothing; Back restores the exact menu state, and Take is the only
  // collection door from the detail.
  function renderDetail(row) {
    const body = rowBody(row);
    const isFlask = row.kind === 'flask';
    const kindLabel = t(isFlask ? 'reward.kind.potion' : row.kind === 'relic' ? 'reward.kind.relic' : 'reward.kind.armament');
    const takeButton = button({ label: t('reward.detail.take', { kind: kindLabel.toLowerCase() }), weight: 'primary', id: 'reward-detail-take' });
    const backButton = button({ label: t('reward.detail.back'), id: 'reward-back', className: 'subtle', attrs: { 'data-back': '' } });
    const detailBody = el('div', { class: 'class-row reward-menu' });
    const armament = !isFlask && registries.equipment.armaments.find(piece => piece.id === row.armamentId);
    if (armament) detailBody.append(renderEquipmentInspection(registries, armament));
    else if (row.kind === 'relic') detailBody.append(renderCollectibleInspection(registries, registries.relics.get(row.relicId), t('reward.kind.relic'), { interactive: false }));
    else if (isFlask) detailBody.append(renderCollectibleInspection(registries, registries.flasks.get(row.flaskId), t('reward.kind.potion')));
    else detailBody.innerHTML = `<div class="class-pick reward-kind" data-kind="${esc(row.kind)}">
      <div class="glyph">${KIND_GLYPHS[row.kind]}</div>
      <div class="cp-body"><h3>${esc(body.title)}</h3><p>${body.body}</p></div>
    </div>`;
    door({
      eyebrow: t('reward.inspect.eyebrow', { kind: kindLabel.toLowerCase() }),
      title: row.kind === 'relic' ? registries.relics.get(row.relicId).name : kindLabel,
      attrs: { dataset: { size: 'md', rewardDetail: row.kind } },
      body: detailBody,
      foot: modalFooter({ secondary: [backButton], primary: takeButton, className: 'reward-foot', size: 'medium' }),
    });
    app.querySelector('#reward-detail-take').addEventListener('click', () => take(row, row.kind));
    const back = app.querySelector('#reward-back');
    attachTooltip(back, () => `<div class="tt-title">${esc(tTip('reward.detail.back'))}</div>${esc(tFull('reward.detail.back'))}`);
    back.addEventListener('click', () => renderMenu(row.key));
    if (isEngaged()) setTimeout(() => focusFirst('#reward-detail-take') || focusFirst('#reward-back'), 0);
  }

  // ---- the card chooser: select first, then explicitly confirm -------------
  // One chooser for the card offer and for a skill draft (plan phase 4b): the
  // row hands in its cards; which deck write Confirm makes is the row's kind.
  function renderChooser(row = plan.rows.find((r) => r.kind === 'card')) {
    const taken = () => states[row.key];
    // A class draft chooses among tree NODES (plan phase 5b): each is a tile
    // with the node's glyph, name and its rule's sentence, the numbers read
    // through the node's bindings — the same selection path as a card.
    const isNodeRow = row.kind === 'classDraft';
    const isLevelChoice = row.kind === 'levelChoice';
    const ids = isNodeRow ? row.nodeIds : isLevelChoice ? row.options.map((o) => `${o.kind}:${o.id}`) : row.cardIds;
    const pickField = isNodeRow ? 'nodeId' : isLevelChoice ? 'choiceId' : 'cardId';
    const backButton = button({ label: t('reward.chooser.back'), id: 'reward-back', className: 'subtle', attrs: { 'data-back': '' } });
    const confirmButton = button({
      label: t('reward.confirm'), weight: 'primary', id: 'reward-card-confirm', className: 'reward-confirm', disabled: true,
    });
    door({
      eyebrow: row.kind === 'levelCard' || isLevelChoice ? '' : row.kind === 'skillDraft' || row.kind === 'classDraft' ? rowBody(row).title : t('reward.card.eyebrow'),
      title: row.kind === 'levelCard' || isLevelChoice ? t('reward.levelUp.action') : rewards.title || t('reward.title.victory'),
      body: el('div', { class: 'reward-row', role: 'radiogroup', 'aria-label': t('reward.card.aria') }),
      foot: modalFooter({ secondary: [backButton], primary: confirmButton, className: 'reward-foot reward-chooser-foot', size: 'medium' }),
    });
    const strip = app.querySelector('.reward-row');
    if (row.kind === 'levelCard' || isLevelChoice) {
      const stats = statAllocationSection();
      if (stats) strip.after(stats);
    }
    let selectedCardId = pendingByKey[row.key] || null;
    let confirming = false;
    const message = el('p', { role: 'status', class: 'reward-confirm-status', hidden: true });
    strip.after(message);
    // Nothing chosen yet: the reason stands under Confirm as text (FINISH §6).
    // A press in flight is a beat, not a reason, so it stays quiet.
    const confirmReason = reasonWhenDisabled(confirmButton, () => (selectedCardId ? null : t('reward.confirm.reason')));
    // ONE SELECTION PATH. The strip's own click and the inspect door's Choose
    // both land here, so a card chosen from inside the door is lit in the
    // strip behind it and Back still shows what you picked.
    const selectCard = (cardId) => {
      selectedCardId = cardId;
      pendingByKey[row.key] = cardId;
      // Candidates are found by CLASS, not by attribute: the reward door's
      // test DOM (tests/helpers/reward-dom.mjs) keeps dataset as a plain
      // object, and a selector on a data attribute would find nothing there.
      for (const candidate of strip.querySelectorAll('.reward-pick')) {
        const selected = candidate.dataset.pickId === cardId;
        // Both, always together (#997): the lift and the shared ring.
        candidate.classList.toggle('reward-selected', selected);
        candidate.classList.toggle('is-chosen', selected);
        candidate.setAttribute('aria-checked', String(selected));
      }
      confirmButton.disabled = false;
      confirmReason();
      message.hidden = true;
    };
    for (const option of isLevelChoice ? row.options : []) {
      const choiceId = `${option.kind}:${option.id}`;
      const feat = option.kind === 'feat' ? featById(option.id) : null;
      const node = option.kind === 'classNode' ? (registries.nodes || []).find((entry) => entry.id === option.id) : null;
      const rule = node && registries.propertyRules?.has(node.id) ? registries.propertyRules.get(node.id) : null;
      const tokens = node ? nodeTokens(registries, node.id) : {};
      const sentence = String(rule?.textTemplate || '').replace(/\{(\w+)\}/g, (m, tok) => tokens[tok] !== undefined ? String(tokens[tok]) : m);
      const tile = el('button', { class: 'class-pick reward-node reward-pick', type: 'button', role: 'radio',
        'aria-checked': String(choiceId === selectedCardId), dataset: { pickId: choiceId } }, [
        el('div', { class: 'glyph', text: feat ? '✦' : node?.glyph || '☉' }),
        el('div', { class: 'cp-body' }, [
          el('h3', { text: feat?.name || node?.label || option.id }),
          el('p', { text: feat?.description || sentence || node?.blurb || '' }),
        ]),
      ]);
      tile.classList.toggle('reward-selected', choiceId === selectedCardId);
      tile.classList.toggle('is-chosen', choiceId === selectedCardId);
      tile.addEventListener('click', () => selectCard(choiceId));
      strip.appendChild(tile);
    }
    for (const nodeId of isNodeRow ? ids : []) {
      const node = (registries.nodes || []).find((n) => n && n.id === nodeId) || { id: nodeId, label: nodeId };
      const rule = registries.propertyRules && registries.propertyRules.has(nodeId) ? registries.propertyRules.get(nodeId) : null;
      const tokens = nodeTokens(registries, nodeId);
      const sentence = String((rule && rule.textTemplate) || '').replace(/\{(\w+)\}/g, (m, tok) => (tokens[tok] !== undefined ? String(tokens[tok]) : m));
      const tile = el('button', { class: 'class-pick reward-node reward-pick', type: 'button', role: 'radio', 'aria-checked': String(nodeId === selectedCardId), dataset: { pickId: nodeId, nodeId } }, [
        el('div', { class: 'glyph', text: node.glyph || '☉' }),
        el('div', { class: 'cp-body' }, [el('h3', { text: node.label }), el('p', { text: sentence || node.blurb || '' })]),
      ]);
      tile.classList.toggle('reward-selected', nodeId === selectedCardId);
      tile.classList.toggle('is-chosen', nodeId === selectedCardId);
      tile.addEventListener('click', () => selectCard(nodeId));
      strip.appendChild(tile);
    }
    for (const cardId of isNodeRow || isLevelChoice ? [] : ids) {
      // This face only selects; collection belongs to Confirm. Inspection must
      // not consume the touch tap before selection enables that button.
      // THE DOOR OFFERS THE VERB THE PLAYER CAME FOR. Opening a card here used
      // to show a dead `Play card` — combat's verb, inherited from the default
      // that services/cardActions.js replaced — on the one screen whose whole
      // purpose is taking the card being read. Choosing from inside the door
      // lights the same card behind it and presses the same Confirm, so there
      // is one commit and one place the receipt is written.
      const el = renderCard(registries, { cardId, upgraded: row.kind === 'skillDraft' && skillUpgradesCards(registries, skillLevel(run, row.skillId)) }, {
        owned: ownedCopies(run, cardId),
        actionOwnsTouch: true,
        surface: 'reward',
        availability: { choose: taken() ? t('reward.card.alreadyTaken') : true },
        commands: { choose: () => { selectCard(cardId); confirmButton.click(); } },
      });
      el.dataset.cardId = cardId;
      el.dataset.pickId = cardId;
      el.classList.add('reward-pick');
      el.setAttribute('role', 'radio');
      el.setAttribute('aria-checked', String(cardId === selectedCardId));
      // `reward-selected` is the door's own lift; `is-chosen` is the ring the
      // whole game now shares (kit.css). Both, always together.
      el.classList.toggle('reward-selected', cardId === selectedCardId);
      el.classList.toggle('is-chosen', cardId === selectedCardId);
      if (marks.cards.includes(cardId)) {
        // The marker is a RENDERED badge, not only a data attribute — Codex
        // 4989824448's third finding: `data-new` alone had no consumer in any
        // stylesheet or renderer, so the promise was inert pixels-wise. The
        // attribute stays as the machine-readable hook; the chip is what the
        // player sees. Positioned inside `.card` (its named container —
        // position: relative, ui.css) per Law 2.
        el.dataset.new = '1';
        const badge = document.createElement('span');
        badge.className = 'chip reward-new card-badge-new';
        badge.textContent = t('reward.card.new');
        el.appendChild(badge);
      }
      el.addEventListener('click', () => selectCard(cardId));
      strip.appendChild(el);
    }
    confirmButton.disabled = !selectedCardId;
    confirmReason();
    confirmButton.addEventListener('click', () => {
      if (!selectedCardId || confirming || taken()) return;
      confirming = true;
      confirmButton.disabled = true;
      try {
        // A take that lands returns true and re-renders the menu; one the
        // door refuses (a draft the ledger has no draft queued for — an
        // offer older than its ledger) returns false and must not leave the
        // chooser armed but dead: say so and hand the button back.
        if (!take({ ...row, [pickField]: selectedCardId }, row.key)) {
          message.textContent = t(row.kind === 'skillDraft' ? 'reward.skillDraft.spent' : row.kind === 'classDraft' ? 'reward.classDraft.spent' : 'reward.card.alreadyTaken');
          message.hidden = false;
          confirming = false;
          confirmButton.disabled = false;
        }
      } catch {
        message.textContent = t('reward.card.saveFailed');
        message.hidden = false;
        confirming = false;
        confirmButton.disabled = false;
      }
    });
    const back = app.querySelector('#reward-back');
    attachTooltip(back, () => `<div class="tt-title">${esc(tTip('reward.chooser.back'))}</div>${esc(tFull('reward.chooser.back'))}`);
    back.addEventListener('click', () => renderMenu(row.key));
    if (isEngaged()) setTimeout(() => focusFirst('.reward-row .reward-pick') || focusFirst('#reward-back'), 0);
  }

  function expandVictory() {
    if (checkpoint) checkpoint.expanded = true;
    persistProgress();
    const waitingCard = plan.rows.find((row) => ['levelChoice', 'levelCard'].includes(row.kind) && row.ordinal < claimedLevels && !states[row.key])
      || plan.rows.find((row) => ['skillDraft', 'classDraft'].includes(row.kind)
        && row.claimOrdinal > 0 && draftUnlocked(row) && !states[row.key]);
    if (waitingCard) renderChooser(waitingCard);
    else renderMenu();
  }

  function renderCompactVictory() {
    const total = Math.max(0, Math.floor(Number(rewards.xpGains?.level) || 0));
    const savedRows = rewards.xpReceipt?.rows;
    // An older saved reward has no itemized receipt. Show its paid total as
    // one honest row; never reconstruct enemy levels from the resumed run.
    const rows = Array.isArray(savedRows) && savedRows.every((row) => Number.isSafeInteger(row.amount))
      && savedRows.reduce((sum, row) => sum + row.amount, 0) === total
      ? savedRows : [{ kind: 'legacy', amount: total }];
    const options = victoryXpPresentation(settings, document.body.classList.contains('reduced-motion'));
    const timing = victoryXpTiming(rows.length, options);
    const open = button({ label: 'Continue', weight: 'primary', id: 'reward-expand', className: 'reward-compact-continue', disabled: true });
    const formula = el('span', { class: 'reward-compact-formula' });
    const more = el('button', { class: 'reward-compact-more', type: 'button', text: '+…', 'aria-label': 'Show full XP calculation' });
    more.hidden = true;
    const arithmetic = el('span', { class: 'reward-compact-arithmetic' }, [formula, more]);
    const value = el('strong', { class: 'reward-compact-value', text: '0 XP', 'aria-live': 'polite' });
    const summary = el('div', { class: 'reward-compact-summary' }, [
      el('span', { class: 'reward-compact-heading', text: 'Total XP' }), arithmetic, value,
    ]);
    const list = el('ol', { class: 'reward-compact-list', 'aria-label': 'XP earned this fight' });
    list.style.setProperty('--receipt-rows', String(options.visibleRows));
    const body = el('div', { class: 'reward-compact-xp' }, [summary, list]);
    const modal = door({ eyebrow: '', title: rewards.title || t('reward.title.victory'),
      attrs: { dataset: { size: 'sm', victoryCompact: 'true' } }, body,
      foot: modalFooter({ primary: open, className: 'reward-foot', size: 'medium' }),
    });
    const fullCalculation = () => `<div class="tt-title">Full XP calculation</div><div>${esc(victoryXpFormula(rows, rows.length, options.formulaTerms).full)}</div>`;
    const tooltipPlacement = { intent: 'above', align: 'end', clear: modal, appearance: { maxWidthRem: 30, maxHeightRatio: 0.5 } };
    attachTooltip(more, fullCalculation, tooltipPlacement);
    more.addEventListener('click', () => showTooltipFor(more, fullCalculation(), tooltipPlacement));
    let ready = false;
    let shown = 0;
    const active = () => modal.isConnected && app.querySelector('.reward-door') === modal;
    const updateFormula = () => {
      const expression = victoryXpFormula(rows, shown, options.formulaTerms);
      formula.textContent = expression.shown;
      more.hidden = !expression.collapsed;
    };
    const addRow = (row) => {
      const label = row.kind === 'power' ? 'Combat-power victory bonus'
        : row.kind === 'enemy' ? `${row.name || 'Enemy'} · Level ${row.level || 1}`
          : row.kind === 'bonus' ? 'Character XP bonus' : 'Battle XP';
      const amount = el('strong', { class: 'reward-compact-row-value', text: '+0' });
      const item = el('li', { class: 'reward-compact-row' }, [
        el('span', { class: 'reward-compact-row-label', text: label }), amount,
      ]);
      list.appendChild(item);
      list.scrollTop = list.scrollHeight;
      return amount;
    };
    const arm = () => {
      if (!active()) return;
      ready = true;
      open.disabled = false;
      open.classList.add('is-ready');
      if (settings.victorySummaryMode === 'auto') expandVictory();
    };
    const pause = (ms) => ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
    const count = (from, to, ms, render) => new Promise((resolve) => {
      if (ms <= 0) { render(to); resolve(); return; }
      const start = performance.now();
      const frame = (now) => {
        if (!active()) { resolve(); return; }
        const fraction = Math.min(1, (now - start) / ms);
        render(from + Math.round((to - from) * fraction));
        if (fraction >= 1) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const show = (row, running) => {
      const amount = addRow(row);
      return (next) => {
        amount.textContent = `${next < 0 ? '−' : '+'}${Math.abs(next)}`;
        value.textContent = `${running + next} XP`;
      };
    };
    if (options.totalMs === 0) {
      let running = 0;
      for (const row of rows) {
        show(row, running)(row.amount);
        running += row.amount;
        shown += 1;
      }
      updateFormula();
      if (options.readyMs === 0) arm();
      else setTimeout(arm, options.readyMs);
    } else {
      (async () => {
        let running = 0;
        for (const [index, row] of rows.entries()) {
          if (!active()) return;
          await count(0, row.amount, timing.tickMs, show(row, running));
          if (!active()) return;
          running += row.amount;
          shown = index + 1;
          updateFormula();
          if (index < rows.length - 1) await pause(timing.pauseMs);
        }
        await pause(options.readyMs);
        arm();
      })();
    }
    open.addEventListener('click', () => { if (ready) expandVictory(); });
    if (settings.victorySummaryMode === 'anywhere') {
      app.querySelector('.reward-veil')?.addEventListener('click', (event) => {
        if (ready && event.target !== open && event.target !== more) expandVictory();
      });
    }
  }

  sfx.play('victory');
  grantCinders();
  if (checkpoint?.expanded) expandVictory();
  else if (!checkpoint?.source || !rewards.xpGains) renderMenu();
  else renderCompactVictory();
}
