// src/ui/models/ArtLoadNoticeModel.js — the title's notice when the web
// edition's built-in art could not be loaded (docs/EXTERNAL-ASSETS-PLAN.md §3,
// *Failure and fallback*, step 5).
//
// Non-blocking: the title stays usable on placeholders, the synth score and
// the system faces, and the notice only says so and offers Retry. Three
// states, one record each:
//   failed    the boot load failed; Retry is offered
//   retrying  a Retry is loading the indexes; the button is busy
//   again     a Retry failed too; Retry is offered again
// The words are rows of content/source/uiStrings.csv (`art.*`).

import { behaviorModel } from './BehaviorModel.js';
import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { t, tFull } from '../strings.js';

export const ART_NOTICE_STATES = Object.freeze(['failed', 'retrying', 'again']);

export function artLoadNoticeModel({ state = 'failed' } = {}) {
  const variant = ART_NOTICE_STATES.includes(state) ? state : 'failed';
  const message = variant === 'retrying' ? t('art.loading')
    : variant === 'again' ? tFull('art.failed.again') : tFull('art.failed.notice');
  const retry = componentModel(UI.artLoadNoticeRetry, {
    variant: variant === 'retrying' ? 'busy' : 'ready',
    properties: { label: t('art.retry'), busy: variant === 'retrying' },
    accessibility: { description: tFull('art.retry') },
    behaviors: [behaviorModel('retry-art', { event: 'activate', command: 'retry-art', policy: 'one-at-a-time' })],
  });
  return componentModel(UI.artLoadNotice, {
    variant,
    properties: { message },
    accessibility: { role: 'status', live: 'polite' },
    children: [retry],
  });
}
