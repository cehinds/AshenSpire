from pathlib import Path
import json,shutil,subprocess
from PIL import Image
root=Path(__file__).resolve().parent
repo=root.parents[2]
out=root/'library';out.mkdir(exist_ok=True)
items=[]
# Use the same pinned light art source as the game and CI. Git checkouts no
# longer necessarily carry assets-mobile/ after the art-pack migration.
artroot=Path(subprocess.check_output(['node','--input-type=module','-e',
 "import {artDir} from './tools/art-source.mjs'; console.log(artDir('assets-mobile').dir)"],cwd=repo,text=True).strip())
for group in ['bg','environments','map']:
 for p in sorted((artroot/group).rglob('*')):
  if p.suffix.lower() not in ['.png','.jpg','.jpeg','.webp','.svg']:continue
  rel=p.relative_to(artroot)
  dest=out/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
  size=list(Image.open(p).size) if p.suffix!='.svg' else [1600,1000]
  items.append(dict(id=rel.as_posix(),name=p.stem.replace('-',' ').replace('_',' '),category='Floor' if 'floor' in p.stem else 'Map' if group=='map' or '-map' in p.stem else 'Background',file='../library/'+rel.as_posix(),size=size))
for id,name in [('far','Distant sky and castle'),('ruins','Ruins and arch'),('ground','Ground plane'),('foreground','Near trees and lantern')]:
 items.insert(0,dict(id='layer:'+id,name=name,category='Scene layer',file='../layers/'+id+'.png',size=list(Image.open(root/'layers'/f'{id}.png').size)))
(root/'editor/library-data.js').write_text('window.BATTLEFIELD_LIBRARY = '+json.dumps(items)+';\n',encoding='utf-8')
print(f'{len(items)} local map/background components indexed and copied.')
