// Independent acceptance policy: the current ordered presentation owes four
// 500 ms waits and half-rate sprites. Only declared waits/clip/receipt holds
// are excluded from the existing 400/750 ms responsiveness budgets.
export function orderedImpactSample({ up, contact, number, timing, clip, holdMs = 0, stages, receipts = [] }) {
  const fail = message => { throw new Error(`ordered click-impact: ${message}`); };
  if (timing?.fixCore !== true) fail('the default fixture must resolve actual Core2 mechanics');
  if (timing?.spriteSpeed?.lungeMs !== 390) fail('default Normal half-rate sprite must use the 390 ms lunge clock');
  for (const key of ['intentMs', 'wordMs', 'afterSpriteMs', 'reactionMs']) if (timing?.[key] !== 500) fail(`${key} must remain 500 ms at default Normal`);
  if (timing.playbackRate !== 0.5 || timing.scale !== 1) fail('default Normal requires ×1 speed and 0.5 sprite playback');
  if (!(Number.isFinite(clip?.impactMs) && Number.isFinite(clip?.totalMs) && clip.totalMs >= clip.impactMs)) fail('missing declared authored clip timing');
  if (Number.isFinite(clip.activeMs) && Math.abs(clip.activeMs - clip.totalMs) > 1) fail('active clip differs from its declared duration');
  const order = ['intent', 'action', 'sprite', 'contact', 'reaction', 'damage', 'hud', 'resolution'];
  const rows = stages.slice(0, order.length);
  if (rows.length !== order.length || rows.some((row, index) => row[1] !== order[index])) fail(`incomplete or reordered stages: ${rows.map(row => row[1]).join(', ')}`);
  const times = Object.fromEntries(rows.map(([at, name]) => [name, at]));
  const minimum = (start, end, ms) => { if (times[end] - times[start] < ms - 4) fail(`${start} → ${end} did not retain ${ms} ms`); };
  minimum('intent', 'action', 500); minimum('action', 'sprite', 500);
  minimum('sprite', 'contact', clip.impactMs);
  minimum('sprite', 'reaction', clip.totalMs + holdMs + 500);
  minimum('reaction', 'damage', 500);
  const whollyMissed = receipts.some(event => event.type === 'attackMissed') && !receipts.some(event =>
    ['attackHit', 'damageDealt', 'blockGained', 'meterGuardGained', 'ratingImpact', 'hpLost', 'healed', 'barrierGained'].includes(event.type));
  if (number == null && !whollyMissed) fail('missing numeric readout without a wholly missed action');
  if (contact < times.contact - 4 || (number != null && number < times.damage - 4)) fail('readout precedes its declared stage');
  const expectedContact = 1000 + clip.impactMs;
  const expectedNumber = 2000 + clip.totalMs + holdMs;
  return { contact: Math.round(contact - up), number: number == null ? null : Math.round(number - up), expectedContact, expectedNumber,
    contactOverhead: Math.round(contact - up - expectedContact), numberOverhead: number == null ? null : Math.round(number - up - expectedNumber) };
}
