// src/ui/screens/profileNotice.js — the handle on the drawer (#67, property 5).
//
// This is the screen a person sees on the worst morning they will ever have
// with this game: the one where their profile would not read. Saga's floor
// (commons/save-and-loss.md P1/P3/P4) is the contract this file implements:
//
//   - don't blame the player
//   - say what was kept, and where
//   - offer the export BEFORE offering to start fresh
//   - don't vanish: this is not a toast, it does not fade, and it cannot be
//     dismissed by accident
//
// PROSE IS DRAFT. Sunna owns every word a player reads and her edit beats mine
// everywhere; the STRUCTURE (three actions in that order, nothing auto-
// dismissing) is the part that is load-bearing.
//
// All numbers and reasons come from saves.profileStatus() / saves.listArchives()
// — this screen states what the engine found, it never re-derives it.

import { esc } from '../components/tooltip.js';

/**
 * mountProfileNotice(app, { saves, status, onContinue }) → void
 * Rendered only when saves.profileStatus().ok === false.
 */
export function mountProfileNotice(app, { saves, status, onContinue }) {
  const archives = saves.listArchives().filter((a) => a.kind === 'meta');
  const mine = status.archiveId ? archives.find((a) => a.id === status.archiveId) : archives[archives.length - 1];

  // What survived, in the player's terms rather than ours. Read from the
  // archived bytes if they can be read at all — a partial read is still worth
  // showing, because "something survived" is the difference between grief and
  // panic (Saga P4b).
  let kept = null;
  if (mine) {
    const entry = saves.getArchive(mine.id);
    try {
      const parsed = JSON.parse(entry.save);
      const p = parsed && parsed.progress;
      if (p) kept = { runs: p.runs, wins: p.wins, unlocked: (parsed.unlocked || []).length };
    } catch (e) {
      kept = null; // unreadable is the normal case here; say nothing rather than guess
    }
  }

  const when = mine && mine.at ? new Date(mine.at).toLocaleString() : null;
  const isNewer = status.state === 'newer';

  app.innerHTML = `
    <div class="screen profile-notice">
      <h1>${isNewer ? 'This profile is from a newer version' : "We couldn't read your profile"}</h1>
      <p class="lead">${
        isNewer
          ? 'It was saved by a newer build of Ashen Spire, so this version has left it completely untouched rather than risk overwriting it. Nothing has been changed or deleted.'
          : "So we've set it aside instead of deleting it — it's still here."
      }</p>
      ${kept ? `<p class="kept">Saved: ${esc(String(kept.runs ?? '—'))} runs · ${esc(String(kept.wins ?? '—'))} wins · ${esc(String(kept.unlocked))} unlocks</p>` : ''}
      ${when ? `<p class="when">Set aside ${esc(when)}</p>` : ''}
      <p class="why">${esc(status.reason || '')}</p>
      <div class="actions">
        ${isNewer ? '' : '<button class="restore">Try to restore</button>'}
        ${mine ? '<button class="export">Save a copy to a file</button>' : ''}
        <button class="fresh ${isNewer ? 'subtle' : ''}">${isNewer ? 'Start a new profile anyway' : 'Start a new profile'}</button>
      </div>
      <p class="result" role="status"></p>
    </div>
  `;

  const $ = (s) => app.querySelector(s);
  const say = (msg) => { $('.result').textContent = msg; };

  const restore = $('.restore');
  if (restore) {
    restore.addEventListener('click', () => {
      const res = saves.restoreProfile(mine && mine.id);
      // Restore may legitimately fail — the bytes were set aside because they
      // were bad. Say so plainly instead of pretending (Saga P1).
      if (res.ok) onContinue();
      else say(`That didn't work: ${res.reason}. Your copy is still here, and you can still save it to a file.`);
    });
  }

  const exportBtn = $('.export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const text = saves.exportArchive(mine.id);
      if (!text) { say('That copy is no longer available.'); return; }
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ashen-spire-profile-${mine.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('Saved. Keep that file somewhere safe — it is the only copy of those bytes.');
    });
  }

  // Deliberately last, and deliberately not the default focus: starting fresh
  // is the irreversible one, so it is never the easiest button to hit.
  $('.fresh').addEventListener('click', () => {
    saves.startNewProfile();
    onContinue();
  });

  if (restore) restore.focus();
  else if (exportBtn) exportBtn.focus();
}
