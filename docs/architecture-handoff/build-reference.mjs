// Rebuild documentation sources in dependency order; do not hand-edit generated artifacts.
import { readFileSync, writeFileSync } from 'node:fs';
import { hudConfig } from './hud-reference.mjs';
writeFileSync(new URL('hud-config.json', import.meta.url), JSON.stringify(hudConfig, null, 2)+'\n');
for(const generator of ['generate-tooltip-wireframes.mjs','generate-card-wireframes.mjs','generate-component-wireframes.mjs','generate-responsive-wireframes.mjs','generate-wireframe-gallery.mjs','generate-card-anatomy.mjs'])await import('./'+generator);
// Diagram padding is internal; trailing spaces are not part of the contract.
for (const name of ['wireframe.md', 'card-wireframes.md', 'component-wireframes.md', 'RESPONSIVE-WIREFRAMES.md']) {
  const file = new URL(name, import.meta.url);
  writeFileSync(file, readFileSync(file, 'utf8').replace(/[\t ]+(?=\r?$)/gm, ''));
}
