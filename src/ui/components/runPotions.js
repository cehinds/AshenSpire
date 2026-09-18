// src/ui/components/runPotions.js — THE POTIONS CONTROL BETWEEN FIGHTS.
//
// Owner, 2026-09-14: potions never draw in the top HUD, and "the potions button
// from the bottom hud should remain present in the map mode in the usual
// position". This is that control for the map's tray: the combat footer's
// Potions button with its minis beside it, reading the same WGH8 projection
// (models/PotionContentsModel.js) and acting by the out-of-combat rules
// (models/RunPotionModel.js).
//
//   · The minis are the shared icon tray (iconTray.js): a tap explains a
//     potion, a second tap opens its flask menu (Use / Inspect / Drop, the
//     menu the room rail's tiles opened). What does not fit is `+N`, which
//     opens the Potions list.
//   · The Potions button opens the list: one row per entry with its one verb,
//     Drink for a charge flask and Drop for a carried potion, disabled with
//     the reason when the rules refuse it.
//
// Whatever changes the run calls `onChange`; the screen saves and redraws.
import { potionCountStringId } from '../models/PotionContentsModel.js';
import { applyRunPotion, runPotionPlan, runPotionRows, runPotionVerb } from '../models/RunPotionModel.js';
import { flaskDetailLines, flaskPresentation, flaskTooltipHtml, mountFlaskActionMenu } from './flask.js';
import { iconTray, observeIconTray, setIconTrayItems, setIconTrayOverflow, trayIcon } from './iconTray.js';
import { settingOn } from '../screens/settings.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { button, flavour, openModal, optionCard } from '../kit/index.js';
import { t, tFull } from '../strings.js';

export function mountRunPotions(host, { registries, run, meta, onChange = null }) {
  const drinkOutsideCombat = settingOn(meta.settings, 'useRestorativeFlasksOutsideCombat');
  const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat });
  const act = (entry, actionId) => {
    if (applyRunPotion({ registries, run, entry, actionId, plan: planFor(entry) })) onChange?.();
  };
  const control = button({ label: t('iconTray.potions'), className: 'run-potions-btn', attrs: { 'aria-haspopup': 'dialog' } });
  const openList = () => openRunPotions({ registries, run, opener: control, planFor, onAction: act });
  const minis = iconTray({ label: t('iconTray.potions'), attrs: { class: 'run-potion-minis' } });
  minis.style.setProperty('--icon-tray-slots', String(wireframeUi.iconTray.footerPotionIcons));
  setIconTrayOverflow(minis, () => { openList(); });
  setIconTrayItems(minis, runPotionRows(registries, run).map(({ entry, def }) => trayIcon({
    art: flaskPresentation(def, { showName: false }), count: entry.count, tone: def.tint || '',
    label: `${def.name}, ${tFull(potionCountStringId(entry), { count: entry.count })}`, disabled: entry.count <= 0,
    attrs: { class: 'potion-mini', dataset: { potionKey: entry.key } },
    tip: () => flaskTooltipHtml(def, entry.category === 'charge' ? { charges: entry.count } : {}),
    activate: (node) => mountFlaskActionMenu(node, {
      def, plan: planFor(entry), charges: entry.category === 'charge' ? entry.count : null,
      onCancel: () => {}, onAction: (actionId) => act(entry, actionId),
    }),
  })));
  control.addEventListener('click', openList);
  host.replaceChildren(minis, control);
  observeIconTray(minis);
  return { control, minis };
}

export function openRunPotions({ registries, run, opener = null, planFor, onAction }) {
  let shell = null;
  shell = openModal({
    title: t('potions.run.title'), size: 'md', className: 'run-potion-menu', opener, bodyClassName: 'as-pane',
    body: (host) => {
      const rows = runPotionRows(registries, run);
      if (!rows.length) { host.appendChild(flavour(t('potions.run.none'))); return; }
      for (const { entry, def } of rows) {
        const verb = runPotionVerb(entry, planFor(entry));
        const label = t(verb.id === 'use' ? 'potions.run.drink' : 'potions.run.drop');
        const control = button({ label, disabled: !verb.enabled, className: 'run-potion-act', attrs: { 'aria-label': `${label} ${def.name}` } });
        control.addEventListener('click', () => {
          if (!verb.enabled) return;
          shell?.close();
          onAction(entry, verb.id);
        });
        host.appendChild(optionCard({
          tag: 'div', arrow: false, name: def.name, art: flaskPresentation(def, { showName: false }),
          description: flaskDetailLines(def, { charges: entry.category === 'charge' ? entry.count : null }).join(' '),
          meta: [t(potionCountStringId(entry), { count: entry.count }), verb.enabled ? '' : verb.reason].filter(Boolean).join(' · '),
          trail: [control], attrs: { dataset: { potionKey: entry.key } },
        }));
      }
    },
  });
  return shell;
}
