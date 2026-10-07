// src/ui/screens/profileNotice.js — the handle on the drawer (#67, property 5).
//
// This is the screen a person sees on the worst morning they will ever have
// with this game: the one where their profile would not read. Saga's floor
// (commons/save-and-loss.md P1/P3/P4) is the contract.
//
// THE WORDS ARE SUNNA'S, pasted from her gate
// (gamedesign/sunna/log/2026/2026-08-07_the-worst-morning-rendered.md). She
// drove this screen at 390 px and found three blocking defects; where her copy
// and my earlier draft disagreed, hers is what shipped. I own the structure and
// which action is wired to what, and every fact on screen still comes from
// saves.profileStatus() / listArchives() rather than being re-derived here.
//
// The three states this renders, and why they differ:
//   corrupt/older — the bytes could not be read. Restore, export, not now.
//   newer         — the bytes are FINE, just from the future. The correct
//                   primary action is TO DO NOTHING, so that is the first
//                   button and it is not destructive (Sunna D1).
//   (empty/ok/migrated/recovered never reach this screen at all.)
//
// ON THE KIT: a decision door standing on the page (body C) — Title·L and
// the ornament ask, Prose says what happened, a DetailCard says what survived
// and where it is, the ButtonRow carries the ways on, a second row the one
// destructive way, a Fold the support detail. The irreversible act opens the
// kit's sm door through openModal. The hooks the instruments read
// (`.profile-notice`, `.restore`/`.export`/`.notnow`/`.keep`/`.fresh`,
// `.result`, `.confirm-fresh`, `.cancel`/`.go`) ride on kit parts.

import {
  el, pageDoor, decide, prose, detailCard, statusText, button, buttonRow, fold, openModal,
} from '../kit/index.js';

// Human time, not a log line: "7 August, 5:09 AM" (Sunna). Second-precision and
// locale-ambiguous slashes read as machine output at the worst moment.
function humanTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

function humanSize(bytes) {
  if (!bytes) return null;
  return bytes < 1024 ? `${bytes} bytes` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * mountProfileNotice(app, { saves, status, onContinue }) → void
 * Rendered only when saves.profileStatus().ok === false.
 */
export function mountProfileNotice(app, { saves, status, onContinue }) {
  const isNewer = status.state === 'newer';

  // ONLY this profile's own archive — never "the most recent archive in the
  // drawer". That fallback offered an unrelated old run under the words "save a
  // copy of your profile" (Vira D2). In the newer state there is deliberately
  // no archive, and that is correct: the bytes are untouched where they are.
  const mine = status.archiveId ? saves.getArchive(status.archiveId) : null;
  const listed = status.archiveId
    ? saves.listArchives().find((a) => a.id === status.archiveId)
    : null;

  // What survived, in the player's terms. Read from the archived bytes when
  // they can be read at all — a partial read is still worth showing, because
  // "something survived" is the difference between grief and panic (Saga P4b).
  let kept = null;
  if (mine) {
    try {
      const parsed = JSON.parse(mine.save);
      const p = parsed && parsed.progress;
      if (p) kept = { runs: p.runs, wins: p.wins, unlocked: (parsed.unlocked || []).length };
    } catch (e) {
      kept = null; // unreadable is the NORMAL case here; say nothing rather than guess
    }
  }

  const when = humanTime(listed && listed.at);
  const size = humanSize(listed ? listed.bytes : null);
  // The screen must say WHERE (Sunna D6): the fact of preservation is the
  // comfort, and it is thin if we can't point at anything.
  const whereLine = isNewer
    ? 'Stored with this game’s data on this device.'
    : [when && `Set aside ${when}`, size, 'stored with this game’s data on this device.']
        .filter(Boolean)
        .join(' · ');

  const leave = isNewer
    ? button({ label: 'Keep it and close', weight: 'primary', className: 'keep' })
    : button({ label: 'Not now', className: 'notnow' });
  const restore = isNewer ? null : button({ label: 'Try to restore', weight: 'primary', className: 'restore' });
  const exportBtn = button({ label: 'Save a copy to a file', className: 'export' });
  const fresh = button({ label: isNewer ? 'Start a new profile anyway' : 'Start a new profile', weight: 'danger', className: 'fresh' });
  const result = statusText('', { class: 'result', role: 'status' });

  const lead = isNewer
    ? [
        prose('It was saved by a newer build of Ashen Spire. We’ve left it exactly as it is rather than risk changing it — nothing has been altered or deleted.', { class: 'lead' }),
        el('p', { class: 'as-prose lead' }, el('strong', { text: 'Update Ashen Spire to open it again.' })),
      ]
    : [prose('So we’ve set it aside instead of deleting it — it’s still here.', { class: 'lead' })];

  const body = decide({
    title: isNewer ? 'This profile is from a newer version' : 'We couldn’t read your profile',
    children: [
      ...lead,
      detailCard({
        eyebrow: 'Your profile',
        name: kept ? `${kept.runs ?? '—'} runs · ${kept.wins ?? '—'} wins · ${kept.unlocked} unlocks` : (isNewer ? 'Untouched' : 'Set aside'),
        line: kept ? 'Saved' : '',
        meta: whereLine,
        muted: !kept,
        attrs: { class: kept ? 'kept' : 'where' },
      }),
      // The way forward stands alone on its own rung; the two quiet ways
      // share the next; the one destructive way is last and never widest.
      buttonRow({ size: 'long', buttons: [restore || leave], className: 'actions' }),
      buttonRow({ size: 'fill', buttons: [exportBtn, isNewer ? null : leave].filter(Boolean), className: 'actions' }),
      buttonRow({ size: 'long', buttons: [fresh], className: 'actions destructive' }),
      result,
      status.reason
        ? fold({ label: 'Details for support', className: 'support', children: [el('code', { text: status.reason })] })
        : null,
    ],
  });

  const door = pageDoor({
    eyebrow: 'Profile',
    title: isNewer ? 'A newer version' : 'Couldn’t be read',
    size: 'md',
    body,
    attrs: { 'aria-label': isNewer ? 'This profile is from a newer version' : 'We couldn’t read your profile' },
  });
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'screen profile-notice' }, door));

  const $ = (s) => app.querySelector(s);
  const say = (msg) => { result.textContent = msg; };

  // "Not now" / "Keep it and close" — the non-destructive exit that did not
  // exist (Sunna D1/D4). Nothing is written and the quarantine stays on, so a
  // player who wants to close the game and think about it loses nothing by
  // doing so.
  leave.addEventListener('click', () => onContinue());

  if (restore) {
    restore.addEventListener('click', () => {
      const res = saves.restoreProfile(status.archiveId);
      if (res.ok) { onContinue(); return; }
      // Sunna's line, verbatim — the raw parser error goes to the support
      // disclosure, never into the sentence (her D2).
      say('That didn’t work — those bytes still can’t be read. Nothing was lost by trying: your copy is exactly where it was, and you can still save it to a file.');
    });
  }

  // Export works in EVERY state: from the archive when there is one, from the
  // live profile when there isn't (the newer case — where it matters most).
  exportBtn.addEventListener('click', () => {
    const text = mine ? saves.exportArchive(mine.id) : saves.exportProfile();
    if (!text) { say('There’s nothing to save to a file yet.'); return; }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ashen-spire-profile-${(mine && mine.id) || status.state}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('Saved. Keep that file somewhere safe.');
  });

  // The one irreversible action, behind a second act (Sunna D3). It is offered
  // to the reader least equipped to evaluate it, so it must be impossible to do
  // by pressing the obvious button quickly. THE DOOR IS THE KIT'S: a sm door
  // through openModal, the way out in the corner, Escape and the scrim through
  // bindModalDismiss, the way forward primary-danger on the ladder.
  fresh.addEventListener('click', () => {
    const cancel = button({ label: 'Not yet', className: 'cancel' });
    const go = button({ label: 'Start fresh', weight: 'primary', className: 'danger go' });
    // A REAL focus trap (Sunna D9). The scrim stopped the mouse and nothing
    // else: five focusables sat reachable behind the open dialog, Escape did
    // nothing, and clicking the scrim did nothing. Nothing irreversible was
    // reachable back there, so it was confusing rather than dangerous — but a
    // dialog you can Tab out of is not a dialog.
    const behind = [...app.querySelectorAll('.profile-notice button, .profile-notice a[href], .profile-notice [tabindex]')];
    behind.forEach((node) => {
      node.setAttribute('tabindex', '-1');
      node.setAttribute('aria-hidden', 'true');
    });
    let door2 = null;
    function onKey(e) {
      if (e.key !== 'Tab' || !door2) return;
      const stops = [...door2.panel.querySelectorAll('button:not([disabled])')];
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !door2.panel.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !door2.panel.contains(active))) { e.preventDefault(); first.focus(); }
    }
    door2 = openModal({
      size: 'sm',
      className: 'confirm-box',
      eyebrow: 'Profile',
      title: 'Start a new profile?',
      closeLabel: 'Close',
      body: decide({ children: [prose('Your old one is set aside — this doesn’t delete it. You can come back to it any time from Profile on the title screen.')] }),
      secondary: [cancel],
      primary: go,
      footSize: 'medium',
      opener: fresh,
      onClose: () => {
        behind.forEach((node) => {
          node.removeAttribute('tabindex');
          node.removeAttribute('aria-hidden');
        });
        document.removeEventListener('keydown', onKey, true);
        $('.fresh')?.focus(); // the cursor comes back to where it left
      },
    });
    door2.veil.classList.add('confirm-fresh');
    document.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', door2.close);
    go.addEventListener('click', () => {
      document.removeEventListener('keydown', onKey, true);
      saves.startNewProfile(); // archives the old bytes first (save.js) — Vira D1
      onContinue();
    });
    cancel.focus(); // the safe option holds the cursor
  });

  // Something is ALWAYS focused: in the newer state neither restore nor export
  // used to exist, so keyboard and gamepad players had no entry point (Sunna
  // D1). Order follows what she credited as holding — restore takes the cursor
  // where it exists (the action that tries to give the profile back), and in
  // the newer state that is "Keep it and close", which is the correct primary
  // action there. The destructive button never takes focus in any state.
  (restore || leave || exportBtn).focus();
}
