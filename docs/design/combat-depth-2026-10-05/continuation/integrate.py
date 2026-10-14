from pathlib import Path
import json,copy
ROOT=Path(__file__).resolve().parent;PACK=ROOT.parent
c=json.loads((PACK/'catalog.json').read_text(encoding='utf-8'))
sc=json.loads((ROOT/'scene-catalog.json').read_text(encoding='utf-8'))
assert len(sc['scenes'])==32,'Finish all scenes before catalog integration'
report=json.loads((ROOT/'validation.json').read_text(encoding='utf-8'))
assert not report['issues'],'Asset validation must pass before integration'
for e in c['entries']:
    if e['family'] not in ('companion','speaker'):continue
    key='theNameless-padding' if e['id']=='theNameless' else e['id']
    r=json.loads((ROOT/'receipts'/f'{key}.json').read_text(encoding='utf-8'))
    e.setdefault('previousView',{k:copy.deepcopy(e[k]) for k in ('file','validation','facing','promptUsed') if k in e})
    reference=(ROOT/r['reference']).resolve().relative_to(PACK.resolve()).as_posix()
    e.update(file='continuation/'+r['resultFile'],facing='away, rear three-quarter right',status='generated',generatedSource=r['generatedSource'],promptUsed=r['prompt'],referenceImages=[reference])
    e['validation']={k:r[k] for k in ('size','mode','alphaRange','transparentFraction','visibleBounds','anchor','sha256')}
    e['validation']['alphaThreshold']=32
    (PACK/'receipts'/f"{e['id']}.json").write_text(json.dumps(e,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
c['sceneCatalog']='continuation/scene-catalog.json'
c['scenePreview']='continuation/index.html'
c['rearViewRevision']['companionAppearances']=2
c['rearViewRevision']['speakerAppearances']=5
c['artContinuation']=dict(date='2026-10-06',baseBranch='alternative/dev',sceneCount=32,compositions=64,retainedApprovedSprites=52,convertedSprites=7,validation='continuation/validation.json')
(PACK/'catalog.json').write_text(json.dumps(c,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
(PACK/'catalog-data.js').write_text('window.COMBAT_ART_CATALOG = '+json.dumps(c,ensure_ascii=False)+';\n',encoding='utf-8',newline='\n')
print('Integrated seven rear sprites and 32 scene references into art catalog only')
