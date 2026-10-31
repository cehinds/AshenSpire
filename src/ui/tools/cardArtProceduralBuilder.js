import { renderCard } from '../components/card.js';
import { cardArtLayersHtml } from '../cardArtLayers.js';
import { t, tFull } from '../strings.js';
import { tagService } from '../../model/tagService.js';
import { BUILDER_TYPES, BUILDER_ELEMENTS, BUILDER_RANK_MAX, builderInputFromControls, createBuilderPreview, builderInputJson } from './cardArtBuilderModel.js';

const node = (tag, text) => { const element = document.createElement(tag); if (text) element.textContent = text; return element; };
export function mountProceduralBuilder({ registries, run, imageURL, download, rootURL }) {
  const find = id => document.getElementById(id);
  const service = tagService(registries);
  const tagName = id => service.resolve([id])[0]?.label || id.split(':').at(-1);
  const option = (select, value, label) => { const item = node('option', label); item.value = value; select.append(item); };
  for (const type of BUILDER_TYPES) option(find('builder-type'), type, t(`cardArtBuilder.type.${type}`));
  for (const category of ['physical', 'spell']) option(find('builder-category'), category, t(`cardArtBuilder.category.${category}`));
  option(find('builder-element'), '', t('cardArtBuilder.none'));
  for (const id of BUILDER_ELEMENTS) option(find('builder-element'), id, tagName(`element:${id}`));
  for (const utility of ['', 'heal', 'draw', 'cleanse']) option(find('builder-utility'), utility, t(utility ? `cardArtBuilder.utility.${utility}` : 'cardArtBuilder.none'));
  for (const delivery of ['melee', 'projectile']) option(find('builder-delivery'), delivery, t(`cardArtBuilder.delivery.${delivery}`));
  find('builder-rank').max = String(BUILDER_RANK_MAX);
  for (const rank of [1, 3, 5]) {
    const button = node('button', t('cardArtBuilder.rankPreset', { rank })); button.type = 'button';
    button.onclick = () => { find('builder-rank').value = String(rank); draw(); }; find('builder-ranks').append(button);
  }
  for (const status of [...registries.statuses.all()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))) {
    const label = node('label'), input = node('input'); input.type = 'checkbox'; input.value = status.id;
    input.dataset.builderStatus = status.id; input.onchange = draw;
    label.append(input, node('span', status.name)); find('builder-statuses').append(label);
  }
  let current = null;
  function draw() {
    find('builder-export').disabled = true; current = null;
    find('builder-art').replaceChildren(); find('builder-native').replaceChildren(); find('builder-components').replaceChildren();
    find('builder-delivery').disabled = find('builder-category').value !== 'spell';
    find('builder-utility').disabled = find('builder-type').value !== 'skill';
    try {
      const value = builderInputFromControls({ type: find('builder-type').value, category: find('builder-category').value,
        element: find('builder-element').value, utility: find('builder-type').value === 'skill' ? find('builder-utility').value : '', delivery: find('builder-delivery').value,
        rank: find('builder-rank').valueAsNumber, extraTags: find('builder-extra-tags').value,
        statuses: [...find('builder-statuses').querySelectorAll('input:checked')].map(input => input.value) });
      const preview = createBuilderPreview(registries, value, { name: t('cardArtBuilder.previewName'), text: tFull('cardArtBuilder.previewOnly') });
      find('builder-input').textContent = builderInputJson(preview.input);
      if (!preview.composition) { find('builder-message').textContent = tFull('cardArtBuilder.noComposition'); return; }
      const art = preview.composition, background = node('img'); background.src = imageURL(art.path); background.alt = '';
      find('builder-art').append(background); find('builder-art').insertAdjacentHTML('beforeend', cardArtLayersHtml(art));
      const face = renderCard(registries, { cardId: preview.definition.id, rank: preview.input.rank },
        { definition: preview.definition, rules: run, inspection: false, level: 'inspect', artStyle: 'Simple' });
      find('builder-native').append(face);
      for (const image of [...find('builder-art').querySelectorAll('img'), ...find('builder-native').querySelectorAll('img')]) {
        const raw = image.getAttribute('src'); if (raw && !/^(data:|https?:|blob:)/.test(raw)) image.src = new URL(raw, rootURL).href;
      }
      for (const sprite of art.componentArt.sprites) {
        const item = node('li'), link = node('a', sprite.label || sprite.assetId); link.href = imageURL(sprite.path); link.target = '_blank'; link.rel = 'noopener';
        item.append(link, node('span', ` · ${sprite.id} · ${sprite.assetId}`)); find('builder-components').append(item);
      }
      find('builder-message').textContent = tFull('cardArtBuilder.ready', { rank: preview.input.rank, count: art.componentArt.sprites.length });
      current = preview.input; find('builder-export').disabled = false;
    } catch (error) {
      find('builder-input').textContent = '';
      find('builder-message').textContent = error.code === 'rank' ? tFull('cardArtBuilder.invalidRank', { max: BUILDER_RANK_MAX })
        : error.code ? tFull('cardArtBuilder.invalidInput') : tFull('cardArtBuilder.previewFailed', { reason: error.message });
    }
  }
  for (const id of ['builder-type', 'builder-category', 'builder-element', 'builder-utility', 'builder-delivery', 'builder-rank', 'builder-extra-tags']) find(id).addEventListener('input', draw);
  find('builder-export').onclick = () => { if (current) download(new Blob([builderInputJson(current)], { type: 'application/json' }), 'procedural-card-art.json'); };
  draw(); return { refresh: draw };
}
