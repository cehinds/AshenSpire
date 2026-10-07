"""Rebuild this class study through the shared export pipeline."""
from alternative_animation_family import build_family

SHEETS = {'attack': ('attack.png', 0.72, [('ready', (0, 0, 512, 516), 285, 508), ('windup', (512, 0, 1024, 516), 805, 508), ('advance', (1024, 0, 1536, 516), 1300, 508), ('contact', (0, 516, 550, 1024), 290, 996), ('follow', (550, 516, 1024, 1024), 800, 996), ('return', (1024, 516, 1536, 1024), 1300, 996)]), 'reactions': ('reactions.png', 0.55, [('hurt', (0, 0, 724, 724), 420, 655), ('hurt-recover', (724, 0, 1448, 724), 1095, 655), ('down', (1448, 0, 2172, 724), 1788, 660)]), 'casts': ('casts.png', 0.52, [('power', (4, 0, 716, 724), 400, 695), ('channel', (750, 0, 1430, 724), 1110, 695), ('release', (1460, 0, 2172, 724), 1830, 695)])}

build_family('rogue', 'twinDaggers', 'Twin-dagger attack', SHEETS, notes=['Daggers are sheathed for casting; sheath/draw transition remains pending.', 'Flattened poses, with separate runtime effects.', 'Attack contact and follow-through cloak edges need final review before gameplay binding.'], effect='slash', rig_label='twin daggers')
