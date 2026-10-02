"""Deterministic authoring source for AshenSpire's scalable concept asset kit."""
from pathlib import Path
from html import escape
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
FILES = []
PALETTE = {
    "soot": "#0d0b08", "raised": "#171310", "panel": "#241d15",
    "brass": "#c9a227", "brassWorn": "#a58a52", "brassEdge": "#7a6b54",
    "ivory": "#e8dcc0", "muted": "#8e826a", "hp": "#a43c35",
    "mana": "#7fa8c9", "stamina": "#7fd97f", "danger": "#e08585",
    "bleed": "#e46a44", "blight": "#b5541c", "insanity": "#a06bd0",
}

def write_svg(name, group, w, h, body, description, *, slice=None, color="#c9a227", slots=None):
    directory = ROOT / group
    directory.mkdir(exist_ok=True)
    ident = name.replace("_", "-")
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none" color="{color}" role="img" aria-labelledby="{ident}-title"><title id="{ident}-title">{escape(description)}</title>{body}</svg>'''
    ET.fromstring(svg)
    relative = f"{group}/{name}.svg"
    (ROOT / relative).write_text(svg + "\n", encoding="utf-8",newline="\n")
    record = {"id": name, "file": relative, "kind": group, "width": w, "height": h,
              "description": description, "transparentOutside": True}
    if slice: record["nineSliceInsets"] = slice
    if slots: record["slots"] = slots
    FILES.append(record)

ICONS = {
    "health": '<path d="M12 20 3.9 12.1C-1 6.6 5.4 1.1 12 6.1 18.6 1.1 25 6.6 20.1 12.1Z"/><path d="m7 9 2 2"/>',
    "mana": '<path d="M12 2c-1.7 3.7-7 8.4-7 12a7 7 0 0 0 14 0c0-3.6-5.3-8.3-7-12Z"/><path d="M8 13c-1 3 1 5 3 5"/>',
    "stamina": '<path d="M9 3h7l-1 9 5 3v5H4v-4l4-4Z"/><path d="M4 17h16M9 6h6M9 9h6"/>',
    "actions": '<path d="M13 2 5 13h6l-1 9 9-12h-6Z"/>',
    "block": '<path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5Z"/><path d="M12 5v13M7 9h10"/>',
    "poise": '<path d="m12 3 7 4v6l-7 8-7-8V7Z"/><path d="M8 9h8M8 13h8M12 6v11"/>',
    "attack": '<path d="m5 3 11 10-3 3L3 5Zm14 0L8 13l3 3L21 5ZM11 16l-4 4m10-4 4 4M4 17l6 6M14 19l5-5"/>',
    "skill": '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/><path d="M12 7v10M7 12h10"/>',
    "deck": '<path d="m3 7 3-3 10 2 2 15-11 1Zm4-3 2-2 10 1 2 17M9 8l5 8M9 16l5-8"/>',
    "draw": '<rect x="4" y="7" width="13" height="15" rx="1"/><path d="M7 4h13v15M10 11v7m-3-3 3 3 3-3"/>',
    "discard": '<rect x="3" y="3" width="12" height="15" rx="1"/><path d="M18 8h3v13H9v-2M6 8h6M6 12h6M17 11v6m-2-2 2 2 2-2"/>',
    "cinders": '<path d="M13 2c1 5-4 6-3 10 2-1 3-3 4-5 2 3 6 5 5 9a7 7 0 0 1-14 0c-1-4 3-7 4-10 0 3 1 4 2 4 0-3 1-5 2-8Z"/><path d="m12 14-2 4 2 3 2-3Z"/>',
    "flask-health": '<path d="M9 2h6v4l-1 2c0 2 5 5 5 9 0 3-2 5-7 5s-7-2-7-5c0-4 5-7 5-9L9 6ZM8 4h8M7 15h10"/><path d="M12 11v7m-2-4h4"/>',
    "flask-mana": '<path d="M9 2h6v4l-1 2c0 2 5 5 5 9 0 3-2 5-7 5s-7-2-7-5c0-4 5-7 5-9L9 6ZM8 4h8M7 16h10"/><path d="M12 10c-1 2-3 3-3 5a3 3 0 0 0 6 0c0-2-2-3-3-5Z"/>',
    "relic": '<path d="m12 2 4 7-4 5-4-5Zm-4 9L3 21l6-3 3 4 3-4 6 3-5-10M12 14v8"/><path d="m12 6 1 3-1 2-1-2Z"/>',
    "equipment": '<path d="m8 3 4 2 4-2 5 5-4 3v10H7V11L3 8ZM9 4l3 5 3-5M8 15h8M8 18h8"/>',
    "sword": '<path d="m18 2 4 0v4L9 19l-4-4ZM4 14l6 6M6 18l-4 4M2 19l3 3M9 15 20 4"/>',
    "shield": '<path d="m12 2 9 3-1 9-8 8-8-8-1-9ZM7 7l5-2 5 2-1 6-4 5-4-5ZM12 5v13"/>',
    "armour": '<path d="m8 3 4 2 4-2 4 4-3 4 2 9-7 2-7-2 2-9-3-4ZM12 5v15M7 11h10M6 17h12"/>',
    "inventory": '<path d="M8 4a4 4 0 0 1 8 0v2M5 6h14v15H5ZM5 10h14M8 6v4M16 6v4M10 15h4"/>',
    "weight": '<path d="M9 6a3 3 0 1 1 6 0M7 7h10l4 14H3ZM9 11h6M10 15h4"/>',
    "link": '<path d="m9 15 6-6M8 12l-3 3a4 4 0 0 0 6 6l3-3M16 12l3-3a4 4 0 0 0-6-6l-3 3"/>',
    "compare": '<path d="M3 5h7v14H3ZM14 5h7v14h-7ZM6 9h1M6 13h1M17 9h1M17 13h1M10 12h4m-2-2 2 2-2 2"/>',
    "journey": '<path d="M4 21 10 4l3 6 4-8 4 19ZM8 10l3 2M15 7l3 3M3 21h19"/>',
    "world": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 6-5 12 0 18 5-6 5-12 0-18ZM5 7h14M5 17h14"/>',
    "map": '<path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3ZM8 2v17M16 5v17M10 8l4 7"/>',
    "location": '<path d="M19 9c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2.5"/>',
    "combat": '<path d="M12 2 19 6l2 9-5 7H8l-5-7 2-9ZM8 9l8 7M16 9l-8 7M7 16l3 3M14 19l3-3"/>',
    "boss": '<path d="m3 6 5 4 4-7 4 7 5-4-2 11H5ZM6 21h12M8 14h8"/>',
    "merchant": '<path d="M3 9h18L19 3H5ZM4 9v12h16V9M2 9c0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0M9 14h6v7"/>',
    "smith": '<path d="M3 11h18l-5 5H8ZM7 16v4H5v2h14v-2h-2v-4M12 2l7 5-2 3-7-5ZM12 7l-5 7"/>',
    "rest": '<path d="M13 3c0 4-5 5-3 9 1-1 2-3 3-4 3 4 5 5 4 8a5 5 0 0 1-10-1c0-3 2-5 3-8M4 21l16-4M4 17l16 4"/>',
    "reward": '<path d="M3 10h18v11H3ZM2 7h20v3H2ZM12 7v14M12 7C1 8 6-3 12 7c6-10 11 1 0 0Z"/>',
    "quest": '<path d="M6 2h14v17H6l-3 3V5h3M9 7h8M9 11h8M9 15h4"/>',
    "dialogue": '<path d="M3 3h18v14H9l-6 5ZM7 7h10M7 11h7"/>',
    "progression": '<circle cx="12" cy="4" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="12" cy="13" r="2"/><path d="M12 6v5M10 14l-4 3M14 14l4 3"/>',
    "compendium": '<path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1ZM12 5v15M5 7h3M5 11h3M16 7h3M16 11h3"/>',
    "coop": '<circle cx="8" cy="6" r="3"/><circle cx="18" cy="7" r="2.5"/><path d="M2 20v-4c0-6 12-6 12 0v4ZM16 12c4-1 6 1 6 4v4h-5"/>',
    "connected": '<path d="M3 9c6-5 12-5 18 0M6 13c4-3 8-3 12 0M9 17c2-1.5 4-1.5 6 0"/><circle cx="12" cy="21" r="1" fill="currentColor" stroke="none"/>',
    "disconnected": '<path d="M3 9c4-4 9-5 14-2M6 13c2-2 5-3 8-2M9 17c2-1.5 4-1.5 6 0M3 3l18 18"/><circle cx="12" cy="21" r="1" fill="currentColor" stroke="none"/>',
    "history": '<path d="M3 9a9 9 0 1 1 1 9M3 3v6h6M12 7v6l4 2"/>',
    "save": '<path d="M3 2h15l3 4v16H3ZM7 2v7h10V2M7 22v-9h10v9M14 4v3"/>',
    "profile": '<circle cx="12" cy="7" r="4"/><path d="M3 22v-3c0-9 18-9 18 0v3M7 19h10"/>',
    "settings": '<path d="m10 2 4 0 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1Z"/><circle cx="12" cy="12" r="3"/>',
    "display": '<rect x="2" y="3" width="20" height="14" rx="1"/><path d="M12 17v4M7 21h10M5 6h14"/>',
    "audio": '<path d="M3 9h4l5-5v16l-5-5H3ZM16 8c3 2 3 6 0 8M19 4c6 5 6 11 0 16"/>',
    "controls": '<path d="M7 6h10c4 0 7 12 4 14-2 1-5-4-6-4H9c-1 0-4 5-6 4C0 18 3 6 7 6ZM7 9v6M4 12h6"/><circle cx="17" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="13" r="1" fill="currentColor" stroke="none"/>',
    "accessibility": '<circle cx="12" cy="3" r="2"/><path d="M3 8h18M12 6v8M12 14l-5 8M12 14l5 8M7 8l5 3 5-3"/>',
    "touch": '<path d="M9 13V5a2 2 0 0 1 4 0v7-3a2 2 0 0 1 3 0v2a2 2 0 0 1 3 0v1a2 2 0 0 1 3 0v6l-4 4h-7l-7-8a2 2 0 0 1 3-2l2 2Z"/><path d="M3 7a8 8 0 0 1 1-4M17 3a8 8 0 0 1 1 4"/>',
    "contrast": '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>',
    "motion": '<path d="M2 6h7M2 11h4M2 16h7M16 3a8 8 0 1 1 0 18 8 8 0 0 1 0-18ZM16 7v6l3 2"/>',
    "search": '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 7 7"/>',
    "menu": '<path d="M4 5h16M4 12h16M4 19h16"/>',
    "close": '<path d="m5 5 14 14M19 5 5 19"/>',
    "back": '<path d="M21 12H3m7-7-7 7 7 7"/>',
    "next": '<path d="M3 12h18m-7-7 7 7-7 7"/>',
    "expand": '<path d="m5 8 7 7 7-7"/>',
    "collapse": '<path d="m5 16 7-7 7 7"/>',
    "check": '<path d="m3 12 6 7L21 5"/>',
    "lock": '<rect x="4" y="10" width="16" height="12" rx="1"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
    "warning": '<path d="m12 2 10 19H2ZM12 8v6"/><circle cx="12" cy="18" r=".9" fill="currentColor" stroke="none"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v7M10 18h4"/><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none"/>',
    "reset": '<path d="M3 3v6h6M3 9a9 9 0 1 1 1 9M12 7v5h4"/>',
    "seed": '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="17" r="1" fill="currentColor" stroke="none"/>',
    "target": '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
    "strength": '<path d="M7 21h10M9 21V10H5l7-8 7 8h-4v11"/>',
    "dexterity": '<path d="m12 2 9 10-9 10-9-10ZM7 12h10M12 7v10"/>',
    "weak": '<path d="M7 3h10M9 3v11H5l7 8 7-8h-4V3"/>',
    "vulnerable": '<path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5ZM12 5l-2 5 4 3-3 6"/>',
    "frail": '<path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5ZM3 3l18 18M9 6l6 12"/>',
    "bleed": '<path d="M12 2c-1.7 3.7-7 8.4-7 12a7 7 0 0 0 14 0c0-3.6-5.3-8.3-7-12Z"/><path d="m9 10 6 6M9 14l3 3"/>',
    "frost": '<path d="M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3M3 11l4-1-1-4M21 13l-4 1 1 4M3 13l4 1-1 4M21 11l-4-1 1-4"/>',
    "insanity": '<path d="M2 12c5-10 15-10 20 0-5 10-15 10-20 0Z"/><path d="M9 9c7-3 8 7 3 7-3 0-3-5 0-4"/>',
    "blight": '<path d="M12 2c-5 5-8 10-7 15 1 5 13 5 14 0 1-5-2-10-7-15ZM12 8v12M7 13l5 3 5-3M9 9l3 3 3-3"/>',
    "burn": '<path d="M13 2c1 5-4 6-3 10 2-1 3-3 4-5 2 3 6 5 5 9a7 7 0 0 1-14 0c-1-4 3-7 4-10 0 3 1 4 2 4 0-3 1-5 2-8Z"/><path d="M10 17c0-2 2-4 2-4s3 3 2 5c-1 2-4 1-4-1Z"/>',
    "regen": '<path d="M4 9a8 8 0 1 1 1 9M4 3v6h6M12 9v8M8 13h8"/>',
    "madness": '<path d="M3 12c2-4 5-6 9-6s7 2 9 6c-2 4-5 6-9 6s-7-2-9-6ZM12 2v4M12 18v4M2 3l5 5M17 16l5 5M22 3l-5 5M7 16l-5 5"/><circle cx="12" cy="12" r="2.5"/>',
    "staggered": '<path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5ZM9 5l4 5-4 3 6 6M2 8H0M22 8h2M2 14H0M22 14h2"/>',
    "unknown": '<path d="M8 7a4 4 0 1 1 7 3c-2 1-3 2-3 5"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>',
}

for name, shapes in ICONS.items():
    write_svg(name, "icons", 24, 24,
              f'<g stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">{shapes}</g>',
              name.replace("-", " ").title() + " engraved icon")

def rect(x, y, w, h, stroke="#a58a52", fill="none", radius=3, sw=1):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" stroke="{stroke}" stroke-width="{sw}" fill="{fill}"/>'

def frame(w, h, selected=False, backing=False):
    col = "#c9a227" if selected else "#a58a52"
    shape = rect(2,2,w-4,h-4,col,"#171310" if backing else "none",5,1.5)
    shape += rect(7,7,w-14,h-14,"#5c4b32","none",2,.6)
    for x,y,sx,sy in [(10,10,1,1),(w-10,10,-1,1),(10,h-10,1,-1),(w-10,h-10,-1,-1)]:
        shape += f'<path d="M{x+sx*15} {y}H{x}v{sy*15}m0 {-sy*9} {sx*6} {-sy*6}" stroke="{col}" stroke-width="1"/>'
    if selected:
        shape += rect(4,4,w-8,h-8,"#e8dcc0","none",4,.7)
    return shape

write_svg("panel-frame", "components", 360, 240, frame(360,240), "Open brass folio frame", slice=[24,24,24,24])
write_svg("panel-backed", "components", 360, 240, frame(360,240,backing=True), "Backed soot folio panel", slice=[24,24,24,24])
write_svg("panel-selected", "components", 360, 240, frame(360,240,True,True), "Selected folio panel with additional inner outline", slice=[24,24,24,24])
write_svg("mobile-tray", "components", 360, 240,
          rect(2,2,356,236,"#a58a52","#171310",12,1.5) + '<path d="M160 12h40" stroke="#e8dcc0" stroke-width="3" stroke-linecap="round"/>' + '<path d="M12 28h336" stroke="#5c4b32"/>',
          "Portrait bottom tray backing; handle is decorative", slice=[32,24,24,24])
write_svg("hud-strip", "components", 360, 64, frame(360,64,backing=True), "Compact HUD strip backing", slice=[24,24,24,24])
write_svg("tooltip", "components", 280, 128, frame(280,128,backing=True), "Status and hint folio backing", slice=[24,24,24,24])
write_svg("item-slot", "components", 64, 64, frame(64,64,backing=True), "Inventory and relic slot backing", slice=[20,20,20,20])
write_svg("item-slot-selected", "components", 64, 64, frame(64,64,True,True), "Selected inventory slot with distinct double outline", slice=[20,20,20,20])

for name,color,bg in [("neutral","#a58a52","#171310"),("selected","#c9a227","#302716"),
                      ("primary-ready","#7fd97f","#182318"),("primary-focus","#a7eda7","#254725"),
                      ("primary-pressed","#7fd97f","#142d14"),("exit-focus","#e08585","#4a1b1b"),
                      ("danger-ready","#e08585","#2c1414"),("disabled","#8e826a","#201b15")]:
    body = rect(2,2,276,52,color,bg,5,1.5) + rect(5,5,270,46,"#5c4b32","none",3,.6)
    body += f'<path d="M11 14V10h9M269 42v4h-9" stroke="{color}" stroke-width="1"/>'
    if "focus" in name:
        body += rect(.75,.75,278.5,54.5,"#e8dcc0","none",6,1.2)
    if name == "selected":
        body += '<path d="m12 23 4 5-4 5-4-5Z" fill="#c9a227"/>'
    if name == "disabled":
        body += '<path d="M10 22h9v10h-9Zm2 0v-3a2.5 2.5 0 0 1 5 0v3" stroke="#e8dcc0" stroke-width="1"/>'
    write_svg("button-"+name,"components",280,56,body,name.replace("-"," ").title()+" action surface",slice=[16,24,16,24])

for name,selected in [("card-folio",False),("card-folio-selected",True)]:
    body = frame(240,336,selected) + rect(9,191,222,136,"#5c4b32","#171310",1,.5)
    body += '<path d="M14 226h212M14 263h212" stroke="#5c4b32" stroke-width=".8"/>'
    body += '<path d="m120 229 3 3-3 3-3-3Z" fill="#a58a52"/>'
    write_svg(name,"components",240,336,body,"Folio card frame with clear artwork aperture and text surface",
              slots={"artwork":[10,10,220,180],"name":[18,197,204,24],"type":[18,237,204,20],"body":[18,274,204,44]})
write_svg("card-parchment-label","components",220,44,
          '<path d="M2 3 17 2 24 4 104 2 129 4 163 3 177 5 217 3 219 42 193 40 151 42 118 40 87 42 51 40 24 42 2 40Z" fill="#e8dcc0" stroke="#7a6b54"/><path d="M8 8h204M8 36h204" stroke="#a58a52" stroke-width=".6"/>',
          "Parchment card title strip; empty for live text",slice=[10,18,10,18])
write_svg("cost-medallion","components",48,48,
          '<path d="m24 2 19 11v22L24 46 5 35V13Z" fill="#171310" stroke="#a58a52" stroke-width="1.5"/><path d="m24 6 15 9v18l-15 9-15-9V15Z" stroke="#e8dcc0" stroke-width=".6"/>',
          "Unnumbered hexagonal card cost medallion")
write_svg("action-medallion","components",64,64,
          '<circle cx="32" cy="32" r="29" fill="#171310" stroke="#c9a227" stroke-width="2"/><circle cx="32" cy="32" r="25" stroke="#7a6b54"/><path d="M32 1v5M32 58v5M1 32h5M58 32h5" stroke="#e8dcc0"/>',
          "Unnumbered Actions counter backing")

write_svg("meter-track","components",240,16,
          rect(1,1,238,14,"#a58a52","#0d0b08",4,1)+rect(4,4,232,8,"#3a3226","#171310",2,.6),
          "Empty resource track; fill length comes from actual game state",slice=[6,8,6,8])
for name,color in [("health","#a43c35"),("mana","#7fa8c9"),("stamina","#7fd97f"),("poise","#c9a227"),("bleed","#e46a44"),("blight","#b5541c"),("insanity","#a06bd0")]:
    body=rect(0,0,232,8,"none",color,2,0)+'<path d="M3 1.5h226" stroke="#e8dcc0" stroke-opacity=".28" stroke-width="1"/>'
    write_svg("meter-fill-"+name,"components",232,8,body,name.title()+" resource or buildup fill",slice=[2,4,2,4])
write_svg("meter-segments","components",240,16,
          ''.join(rect(1+i*30,1,26,14,"#7a6b54","#171310",2,.8) for i in range(8)),
          "Eight-cell decorative strip example; compose live cell count instead of implying a fixed game maximum")
for name,active in [("charge-empty",False),("charge-filled",True)]:
    write_svg(name,"components",20,24,'<path d="M10 2c-1.5 3-7 7-7 12a7 7 0 0 0 14 0c0-5-5.5-9-7-12Z" fill="'+('currentColor' if active else '#171310')+'" stroke="currentColor" stroke-width="1.4"/>',
              "Unnumbered flask charge marker",color="#a43c35")

for name,kind in [("reachable","neutral"),("selected","selected"),("visited","visited"),("locked","locked"),("unknown","unknown"),("current","current")]:
    body='<circle cx="32" cy="32" r="25" fill="#171310" stroke="#7a6b54" stroke-width="2"/>'
    if kind in ["selected","current"]:
        body+='<circle cx="32" cy="32" r="29" stroke="#c9a227" stroke-width="1.5"/><path d="m32 0 4 5h-8ZM32 64l4-5h-8Z" fill="#c9a227"/>'
    if kind=="visited": body+='<path d="m24 33 6 6 12-14" stroke="#e8dcc0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    if kind=="locked": body+='<rect x="24" y="28" width="16" height="14" rx="2" stroke="#8e826a" stroke-width="1.7"/><path d="M27 28v-5a5 5 0 0 1 10 0v5" stroke="#8e826a" stroke-width="1.7"/>'
    if kind=="unknown": body+='<path d="M27 26a5 5 0 1 1 8 4c-2 1-3 2-3 5" stroke="#e8dcc0" stroke-width="1.7"/><circle cx="32" cy="40" r="1.2" fill="#e8dcc0"/>'
    if kind=="current": body+='<circle cx="32" cy="32" r="4" fill="#e8dcc0"/>'
    write_svg("map-node-"+name,"components",64,64,body,"Map route node: "+name)

write_svg("divider-ornate","components",480,20,
          '<path d="M6 10h216M258 10h216" stroke="#a58a52"/><path d="m240 1 3 6 13 3-13 3-3 6-3-6-13-3 13-3Z" fill="#a58a52"/><path d="m2 10 4-3 4 3-4 3Zm468 0 4-3 4 3-4 3Z" fill="#c9a227"/>',
          "Wide horizontal folio divider")
write_svg("divider-plain","components",480,4,'<path d="M0 2h480" stroke="#7a6b54"/><path d="M0 1h480" stroke="#e8dcc0" stroke-opacity=".12"/>',"Plain separator",slice=[1,2,1,2])
write_svg("heading-spark","components",40,40,
          '<path d="m20 2 3 14 15 4-15 3-3 15-3-15-15-3 15-4Z" fill="#a58a52"/><path d="m8 8 12 8L32 8l-8 12 8 12-12-8-12 8 8-12Z" stroke="#c9a227" stroke-width=".8"/>',
          "Small heading ornament")
write_svg("corner-engraved","components",40,40,
          '<path d="M3 37V3h34M9 31V9h22M3 14l11-11M15 9 9 15M3 23l8-5M23 3l-5 8" stroke="#a58a52" stroke-width="1"/><path d="m3 3 4 1-3 3Z" fill="#e8dcc0"/>',
          "Top left frame corner; rotate for other corners")
write_svg("focus-outline","components",280,56,rect(1,1,278,54,"#e8dcc0","none",6,2),"Non-color keyboard or controller focus ring",slice=[12,12,12,12])
write_svg("selection-tick","components",24,24,
          '<path d="M1 1h22v22H1Z" fill="#171310" stroke="#c9a227"/><path d="m5 12 5 5 9-11" stroke="#e8dcc0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
          "Selected or collected receipt marker; semantics from model")
for name,active in [("toggle-off",False),("toggle-on",True)]:
    write_svg(name,"components",52,28,
              rect(1,1,50,26,"#7fd97f" if active else "#a58a52","#254725" if active else "#171310",13,1.3)+f'<circle cx="{38 if active else 14}" cy="14" r="9" fill="#e8dcc0"/>',
              "Toggle backing: "+("on" if active else "off")+"; accessible control remains live DOM")
write_svg("slider-track","components",240,12,
          '<path d="M6 6h228" stroke="#3a3226" stroke-width="5" stroke-linecap="round"/><path d="M6 4h228" stroke="#7a6b54" stroke-width="1"/><path d="M6 2v8M63 3v6M120 2v8M177 3v6M234 2v8" stroke="#a58a52"/>',
          "Settings slider track with unlabeled decorative ticks")
write_svg("slider-thumb","components",28,28,
          '<path d="m14 2 10 12-10 12L4 14Z" fill="#171310" stroke="#c9a227" stroke-width="1.5"/><path d="m14 7 5 7-5 7-5-7Z" fill="#a58a52"/>',
          "Diamond slider thumb; enlarged hit region required")
write_svg("tab-marker","components",12,32,'<path d="M2 0v32M2 9l8 7-8 7Z" fill="#c9a227" stroke="#c9a227"/>',"Gold persistent category selection marker")
write_svg("target-brackets","components",160,160,
          '<path d="M3 37V3h34M123 3h34v34M157 123v34h-34M37 157H3v-34" stroke="#e8dcc0" stroke-width="2"/><path d="M10 32V10h22M128 10h22v22M150 128v22h-22M32 150H10v-22" stroke="#c9a227" stroke-width="1"/>',
          "Combat targeting brackets; no targeting legality encoded")

manifest={"version":1,"purpose":"Scalable UI concept assets matching the player-polish preview images; integration is separate.","palette":PALETTE,"assets":FILES,"iconDefaultSize":24,"iconStrokeWidth":1.65,
          "filesCount":len(FILES),"noBakedTextOrGameplayValues":True,
          "sources":["docs/design/player-polish-2026-10-01/README.md","docs/design/player-polish-2026-10-01/05-combat-and-threats.png","docs/design/player-polish-2026-10-01/07-cards-and-relics.png","docs/design/player-polish-2026-10-01/12-preferences-and-run-setup.png","docs/architecture-handoff/COLOR-INTERACTION-CONTRACT.md","src/content/statuses.js","styles/base.css","src/framework/data/theme.js"]}
(ROOT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8",newline="\n")

css='''/* Suggested concept styling. Map these aliases to the game's authoritative theme at integration. */
:root{--as-soot:#0d0b08;--as-raised:#171310;--as-panel:#241d15;--as-brass:#c9a227;--as-worn-brass:#a58a52;--as-edge:#7a6b54;--as-ivory:#e8dcc0;--as-muted:#8e826a;--as-positive:#7fd97f;--as-danger:#e08585;--as-tap:44px;}
.as-icon{width:24px;height:24px;flex:none;color:var(--as-brass)}
.as-icon-control{min-width:var(--as-tap);min-height:var(--as-tap);display:grid;place-items:center}
.as-folio{border:24px solid transparent;border-image:url(components/panel-backed.svg) 24 fill stretch;padding:0;color:var(--as-ivory)}
.as-action{box-sizing:border-box;border:solid transparent;border-width:16px 24px;min-height:56px;color:var(--as-ivory);border-image:url(components/button-neutral.svg) 16 24 fill stretch;}
.as-action[data-role=primary][data-ready=true]:not(:disabled):not([aria-disabled=true]){border-image-source:url(components/button-primary-ready.svg)}
.as-action[data-role=primary][data-ready=true]:not(:disabled):not([aria-disabled=true]):is(:hover,:focus-visible){border-image-source:url(components/button-primary-focus.svg)}
.as-action[data-role=destructive][data-ready=true]:not(:disabled):not([aria-disabled=true]){border-image-source:url(components/button-danger-ready.svg)}
.as-action[data-role=exit]:not(:disabled):not([aria-disabled=true]):is(:hover,:focus-visible),.as-action[data-role=destructive][data-ready=true]:not(:disabled):not([aria-disabled=true]):focus-visible{border-image-source:url(components/button-exit-focus.svg)}
.as-action:is(:disabled,[aria-disabled=true]){border-image-source:url(components/button-disabled.svg)}
.as-action:focus-visible{outline:2px solid var(--as-ivory);outline-offset:3px}
@media(max-width:720px){.as-footer-action{width:100%;min-height:56px}.as-folio{max-width:100%;box-sizing:border-box}}
@media(prefers-reduced-motion:reduce){.as-action{transition:none}}
'''
# border is specified with individual widths because CSS border shorthand only accepts one width.
css=css.replace('border:16px 24px solid transparent;','border:solid transparent;border-width:16px 24px;')
(ROOT/"theme.css").write_text(css,encoding="utf-8",newline="\n")

cards=''.join(f'''<article class="asset {'icon' if a['kind']=='icons' else 'component'}" data-name="{a['id']}"><div class="preview"><img src="{a['file']}" alt="{escape(a['description'])}" loading="lazy"></div><a href="{a['file']}">{a['id']}</a><span>{a['width']} × {a['height']} · SVG</span></article>''' for a in FILES)
html=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire · Vector asset kit</title>
<style>body{{margin:0;background:#0d0b08;color:#e8dcc0;font:16px/1.5 Georgia,serif}}main{{max-width:1380px;margin:auto;padding:32px 24px}}h1{{font-size:36px;font-weight:normal;color:#c9a227;margin:0}}p{{max-width:860px;color:#b5a98e}}.controls{{position:sticky;top:0;z-index:1;padding:12px 0;background:#0d0b08;display:flex;gap:12px;flex-wrap:wrap}}input,select{{box-sizing:border-box;background:#171310;border:1px solid #a58a52;color:#e8dcc0;padding:12px;border-radius:4px;font:inherit;min-height:44px}}input{{width:320px}}a{{color:#d3b65f}}#grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}}.asset{{background:#171310;border:1px solid #4a4034;border-radius:4px;padding:14px;min-width:0}}.asset[hidden]{{display:none}}.preview{{height:150px;display:grid;place-items:center;background:radial-gradient(#302716,#14100c);border:1px solid #241d15;margin-bottom:10px}}.preview img{{max-width:100%;max-height:136px}}.icon .preview img{{width:48px;height:48px}}.asset a{{display:block;overflow-wrap:anywhere;font:14px/1.4 ui-monospace,monospace}}.asset span{{display:block;color:#b5a98e;font-size:12px;margin-top:4px}}.sizes{{display:flex;align-items:center;gap:14px;margin:14px 0 24px}}.sizes img{{color:#c9a227}}.state-demo{{display:flex;gap:12px;flex-wrap:wrap;padding:12px 0 24px}}.demo{{position:relative;width:230px;height:56px}}.demo img{{width:100%;height:56px}}.demo span{{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}}:focus-visible{{outline:2px solid #e8dcc0;outline-offset:4px}}@media(max-width:520px){{main{{padding:24px 16px}}h1{{font-size:28px}}#grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}.asset{{padding:8px}}.preview{{height:120px}}input{{width:100%}}}}</style>
<main><h1>Ashen Spire · Engraved interface kit</h1><p>{len(ICONS)} scalable icons and {len(FILES)-len(ICONS)} interface pieces. Every SVG has a transparent exterior and contains no raster imagery, gameplay values, or baked text. A shared kit serves desktop and mobile; adapt the composition and hit region, not the illustrated stroke weight.</p>
<div class="sizes" aria-label="Icon size comparison"><img src="icons/block.svg" width="16" height="16" alt="Block at 16 pixels"><img src="icons/block.svg" width="24" height="24" alt="Block at 24 pixels"><img src="icons/block.svg" width="32" height="32" alt="Block at 32 pixels"><img src="icons/block.svg" width="48" height="48" alt="Block at 48 pixels"><span>16 / 24 / 32 / 48 px</span></div>
<div class="state-demo"><div class="demo"><img src="components/button-neutral.svg" alt=""><span>Neutral utility</span></div><div class="demo"><img src="components/button-primary-ready.svg" alt=""><span>Ready primary</span></div><div class="demo"><img src="components/button-primary-focus.svg" alt=""><span>Primary focus</span></div><div class="demo"><img src="components/button-exit-focus.svg" alt=""><span>Exit focus</span></div></div>
<div class="controls"><input id="search" type="search" aria-label="Search asset names" placeholder="Search health, card, map…"><select id="kind" aria-label="Asset type"><option value="">All assets</option><option value="icon">Icons</option><option value="component">UI pieces</option></select><span id="count" aria-live="polite">{len(FILES)} assets</span></div><section id="grid" aria-label="Asset contact sheet">{cards}</section><p><a href="README.md">Integration notes</a> · <a href="manifest.json">Asset manifest</a> · <a href="theme.css">Suggested CSS</a></p></main>
<script>const rows=[...document.querySelectorAll('.asset')],search=document.querySelector('#search'),kind=document.querySelector('#kind');function filter(){{let count=0;for(const row of rows){{row.hidden=!(row.dataset.name.includes(search.value.trim().toLowerCase())&&(!kind.value||row.classList.contains(kind.value)));if(!row.hidden)count++}}document.querySelector('#count').textContent=count+' assets'}}search.addEventListener('input',filter);kind.addEventListener('change',filter);</script></html>'''
(ROOT/"index.html").write_text(html,encoding="utf-8",newline="\n")

notes={"svgAssets":len(FILES),"icons":len(ICONS),"components":len(FILES)-len(ICONS),"directory":"ui",
       "rationale":"Precise geometry and quiet engraved surfaces complement the painted references. Text, values, legality, icon semantic palettes and input behavior stay in the actual UI.",
       "canonicalMappings":{"health":"HP","mana":"MP","stamina":"SP","actions":"Actions (engine energy)","blight":"crimsonBlight","poise":"Poise buildup","block":"Block","staggered":"staggered"},
       "limitations":["An asset kit, not a runtime implementation or exhaustive replacement of every authored status symbol.","No uncommon class-specific status symbol is assigned a speculative replacement; use existing canonical symbols until authored.","Some neutral decorative brass shades are concept polish additions; map through the authoritative palette at implementation.","Raster img elements cannot inherit currentColor or CSS custom properties inside a separate SVG document. Inline the SVG or use a mask for theme-aware icons.","Mobile tray artwork does not implement drag interaction. Navigation and disclosure stay accessible DOM controls."]}
(ROOT.parent/"ui-notes.json").write_text(json.dumps(notes,indent=2)+"\n",encoding="utf-8",newline="\n")
print(json.dumps({"assets":len(FILES),"icons":len(ICONS),"components":len(FILES)-len(ICONS),"directory":str(ROOT)}))
