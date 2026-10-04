"""Offline component catalog. Embedded metadata avoids file:// fetch restrictions."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent

def run():
    manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    recipes=json.loads((ROOT/'screen-recipes.json').read_text(encoding='utf-8'))['recipes']
    payload=json.dumps({'assets':manifest['assets'],'recipes':recipes}).replace('</','<\\/')
    template=(ROOT/'gallery-template.html').read_text(encoding='utf-8')
    (ROOT/'index.html').write_text(template.replace('__COLLECTION_DATA__',payload),encoding='utf-8',newline='\n')
    print('Catalog:',len(manifest['assets']),'assets;',len(recipes),'screen recipes')

if __name__=='__main__':run()
