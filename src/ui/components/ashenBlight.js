import { ashenBlightFeatChoices, ashenBlightFeat } from '../../content/ashenBlight.js';
import { openModal, button, el } from '../kit/index.js';
import { esc } from './tooltip.js';

export function ashenBlightBarHtml(owner, { compact = false, cooperative = false } = {}) {
  if (owner?.combatExpansionVersion !== 2) return '';
  const state = owner.ashenBlight;
  const value = state?.value || 0;
  const terminal = state?.thresholdOutcome === 'lost' || state?.entries?.some(row => row.outcome === 'lost');
  const stage = value >= 100 ? terminal ? 'Lost to the Blight' : 'Blighted'
    : value >= 75 ? 'Infernal' : value >= 50 ? 'Kindled' : value >= 25 ? 'Singed' : 'Unmarked';
  const selected = (state?.milestones || []).filter(row => row.path !== null);
  const detail = selected.map(row => {
    const feat = ashenBlightFeat(row.threshold, row.path);
    return feat ? `${feat.stage}: ${feat.name}. ${[...feat.buffs, ...feat.drawbacks].join(' ')}` : '';
  }).filter(Boolean).join('\n');
  const help = cooperative
    ? 'Corrupted plays permanently add Ashen Blight. At 100: 90% chance of permanent character elimination. Survivors face 5% elimination risk at each later combat. The party continues while another character lives.'
    : 'Corrupted plays permanently add Ashen Blight. At 100: 90% chance of losing the run. Survivors face 5% death risk at each later combat.';
  return `<section class="ashen-blight${compact ? ' ashen-blight-compact' : ''}" aria-label="Ashen Blight" title="${esc([help, detail].filter(Boolean).join('\n'))}">
    <div class="ashen-blight-heading"><span>Ashen Blight · ${esc(stage)}</span><strong>${value}/100</strong></div>
    <div class="ashen-blight-track" role="meter" aria-label="Run corruption" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-valuetext="${value} of 100, ${esc(stage)}" style="--blight-value:${value}%">
      <span class="ashen-blight-fill"></span>${[25, 50, 75].map(threshold => `<span class="ashen-blight-pip${value >= threshold ? ' reached' : ''}" style="left:${threshold}%" aria-hidden="true"></span>`).join('')}
    </div>${compact ? '' : `<p class="ashen-blight-help">${esc(help)}</p>`}
  </section>`;
}

export function ashenBlightCardLabel(definition) {
  if (!definition?.corrupted) return '';
  const price = definition.ashenBlightCost || 0;
  return `<span class="corrupted-card-label">Corrupted <span class="corrupted-card-price">+${price} Blight</span></span>`;
}

export function ashenBlightFeatHtml(feat) {
  return `<div class="ashen-blight-feat"><h3>${esc(feat.name)}</h3><ul>${feat.buffs.map(text => `<li class="ashen-blight-benefit">${esc(text)}</li>`).join('')}<li class="ashen-blight-drawback">${esc(feat.drawbacks[0])}</li></ul></div>`;
}

/** A dismissed dialog leaves the pending choice intact; the host blocks normal plays. */
export function openAshenBlightMilestone({ threshold, onChoose, onClosed, opener = document.activeElement }) {
  const choices = ashenBlightFeatChoices(threshold);
  if (!choices.length) throw new Error('Unknown Ashen Blight milestone');
  let busy = false;
  const later = button({ label: 'Choose later', role: 'exit', attrs: { 'data-focusable': 'true' } });
  const shell = openModal({
    size: 'md', className: 'ashen-blight-choice', opener,
    eyebrow: `${choices[0].stage} · ${threshold} Ashen Blight`, title: 'Choose a lasting Blight feat',
    closeLabel: 'Choose Blight feat later', bodyClassName: 'as-pane', primary: later,
    body: host => {
      const status = el('p', { class: 'as-prose', role: 'status', 'aria-live': 'polite' });
      host.appendChild(el('p', { class: 'as-prose', text: 'Choose two benefits and one drawback. This choice lasts for the run. Normal cards wait until you choose.' }));
      for (const feat of choices) {
        const row = el('div', { class: 'ashen-blight-choice-row' }); row.innerHTML = ashenBlightFeatHtml(feat);
        const pick = button({ label: `Choose ${feat.name}`, weight: 'primary', attrs: { 'data-focusable': 'true', 'data-blight-path': feat.path } });
        pick.addEventListener('click', async () => {
          if (busy) return; busy = true; pick.disabled = true;
          try {
            const result = await onChoose({ threshold, path: feat.path });
            if (result === false || result?.ok === false) { status.textContent = result?.error || 'The choice could not be saved. Please try again.'; return; }
            shell.close();
          } catch (error) { status.textContent = error?.message || 'The choice could not be saved. Please try again.'; }
          finally { busy = false; pick.disabled = false; }
        });
        row.appendChild(pick); host.appendChild(row);
      }
      host.appendChild(status);
    }, onClose: () => onClosed?.(),
  });
  later.addEventListener('click', () => { if (!busy) shell.close(); });
  return shell;
}
