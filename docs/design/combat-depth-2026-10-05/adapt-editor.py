from pathlib import Path
root=Path(__file__).resolve().parent
source=Path('D:/codex-artifacts/AshenSpire/battlefield-editor')
dest=root/'editor'
script=(source/'battlefield-wireframe-editor.js').read_text(encoding='utf-8')
script=script.replace('ashen-spire-wireframe-editor','ashen-spire-layered-art-editor')
script=script.replace("init();\n})();",(dest/'art-extension.js').read_text(encoding='utf-8')+"\ninit();\nstatus('Drag actors · Snap is on · Unlock scenery in Layers · Export JSON to share placement');\n})();")
assert 'BATTLEFIELD_ART_EDITOR' in script
(dest/'battlefield-wireframe-editor.js').write_text(script,encoding='utf-8')
html=(source/'battlefield-wireframe-editor.html').read_text(encoding='utf-8')
html=html.replace('</head>','<link rel="stylesheet" href="art-extension.css"></head>')
html=html.replace('<script src="battlefield-wireframe-editor.js">','<script src="../catalog-data.js"></script><script src="battlefield-wireframe-editor.js">')
html=html.replace('Battlefield Wireframe Editor','Layered Battlefield Editor')
(dest/'editor-legacy.html').write_text(html,encoding='utf-8')
print('Adapted existing battlefield editor with art layers, IDs, depth and original HUD overlay.')
