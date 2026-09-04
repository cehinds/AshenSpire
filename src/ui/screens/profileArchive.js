// src/ui/screens/profileArchive.js — title-screen Profile archive (#67, Sunna's D8/D5).
//
// WHY THIS FILE EXISTS. The crisis dialog told the player "You can come back to
// it any time from the title screen's Profile route and Settings had Display, Audio,
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
// ON THE KIT: the route is a lg door through openModal (Eyebrow "Player data",
// Title·S "Profile", the close IconButton in the corner); the body is a Pane —
// Prose for the state line, a muted DetailCard for a drawer notice, one
// DetailCard per entry (Eyebrow = when, name = what, line = why, meta = size)
// with its ButtonRow and support Fold, and a gold DetailCard for the restore
// question. The hooks the instruments read (`.profile-archive-modal`,
// `.profile-archive-body`, `[data-profile-close]`, `.prof-*`) ride on the
// kit's parts and draw nothing.
//
// PROSE IS DRAFT where Sunna has not written copy for this surface, and marked
// so below; her replacements land verbatim as they did on the notice screen.

import {
  el, pane, prose, detailCard, button, buttonRow, statusText, fold, openModal, flavour, options,
} from '../kit/index.js';

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
  //
  // THE `empty` LINE IS THE ASK, PRINTED BACK AT HIM (M7). It read "one is
  // created when you finish your first run" — which was true of the build and
  // was the exact behaviour Constantine had asked us to change, quoted to him in
  // bold on the screen where he went looking for the profile. The behaviour is
  // fixed in engine/save.js (`ensureProfile`, created at the class-pick commit),
  // so this sentence is rewritten rather than deleted: the state is still
  // reachable — someone who opens Settings before they have ever begun a climb —
  // and it must say what will actually happen to them.
  const stateLine = {
    ok: 'Your profile is fine.',
    empty: 'No profile yet — one is created the moment you begin your first climb.',
    migrated: 'Your profile was saved by an older version and has been brought forward.',
    recovered: 'Your profile was restored from the backup copy after a bad read.',
    corrupt: 'Your profile could not be read. It has been set aside — it is listed below.',
    older: 'Your profile is from an older version we cannot open. It has been set aside — it is listed below.',
    newer: 'Your profile is from a newer version. It has been left exactly as it is; update the game to open it.',
  }[status.state] || 'Your profile is fine.';

  const result = statusText('', { class: 'prof-result', role: 'status' });
  const say = (msg) => { result.textContent = msg; };
  const archiveOf = (id) => saves.listArchives().find((a) => a.id === id) || {};

  const entries = archives.length
    ? archives.map((a) => {
        const when = humanTime(a.at);
        const size = humanSize(a.bytes);
        const again = a.count > 1 && a.lastSeenAt
          ? ` · seen ${a.count} times, most recently ${humanTime(a.lastSeenAt)}`
          : '';
        const exportBtn = button({ label: 'Save a copy to a file', className: 'prof-export', attrs: { dataset: { id: a.id } } });
        const restoreBtn = a.kind === 'meta' ? button({ label: 'Restore this profile', className: 'prof-restore', attrs: { dataset: { id: a.id } } }) : null;
        const card = detailCard({
          eyebrow: [when && `Set aside ${when}`, size].filter(Boolean).join(' · ') + again,
          name: describe(a, saves),
          line: humanReason(a.reason),
          muted: true,
          attrs: { class: 'prof-entry', dataset: { id: a.id } },
        });
        card.appendChild(buttonRow({ size: 'long', buttons: [exportBtn, restoreBtn], className: 'prof-entry-actions' }));
        if (a.reason) card.appendChild(fold({ label: 'Details for support', className: 'support', children: [el('code', { text: a.reason })] }));

        exportBtn.addEventListener('click', () => {
          const text = saves.exportArchive(a.id);
          if (!text) { say('That copy is no longer available.'); return; }
          const blob = new Blob([text], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ashen-spire-${a.id}.json`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          say('Saved. Keep that file somewhere safe.');
        });
        if (restoreBtn) restoreBtn.addEventListener('click', () => {
          // The risk is stated BEFORE the click does anything, in the entry's
          // own confirmation — not after, and not in a tooltip nobody opens.
          if (card.querySelector('.prof-confirm')) return;
          // DRAFT COPY (Sunna's to replace).
          // Sunna's copy, split exactly as she wrote it: the second sentence is
          // FALSE for a readable archive and it lied to her about a perfectly good
          // 2000-run profile, so it appears only when this copy was set aside
          // because it couldn't be read.
          const unreadable = /Couldn’t be read\./.test(humanReason(archiveOf(a.id).reason));
          const cancel = button({ label: 'Not yet', className: 'prof-cancel' });
          const go = button({ label: 'Restore it', weight: 'primary', className: 'prof-go' });
          const box = el('div', { class: 'as-detailcard prof-confirm' }, [
            el('span', { class: 'dc-eyebrow', text: 'Restore this profile?' }),
            prose('The profile you’re using now is set aside here in its place — not deleted.'),
            unreadable ? prose('This copy couldn’t be read when we set it aside, so restoring it may not work. Nothing is lost by trying.') : null,
            buttonRow({ size: 'medium', buttons: [cancel, go], className: 'prof-entry-actions' }),
          ]);
          card.appendChild(box);
          cancel.addEventListener('click', () => box.remove());
          cancel.focus();
          go.addEventListener('click', () => {
            const res = saves.restoreProfile(a.id);
            if (res.ok) {
              // Re-render FIRST, then speak into the node that survives it. Saying
              // it first wrote the message into an element the re-render replaced,
              // so nothing visibly changed, the player pressed again — and with
              // D12 open that ate a second profile (Sunna D13).
              renderProfileSection(container, { saves, onRestored });
              const node = container.querySelector('.prof-result');
              if (node) node.textContent = 'Restored. This is your profile now — the one you were using is set aside below.';
              if (onRestored) onRestored();
              return;
            }
            // A failed restore NEVER consumes the archive, and says so — Sunna's
            // must, and the same sentence the crisis screen uses.
            box.remove();
            say('That didn’t work — those bytes still can’t be read. Nothing was lost by trying: your copy is exactly where it was, and you can still save it to a file.');
          });
        });
        return card;
      })
    // DRAFT COPY: the empty state must not read as a failure — an empty drawer
    // is the good outcome, and this screen is most often opened by someone
    // curious rather than someone hurt.
    : [flavour('Nothing has been set aside. That’s the good news — this fills when something couldn’t be read, and when you start a new profile and we keep the old one for you.', { class: 'prof-empty' })];

  // The player is TOLD when the drawer had to move a profile further aside —
  // that is the whole difference between a bounded drawer and a silent
  // eviction (Saga's gate). Copy: Sunna, 2026-08-07.
  //
  // Structure is load-bearing: the explanation once, the dates once each. And
  // the closing line stays — it is the only thing that stops "not deleted"
  // from sending someone hunting through a list this profile is not in.
  const salvaged = (saves.drawerNotices ? saves.drawerNotices() : [])
    .filter((n) => n.kind === 'profile-salvaged');
  const many = salvaged.length > 1;
  const when = (n) => {
    const was = humanTime(n.was);
    const at = humanTime(n.at);
    const subject = was ? `The profile set aside on ${was}` : 'A profile set aside earlier';
    return at ? `${subject} was moved out on ${at}.` : `${subject} was moved out.`;
  };
  const notice = salvaged.length
    ? el('div', { class: 'as-detailcard prof-notice' }, [
        el('span', { class: 'dc-eyebrow', text: 'Moved out of the drawer' }),
        prose(`This drawer filled up, so ${many ? 'its oldest profiles were' : 'its oldest profile was'} moved out and kept ${many ? 'on their own' : 'on its own'}. Nothing was deleted, and the profile you’re playing now was never touched.`),
        ...salvaged.map((n) => flavour(when(n))),
        flavour(`${many ? 'They’re' : 'It’s'} still on this device, but ${many ? 'they’re' : 'it’s'} no longer in the list below.`),
      ])
    : null;

  container.innerHTML = '';
  container.appendChild(pane({
    eyebrow: 'Your profile',
    title: stateLine,
    subtitle: 'Set-aside profiles are never deleted to make room. Set-aside runs stay in this device’s drawer for up to six months, with the newest 12 kept here.',
    children: [
      notice,
      options(entries, { class: 'prof-entries' }),
      result,
    ],
    attrs: { class: 'prof-archive' },
  }));
  container.querySelector('.prof-archive > .as-title-m')?.classList.add('prof-state');
}

/** Title-screen route to the profile and recovery drawer. */
export function openProfileArchive({ saves, onRestored = null } = {}) {
  if (!saves) return null;
  const door = openModal({
    size: 'lg',
    className: 'profile-archive-modal',
    eyebrow: 'Player data',
    title: 'Profile',
    closeLabel: 'Close profile',
    bodyClassName: 'profile-archive-body',
  });
  door.head.querySelector('.modal-close').setAttribute('data-profile-close', '');
  renderProfileSection(door.body, { saves, onRestored });
  // The focus cursor cannot leave the door (the same trap the notice keeps).
  const focusStops = () => [...door.panel.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getClientRects().length > 0);
  door.veil.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const stops = focusStops();
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !door.panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !door.panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  });
  door.head.querySelector('.modal-close').focus();
  return door.veil;
}
