"""Screen-by-screen decomposition from visual inspection of all twelve boards."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
BASE=ROOT.parent/'player-polish-asset-kit-2026-10-02'

# Each row describes the visible UI primitives and the fields which stay live.
DETAIL={
'01a':('menu', 'Save receipt, large begin action, four utility rows, logo ornament, subtitle, footer motto',
        'save class, act, location, availability, menu labels',
        ['menu-window','navigation-row','navigation-row-selected','choice-row','heading-rule']),
'01b':('creation','Four class portraits, selected full figure, attribute rows, starting-kit object, loadout fields, segmented journey choices',
        'class identity, starting attributes, kit and appearance, legal creation choices',
        ['portrait-mat','item-mat','stat-chip','setting-row','filter-tab-selected']),
'02a':('story','Full narrative illustration, overlaid title/caption, diamond page indicators, skip and continue actions',
        'authored prologue text, current page, loaded-art readiness',
        ['heading-rule','action-ready']),
'02b':('dialogue','Grave vignette, separate speaker cutout/mat, title/body/quote, two icon-led consequence rows, remembered-choice footer',
        'event title, canonical speaker, dialogue, legal choices and consequences',
        ['portrait-mat','choice-row','service-inspector','heading-rule']),
'03a':('world','Authored atlas, route paths, circular landmark pins, selected-location plaque, HUD, sidebar, destination thumbnail/receipt, zoom controls',
        'location coordinates, reachability, destination details, map zoom, player resources',
        ['navigation-sidebar','navigation-row-selected','service-inspector','hud-rail','receipt-row']),
'03b':('routes','Climb backdrop, linked encounter nodes, state rings, legend, selected encounter portrait, potential reward sockets',
        'node graph, encounter kind, visited/current/reachable state, rewards',
        ['navigation-sidebar','service-inspector','item-mat','hud-rail']),
'04a':('city','City illustration, service diamond pins/labels, city heading, HUD, selected service thumbnail, quest/services/lore tabs, quest receipt',
        'authored service coordinates, availability, quest data, selected tab',
        ['service-inspector','quest-row','accordion-heading','filter-tab-selected','hud-rail']),
'04b':('dungeon','Furnace panorama, separate chamber thumbnails/sockets, room connectors, current/visited/unknown markers, threat pips, exit rows',
        'actual room graph, discovery, threat, exits, possible rewards',
        ['chamber-known','chamber-current','chamber-unknown','chamber-visited','service-inspector','stat-chip']),
'05a':('combat','Authored arena/floor, canonical player and two enemy sprites, hero HUD, flask/relic sockets, intent bubbles, health/poise rails, card fan, cost tokens, turn orb',
        'fighter anchors, target, intent, HP, poise, actual costs/effects, draw/discard counts, turn availability',
        ['combat-intent','health-rail','buildup-rail','turn-orb','card-engraved','card-selection','cost-hexagon']),
'05b':('boss','Authored boss arena and floor, boss silhouette, player sprite, boss intent and health/poise, expandable status detail, selected card frame',
        'boss identity, sprite anchors, intent, status buildup and duration, selected card',
        ['combat-intent','health-rail','buildup-rail','status-tooltip','card-engraved','card-selection','turn-orb']),
'06a':('equipment','Full outfit figure, equipment socket list, character tabs, attribute panel, weight rail, loadout selection controls',
        'actual slots, equipped art, attributes, weight class, actual prepared-set availability',
        ['navigation-row','item-mat','portrait-mat','training-rail','setting-row']),
'06b':('inventory','Category rail, item grid and selection socket, canonical weapons, equipped/selected comparison panes, stat deltas, swap-card receipt, action footer',
        'inventory ownership, item IDs, weight and stats, actual swap/equipment receipt',
        ['navigation-sidebar','item-mat','selection-ring','comparison-pane','receipt-row','stat-chip']),
'07a':('cards','Deck sidebar, category filters, card grid, separate painting/cost/name/type/body layers, selected-card inspector, equipment-source badge',
        'actual deck model, card costs/names/effects, source ownership, legal deck actions',
        ['navigation-sidebar','filter-tab','filter-tab-selected','card-engraved','card-selection','cost-hexagon','service-inspector']),
'07b':('relics','Relic/flask tabs, canonical relic object sockets, selected-relic illustration and text, flask rows, independent charge droplets, use controls',
        'relic identity, discovered effect, flask quantity/charges and use availability',
        ['item-mat','selection-ring','service-inspector','receipt-row','filter-tab']),
'08a':('merchant','Separate market scene and merchant portrait, category accordion headings, stock object sockets, item detail/price/affordability, sell/remove controls',
        'canonical merchant identity, stock, price, cinders, affordability and buy/sell legality',
        ['portrait-mat','accordion-heading','item-mat','selection-ring','service-inspector','receipt-row']),
'08b':('forge','Separate forge scene and smith portrait, service tabs, equipment socket, compatible mount list and empty mount, selected card preview, cost/receipt',
        'actual smith services, equipment mounts, compatible cards, cost and result receipt',
        ['portrait-mat','filter-tab-selected','empty-mount','item-mat','card-engraved','comparison-pane']),
'09a':('rest','Chapel rest backdrop, recovery-before/after rows, rest/upgrade choice rows, selected upgrade card, calm caption',
        'location recovery rules, max HP, resource deltas, available rest and upgrade choices',
        ['receipt-row','choice-row','card-engraved','card-selection','heading-rule']),
'09b':('rewards','Spoils background, three selectable card folios, category reward receipts, cinder/relic/flask objects, claimed ticks, skip/continue footer',
        'actual reward model, selected card, claimed ownership, inventory capacity, legal continue',
        ['card-engraved','card-selection','cost-hexagon','receipt-row','accordion-heading','item-mat']),
'10a':('progression','Parchment substrate, branch connectors and sockets, XP rail, selected talent illustration/inspector, training rows, point-cost action',
        'canonical skill tree, learned/locked prerequisites, XP curve, training, points and step duration',
        ['talent-available','talent-selected','talent-locked','talent-learned','training-rail','service-inspector','receipt-row']),
'10b':('compendium','Parchment gallery, category rail, canonical object thumbnails, discovered/undiscovered masks, rarity pips, selected object mat and facts, favorite',
        'discovery, actual item identity, unknown masking, stats, favorite state',
        ['navigation-sidebar','item-mat','selection-ring','service-inspector','stat-chip']),
'11a':('party','Camp backdrop, four canonical class portrait cards/rows, host badge, separate readiness/connection states, route-vote thumbnails and pips, start/leave actions',
        'player roster, host, class, readiness, reconnect state, actual lobby and route-vote phases',
        ['party-card','party-row','portrait-mat','receipt-row','selection-ring']),
'11b':('history','Aftermath background, history thumbnail rows, outcome badge, run receipt, progress timeline with independent nodes, expandable deck/relic/event details',
        'run history, outcome, seed, reached acts, encounter, play time, actual collected deck/relics',
        ['history-receipt','quest-row','receipt-row','accordion-heading','heading-rule']),
'12a':('settings','Settings menu/categories, search field, descriptive setting rows, segmented selections, toggle/slider parts, profile receipt, keycaps/rebind counts, reset dialog',
        'actual preferences, text size, quality, reduced motion, bindings, archive/profile, reset confirmation',
        ['settings-section','navigation-sidebar','navigation-row-selected','search-field','setting-row','filter-tab','keycap','confirmation-dialog']),
'12b':('draft','Run configuration folio, seed field/reroll controls, journey segmented choices, folded modifiers/gear, three draft cards, current pick ring, carousel dots, confirm footer',
        'actual seed, journey type, legal modifiers/gear, draft offered IDs, selected pick and availability',
        ['search-field','filter-tab-selected','accordion-heading','card-engraved','card-selection','cost-hexagon'])}

SCENES={'04a':('crownfall-desktop','crownfall-mobile'),
        '04b':('furnace-chapel-desktop','furnace-chapel-mobile'),
        '05a':('ruined-courtyard-desktop','ruined-courtyard-mobile'),
        '05b':('furnace-chapel-desktop','furnace-chapel-mobile'),
        '09a':('chapel-rest-desktop','chapel-rest-mobile'),
        '09b':('spoils-desktop','spoils-mobile'),
        '11a':('fellowship-desktop','fellowship-mobile'),
        '11b':('aftermath-desktop','aftermath-mobile')}
NAMES=['arrival-and-identity','story-and-choices','world-and-routes','cities-and-dungeons',
       'combat-and-threats','armoury-and-inventory','cards-and-relics','merchant-and-forge',
       'rest-and-rewards','growth-and-discovery','company-and-history','preferences-and-run-setup']
ICON_ALIASES={'reaver':'motif-endurance','rogue':'motif-agility','starseer':'motif-stars','herald':'motif-oath',
              'plus':'zoom-in','minus':'zoom-out','event':'event-mark','favorite':'favorite-star'}
EXTRA_ICONS={
'01a':['journey','history','compendium','settings','coop','reaver'],
'01b':['reaver','rogue','starseer','herald','health','mana','stamina','actions','sword'],
'02a':['next','check'],'02b':['cinders','next','dialogue'],
'03a':['world','quest','deck','inventory','settings','location','merchant','smith','rest','combat','plus','minus'],
'03b':['journey','combat','boss','rest','merchant','event','check','lock'],
'04a':['rest','smith','merchant','quest','dialogue','location'],
'04b':['warning','boss','check','lock','unknown','next'],
'05a':['health','mana','stamina','block','attack','draw','discard','flask-health','flask-mana','relic'],
'05b':['health','poise','bleed','blight','insanity','attack'],
'06a':['equipment','health','mana','stamina','poise','weight','lock'],
'06b':['sword','shield','armour','flask-health','relic','weight','compare','link'],
'07a':['deck','attack','skill','link'],'07b':['relic','flask-health','flask-mana','next'],
'08a':['deck','relic','flask-health','cinders','merchant','back'],
'08b':['smith','sword','deck','link','cinders','back'],
'09a':['rest','deck','health','mana','stamina','actions'],
'09b':['reward','cinders','relic','flask-health','check','next'],
'10a':['progression','lock','check','sword','strength','dexterity'],
'10b':['compendium','sword','shield','lock','favorite'],
'11a':['coop','reaver','rogue','starseer','herald','connected','disconnected','check'],
'11b':['history','boss','check','deck','reset'],
'12a':['settings','display','audio','controls','accessibility','motion','contrast','touch','search','reset','profile'],
'12b':['seed','reset','world','journey','check','next']}

def run():
    manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    assets={a['file']:a for a in manifest['assets']}
    base=json.loads((BASE/'feature-map.json').read_text(encoding='utf-8'))
    recipes=[]
    for old in base['features']:
        id=old['id']; family,parts,fields,new=DETAIL[id]
        board=f"references/{id[:2]}-{NAMES[int(id[:2])-1]}.png"
        original_art={device:['assets/reused/'+p for p in old[device+'Artwork']] for device in ['desktop','mobile']}
        shared=['assets/reused/'+p for p in old['sharedAssets']]
        components=['assets/components/'+p+'.svg' for p in new]
        components+=['assets/components/'+p+'.svg' for p in ['engraved-folio-frame','engraved-folio-backed','action-neutral','action-ready','action-selected','action-danger','action-disabled','focus-ring','mobile-action-tray']]
        icons=['assets/components/'+ICON_ALIASES[p]+'.svg' if p in ICON_ALIASES else 'assets/reused/ui/icons/'+p+'.svg' for p in EXTRA_ICONS[id]]
        # Names in the concept boards can differ; only resolve supplied icon geometry.
        missing_icons=[p for p in icons if p not in assets]
        icons=[p for p in icons if p in assets]
        optional={device:[] for device in ['desktop','mobile']}
        if id in SCENES:
            for d,n in zip(['desktop','mobile'],SCENES[id]):optional[d].append('assets/scenes/'+n+'.webp')
        if id=='04a':
            for d in optional:
                optional[d]+=['assets/scenes/crownfall-street-'+d+'.webp','assets/scenes/inn-interior.webp']
        if id in ['05a','05b']:
            for d in optional:
                optional[d]+=['assets/enemies/'+n+'.webp' for n in (['wandering-soldier-three-quarter','blight-hound-three-quarter'] if id=='05a' else ['charred-colossus-three-quarter'])]
                optional[d]+=['assets/enemies/'+n+'.webp' for n in (['wandering-soldier-inspector','blight-hound-inspector'] if id=='05a' else ['charred-colossus-inspector'])]
        decoration=[]
        if id in ['03b','04a','04b','05a','09b']:decoration.append('assets/decorations/torn-standard.webp')
        if id in ['06b','07a','07b','08a']:decoration.append('assets/decorations/fieldcase-still-life.webp')
        if id in ['04a','07b','08a']:decoration.append('assets/decorations/hanging-lantern.webp')
        if id in ['10a','10b']:decoration.append('assets/materials/weathered-parchment.webp')
        recipe={**old,'family':family,'reference':board,'referenceFeature':'upper' if id.endswith('a') else 'lower',
                'visualParts':parts.split(', '),'liveFields':fields.split(', '),
                'artwork':original_art,'newPerspectiveOptions':optional,'components':components,
                'icons':icons,'sharedAssets':shared,'decorations':decoration,
                'layout':{'desktop':{'referenceSize':[1440,900],'regions':['context/rail','main stage or collection','selected inspector/comparison','bottom actions']},
                          'mobile':{'referenceSize':[390,844],'regions':['compact HUD','upper artwork or selected stage','one open detail tray','bottom safe-area actions'],'note':old['mobileComposition']},
                          'shortLandscape':'Fold context and inspector; allow stage pan and detail scrolling; keep actions reachable.'},
                'layerOrder':['background','canonical objects or optional illustrations','optional decor','readability veil','panel material','frame or socket','live DOM labels and values','selection/focus/availability overlay'],
                'constraints':['Use canonical game data for all live fields; the screenshot is a visual reference.',
                               'Choose canonical art or a new perspective option deliberately; never layer duplicate baked figures.',
                               'Separate focus, persistent selection, disabled state and actual legal action.'],
                'unresolvedIconAliases':missing_icons}
        if id in ['03a','04a']:
            recipe['constraints'].append('Canonical map is the default. New city perspective is a hero/service background, not a coordinate-compatible map replacement.')
        if id in ['05a','05b']:
            recipe['constraints'].append('Use existing combatEnvironment atlas boxes and floorStart for canonical scenes. New backgrounds/cutouts require authored anchors and binding before combat integration; they are already usable in static encounter inspectors.')
        if id=='11a':recipe['constraints'].append('Decorative seated travellers are baked into fellowship scenes, not selectable player sprites. Route voting and lobby readiness remain separate actual phases.')
        if id in ['10a','10b']:recipe['constraints'].append('Parchment is a non-seamless cover material, dark DOM text recommended; undiscovered masks come from real item art and discovery state.')
        allpaths=original_art['desktop']+original_art['mobile']+shared+components+icons+decoration+optional['desktop']+optional['mobile']
        for path in allpaths:
            if path not in assets:raise ValueError('Recipe '+id+' missing '+path)
        # Drop obsolete path arrays inherited above; all portable paths now have one meaning.
        recipe.pop('desktopArtwork');recipe.pop('mobileArtwork')
        recipes.append(recipe)
        (ROOT/'recipes').mkdir(exist_ok=True)
        (ROOT/'recipes'/f'{id}.json').write_text(json.dumps(recipe,indent=2)+'\n',encoding='utf-8',newline='\n')
    (ROOT/'screen-recipes.json').write_text(json.dumps({'schema':1,'recipes':recipes},indent=2)+'\n',encoding='utf-8',newline='\n')
    breakdown={'schema':1,'reviewedBoards':12,'featureViews':24,'responsiveRenditions':48,
               'method':'Visual review of every original board; reauthored text-free raster layers, original SVG geometry and unchanged canonical assets, not low-resolution screenshot crops.',
               'boards':[{'reference':f'references/{i:02}-{name}.png','features':[f'{i:02}a',f'{i:02}b'],'reviewedDesktop':True,'reviewedMobile':True} for i,name in enumerate(NAMES,1)],
               'sharedFamilies':['world paintings','canonical characters and objects','enemy static cutouts and portraits','materials and transparent decorations','boxes and frames','navigation and menus','cards and costs','map/dungeon/progression sockets','meters/intents/statuses','controls and semantic states','live typography'],
               'gameplay':'No rules extracted from illustrative text. All labels, amounts, graph geometry, discovery and availability stay live.'}
    (ROOT/'breakdown.json').write_text(json.dumps(breakdown,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('24 recipes; 12 boards; 48 responsive renditions. Icon aliases:',sum(len(r['unresolvedIconAliases']) for r in recipes))

if __name__=='__main__':run()
