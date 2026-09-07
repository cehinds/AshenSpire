import { contentBundle } from '../../content/index.js';
import { createRegistries } from '../../model/registries.js';
import { renderEquipmentInspection } from '../components/equipmentCard.js';
import { openModal } from '../components/modalShell.js';
import { button } from '../kit/index.js';
import { hideTooltip } from '../components/tooltip.js';

const registries = createRegistries(contentBundle);
const pieces = registries.equipment.armaments;
const search = document.querySelector('#weapon-search');
const kind = document.querySelector('#weapon-kind');
const gallery = document.querySelector('#weapon-gallery');
const initial = new URL(location.href).searchParams;
search.value = initial.get('q') || '';
for (const value of new Set(pieces.map(piece => piece.kind))) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value[0].toUpperCase() + value.slice(1);
  kind.append(option);
}
kind.value = initial.get('kind') || '';

function draw() {
  hideTooltip();
  const query = search.value.trim().toLowerCase();
  const matches = pieces.filter(piece => (!kind.value || piece.kind === kind.value)
    && [piece.id, piece.name, ...(piece.itemTypes || []).map(type => type.label), ...piece.tags].join(' ').toLowerCase().includes(query));
  const articles = matches.map(piece => {
    const article = document.createElement('article');
    article.dataset.weaponId = piece.id;
    article.setAttribute('aria-label', piece.name);
    article.append(renderEquipmentInspection(registries, piece));
    const inspect = button({ label: 'Enlarge card', className: 'weapon-enlarge' });
    inspect.setAttribute('aria-label', `Enlarge ${piece.name}`);
    inspect.onclick = () => {
      hideTooltip();
      openModal({ title: piece.name, eyebrow: 'Equipment inspection', size: 'md',
        body: host => host.append(renderEquipmentInspection(registries, piece)) });
    };
    article.append(inspect);
    return article;
  });
  gallery.replaceChildren(...articles);
  document.querySelector('#weapon-count').textContent = `${matches.length} of ${pieces.length} armaments`;
  document.querySelector('#weapon-empty').hidden = matches.length > 0;
  const url = new URL(location.href);
  for (const [key, value] of [['q', search.value], ['kind', kind.value]]) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
  document.body.dataset.previewReady = 'true';
}
search.addEventListener('input', draw);
kind.addEventListener('change', draw);
document.querySelector('form').addEventListener('reset', () => { search.value = ''; kind.value = ''; queueMicrotask(draw); });
draw();
