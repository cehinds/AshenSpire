from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
# Coordinates are percentages of the original uncropped 1536x1024 painting.
def nodes(prefix, rows):
    result=[]
    for i,row in enumerate(rows.strip().splitlines(),1):
        x,y,kind,name,speaker,lore,reply=row.split('|')
        result.append(dict(id=f'{prefix}-{i:02}',number=i,x=float(x),y=float(y),kind=kind,name=name,speaker=speaker,lore=lore,reply=reply))
    return result

briar=nodes('BS','''36|83|entrance|Gate of Unkept Names|You|Every name on this gate has been scratched out from within.|Beneath the cuts, one command survives: Remember us without waking us.
40|65|observation|Rootbound Fork|You|The paving divides around a root older than the wall. Both tracks carry fresh mud.|The western road serves the graves. The eastern road follows the water toward the sanctum.
33|55|encounter|Pilgrims' Hollow|Briar Hermit|Do not pull the thorns from your cloak. They are how she counts who leaves.|The hermit remembers a gardener who asked the roots to hold the dying until spring.
31|45|observation|Broken Processional|You|The stones are worn at the knees, not the feet.|The faithful crawled this road carrying water in their hands.
23|35|fight|Moss Stair|You|Something beneath the moss breathes against the stair. A blight hound lifts its head.|Its collar bears the same flower carved on the sanctuary door.
18|29|shrine|Chapel of Small Mercies|You|A gold cup stands beneath a roof that fell generations ago. It is still full.|Rain gathers here even beneath clear skies. Someone kept one small promise.
12|23|observation|Widow's Recess|You|A child's wooden shoe rests beside an adult's stone effigy.|The inscription leaves space for a second name that was never added.
22|21|dialogue|The Last Grave Tender|Grave Tender|I leave one grave open. If I fill it, I have to admit whom it was for.|The tender says the Matriarch buried her own name before giving the roots her voice.
26|15|cache|Seed Reliquary|You|The reliquary holds seeds wrapped in burial cloth, each labeled with a season.|None is marked spring. The sanctum has been waiting longer than its gardeners lived.
25|9|observation|Abandoned Watch Chapel|You|A narrow window faces away from the forest and toward the great tree.|The watchers feared what their sanctuary might become, not what might enter it.
40|39|encounter|Bridge of Bound Vows|Oathbound Watcher|State whom you have come to mourn. A blade is not an answer.|Those who cannot name their dead are made to carry the watcher's grief instead.
45|68|observation|Waterward Fork|You|A second road leaves the gate beside a channel cut into the rock.|The channel once carried offerings downstream. Now the roots drink before the river can.
54|59|dialogue|Thorn Scribe|Thorn Scribe|I write the names she forgets. The bark heals faster each year.|The scribe shows you a fresh name: their own. They do not remember writing it.
63|52|fight|Lower Stone Bridge|You|A blight hound waits where the bridge narrows, its muzzle tangled in prayer cords.|The cords were tied to keep a beloved animal from straying. They held too well.
69|47|observation|Candleless Landing|You|Wax fills every crack in the landing, but no wick remains.|The mourners stopped lighting candles when the roots began reaching toward the flame.
77|43|shrine|East Chapel Steps|You|A kneeling statue holds a bowl toward the waterfall.|The bowl is dry. Its underside is engraved: Give without being seen.
88|42|dialogue|Keeper of the Empty Bowl|Chapel Keeper|She took our hunger first. We thanked her. Then she took what we hungered for.|The keeper asks you to remember the taste of bread aloud. For a moment, they smile.
88|57|cache|Waterfall Oratory|You|A leather satchel hangs above the spray, protected by a curtain of thorns.|Inside lies a farewell never delivered: I will wait at the lower bridge until dawn.
83|34|encounter|The Listening Hedge|Rootbound Pilgrim|Speak softly. The leaves repeat whatever they hear to Mother.|The pilgrim will let a quiet traveler pass, but a drawn weapon makes every branch turn.
80|26|observation|Pilgrim's Turn|You|Footprints circle a single root before joining the upper path.|Every pilgrim paused here. The root is polished like a handrail.
77|16|observation|Rear Watch Ruin|You|A fallen bell lies stuffed with moss, its clapper deliberately removed.|The watch chose silence on the night the tree first answered a prayer.
64|35|dialogue|The Unnamed Gardener|Unnamed Gardener|She is not guarding the dead from you. She is guarding them from the morning.|The gardener remembers the Matriarch's first wish: let no one under my care be lost.
55|31|gate|Sanctum Stair|You|Every root points inward. The stair rises into a silence that feels held shut.|Beyond these steps, the Thorn Matriarch keeps the promise that ruined this place.
55|22|boss|Heart of Briar Sanctum|Thorn Matriarch|I kept them. Every one. Would you have me call that a sin?|Defeat loosens the roots without erasing the graves. The dungeon is cleared; its memories remain.''')

mirrors=nodes('HM','''18|80|entrance|Gate of Second Faces|You|Your reflection reaches the gate a moment before you do.|Two roads circle the tarn: the garden path to the west and the high causeway to the east.
18|67|observation|Winter Garden Fork|You|The snow is broken by footsteps that never seem to leave.|Most turn toward the glasshouse. One set walks backward toward the palace.
14|56|encounter|The Unreflected Porter|Palace Porter|Leave your reflection with me. Guests must not bring strangers into court.|The porter carries receipts for shadows, smiles, and the right to be remembered.
17|45|shrine|Fountain of Still Water|You|The fountain is frozen around a falling drop.|The plaque promises a moment without sorrow. It never says the moment will end.
18|34|dialogue|Gardener of Glass|Winter Gardener|The Regent wanted flowers that could not die. Glass was only the first attempt.|The gardener kept one seed beneath their tongue through every winter of the court.
11|27|cache|Shattered Conservatory|You|The collapsed glasshouse shelters a box of ordinary earth.|Its label reads: For when Her Grace tires of perfection.
19|23|observation|Glasshouse Crossing|You|Glass ribs make a cage around an empty planting bed.|There are no roots. These flowers were installed, not grown.
28|29|fight|Statue Walk|You|A porcelain sentry turns its face to match yours.|Its weapon is real, though its hands are only reflected in the snow.
36|31|observation|The White Landing|You|The same farewell is carved into every step in a different hand.|Each courtier thought they were the first to ask permission to leave.
46|29|encounter|Bridge of Courtesy|Mirror Usher|Bow to the image, never the guest. Images do not change their loyalties.|The usher admits the Regent has not crossed this bridge since the first mirror cracked.
58|25|dialogue|The Thawing Witness|Court Witness|I saw the original die. Every morning since, another reflection has denied it.|The witness cannot tell you which death they mean. Their testimony changes with the light.
33|75|observation|Causeway Fork|You|The other road crosses dark water on broad stone arches.|The balustrade is warmer than the air, as if another season waits inside the stone.
45|71|fight|The Tarn Span|You|A glass-armored sentinel drags its spear along the bridge rail.|Each scratch in the rail matches a scar visible beneath its transparent armor.
57|65|observation|Listening Balustrade|You|Voices rise through the arches, repeating a conversation you have not had.|One voice sounds like yours. It says that you should have taken the garden road.
67|63|dialogue|The Ferry Without Oars|Stranded Ferryman|Before the ice, I carried people across. Now I ferry apologies. Neither ever returns.|The ferryman points to a palace window where a lantern answers only at noon.
80|61|cache|Icebound Tollhouse|You|A brass box contains toll coins polished perfectly blank.|The Regent would permit no other sovereign's face within sight of the palace.
87|52|encounter|Rime Watch|Rime Warden|Show me the face you wore when you entered. No substitutions.|The warden remembers every visitor and no departure. A respectful answer can delay its suspicion.
85|42|observation|Eastern Stair|You|Frost has formed on the underside of the steps, against the wind.|The cold comes from the hall, not from the mountains.
88|31|shrine|The Unsilvered Niche|You|One mirror has had its silver scraped away, leaving a view of bare stone.|Someone chose the wall over the face the court demanded.
82|26|dialogue|The Seamstress of Faces|Court Seamstress|A face is easier to mend when its owner stops moving.|She remembers sewing mourning veils until the Regent outlawed the suggestion of loss.
76|32|fight|Court of Repeated Steps|You|Two sentries move as one. Only one leaves tracks.|The tracks stop before each mirror and begin again on the other side.
71|26|observation|Blackwater Basin|You|The basin reflects an intact palace under a summer sky.|A figure at its window closes the curtain when you lean closer.
70|19|gate|Threshold of True Silver|You|Your reflection remains at the threshold after you step away.|It mouths a warning: do not let her choose which of you leaves.
73|12|boss|Hall of Mirrors|Glass Regent|I have perfected this court. It is the world outside that refuses correction.|Victory cracks the false summer in every mirror. The dungeon clears as the tarn begins to thaw.''')

furnace=nodes('FC','''75|85|entrance|Gate of Banked Coals|You|The gate is warm enough to hurt through a glove. No fire burns nearby.|A pilgrim stair climbs directly toward the chapel; a works road loops through the lower kilns.
67|75|observation|The Ashen Divide|You|Two sets of footprints separate: bare feet uphill, iron boots toward the works.|Pilgrims and furnace workers shared a gate, but not a destination.
58|66|encounter|The Coal Tally|Chain Scavenger|Nothing enters empty-handed. What will you give the flame?|The tally board counts workers by weight, beside the coal and the ore.
49|65|observation|Kiln Approach|You|Ash has settled into the shape of tools that were taken away long ago.|Every tool faced the chapel when the workers laid it down.
39|66|dialogue|The Last Stoker|Old Stoker|We thought the heat was a blessing. Then the saint stopped asking for fuel.|The old stoker remembers the first night the furnace burned on a prayer alone.
30|61|cache|Cold Coal Shed|You|A sealed lunch tin sits between heaps of coal that never caught.|Inside, a note asks its reader to be home before the evening bell.
20|55|fight|Quenching Yard|You|A cinder mantis unfolds from a slag heap, its legs ringing against the stone.|It has nested in a quenching trough dry since the water was diverted to the chapel.
18|46|shrine|Worker's Niche|You|A small iron hand protects a candle from the furnace wind.|Its inscription offers no miracle, only a safe return after work.
27|40|dialogue|The Soot Confessor|Soot Confessor|They confessed exhaustion. I called it doubt. I would like that written down.|The confessor has kept every worker's name on strips of unburned cloth.
37|34|observation|The Red Stair|You|The stair is swept clean while the surrounding terraces lie deep in ash.|Someone still prepares this approach for a congregation that cannot come.
43|32|observation|Brazier of Petition|You|The great brazier is cold. Its rim has melted inward.|The offerings stopped here when the furnace learned to call the petitioners by name.
76|73|observation|Pilgrims' Stair|You|The direct stair climbs above a fissure glowing beneath the paving.|The handrail bears thousands of fingerprints baked into old soot.
69|63|fight|Procession Landing|You|An ember-starved pilgrim blocks the stair, guarding a coal in cupped hands.|The coal is cold. The pilgrim has not noticed.
61|55|dialogue|Bearer of the Last Coal|Coal Bearer|If it goes out, she said we all go out. Help me remember who she meant.|The bearer remembers children warming their hands at the chapel before the doors were chained.
55|47|observation|Reliquary Steps|You|Empty reliquary sockets line the stair like missing teeth.|Each held a saint's bone until the furnace demanded a warmer offering.
76|48|encounter|Iron Viaduct|Bridge Warden|The upper works are closed. The order is old; my oath is older.|The warden will hear a worker's grievance. A threat turns its chain across the bridge.
87|38|observation|Eastern Abutment|You|The iron supports sing at a pitch too low to hear clearly.|The bridge was tuned to the chapel's hymn so the workers could pray without stopping.
87|28|cache|The Weigh House|You|A balance hangs level with a prayer tablet on one pan and a tooth on the other.|Its ledger assigns the same value to both: one more hour of heat.
76|23|dialogue|Foreman Without a Shift|Ash Foreman|No one dismissed us. Until someone does, the shift is not over.|The foreman asks for the workers' names to be spoken outside the reach of the furnace.
64|29|fight|High Works Crossing|You|A cinder mantis has woven hot wire across the old service path.|The wire was once part of the alarm system. No one answered its last ringing.
54|34|observation|The Joining Road|You|The works road and pilgrim stair meet before the chapel terrace.|Here the ash erases the difference between bare feet and iron boots.
36|28|shrine|Chapel Forecourt|You|Gold trim blackens above a row of names struck from the list of saints.|The scratched names belong to those who told the congregation to leave.
30|25|gate|Furnace Threshold|You|Heat presses against you like a held breath. The chains are fastened from within.|The Furnace Saint has mistaken endurance for devotion. The door opens when you stop kneeling.
27|19|boss|Furnace Chapel|Furnace Saint|You call it suffering because you have not yet learned to burn clean.|Victory banks the sacred furnace. Volcanic haze settles, the workers' shift ends, and the dungeon clears.''')

def chain(seq): return list(zip(seq,seq[1:]))
def make(aid,name,prefix,theme,boss,ns,edges,lanes,waypoints):
    es=[]
    for a,b in edges:
        es.append(dict(a=f'{prefix}-{a:02}',b=f'{prefix}-{b:02}',via=waypoints.get(f'{a}-{b}',[])))
    return dict(id=prefix,assetId=aid,name=name,theme=theme,boss=boss,nodes=ns,edges=es,lanes=lanes,entrance=f'{prefix}-01',bossNode=f'{prefix}-24')

data=dict(version=1,status='Review prototype; proposed lore and mechanics, not runtime content',flee=dict(base=40,dexBaseline=10,bonusPerPoint=3,min=10,max=85,failure='Starts encounter',success='Retreat to previous node; encounter stays unresolved'),dungeons=[
make('MAP-01-briar-sanctum','Briar Sanctum','BS','olive','Thorn Matriarch',briar,chain([1,2,3,4,5,6,7])+chain([6,8,9,10])+chain([4,11,22,23,24])+chain([1,12,13,14,15,16,17,18])+chain([16,19,20,21])+[(20,22),(15,22),(2,12)],['Grave Road','Waterward Road'],{'1-2':[[36,76],[36,71]],'1-12':[[39,79],[42,73]],'2-3':[[37,62]],'4-5':[[28,40]],'4-11':[[34,42]],'11-22':[[48,36],[57,35]],'16-19':[[80,40]],'20-22':[[75,30],[69,34]],'15-22':[[68,41]],'2-12':[[42,66]]}),
make('MAP-02-hall-of-mirrors','Hall of Mirrors','HM','indigo','Glass Regent',mirrors,chain([1,2,3,4,5,6,7,8,9,10,11,22,23,24])+chain([1,12,13,14,15,16,17,18,19,20,21,22])+[(5,8)],['Winter Garden','Tarn Causeway'],{'1-2':[[17,74]],'4-5':[[15,40]],'5-6':[[14,31]],'7-8':[[24,24]],'11-22':[[63,22],[68,23]],'1-12':[[24,80],[28,77]],'15-16':[[75,64]],'16-17':[[84,57]],'18-19':[[85,36]],'20-21':[[80,29]],'5-8':[[23,32]]}),
make('MAP-03-furnace-chapel','Furnace Chapel','FC','ember','Furnace Saint',furnace,chain([1,2,3,4,5,6,7,8,9,10,11,22,23,24])+chain([1,12,13,14,15,21,11])+chain([13,16,17,18,19,20,21]),['Lower Works','Pilgrim Stair'],{'1-2':[[71,81]],'2-3':[[63,72]],'6-7':[[24,59]],'8-9':[[22,43]],'9-10':[[32,36]],'11-22':[[40,30]],'1-12':[[77,80]],'12-13':[[73,68]],'15-21':[[54,41]],'13-16':[[72,57],[77,54]],'16-17':[[81,44]],'18-19':[[83,25]],'19-20':[[70,26]]})])

# Road-alignment corrections from full-size browser review. Routes are traced
# along bridge decks and stairs, never as direct graph chords across terrain.
positions={
 'BS':{1:(36,72),2:(32,64),3:(29,56),4:(33,45),5:(27,38),6:(20,31),7:(12,25),8:(23,24),9:(26,17),10:(25,10),11:(42,39),12:(46,66),13:(55,62),14:(67,54),15:(77,47),16:(81,43),17:(89,40),18:(91,56),19:(84,32),20:(81,25),21:(80,14),22:(65,34),23:(55,32),24:(55,24)},
 'HM':{2:(17,68),3:(14,56),4:(18,44),5:(18,35),6:(12,27),7:(20,24),8:(28,33),9:(36,42),10:(46,37),11:(58,31),12:(31,81),13:(44,81),14:(55,75),15:(66,72),16:(77,67),17:(87,58),18:(91,45),19:(88,34),20:(83,25),21:(73,30),22:(71,20),23:(70,16)},
 'FC':{1:(74,76),2:(66,74),3:(55,76),4:(44,74),5:(33,70),6:(23,65),7:(16,57),8:(15,47),9:(26,40),10:(35,35),11:(44,39),12:(71,68),13:(64,61),14:(57,54),15:(50,47),16:(79,37),17:(89,41),18:(90,28),19:(81,20),20:(69,25),21:(60,30),22:(36,28),23:(30,26),24:(27,20)}
}
bends={
 'BS':{'1-2':[[35,69],[34,67]],'1-12':[[39,68],[42,67]],'2-3':[[30,61]],'3-4':[[30,52],[32,49]],'4-5':[[32,42],[29,40]],'5-6':[[24,35]],'6-7':[[16,29]],'6-8':[[22,28]],'8-9':[[25,22]],'9-10':[[27,14]],'4-11':[[35,42],[38,41]],'11-22':[[48,36],[55,35],[61,36]],'12-13':[[50,65]],'13-14':[[61,59],[64,57]],'14-15':[[70,51],[74,49]],'15-16':[[79,46]],'16-17':[[85,43],[88,43]],'17-18':[[87,43],[85,47],[87,52]],'16-19':[[80,39],[82,36]],'19-20':[[83,29]],'20-21':[[81,20],[79,17]],'20-22':[[78,29],[73,33],[69,35]],'15-22':[[74,44],[70,41],[67,37]],'2-12':[[38,65],[42,66]],'22-23':[[61,34],[58,34]]},
 'HM':{'1-2':[[17,76],[16,72]],'2-3':[[15,64]],'3-4':[[15,52],[17,48]],'4-5':[[17,40]],'5-6':[[15,32]],'6-7':[[16,26]],'7-8':[[24,27],[27,30]],'8-9':[[31,37],[34,40]],'9-10':[[40,40]],'10-11':[[52,34]],'11-22':[[62,27],[65,25],[68,24]],'1-12':[[23,81],[27,80]],'12-13':[[36,84],[39,84]],'13-14':[[48,78],[51,77]],'14-15':[[60,74]],'15-16':[[71,70],[74,70]],'16-17':[[82,65],[85,62]],'17-18':[[89,54],[91,50]],'18-19':[[90,40]],'19-20':[[86,29]],'20-21':[[79,28],[76,29]],'21-22':[[73,25]],'5-8':[[22,34],[25,34]]},
 'FC':{'1-2':[[71,74],[69,74]],'2-3':[[61,77],[58,77]],'3-4':[[49,76]],'4-5':[[39,73]],'5-6':[[28,68]],'6-7':[[19,62],[17,60]],'7-8':[[14,54],[14,50]],'8-9':[[18,43],[22,41]],'9-10':[[30,37]],'10-11':[[39,35],[42,37]],'11-22':[[42,33],[40,31]],'1-12':[[74,72]],'12-13':[[68,65]],'13-14':[[60,57]],'14-15':[[53,50]],'15-21':[[49,43],[48,36],[53,32]],'21-11':[[53,33],[48,35]],'13-16':[[72,62],[78,60],[84,55],[88,48],[89,42],[85,40]],'16-17':[[84,39]],'17-18':[[90,36],[91,32]],'18-19':[[87,24],[84,22]],'19-20':[[75,21],[72,23]],'20-21':[[65,27]],'22-23':[[33,27]]}
}
for d in data['dungeons']:
    if d['id']=='FC':
        d['edges']=[e for e in d['edges'] if not (e['a']=='FC-13' and e['b']=='FC-16')]
        d['edges'].append(dict(a='FC-21',b='FC-16',via=[]))
        bends['FC']['21-16']=[[64,33],[70,35],[74,36]]
    for n in d['nodes']:
        if n['number'] in positions[d['id']]: n['x'],n['y']=positions[d['id']][n['number']]
    for e in d['edges']:
        key=f"{int(e['a'].split('-')[1])}-{int(e['b'].split('-')[1])}"
        e['via']=bends[d['id']].get(key,[])
    assert len(d['nodes'])==24
    ids={n['id'] for n in d['nodes']}; seen={d['entrance']}
    for _ in ids:
        for e in d['edges']:
            assert e['a'] in ids and e['b'] in ids
            if e['a'] in seen or e['b'] in seen: seen.update([e['a'],e['b']])
    assert seen==ids, d['id']
    assert sum(d['entrance'] in (e['a'],e['b']) for e in d['edges'])==2
    assert sum(d['bossNode'] in (e['a'],e['b']) for e in d['edges'])==1
    assert all(n['lore'] and n['reply'] for n in d['nodes'])
(ROOT/'dungeons.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
(ROOT/'dungeons.js').write_text('window.DUNGEONS = '+json.dumps(data,ensure_ascii=False)+';',encoding='utf-8')
lines=['# Legacy dungeons — narrative and route design','', 'Proposed lore for review; not yet integrated into the game. Defeating the boss clears the dungeon. Exploration of unfinished locations remains possible afterward.','', 'Each dungeon has 24 nodes and two entrance lanes, with side rooms and connecting roads. Coordinates and traced road bends are stored in dungeons.json. Node IDs remain stable during revisions.','', '## Escape rule (draft)', '', 'Chance = clamp(40 + 3 × (Dexterity − 10), 10, 85) percent. Roll 1–100; at or below chance succeeds. Dexterity 14 gives 52%. Success returns to the previous location without resolving the encounter; failure starts combat. Bosses allow withdrawal before commitment, but no escape roll once engaged.','', '## Dialogue behavior','', 'Observations, shrines, and caches use the same dialogue panel as conversations. Read/listen reveals a second lore beat. Dialogue nodes resolve peacefully. Encounter nodes offer peaceful listening, an optional challenge, or escape. Fight nodes offer combat or escape. Prototype victories and defeats are explicitly simulated; no combat balance, loot, or healing values are implied.','']
for d in data['dungeons']:
    lines += [f"## {d['name']}", '', f"Routes: {' / '.join(d['lanes'])}. Boss: {d['boss']}. Fog: "+{'olive':'olive woodland mist with pollen tones.','indigo':'cold indigo mist with pale frost tones.','ember':'charcoal volcanic haze with ember tones.'}[d['theme']], '']
    for n in d['nodes']:
        lines += [f"### {n['id']} — {n['name']} ({n['kind']})",'',f"**{n['speaker']}:** {n['lore']}",'',f"**Further lore:** {n['reply']}",'']
(ROOT/'LORE-AND-DESIGN.md').write_text('\n'.join(lines),encoding='utf-8')
print('Validated 72 unique lore nodes, connected routes, two entrance lanes and one boss gate per dungeon.')
