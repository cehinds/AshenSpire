"""Inventory canonical content; generated PNG masters are never altered."""
from pathlib import Path
import csv, io, json, re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
def rows(name):
    return list(csv.DictReader(io.StringIO('\n'.join(x for x in (ROOT/'content/source'/name).read_text(encoding='utf-8').splitlines() if not x.startswith('#')))))

classes = {
 'reaver': 'A battle-worn sellsword, closed steel helmet, heavy layered plate and chainmail, ragged rust-red scarf and cloak, worn leather straps, sword lowered diagonally. Recognizable as the knight on the left of the supplied reference.',
 'starseer': 'A gaunt Observatory apprentice, shadowed hood, intricate layered scholar robes, weathered leather belts and chart scrolls, modest blue starstone on a long staff held vertically; human anatomy, no oversized wizard hat.',
 'herald': 'A Furnace Chapel novice, scarred human face beneath a deep cowl, layered ritual cloth over modest mail, tarnished brass reliquary and censer, a worn ritual mace lowered. Austere pilgrim, gold and rot, not a crowned pope.',
 'rogue': 'A lean river-city scavenger, hood and scarf partly covering the face, close-fitting layered leather armor, torn coat tails, practical pouches, two short blades held low. Subtle ash patina and restrained cold teal accents.',
}
enemy_designs = {
 'wanderingSoldier': 'Undead hollow soldier in damaged iron mail and a ragged field tabard, dented kettle helmet, chipped sword and battered small shield.',
 'blightHound': 'Low crouching skeletal hound, blackened wiry fur and rocky scabs, subtle glowing orange ember fissures, snarling elongated muzzle, four legs and long tail, like the hound on the reference right.',
 'huskBrute': 'Massive hollow humanoid with bark-dry ashen skin and heavy ragged armor scraps, dragging a rough stone club, hunched brute silhouette.',
 'graveWisp': 'Small hovering spirit made of pale funeral shrouds, a dim golden ember core, skull-like suggestion within tattered spectral cloth, restrained translucent wisps.',
 'wyrmAspirant': 'Human cult warrior gradually becoming a wyrm, scaled shoulders and horned distorted helm, tattered ritual cloth, long hooked spear; bipedal, not a full dragon.',
 'fellWarden': 'Ancient heavily armored gate warden, damaged leg, weight supported on a substantial iron war cane, tarnished green-black plate and old leaf-crested helm. The cane and uneven stance are essential.',
 'lanternMoth': 'Large moth of soot-brown velvet wings, intricate dusty wing veins, warm amber lanternlike abdomen, six slender legs, wings fully visible.',
 'briarHermit': 'Hunched robed hermit rooted into gnarled briars, dead branches emerging from the back, tangled thorn staff, face hidden beneath bark and cowl.',
 'chainScavenger': 'Ragged masked human scavenger with many rusted chains looped over shoulders, scrap-metal plates and a hooked chain weapon.',
 'bellKeeper': 'Towering stooped bellfoundry keeper wearing a cracked bronze bell as heavy back armor, soot-stained leather apron, massive bell-striker hammer.',
 'thornMatriarch': 'Female warden grafted into a huge briar body, old green-black armor embedded in thorny wooden limbs, branch crown, readable rooted feet.',
 'gildedKnight': 'Undead royal knight in weathered gilt plate with verdigris seams and frost, thin crowned helmet, long straight sword and heraldic shield.',
 'courtSurgeon': 'Ominous royal surgeon in layered stained ivory robes and leather surgical apron, beaked metal mask, delicate long cutting tool and thread spools; no explicit gore.',
 'stitchedHound': 'Gaunt hound assembled with visible coarse stitch seams, aged leather bands and bone reinforcement, cold muted gray fur, four legs, no exposed gore.',
 'courtMarionette': 'Unsettling slender jointed court puppet, cracked porcelain mask, stitched court clothes, articulated wooden hands and legs, no strings leading outside frame.',
 'livingArmor': 'Empty animated suit of aged royal armor, dark hollow helmet opening, oxidized steel with gilt trim and rime, sword raised slightly in watchful idle.',
 'courtDuelist': 'Elegant undead duelist, lean fitted tarnished steel armor over faded court doublet, narrow masked helmet, long rapier and short parrying dagger.',
 'stitchedKing': 'Grotesque regal king seated in a compact portable silhouette of the Stitched Throne, faded crown, elaborate weathered robes, many sewn spectral armored hands forming mantle and throne. Implied stitching, no graphic gore.',
 'mirrorScribe': 'Slender masked scribe wrapped in faded court robes and shards of silvered mirror, holding an open metal-bound ledger and long quill, cold reflected highlights.',
 'stitchCrab': 'Low broad crablike stitched construct of bone-colored plates, dark leather seams and surgical metal, two asymmetric pincers and articulated legs, all extremities visible.',
 'glassRegent': 'Regal female apparition formed from cracked smoky mirror glass and frozen silver, long sharp glass gown, delicate crown, empty reflected face.',
 'marrowOrganist': 'Tall gaunt organist in aged court vestments, bony fingers, compact organ-pipe framework rising from shoulders, carved bone mask, no surrounding organ room.',
 'ashRevenant': 'Human revenant reforming from charcoal and ash, crumbling black armor, ember core in chest, drifting ash contained tightly around body.',
 'emberStarvedPilgrim': 'Emaciated cloaked pilgrim, cracked ash-gray hands cupped around a dying ember, ragged dark robes, weary bowed posture, full feet visible.',
 'valkyrieShade': 'Armored spectral female warrior with ragged dark feather wings partly folded, spear pointed downward, pale bone light in helm, full wings contained.',
 'charredColossus': 'Enormous broad-shouldered humanoid golem of cracked black volcanic rock with bright orange magma seams, massive stone fists, heavy grounded legs; strongly resembles the reference giant.',
 'wyrmLord': 'Towering ancient draconic overlord, black scales, long horned head, muscular hindlegs, heavy folded wings and curling tail, volcanic ember between scales.',
 'blightedValkyrie': 'Majestic corrupted female valkyrie, weathered gilded armor, huge ragged wing silhouette, ember-blighted feather edges, long spear, dark torn mantle.',
 'cinderMantis': 'Predatory praying mantis of obsidian chitin with restrained orange seams, two long scythe forearms, four supporting legs, poised low, full antennae visible.',
 'eclipseCantor': 'Tall hooded ritual singer in blackened layered vestments, tarnished circular eclipse emblem held behind head as physical headdress, thin brass staff.',
 'furnaceSaint': 'Hollow saint in heavy burnt chapel robes and bronze ribbed armor, furnace-glow within chest, ritual halo made of old iron, arms lowered, solemn rather than heroic.',
 'hollowAstronomer': 'Ancient hunched Observatory scholar, hollow hooded face, ruined star-chart robes, brass astrolabe and a tall starstone staff, restrained cold blue light.',
 'ashheartDragon': 'Ancient four-legged dragon, huge obsidian scales and charred wings folded upward, long curled tail, orange ember heart visible between chest plates, every limb visible.',
}
base = ('Create ONE individual full-body idle combat sprite in the supplied reference style: highly detailed dark fantasy painted realism, tactile weathered metal, cloth and stone, muted charcoal/umber palette, restrained ember accents, neutral overcast light from upper left. Crisp readable silhouette. This is a game cutout, NOT a portrait, grid, collage or scene. Actual transparent alpha outside the body, including gaps between limbs. No colored backdrop, no glow halo outside the silhouette, no floor, no contact shadow, no text, no UI. Entire body and all equipment must fit with generous clear margins. Three-quarter side view. ')
entries=[]
for row in rows('outfits.csv'):
    if row['sharedSet']=='true': continue
    key=f"{row['classId']}-{row['id']}"
    palette=', '.join(f"{field} #{row[field]}" for field in ('plate','plateLt','leather','under'))
    entries.append(dict(id=key,name=f"{row['name']} · {row['classId'].title()}",family='armor',classId=row['classId'],outfitId=row['id'],source='content/source/outfits.csv',artAlias=row['artKey'] or None,facing='right',pose='idle',prompt=base+f"Subject: {classes[row['classId']]} Outfit: {row['name']}. Lore: {row['blurb']} Material palette: {palette}. Preserve this class identity and equipment. Face RIGHT toward enemies. Portrait 1024x1536, feet at 94 percent canvas height, center mass at 50 percent width."))
for act in (1,2,3):
    source=f'src/content/enemies/act{act}.js'
    text=(ROOT/source).read_text(encoding='utf-8')
    for match in re.finditer(r'''["']?\bid["']?:\s*["']([^"']+)["']''',text):
        key=match.group(1)
        if key not in enemy_designs: continue
        tail=text[match.end():]
        name=re.search(r'''["']?\bname["']?:\s*["']([^"']+)["']''',tail).group(1)
        size=re.search(r'''["']?\bsize["']?:\s*["']([^"']+)["']''',tail)
        entries.append(dict(id=key,name=name,family='enemy',act=act,size=size.group(1) if size else 'medium',source=source,facing='left',pose='idle',prompt=base+f"Subject: {enemy_designs[key]} Face LEFT toward the player. Use a canvas that contains the complete silhouette, wide 1536x1024 for broad beasts and winged figures, portrait 1024x1536 for upright figures. Lowest foot at 94 percent height; no clipped horns, wings, tails or weapons."))
extras={
 'hollowSquire':('Hollow Squire','companion','Hollow young squire in battered modest steel mail, ragged tabard and an oversized shield, sword lowered, timid but loyal stance.'),
 'emberHound':('Ember Hound','companion','Loyal alert hound of banked coals, charcoal fur with dim amber warmth beneath, ears raised, four paws firmly planted, gentle watchful stance.'),
 'theNameless':('The Nameless','speaker','Hooded anonymous Forsaken spirit, pale threadbare shroud over worn unmarked travel clothes, face lost in shadow, modest broken sword.'),
 'keeperOfTheNameless':('Keeper of the Nameless','speaker','Silent unmarked Forsaken traveler, ragged dark cloak, faceless weathered helm, broken sword held down, old cloth bindings and no insignia.'),
 'roadWarden':('The Road Warden','speaker','Weathered veteran road warden in practical old green-black mail and hooded cloak, lantern held low and a sturdy walking spear, calm guarded pose.'),
 'swordSaint':('The Sword Saint','speaker','Elderly master swordsman in austere layered weathered cloth and light steel guards, long worn sword held down, quiet controlled posture.'),
 'starReader':('The Star Reader','speaker','Elderly hooded star reader in faded midnight robes, aged brass astrolabe held close and rolled star chart, restrained blue starstone ornament.'),
}
for key,(name,family,desc) in extras.items():
    entries.append(dict(id=key,name=name,family=family,source='src/content/companions.js' if family=='companion' else 'content/source/speakers.csv',facing='right',pose='idle',prompt=base+f'Subject: {desc} Face RIGHT. Entire full body, portrait 1024x1536; use landscape for the hound. Feet at 94 percent canvas height.'))
assert len([e for e in entries if e['family']=='armor'])==19
assert len([e for e in entries if e['family']=='enemy'])==33
for e in entries:
    e['file']=f"masters/{e['id']}.png"
    e['status']='pending'
manifest=HERE/'catalog.json'
if manifest.exists():
    previous={e['id']:e for e in json.loads(manifest.read_text())['entries']}
    for e in entries:
        if e['id'] in previous: e.update({k:v for k,v in previous[e['id']].items() if k in ('status','generatedSource','validation')})
HERE.mkdir(parents=True,exist_ok=True)
(HERE/'masters').mkdir(exist_ok=True)
manifest.write_text(json.dumps(dict(schemaVersion=1,scope='Art-only idle sprite collection and layered scene preview. No runtime replacement.',sourceRevision='286bf975f',generator='built-in image_gen',entries=entries),indent=2),encoding='utf-8')
print(json.dumps({'entries':len(entries),'families':{f:sum(e['family']==f for e in entries) for f in ['armor','enemy','companion','speaker']}},indent=2))
