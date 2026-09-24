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
// PROGRESSION, BESIDE THE CLAIM (Constantine, 2026-09-20: "why don't I see
// level progression, xp gained, skill progression in here either"). The fight
// pays the character level and every skill track it touched at combat
// resolution — BEFORE this door opens — so the door used to show only the
// half you pick up. model/rewardprogress.js derives the other half: the
// ledgers as they stand now, plus what this fight paid into them, handed in
// on the offer as `rewards.xpGains` (main.js keeps it on the pending-reward
// checkpoint, so a reload resumes the same numbers). Derived once at mount:
// nothing a player does at this door moves a level.
//
// `saves` and `rng` are optional: co-op stubs and old callers get the dial's
// default and a deterministic first-card pick, never a crash and never
// Math.random — a UI pick that desyncs a seeded run is a defect.

import { renderCard } from '../components/card.js';
import { renderEquipmentInspection } from '../components/equipmentCard.js';
import { renderCollectibleInspection } from '../components/collectibleCard.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';
import { flaskIdentityHtml, flaskDetailLines } from '../components/flask.js';
import { flaskSlotCap } from '../../model/gracerefill.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { rewardPlan, rewardClaimStatus, resolveContinue, unseenIds } from '../../model/rewardplan.js';
import { rewardProgress } from '../../model/rewardprogress.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { modEffectLines } from '../../model/loadout.js';
import { skillTracks, skillLevel, skillUpgradesCards, spendSkillDraft, classSkillId } from '../../model/skills.js';
import { pickClassNode } from '../../model/classTree.js';
import { nodeTokens } from '../../model/tree.js';
import { el, modalHead, modalFooter, button, meter } from '../kit/index.js';
// Every sentence this screen says is a row in content/source/uiStrings.csv.
import { t, tFull, tTip } from '../strings.js';
import { clearSelection } from '../components/cardSelection.js';

const KIND_GLYPHS = { cinders: '◉', smithingStone: '⚒', classDraft: '☉', skillDraft: '✦', card: '🂠', flask: '⚗', armament: '⚔', relic: '◆' };

// `onCollectArmament` is the armament's whole persistence, handed in by the
// caller (main.js collectArmament): run storage + meta.found + the discovery
// receipt. Handed in rather than done here because the persistence needs the
// caller's run/shot context, and because a screen that decides nothing should
// also STORE nothing itself. A caller that hands none gets reveal-only rows —
// no such caller exists today; the boundary is named, not covered.
export function mountRewards(app, {
  registries, run, rewards, onDone, saves = null, rng = null,
  onCollectArmament = null, onPersist = null, checkpoint = null,
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
  // The fight's progression, derived once: the ledgers are already paid and
  // no choice at this door moves one. ONLY WHERE THERE WAS A FIGHT — the
  // panel's whole claim is what this one moved, and a treasure room (or an
  // offer saved before the receipt existed) moved nothing, so it draws the
  // spoils alone rather than a heading with no gains under it.
  const progress = rewards.xpGains ? rewardProgress(registries, run, rewards.xpGains) : null;
  const states = {
    ...(checkpoint?.states || {}),
    ...(rewards.smithingStoneReceipt?.amount > 0 ? { smithingStone: 'taken' } : {}),
  }; // kind → 'taken'|'skipped' (absent = pending / implicitly left in manual mode)
  let chosenCardId = checkpoint?.chosenCardId || null;
  // The skill drafts' picks, keyed by ROW KEY (plan phase 4b): one offer may
  // carry several drafts, even for one track, so the card row's single
  // `chosenCardId` is not their record.
  const chosenDraftCardIds = { ...(checkpoint?.chosenDraftCardIds || {}) };
  // The class drafts' picks (plan phase 5b), keyed by row key: tree nodes.
  const chosenDraftNodeIds = { ...(checkpoint?.chosenDraftNodeIds || {}) };
  // The boss relic kept from a choice row (SPEC §6.1); a pre-choice save has none.
  let chosenRelicId = checkpoint?.chosenRelicId || null;
  const pendingByKey = {}; // a chooser's unconfirmed selection, per row, so Back keeps it

  function persistProgress() {
    if (checkpoint) {
      checkpoint.states = { ...states };
      checkpoint.chosenCardId = chosenCardId;
      checkpoint.chosenDraftCardIds = { ...chosenDraftCardIds };
      checkpoint.chosenDraftNodeIds = { ...chosenDraftNodeIds };
      checkpoint.chosenRelicId = chosenRelicId;
    }
    if (onPersist && onPersist() === false) throw new Error('Reward save was refused.');
  }

  // ---- the 'new' derivation: run inventory ∪ the profile's record ----------
  const meta = (saves && saves.loadMeta && saves.loadMeta()) || {};
  const seenStore = meta.seen || {};
  const marks = unseenIds(rewards, {
    cards: new Set([...run.deck.map((c) => c.cardId), ...(seenStore.cards || [])]),
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
      run.deck.push({ instanceId: `r${run.deck.length}_${row.cardId}`, cardId: row.cardId, upgraded: false });
      chosenCardId = row.cardId;
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
      run.deck.push({ instanceId: `r${run.deck.length}_${row.cardId}`, cardId: row.cardId, upgraded: skillUpgradesCards(registries, skillLevel(run, row.skillId)) });
      chosenDraftCardIds[row.key] = row.cardId;
      return true;
    },
    flask(row) {
      run.flasks.push({ flaskId: row.flaskId });
      recordSeen('flask', [row.flaskId]);
      return true;
    },
    relic(row) {
      // A choice row lands exactly one relic: the pick, and only if not held.
      if (!row.relicId || run.relics.includes(row.relicId)) return false;
      if (row.choice) chosenRelicId = row.relicId;
      run.relics.push(row.relicId);
      syncFlaskGrowth(registries, run); // growth chain: a relic source binds the moment it is held
      recordSeen('relic', [row.relicId]);
      return true;
    },
    armament(row) { return onCollectArmament ? onCollectArmament(row.armamentId) !== false : false; },
  };

  function take(row, viaKind) {
    if (states[row.key]) return false;
    // A row may say Taken only after its persistence door says it landed. The
    // armament collector returns false at the storage/duplicate boundary; a
    // refusal therefore cannot become a claimed-looking row (E11 review P2).
    const cardBefore = row.kind === 'card' || row.kind === 'skillDraft' || row.kind === 'classDraft' || row.kind === 'relic' ? {
      deck: [...run.deck], chosenCardId, chosenRelicId, relics: [...run.relics], chosenDraft: { ...chosenDraftCardIds }, chosenNode: { ...chosenDraftNodeIds },
      // A draft's take spends the ledger's queued draft; only a draft's rollback puts it back.
      skills: row.kind === 'skillDraft' || row.kind === 'classDraft' ? structuredClone(run.skills || {}) : null,
      coreTags: row.kind === 'classDraft' ? [...(run.coreTags || [])] : null,
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
        chosenRelicId = cardBefore.chosenRelicId;
        run.relics.splice(0, run.relics.length, ...cardBefore.relics);
        for (const key of Object.keys(chosenDraftCardIds)) delete chosenDraftCardIds[key];
        Object.assign(chosenDraftCardIds, cardBefore.chosenDraft);
        if (cardBefore.skills) run.skills = cardBefore.skills;
        if (cardBefore.coreTags) run.coreTags = cardBefore.coreTags;
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
    if (row.kind === 'card' || row.kind === 'skillDraft') recordSeen('card', [row.cardId]);
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
        return {
          title: t('reward.stone.title', { amount: row.amount, plural: row.amount === 1 ? '' : 's' }),
          body: t('reward.stone.body', { total: row.stoneBalanceAfter }),
        };
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
        if (row.choice) {
          const title = t('reward.relic.bossTitle');
          if (state === 'taken') {
            const def = registries.relics.get(chosenRelicId);
            return { title, body: t('reward.relic.chosen', { name: esc(`${def.icon || '◆'} ${def.name}`) }) };
          }
          const names = row.relicIds.map((id) => esc(registries.relics.get(id).name)).join(' · ');
          return { title, body: `${t('reward.card.chooseOne', { count: row.relicIds.length })}<br>${names}` };
        }
        const def = registries.relics.get(row.relicId);
        return { title: t('reward.kind.relic'), body: `<b>${esc(def.icon || '◆')} ${esc(def.name)}</b> — ${esc(relicText(def, registries))}` };
      }
      default:
        return { title: row.kind, body: '' };
    }
  }

  function isNew(row) {
    switch (row.kind) {
      case 'card':
      case 'skillDraft': return row.cardIds.some((id) => marks.cards.includes(id));
      case 'relic': return (row.choice ? row.relicIds : [row.relicId]).some((id) => marks.relics.includes(id));
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
    const rowsHtml = plan.rows.map((row) => {
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
        el('div', { class: 'class-row reward-menu', html: rowsHtml }),
        sideColumn(claim),
      ]),
      foot,
    });

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
        const offer = row.kind === 'relic' && row.choice ? 'reward.relic.choose'
          : row.kind === 'card' || row.kind === 'skillDraft' || row.kind === 'classDraft' ? (row.choice ? 'reward.card.choose' : 'reward.card.take') : 'reward.take';
        return `<div class="tt-title">${esc(tTip(offer))}</div>${esc(tFull(offer))}`;
      });
      if (state === 'taken' || state === 'blocked' || state === 'skipped') continue;
      el.addEventListener('click', (ev) => {
        if (row.kind === 'card' || row.kind === 'skillDraft' || row.kind === 'classDraft' || (row.kind === 'relic' && row.choice)) return renderChooser(row);
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
      const { take: toTake } = resolveContinue(plan, states, mode, pickFn);
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
    const children = [progressPanel(), plan.rows.length ? claimStatusPanel(claim) : null].filter(Boolean);
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
      text: row.capped ? t('reward.progress.capped') : t('reward.progress.next', { level: row.level + 1 }),
    });
    const bar = meter({
      pct: row.fraction * 100,
      skinny: true,
      attrs: { class: 'rp-bar' },
      ariaLabel: row.capped
        ? `${label}: ${tFull('reward.progress.capped')}`
        : `${label}: ${tFull('reward.progress.xp', { xp: row.xp, next: row.xpToNext, level: row.level + 1 })}`,
    });
    const node = el('li', {
      class: 'reward-progress-row',
      dataset: { kind: row.kind, track: row.id, gained: String(row.gained) },
    }, [
      el('span', { class: 'rp-name', text: label }),
      el('span', { class: 'rp-level', text: t('reward.progress.level', { level: row.level }) }),
      bar,
      next,
      row.gained ? el('span', { class: 'rp-gain', text: t('reward.progress.gained', { xp: row.gained }) }) : null,
    ]);
    // The exact XP is the tooltip, not the row: the row carries the shape of
    // the climb and the gain; the numbers are for the player who asks.
    attachTooltip(node, () => `<div class="tt-title">${esc(label)}</div>${esc(row.capped
      ? tFull('reward.progress.capped')
      : tFull('reward.progress.xp', { xp: row.xp, next: row.xpToNext, level: row.level + 1 }))}`);
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
      skills.length ? el('h4', { class: 'as-eyebrow', text: t('reward.progress.skills') }) : null,
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
    const backButton = button({ label: t('reward.detail.back'), id: 'reward-back', className: 'subtle' });
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
    // A boss's relic choice (SPEC §6.1) rides the same select-then-Confirm
    // door as a card: tiles in a radiogroup, one pick, plus a Skip that
    // leaves every relic behind.
    const isRelicRow = row.kind === 'relic';
    const ids = isNodeRow ? row.nodeIds : isRelicRow ? row.relicIds : row.cardIds;
    const pickField = isNodeRow ? 'nodeId' : isRelicRow ? 'relicId' : 'cardId';
    const backButton = button({ label: t('reward.chooser.back'), id: 'reward-back', className: 'subtle' });
    const skipButton = isRelicRow ? button({ label: t('reward.relic.skip'), id: 'reward-relic-skip', className: 'subtle' }) : null;
    const confirmButton = button({
      label: t(isRelicRow ? 'reward.relic.confirm' : 'reward.confirm'), weight: 'primary', id: 'reward-card-confirm', className: 'reward-confirm', disabled: true,
    });
    door({
      eyebrow: isRelicRow ? t('reward.relic.eyebrow') : row.kind === 'skillDraft' || row.kind === 'classDraft' ? rowBody(row).title : t('reward.card.eyebrow'),
      title: rewards.title || t('reward.title.victory'),
      attrs: isRelicRow ? { dataset: { size: 'md', rewardChooser: 'relic' } } : {},
      body: el('div', { class: `reward-row${isRelicRow ? ' reward-relic-row' : ''}`, role: 'radiogroup', 'aria-label': t(isRelicRow ? 'reward.relic.aria' : 'reward.card.aria') }),
      foot: modalFooter({ secondary: [backButton, skipButton].filter(Boolean), primary: confirmButton, className: 'reward-foot reward-chooser-foot', size: 'medium' }),
    });
    const strip = app.querySelector('.reward-row');
    let selectedCardId = pendingByKey[row.key] || null;
    let confirming = false;
    const message = el('p', { role: 'status', class: 'reward-confirm-status', hidden: true });
    strip.after(message);
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
      message.hidden = true;
    };
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
    for (const relicId of isRelicRow ? ids : []) {
      const def = registries.relics.get(relicId);
      const tile = el('button', { class: 'class-pick reward-relic reward-pick', type: 'button', role: 'radio', 'aria-checked': String(relicId === selectedCardId), dataset: { pickId: relicId, relicId } }, [
        el('div', { class: 'glyph', text: def.icon || '◆' }),
        el('div', { class: 'cp-body' }, [el('h3', { text: def.name }), el('p', { text: relicText(def, registries) })]),
      ]);
      if (marks.relics.includes(relicId)) {
        tile.dataset.new = '1';
        tile.querySelector('h3').append(document.createTextNode(' '), el('span', { class: 'chip reward-new', text: t('reward.card.new') }));
      }
      tile.classList.toggle('reward-selected', relicId === selectedCardId);
      tile.classList.toggle('is-chosen', relicId === selectedCardId);
      attachTooltip(tile, () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def, registries))}`);
      tile.addEventListener('click', () => selectCard(relicId));
      strip.appendChild(tile);
    }
    for (const cardId of isNodeRow || isRelicRow ? [] : ids) {
      // This face only selects; collection belongs to Confirm. Inspection must
      // not consume the touch tap before selection enables that button.
      // THE DOOR OFFERS THE VERB THE PLAYER CAME FOR. Opening a card here used
      // to show a dead `Play card` — combat's verb, inherited from the default
      // that services/cardActions.js replaced — on the one screen whose whole
      // purpose is taking the card being read. Choosing from inside the door
      // lights the same card behind it and presses the same Confirm, so there
      // is one commit and one place the receipt is written.
      const el = renderCard(registries, { cardId, upgraded: row.kind === 'skillDraft' && skillUpgradesCards(registries, skillLevel(run, row.skillId)) }, {
        owned: run.deck.filter((c) => c.cardId === cardId).length,
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
    if (skipButton) {
      attachTooltip(skipButton, () => `<div class="tt-title">${esc(tTip('reward.relic.skip'))}</div>${esc(tFull('reward.relic.skip'))}`);
      skipButton.addEventListener('click', () => {
        if (taken()) return;
        states[row.key] = 'skipped';
        delete pendingByKey[row.key];
        persistProgress();
        renderMenu(row.key);
      });
    }
    if (isEngaged()) setTimeout(() => focusFirst('.reward-row .reward-pick') || focusFirst('#reward-back'), 0);
  }

  sfx.play('victory');
  grantCinders();
  renderMenu();
}
