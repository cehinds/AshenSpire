// Read-only enemy action cards. The engine owns selection and live previews.
const words = (value) => String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());

function effectText(effect, registries) {
  const target = effect.target === 'self' ? 'self' : effect.target === 'player' ? 'player' : words(effect.target || 'default target');
  if (effect.op === 'applyStatus') {
    const name = registries?.statuses?.get(effect.status)?.name || words(effect.status);
    return `Apply ${effect.stacks ?? effect.value ?? ''} ${name} to ${target}${effect.duration != null ? ` for ${effect.duration} turns` : ''}`;
  }
  if (effect.op === 'heal') return `Heal ${target} for ${effect.amount}`;
  if (effect.op === 'block') return `Give ${target} ${effect.amount} base Block`;
  if (effect.op === 'addCard') return `Add ${registries?.cards?.get(effect.card)?.name || words(effect.card)} to ${words(effect.pile)}${effect.position ? ` (${effect.position})` : ''}`;
  // Unknown future operations remain visible without invented effect semantics.
  return `${words(effect.op)}: ${JSON.stringify(Object.fromEntries(Object.entries(effect).filter(([key]) => key !== 'op')))}`;
}

/** No RNG, mutation, selection or engine dispatch; preview must come from previewIntent. */
export function enemyMoveCards(def, { enemy = null, preview = null, registries = null } = {}) {
  return Object.entries(def.moves || {}).map(([moveId, move]) => {
    const active = preview?.moveId === moveId;
    const liveDamage = active && preview.damage != null;
    const damage = liveDamage ? preview.damage : move.damage;
    const hits = liveDamage ? (preview.hits ?? 1) : (move.hits ?? 1);
    const locked = !!move.locked && !(enemy?.unlockedMoves || []).includes(moveId);
    const pieces = [];
    if (damage != null) pieces.push(`${damage}${hits > 1 ? ` × ${hits}` : ''} ${liveDamage ? 'preview damage before Block' : 'base damage'}`);
    if (move.block != null) pieces.push(`${move.block} base Block`);
    pieces.push(...(move.effects || []).map((effect) => effectText(effect, registries)));
    if (move.delay) {
      pieces.push(`Delayed ${move.delay.turns} turn${move.delay.turns === 1 ? '' : 's'}`);
      if (move.delay.whileCharging?.block != null) pieces.push(`${move.delay.whileCharging.block} base Block while charging`);
    }
    const phaseRequirements = (def.phases || []).filter((phase) => phase.unlockMoves?.includes(moveId)).map((phase) => (
      phase.on === 'hpBelowPct' ? `Unlocks at ${phase.pct}% HP or below` : `Unlocks on ${words(phase.on)}`
    ));
    const tags = Array.isArray(move.tags) ? [...move.tags] : [];
    const state = active ? (preview.pending ? 'Charging' : 'Current intent') : locked ? 'Locked' : 'Move set';
    const meta = [state, words(move.intent), ...phaseRequirements];
    if (move.maxConsecutive != null) meta.push(`At most ${move.maxConsecutive} consecutive selections`);
    if (tags.length) meta.push(`Tags: ${tags.map(words).join(', ')}`);
    return { id: `${def.id}:${moveId}`, moveId, name: move.name || words(moveId), active, locked,
      tags, intent: move.intent, detail: pieces.join(' · ') || words(move.intent), meta: meta.join(' · ') };
  });
}
