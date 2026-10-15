// A face is a short reading of complete facts, never a clipped paragraph.
// cardFaceLines and the Information pane retain the full card. Selection does
// not promote this budget: every ordinary face owes the same three lines.
import { uiStrings } from '../content/generated/uiStrings.js';

export const FACE_EFFECT_LINES = 3;
export const FACE_EFFECT_CLAUSES = 2;
export const FACE_EFFECT_CHARACTERS = 90;

const plain = html => html.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, 'x');
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const shorten = html => html.replace(/At the start of your turn, /g, 'Turn start: ')
  .replace(/At the end of your turn, /g, 'Turn end: ')
  .replace(/Whenever /g, 'When ').replace(/to the selected enemy/g, 'to target')
  .replace(/to ALL enemies/g, 'to all enemies').replace(/to a random enemy/g, 'to random enemy')
  .replace(/for every /g, 'per ')
  .replace(/In expanded combat, stops at (\d+) stacks each/g, 'Expanded: cap $1 stacks each')
  .replace(/(\d+) per (\d+) of \((.+?) stacks across all enemies plus (.+?) stacks across all enemies\) \(whole groups\)/g, '$1 per $2 total $3 + $4 on all enemies')
  .replace(/\bInflict (?=(?:<[^>]*>)*\d)/g, 'Deal ').replace(/\bInflict /g, 'Apply ')
  .replace(/\(maximum (\d+)\)/g, '(max $1)').replace(/\.\s*$/, '').trim();
const clauseCount = html => plain(html).split(/[.;]\s+(?=[A-Z(])|,\s+(?=(?:Draw|Discard|Choose|Heal|Gain|Remove|Apply|Add|Enter|Prepare|Next|Pay|Offer|Retain|Restore)\b)| and (?=(?:draw|take|gain|heal|apply|retain|discard)\b)/).length;

// Split only complete authored sentences. A following qualification belongs
// to the preceding sentence (caps, generated-card costs and pronoun riders).
function authoredClauses(html) {
  const sentences = html.split(/(?<=[.!?])\s+(?=[A-Z(])/), out = [];
  for (const sentence of sentences) {
    if (/^(?:\(|It |This |That |In expanded combat,)/.test(sentence) && out.length) out[out.length - 1] += ' ' + sentence;
    else out.push(sentence);
  }
  return out.map(html => ({ kind: 'effect', html: shorten(html) }));
}

/** At most two whole qualified clauses; omitted facts remain in Information. */
export function cardFaceProjection(def, { lines = null, authoredHtml = '', registries = null } = {}) {
  let candidates = lines ? lines.map(line => ({ ...line,
    // Entry bonuses and the Defend restore are stance explanations, outside
    // the ordinary effect budget. Their complete reading stays in Information.
    html: line.html.replace(/^Restore .*?Poise\/Ward\.\s*/, '').replace(/(?:, |\. )?Entry:.*$/, '').trim(),
  })).filter(line => line.html && !/^(?:Entry:|Restore .*Poise\/Ward)/.test(plain(line.html))
    && !['detail'].includes(line.kind))
    : authoredClauses(authoredHtml);
  if (!candidates.length) candidates = authoredClauses(authoredHtml);
  const keywordOnly = line => /^(?:Exhaust|Retain|Ethereal|Innate|Unplayable)(?:, (?:Exhaust|Retain|Ethereal|Innate|Unplayable))*$/.test(plain(line.html));
  if (candidates.some(line => !keywordOnly(line))) candidates = candidates.filter(line => !keywordOnly(line));
  // Probability is part of an application, not an optional extra line. A
  // status candidate must never look guaranteed when its effect has a chance.
  if (lines) candidates = candidates.map(line => {
    const chances = (def.effects || []).filter(effect => effect.op === 'buildup' && effect.chance !== undefined && effect.chance < 100)
      .filter(effect => plain(line.html).includes(registries?.statuses?.get?.(effect.status)?.name || effect.status))
      .map(effect => `${effect.chance}% chance`);
    return { ...line, html: shorten(line.html) + (chances.length ? ` (${esc([...new Set(chances)].join(', '))})` : '') };
  });
  // A payment cannot disappear while its payoff remains. Include authored
  // Ashen Blight payments too: those costs are intentionally outside effects.
  const authored = authoredClauses(authoredHtml);
  const payments = candidates.filter(line => line.kind === 'cost' || /^(?:Pay|Offer) /.test(plain(line.html)));
  if (def.ashenBlightCost) for (const line of authored.filter(line => /^Pay .*Ashen Blight/.test(plain(line.html)))) {
    if (!payments.some(payment => payment.html === line.html)) payments.push({ ...line, kind: 'cost' });
  }
  candidates = [...payments, ...candidates.filter(line => !payments.some(payment => payment.html === line.html))];
  const clauses = [];
  const requiredPayments = payments.reduce((sum, line) => sum + plain(line.html).length + 2, 0);
  for (const line of candidates) {
    const size = plain(line.html).length;
    const used = clauses.reduce((sum, clause) => sum + plain(clause.html).length + 2, 0);
    const count = clauses.reduce((sum, clause) => sum + clauseCount(clause.html), 0);
    if (requiredPayments > FACE_EFFECT_CHARACTERS || !size || used + size > FACE_EFFECT_CHARACTERS || count + clauseCount(line.html) > FACE_EFFECT_CLAUSES) continue;
    clauses.push(line);
    if (clauses.length === FACE_EFFECT_CLAUSES) break;
  }
  // An unfamiliar long rule is named, never shortened mid-condition. Current
  // authored cards are covered by whole clauses; this explicit door is a safe
  // forward-compatible reading for future mechanics rather than false prose.
  if (!clauses.length) clauses.push({ kind: 'detail', html: esc(uiStrings.find(row => row.id === 'card.face.inspectEffect').short) });
  return { clauses, maxLines: FACE_EFFECT_LINES,
    omitted: !lines || clauses.length < lines.length || candidates.length > clauses.length };
}
