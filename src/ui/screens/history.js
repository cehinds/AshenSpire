// src/ui/screens/history.js — run history + aggregate win rates (SPEC §3.12, §9 M4)
//
// Reads the last 20 run results recorded by save.recordResult (sote_meta_v1)
// and shown most-recent-first. Also surfaces the win-rate telemetry the M3
// balance notes call for: overall and per-class win %.
//
// ON THE KIT: a Pane on the page — Eyebrow + Title·M + Subtitle (the tally),
// a StatStrip of per-class chips, one Row per run (Glyph = outcome, label =
// class, StatusText = where it ended, trail = outcome StatePill · custom Tag ·
// seed), and a ButtonRow foot.

import {
  el, pane, row, pill, tagChip, statusText, statStrip, chip, button, buttonRow, flavour, hairline,
} from '../kit/index.js';

export function mountHistory(app, { meta, onBack }) {
  const results = (meta.results || []).slice().reverse(); // most recent first
  // Win-rate telemetry counts STANDARD runs only — custom climbs are excluded
  // so their modifiers can't skew the balance numbers (SPEC §10).
  const standard = results.filter((r) => !r.custom);
  const customCount = results.length - standard.length;
  const total = standard.length;
  const wins = standard.filter((r) => r.victory).length;
  const pct = total ? Math.round((wins / total) * 100) : 0;

  // Per-class win/run tallies (the balance telemetry payoff) — standard only.
  const byClass = {};
  for (const r of standard) {
    const k = r.className || r.class || '—';
    const b = (byClass[k] = byClass[k] || { runs: 0, wins: 0 });
    b.runs += 1;
    if (r.victory) b.wins += 1;
  }

  const rows = results.map((r) => {
    const reached = r.victory
      ? `Act ${r.act || 3} cleared`
      : `Act ${r.act || 1} · Floor ${r.floor != null ? r.floor : '—'}`;
    const fights = r.fightsWon != null ? ` · ${r.fightsWon} fight${r.fightsWon === 1 ? '' : 's'}` : '';
    const trail = [
      pill({ label: r.victory ? 'Rune restored' : 'Perished', on: !!r.victory }),
      r.custom ? tagChip({ label: `Custom${r.ascension ? ` A${r.ascension}` : ''}`, attrs: { 'aria-label': 'Custom Climb — excluded from win rate' } }) : null,
      r.seed ? statusText(r.seed, { class: 'hx-seed' }) : null,
    ];
    return row({
      tag: 'div', setting: true,
      glyph: r.victory ? '♛' : '☠',
      label: r.className || r.class || '—',
      status: `${reached}${fights}`,
      trail,
      tone: r.victory ? 'current' : 'loss',
      className: 'hx-row',
    });
  });

  const back = button({ label: 'Back', id: 'hx-back' });
  const customNote = customCount ? ` · ${customCount} custom (not counted)` : '';
  const children = results.length
    ? [
        statStrip(Object.entries(byClass).map(([k, b]) => chip({ key: k, value: `${b.wins}/${b.runs}` })), { class: 'hx-byclass' }),
        hairline(),
        ...rows,
        buttonRow({ size: 'short', buttons: [back] }),
      ]
    : [
        flavour('The spire remembers those who climb it.'),
        buttonRow({ size: 'short', buttons: [back] }),
      ];

  const panel = pane({
    eyebrow: 'Records',
    title: 'Run history',
    subtitle: results.length
      ? `${total} standard run${total === 1 ? '' : 's'} · ${wins} won · ${pct}% win rate${customNote}`
      : 'No runs recorded yet',
    children,
    attrs: { class: 'history' },
  });

  app.innerHTML = '';
  app.appendChild(el('div', { class: 'screen history-screen' }, panel));
  back.addEventListener('click', onBack);
  back.focus({ preventScroll: true });
}
