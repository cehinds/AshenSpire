// src/ui/screens/profileArchive.js — Settings → Profile (#67, Sunna's D8/D5).
//
// WHY THIS FILE EXISTS. The crisis dialog told the player "You can come back to
// it any time from Settings → Profile" and Settings had Display, Audio,
// Accessibility, Advanced — no Profile. The word "archive" appeared on no
// screen in the game, and profileNotice.js was the only file that had ever
// called listArchives/getArchive/exportArchive/restoreProfile. Constantine's
// answer to that was one word — "build" — so the surface exists and the
// sentence becomes true rather than being cut.
//
// It also closes Sunna's D5: the handle used to live only inside a dialog that
// fires once per session, so past that screen by any route a player could never
// reach their archived profile again. The drawer's handle was fitted to a door
// that locks behind you. This is the calm-moment route — the person who needs
// it on Tuesday is the whole point.
//
// HER MUSTS BIND HERE, and they shaped the decisions:
//   · The comfort is the FACT of preservation, not its contents — so every
//     entry shows what it is, when it was set aside and how big, even when the
//     bytes themselves cannot be read (which is the normal case).
//   · Nothing irreversible is forced, and "start a new profile" is NOT on this
//     screen at all: on a calm day there is no reason to offer it, and its only
//     honest home is the crisis dialog behind its confirm.
//   · A failed restore never consumes the archive, and says so.
//
// PROSE IS DRAFT where Sunna has not written copy for this surface, and marked
// so below; her replacements land verbatim as they did on the notice screen.

import { esc } from '../components/tooltip.js';

// Human time, not a log line — same rule as the notice screen (Sunna).
function humanTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function humanSize(bytes) {
  if (!bytes) return null;
  return bytes < 1024 ? `${bytes} bytes` : `${Math.round(bytes / 1024)} KB`;
}

// What an entry IS, in the player's words rather than ours. Two entries both
// titled "Profile" with nothing telling them apart is the card Sunna raised:
// the crisis screen already reads progress out of the bytes, and this screen
// can do the same when they are readable.
function describe(entry, saves) {
  if (entry.kind !== 'meta') return entry.slot ? `Run · slot ${entry.slot}` : 'Run';
  const full = saves.getArchive(entry.id);
  try {
    const p = JSON.parse(full.save).progress;
    if (p && (p.runs != null || p.wins != null)) {
      return `Profile · ${p.runs ?? 0} runs${p.wins != null ? `, ${p.wins} wins` : ''}`;
    }
  } catch (e) { /* unreadable is the normal case; fall through to the plain noun */ }
  return 'Profile';
}

// Sunna's reason mapping — the body says what happened in words, and the raw
// engine text lives behind "Details for support" (her D2, reopened on this
// surface after it was closed on the notice screen).
function humanReason(raw) {
  const r = String(raw || '');
  if (/could not be read|corrupt|JSON|Unexpected|Unterminated|position \d+/i.test(r)) return 'Couldn’t be read.';
  if (/older than this build|older version/i.test(r)) return 'From an older version.';
  if (/started a new profile|kept when you started/i.test(r)) return 'Kept when you started a new profile.';
  if (/dangling id/i.test(r)) return 'From an older version of the game’s content.';
  if (/restored/i.test(r)) return 'Set aside when you restored another profile.';
  return r ? 'Set aside.' : '';
}

/**
 * renderProfileSection(container, { saves, onRestored })
 * Fills `container` with the Profile section. Every fact comes from
 * saves.profileStatus() / listArchives() — nothing is re-derived here.
 */
export function renderProfileSection(container, { saves, onRestored }) {
  const status = saves.profileStatus();
  const archives = saves.listArchives().slice().reverse(); // newest first

  // DRAFT COPY (Sunna's to replace) — the state line. It exists so the screen
  // answers "is my profile alright?" before it answers "what is in the drawer".
  const stateLine = {
    ok: 'Your profile is fine.',
    empty: 'No profile yet — one is created when you finish your first run.',
    migrated: 'Your profile was saved by an older version and has been brought forward.',
    recovered: 'Your profile was restored from the backup copy after a bad read.',
    corrupt: 'Your profile could not be read. It has been set aside — it is listed below.',
    older: 'Your profile is from an older version we cannot open. It has been set aside — it is listed below.',
    newer: 'Your profile is from a newer version. It has been left exactly as it is; update the game to open it.',
  }[status.state] || 'Your profile is fine.';

  const rows = archives.length
    ? archives.map((a) => {
        const when = humanTime(a.at);
        const size = humanSize(a.bytes);
        const again = a.count > 1 && a.lastSeenAt
          ? ` · seen ${a.count} times, most recently ${humanTime(a.lastSeenAt)}`
          : '';
        return `
          <div class="prof-entry" data-id="${esc(a.id)}">
            <div class="prof-entry-what">
              <b>${esc(describe(a, saves))}</b>
              <p class="set-note">${esc([when && `Set aside ${when}`, size].filter(Boolean).join(' · '))}${esc(again)}</p>
              <p class="set-note prof-why">${esc(humanReason(a.reason))}</p>
              ${a.reason ? `<details class="support"><summary>Details for support</summary><code>${esc(a.reason)}</code></details>` : ''}
            </div>
            <div class="prof-entry-actions">
              <button class="prof-export" data-id="${esc(a.id)}">Save a copy to a file</button>
              ${a.kind === 'meta' ? `<button class="prof-restore subtle" data-id="${esc(a.id)}">Restore this profile</button>` : ''}
            </div>
          </div>`;
      }).join('')
    // DRAFT COPY: the empty state must not read as a failure — an empty drawer
    // is the good outcome, and this screen is most often opened by someone
    // curious rather than someone hurt.
    : '<p class="set-note prof-empty">Nothing has been set aside. That’s the good news — this fills when something couldn’t be read, and when you start a new profile and we keep the old one for you.</p>';

  // If the drawer ever had to move a profile further aside to stay inside the
  // browser's storage, the player is TOLD — that is the whole difference
  // between a bounded drawer and a silent eviction (Saga's gate).
  // DRAFT COPY (Sunna's to replace).
  const notices = (saves.drawerNotices ? saves.drawerNotices() : [])
    .filter((n) => n.kind === 'profile-salvaged')
    .map((n) => `<p class="prof-notice">A set-aside profile from ${esc(humanTime(n.was) || 'earlier')} was moved further aside on ${esc(humanTime(n.at) || '')} to stay within this device’s storage. It was not deleted.</p>`)
    .join('');

  container.innerHTML = `
    <div class="prof-archive">
      <p class="prof-state">${esc(stateLine)}</p>
      ${notices}
      <p class="set-note">Set-aside profiles and runs are kept with this game’s data on this device. They are never deleted to make room for anything else.</p>
      ${rows}
      <p class="prof-result" role="status"></p>
    </div>`;

  const archiveOf = (id) => saves.listArchives().find((a) => a.id === id) || {};
  const say = (msg) => { const el = container.querySelector('.prof-result'); if (el) el.textContent = msg; };

  container.querySelectorAll('.prof-export').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = saves.exportArchive(btn.dataset.id);
      if (!text) { say('That copy is no longer available.'); return; }
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ashen-spire-${btn.dataset.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('Saved. Keep that file somewhere safe.');
    });
  });

  container.querySelectorAll('.prof-restore').forEach((btn) => {
    btn.addEventListener('click', () => {
      // The risk is stated BEFORE the click does anything, in the button's own
      // confirmation — not after, and not in a tooltip nobody opens.
      const entry = btn.closest('.prof-entry');
      if (entry.querySelector('.prof-confirm')) return;
      const box = document.createElement('div');
      box.className = 'prof-confirm';
      // DRAFT COPY (Sunna's to replace).
      // Sunna's copy, split exactly as she wrote it: the second sentence is
      // FALSE for a readable archive and it lied to her about a perfectly good
      // 2000-run profile, so it appears only when this copy was set aside
      // because it couldn't be read.
      const unreadable = /Couldn’t be read\./.test(humanReason(archiveOf(btn.dataset.id).reason));
      box.innerHTML = `
        <p>Restore this profile? The profile you’re using now is set aside here in its place — not deleted.</p>
        ${unreadable ? '<p>This copy couldn’t be read when we set it aside, so restoring it may not work. Nothing is lost by trying.</p>' : ''}
        <div class="prof-entry-actions">
          <button class="prof-cancel">Not yet</button>
          <button class="prof-go subtle">Restore it</button>
        </div>`;
      entry.appendChild(box);
      box.querySelector('.prof-cancel').addEventListener('click', () => box.remove());
      box.querySelector('.prof-cancel').focus();
      box.querySelector('.prof-go').addEventListener('click', () => {
        const res = saves.restoreProfile(btn.dataset.id);
        if (res.ok) {
          // Re-render FIRST, then speak into the node that survives it. Saying
          // it first wrote the message into an element the re-render replaced,
          // so nothing visibly changed, the player pressed again — and with
          // D12 open that ate a second profile (Sunna D13).
          renderProfileSection(container, { saves, onRestored });
          const el = container.querySelector('.prof-result');
          if (el) el.textContent = 'Restored. This is your profile now — the one you were using is set aside below.';
          if (onRestored) onRestored();
          return;
        }
        // A failed restore NEVER consumes the archive, and says so — Sunna's
        // must, and the same sentence the crisis screen uses.
        box.remove();
        say(`That didn’t work — those bytes still can’t be read. Nothing was lost by trying: your copy is exactly where it was, and you can still save it to a file.`);
      });
    });
  });
}
