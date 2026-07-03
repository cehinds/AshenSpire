// src/ui/screens/history.js — run history + aggregate win rates (SPEC §3.12, §9 M4)
//
// Reads the last 20 run results recorded by save.recordResult (sote_meta_v1)
// and shown most-recent-first. Also surfaces the win-rate telemetry the M3
// balance notes call for: overall and per-class win %.

import { esc } from '../components/tooltip.js';

export function mountHistory(app, { meta, onBack }) {
  const results = (meta.results || []).slice().reverse(); // most recent first
  const total = results.length;
  const wins = results.filter((r) => r.victory).length;
  const pct = total ? Math.round((wins / total) * 100) : 0;

  // Per-class win/run tallies (the balance telemetry payoff).
  const byClass = {};
  for (const r of results) {
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
        : '<span class="hx-loss">YOU DIED</span>';
      const reached = r.victory
        ? `Act ${r.act || 3} cleared`
        : `Act ${r.act || 1} · Floor ${r.floor != null ? r.floor : '—'}`;
      return `<tr>
        <td>${outcome}</td>
        <td>${esc(r.className || r.class || '—')}</td>
        <td>${reached}</td>
        <td class="hx-num">${r.fightsWon != null ? r.fightsWon : '—'}</td>
        <td class="hx-seed">${esc(r.seed || '')}</td>
      </tr>`;
    })
    .join('');

  const body = total
    ? `<p class="subtitle">${total} RUN${total === 1 ? '' : 'S'} · ${wins} WON · ${pct}% WIN RATE</p>
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
