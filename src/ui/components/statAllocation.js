// The attribute-point spender, one drawing for the victory receipt and the combined victory door.
// Presentation only: the host owns the spend (`onAllocateStat`) and the save (`onChange`).
import { attributePointGains, largestAttributeGain, attributeGainSummary } from '../../model/attributePointPreview.js';
import { levelUpPlan } from '../../model/levelup.js';
import { el, button } from '../kit/index.js';
import { t } from '../strings.js';

/** StatAllocationSection(...) → the section, or null when the run has no unspent points or no way to spend them. */
export function StatAllocationSection(registries, run, { settings = {}, onAllocateStat = null, onChange = null } = {}) {
  if (!onAllocateStat || !(run.level?.unspentPoints > 0)) return null;
  const host = el('section', { class: 'reward-stat-allocation', 'aria-label': t('reward.level.assignStats.aria') });
  const draw = () => {
    const points = run.level?.unspentPoints || 0;
    const attrs = levelUpPlan(registries, run).attributes;
    // The largest thing one more point buys, from the live formulas (model/attributePointPreview.js).
    const gainChip = (attrId) => {
      const gains = attributePointGains(registries, run, attrId, { settings });
      const top = largestAttributeGain(registries, run, attrId, { settings });
      return top ? el('span', { class: 'reward-stat-gain', text: top.text, title: attributeGainSummary(gains) }) : null;
    };
    host.replaceChildren(
      el('h3', { text: t('reward.stat.heading', { count: points, plural: points === 1 ? '' : 's' }) }),
      ...attrs.map((attr) => {
        const id = attr.id;
        const add = button({ label: '+', className: 'reward-stat-add', disabled: points < 1, attrs: { 'aria-label': t('reward.stat.increase', { attribute: attr.label }) } });
        add.addEventListener('click', () => {
          if (!run.level?.unspentPoints) return;
          onAllocateStat(id);
          onChange?.();
          draw();
        });
        return el('div', { class: 'reward-stat-row' }, [
          el('span', { class: 'reward-stat-name' }, [attr.label, gainChip(attr.id)]),
          el('span', { text: String(run.attributes?.[id] ?? 0) }),
          add,
        ]);
      }),
    );
  };
  draw();
  return host;
}
