import { trackGesture } from '../gesture.js';
import { touchPoint, recordFlickPoint, flickVerdict, flickPreferences } from '../models/TouchFlickModel.js';

export function mountFlickPractice(container, settings, rules) {
  const zone = container.querySelector('[data-flick-practice]');
  if (!zone) return;
  const result = zone.querySelector('output');
  zone.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    const start = touchPoint(event), points = [start];
    result.textContent = 'Move upward, then release.';
    trackGesture(event, {
      onMove(move) {
        const end = touchPoint(move);
        recordFlickPoint(points, end, rules);
        const verdict = flickVerdict(start, end, points, settings, rules);
        zone.dataset.ready = String(verdict.distanceMet);
        result.textContent = `${Math.max(0, Math.round(verdict.upward))} / ${flickPreferences(settings, rules).distance} px${verdict.distanceMet ? ' · Flick to play' : ''}`;
      },
      onEnd(up, { cancelled }) {
        zone.dataset.ready = 'false';
        const verdict = flickVerdict(start, touchPoint(up), points, settings, rules);
        result.textContent = cancelled ? 'Cancelled. Try again.' : verdict.qualifies ? 'Flick accepted — no card spent.'
          : !flickPreferences(settings, rules).enabled ? 'Card flick to play is off.'
          : verdict.distanceMet ? 'Distance reached. Release with a quicker upward motion.' : 'Too short or sideways. Try upward again.';
      },
    });
  });
}
