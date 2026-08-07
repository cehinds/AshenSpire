// src/ui/screens/about.js — Settings → About: the in-product AI acknowledgement.
//
// Every word here comes from src/content/aiDisclosure.js. This file renders and
// does not author: if you want to change what the game says about how it was
// made, change that module and both this screen and the store text change with
// it. A sentence typed into this file would be the second copy the arrangement
// exists to prevent.
//
// Follows the Profile section's pattern (profileArchive.js): a section rendered
// into the Settings modal rather than a screen of its own.

import { esc } from '../components/tooltip.js';
import { AI_DISCLOSURE, disclosureAsText } from '../../content/aiDisclosure.js';

export function renderAboutSection(container, { disclosure = AI_DISCLOSURE } = {}) {
  const sections = disclosure.sections
    .map(
      (s) => `
        <div class="about-block">
          <b>${esc(s.heading)}</b>
          <p class="set-note">${esc(s.body)}</p>
        </div>`
    )
    .join('');

  container.innerHTML = `
    <div class="about-ai">
      <p class="about-lead">${esc(disclosure.storeForm)}</p>
      ${sections}
      <div class="about-actions">
        <button class="about-copy">Save this to a file</button>
      </div>
      <p class="about-result" role="status"></p>
      <p class="set-note about-ver">Ashen Spire ${esc(disclosure.version)} · acknowledgement last updated ${esc(disclosure.updated)}</p>
    </div>`;

  // The player can keep a copy of what they were told. Same instinct as the
  // profile export: a claim you can save is a claim you can hold us to.
  container.querySelector('.about-copy').addEventListener('click', () => {
    const say = (m) => { container.querySelector('.about-result').textContent = m; };
    try {
      const blob = new Blob([disclosureAsText(disclosure)], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ashen-spire-ai-acknowledgement.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('Saved.');
    } catch (e) {
      say('Couldn’t save the file here — the text above is the whole of it.');
    }
  });
}
