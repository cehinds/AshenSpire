import { ACTION_SIGILS } from '../../content/combatSigils.js';
import { esc } from './tooltip.js';

// Original solid silhouettes, matching the approved B footer treatment.
const SHAPES = Object.freeze({
  ritual: '<path d="M16 2 31 28H1Zm0 7L7 25h18Z"/><circle cx="16" cy="19" r="4"/>',
  skill: '<path d="m16 2 5 9 9 5-9 5-5 9-5-9-9-5 9-5Zm0 9-5 5 5 5 5-5Z"/>',
  bleed: '<path d="M16 1C13 8 5 15 5 21a11 11 0 0 0 22 0C27 15 19 8 16 1ZM9 21h3c0 4 2 5 5 5v3c-5 0-8-3-8-8Z"/>',
  frost: '<path d="M14 1h4v8l6-5 3 3-8 7 10-1v4l-10 1 8 7-3 3-6-7v10h-4V21l-7 7-3-3 8-7-10-1v-4l10 1-8-7 3-3 7 5Z"/>',
  lightning: '<path d="M18 1 3 19h11l-2 12L30 12H18l4-11Z"/>',
  force: '<path d="M16 2 30 16 16 30 2 16Zm0 6-8 8 8 8 8-8Z"/><circle cx="16" cy="16" r="4"/>',
  alteration: '<path d="m1 25 10-20 8 13 5-7 7 14ZM3 28h26v3H3Z"/>',
  illusion: '<path d="M1 16Q16-3 31 16 16 35 1 16Zm8 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0Z"/><circle cx="16" cy="16" r="4"/>',
  divine: '<path d="m16 0 3 7 7-4-1 8 7 5-7 4 1 9-7-5-3 8-3-8-7 5 1-9-7-4 7-5-1-8 7 4Z"/>',
  decay: '<path d="M16 14C6 17 1 9 7 3l6 8ZM18 14l2-11c9 0 13 10 3 13ZM17 19l8 8c-5 8-17 5-15-5Z"/><circle cx="16" cy="16" r="4"/>',
  slashing: '<path d="M26 1h5C26 16 16 24 1 31l5-7C16 17 23 8 26 1Zm2 15 3 3-10 11-3-3Z"/>',
  piercing: '<path d="m28 1 3 3-9 16-4-4ZM15 13l10 10-3 3-10-10ZM4 25l10-10 4 4L8 29H4Z"/>',
  blunt: '<path d="M5 2h22v12H5Zm8 14h6v15h-6Z"/>',
  guard: '<path d="M16 2 29 7v10c0 7-13 14-13 14S3 24 3 17V7Zm-2 8v8H8v4h16v-4h-6v-8Z"/>',
  guile: '<path d="M2 7q14 8 28 0v12L19 30l-3-9-3 9L2 19Zm4 6v5l6 1v-4Zm20 0-6 2v4l6-1Z"/>',
});

const ALIASES = Object.freeze({ fire:'spell', burn:'spell', cold:'frost', arcane:'force', sacred:'divine', holy:'divine', necrotic:'decay', crimsonBlight:'decay', blight:'decay', blood:'bleed', gorefire:'spell', blade:'slashing', pierce:'piercing', heavy:'blunt', starstone:'force', astral:'force', venom:'decay', oath:'divine', weak:'lightning', vulnerable:'guard', staggered:'blunt', poise:'blunt', precision:'ranged', cleave:'attack', counter:'counter', flourish:'skill', prepared:'guile', concealed:'guile', ash:'guile' });

function shapeFor(tag) {
  const key = tag.id.split(':').at(-1);
  const id = ALIASES[key] || key;
  return ACTION_SIGILS[id]?.solid ? ACTION_SIGILS[id].shape : SHAPES[id] || SHAPES.skill;
}

// Select a representative of each useful category; never print the footer's
// action a second time. The complete vocabulary remains in Information.
export function cardSideTags(model, def = {}, registries = null) {
  const tags = model.tags.filter(tag => tag.label.toLowerCase() !== model.sigils.action);
  const statusEffect = def.effects?.find(effect => ['applyStatus','buildup'].includes(effect.op) && effect.status);
  const statusDef = statusEffect && registries?.statuses?.has(statusEffect.status) ? registries.statuses.get(statusEffect.status) : null;
  const status = statusDef ? { id:`status:${statusEffect.status}`, label:statusDef.name, blurb:statusDef.tooltip || statusDef.name } : null;
  const element = tags.find(tag => tag.id.startsWith('damage:')) || tags.find(tag => tag.id.startsWith('school:'));
  const skill = tags.find(tag => tag.id.startsWith('ability:'))
    || tags.find(tag => tag.id.startsWith('technique:'))
    || tags.find(tag => !tag.id.includes(':'));
  const selected = [], labels = new Set();
  const add = tag => { if(tag && selected.length < 3 && !labels.has(tag.label.toLowerCase())) { selected.push(tag); labels.add(tag.label.toLowerCase()); } };
  add(element); add(status); add(skill);
  add(tags.find(tag => tag.id === 'camp:spell'));
  add(tags.find(tag => tag.id.startsWith('school:')));
  for(const tag of tags.filter(tag => !/^(source|reach|targeting|counter|camp|maneuver|delivery):/.test(tag.id)))add(tag);
  // Put identity first, then spell camp, followed by damage/school and status.
  return selected.sort((a,b) => (a===skill?0:a.id==='camp:spell'?1:a===element?2:3) - (b===skill?0:b.id==='camp:spell'?1:b===element?2:3));
}

export function cardTagRailHtml(tags) {
  if(!tags?.length)return '';
  return `<div class="card-tag-rail" data-card-layer="7" aria-label="Primary card tags">${tags.map(tag => `<span class="card-tag-symbol" role="img" data-tag-id="${esc(tag.id)}" aria-label="${esc(tag.label)}" aria-description="${esc(tag.blurb || tag.label)}"><svg viewBox="0 0 32 32" fill="currentColor" fill-rule="evenodd" aria-hidden="true" focusable="false">${shapeFor(tag)}</svg></span>`).join('')}</div>`;
}
