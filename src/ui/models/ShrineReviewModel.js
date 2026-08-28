export function restReviewModel({ hp, maxHp, mana, maxMana, heal }) {
  const nextHp = Math.min(maxHp, hp + heal);
  const nextMana = maxMana;
  return {
    kind: 'rest',
    title: 'Rest at the Shrine?',
    consequence: 'LEAVES SHRINE',
    confirmLabel: 'Rest and continue',
    rows: [
      { label: 'Health', before: hp, delta: nextHp - hp, after: nextHp, max: maxHp },
      { label: 'Mana', before: mana, delta: nextMana - mana, after: nextMana, max: maxMana },
    ],
  };
}

export function levelReviewModel({ attribute, label, before, cost, cinders }) {
  return {
    kind: 'level',
    title: `Raise ${label}?`,
    consequence: 'LEAVES SHRINE',
    confirmLabel: 'Level up and continue',
    attribute,
    rows: [
      { label, before, delta: 1, after: before + 1 },
      { label: 'Cinders', before: cinders, delta: -cost, after: cinders - cost },
    ],
  };
}

export function shrineReviewHtml(model) {
  return `<div class="shrine-review-summary">${model.rows.map((row) => {
    const sign = row.delta > 0 ? '+' : '';
    const max = row.max == null ? '' : `/${row.max}`;
    return `<div class="shrine-review-row"><span>${row.label}</span><b>${row.before}${max}</b><strong class="${row.delta < 0 ? 'cost' : 'gain'}">${sign}${row.delta}</strong><b>${row.after}${max}</b></div>`;
  }).join('')}</div>`;
}
