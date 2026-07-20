// src/ui/screens/history.js — run history + aggregate win rates (SPEC §3.12, §9 M4)
//
// Reads the last 20 run results recorded by save.recordResult (sote_meta_v1)
// and shown most-recent-first. Also surfaces the win-rate telemetry the M3
// balance notes call for: overall and per-class win %.

import { esc } from '../components/tooltip.js';

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
  const classLine = Object.entries(byClass)
    .map(([k, b]) => `${esc(k)} ${b.wins}/${b.runs}`)
    .join('  ·  ');

  const rows = results
    .map((r) => {
      const outcome = r.victory
        ? '<span class="hx-win">RUNE RESTORED</span>'
        : '<span class="hx-loss">YOU PERISHED</span>';
      const reached = r.victory
        ? `Act ${r.act || 3} cleared`
        : `Act ${r.act || 1} · Floor ${r.floor != null ? r.floor : '—'}`;
      const tag = r.custom
        ? `<span class="hx-custom" title="Custom Climb — excluded from win rate">CUSTOM${r.ascension ? ` A${r.ascension}` : ''}</span>`
        : '';
      return `<tr>
        <td>${outcome}</td>
        <td>${esc(r.className || r.class || '—')}${tag}</td>
        <td>${reached}</td>
        <td class="hx-num">${r.fightsWon != null ? r.fightsWon : '—'}</td>
        <td class="hx-seed">${esc(r.seed || '')}</td>
      </tr>`;
    })
    .join('');

  const customNote = customCount ? ` · ${customCount} CUSTOM (not counted)` : '';
  const body = results.length
    ? `<p class="subtitle">${total} STANDARD RUN${total === 1 ? '' : 'S'} · ${wins} WON · ${pct}% WIN RATE${customNote}</p>
       <p class="hx-byclass">${classLine}</p>
       <div class="hx-wrap">
         <table class="hx-table">
           <thead><tr><th>Outcome</th><th>Class</th><th>Reached</th><th>Fights</th><th>Seed</th></tr></thead>
           <tbody>${rows}</tbody>
         </table>
       </div>`
    : `<p class="subtitle" style="margin-top:24px">NO RUNS RECORDED YET</p>
       <p style="color:var(--muted);font-size:12px">The spire remembers those who climb it.</p>`;

  app.innerHTML = `
    <div class="screen" style="justify-content:flex-start;gap:14px;padding-top:44px">
      <h1 class="title-big" style="font-size:32px">RUN HISTORY</h1>
      ${body}
      <button id="hx-back">BACK</button>
    </div>`;

  app.querySelector('#hx-back').addEventListener('click', onBack);
}
