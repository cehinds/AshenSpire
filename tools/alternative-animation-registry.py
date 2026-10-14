"""Refresh explicit authoring coverage from normalized, class-specific families."""
import json
from pathlib import Path

def refresh():
    root=Path(__file__).resolve().parents[1]/'pose-studio/renewal'
    path=root/'manifest.json'
    manifest=json.loads(path.read_text(encoding='utf-8'))
    families={'reaver/sword':{'rig':'reaver-sword.rig.json','folder':''}}
    loadouts={x['id'] for x in manifest['loadouts']}
    for child in sorted(root.glob('*/manifest.json')):
        family=json.loads(child.read_text(encoding='utf-8'))
        actor,loadout=family['classId'],family['loadout']
        if actor not in manifest['classes'] or loadout not in loadouts:
            raise ValueError('Unknown authoring family: '+str(child))
        key=actor+'/'+loadout
        if key in families:raise ValueError('Duplicate family: '+key)
        folder=child.parent.name+'/'
        rig=folder+actor+'-'+loadout+'.rig.json'
        if not (root/rig).is_file():raise ValueError('Missing portable project: '+rig)
        families[key]={'manifest':folder+'manifest.json','rig':rig,'folder':folder}
    manifest['families']=families
    for row in manifest['coverage']:
        row['status']='draft' if row['classId']+'/'+row['loadout'] in families else 'pending'
    manifest['notes'][0]=f'{len(families)} reference families drafted; remaining combinations are pending and never substituted.'
    path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    return len(families)

if __name__=='__main__':print('Draft families:',refresh())
