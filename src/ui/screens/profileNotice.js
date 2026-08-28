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

import { esc } from '../components/tooltip.js';

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

  app.innerHTML = `
    <div class="screen profile-notice">
      <h1>${isNewer ? 'This profile is from a newer version' : 'We couldn’t read your profile'}</h1>
      <p class="lead">${
        isNewer
          ? 'It was saved by a newer build of Ashen Spire. We’ve left it exactly as it is rather than risk changing it — nothing has been altered or deleted.<br><strong>Update Ashen Spire to open it again.</strong>'
          : 'So we’ve set it aside instead of deleting it — it’s still here.'
      }</p>
      ${kept ? `<p class="kept">Saved: ${esc(String(kept.runs ?? '—'))} runs · ${esc(String(kept.wins ?? '—'))} wins · ${esc(String(kept.unlocked))} unlocks</p>` : ''}
      <p class="where">${esc(whereLine)}</p>
      <div class="actions">
        ${isNewer
          ? '<button class="keep">Keep it and close</button>'
          : '<button class="restore">Try to restore</button>'}
        <button class="export">Save a copy to a file</button>
        ${isNewer ? '' : '<button class="notnow">Not now</button>'}
      </div>
      <div class="actions destructive">
        <button class="fresh subtle">${isNewer ? 'Start a new profile anyway' : 'Start a new profile'}</button>
      </div>
      <p class="result" role="status"></p>
      ${status.reason
        ? `<details class="support"><summary>Details for support</summary><code>${esc(status.reason)}</code></details>`
        : ''}
    </div>
  `;

  const $ = (s) => app.querySelector(s);
  const say = (msg) => { $('.result').textContent = msg; };

  // "Not now" / "Keep it and close" — the non-destructive exit that did not
  // exist (Sunna D1/D4). Nothing is written and the quarantine stays on, so a
  // player who wants to close the game and think about it loses nothing by
  // doing so.
  const leave = $('.notnow') || $('.keep');
  if (leave) leave.addEventListener('click', () => onContinue());

  const restore = $('.restore');
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
  $('.export').addEventListener('click', () => {
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
  // by pressing the obvious button quickly.
  $('.fresh').addEventListener('click', () => {
    const wrap = document.createElement('div');
    wrap.className = 'confirm-fresh';
    wrap.innerHTML = `
      <div class="confirm-box" role="dialog" aria-modal="true" aria-label="Start a new profile?">
        <h2>Start a new profile?</h2>
        <p>Your old one is set aside — this doesn’t delete it. You can come back to it any time from Settings → Profile.</p>
        <div class="actions">
          <button class="cancel">Not yet</button>
          <button class="go subtle">Start fresh</button>
        </div>
      </div>`;
    app.appendChild(wrap);
    const cancel = wrap.querySelector('.cancel');

    // A REAL focus trap (Sunna D9). The scrim stopped the mouse and nothing
    // else: five focusables sat reachable behind the open dialog, Escape did
    // nothing, and clicking the scrim did nothing. Nothing irreversible was
    // reachable back there, so it was confusing rather than dangerous — but a
    // dialog you can Tab out of is not a dialog.
    const behind = [...app.querySelectorAll('.profile-notice button, .profile-notice a[href], .profile-notice [tabindex]')];
    behind.forEach((el) => {
      el.setAttribute('tabindex', '-1');
      el.setAttribute('aria-hidden', 'true');
    });
    const close = () => {
      behind.forEach((el) => {
        el.removeAttribute('tabindex');
        el.removeAttribute('aria-hidden');
      });
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      $('.fresh').focus(); // the cursor comes back to where it left
    };
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const stops = [...wrap.querySelectorAll('button')];
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !wrap.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !wrap.contains(active))) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    // Clicking the scrim — outside the box — dismisses, matching every other
    // veil in the game.
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    cancel.addEventListener('click', close);
    wrap.querySelector('.go').addEventListener('click', () => {
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
  (restore || leave || $('.export')).focus();
}
