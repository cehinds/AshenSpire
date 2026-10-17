#!/usr/bin/env python3
"""Mechanical proposal export: fixed cells, one scale, no inferred pixels."""
import argparse, hashlib, json, sys
from pathlib import Path
from PIL import Image, ImageDraw

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def boundary(a):
    w,h=a.size
    values=list(a.crop((0,0,w,1)).getdata())+list(a.crop((0,h-1,w,h)).getdata())+list(a.crop((0,1,1,h-1)).getdata())+list(a.crop((w-1,1,w,h-1)).getdata())
    return {"alphaAbove0":sum(v>0 for v in values),"alphaAbove32":sum(v>32 for v in values)}
def run(root):
    source=root/"proposal-sheet.png"
    im=Image.open(source).convert("RGBA")
    w,h=im.size
    report={"schemaVersion":1,"source":{"path":source.as_posix(),"sha256":sha(source),"size":[w,h]},"grid":{"columns":5,"rows":2,"rectPolicy":"integer partition"},"output":{"size":[512,512],"anchor":[256,464],"sharedScale":None},"alphaThreshold":32,"sourceBoundary":boundary(im.getchannel("A")),"variants":[],"qa":{"errors":[],"warnings":[]}}
    cells=[]
    for i in range(10):
        col,row=i%5,i//5
        rect=[col*w//5,row*h//2,(col+1)*w//5,(row+1)*h//2]
        cell=im.crop(rect); a=cell.getchannel("A")
        bounds=a.point(lambda v:255 if v>32 else 0).getbbox()
        edge=boundary(a)
        entry={"id":f"v{i+1:02}","sourceRect":rect,"sourceAlphaBounds":bounds,"sourceBoundaryCounts":edge,"sourceBoundaryClipped":edge["alphaAbove32"]>0}
        report["variants"].append(entry)
        if not bounds: report["qa"]["errors"].append(entry["id"]+": empty cell")
        if edge["alphaAbove32"]: report["qa"]["errors"].append(entry["id"]+": meaningful alpha touches cell boundary")
        if edge["alphaAbove0"] and not edge["alphaAbove32"]: report["qa"]["warnings"].append(entry["id"]+": boundary antialias noise")
        cells.append((cell,bounds))
    if report["sourceBoundary"]["alphaAbove32"]: report["qa"]["errors"].append("meaningful alpha touches source outer boundary")
    if not report["qa"]["errors"]:
        # Fit meaningful bounds inside x=32..480, y=32..464, without upscaling.
        scale=min([1.0]+[min(448/(b[2]-b[0]),432/(b[3]-b[1])) for _,b in cells])
        report["output"]["sharedScale"]=scale
        sheet=Image.new("RGB",(5*256,2*280),(36,39,43)); draw=ImageDraw.Draw(sheet)
        for i,((cell,b),entry) in enumerate(zip(cells,report["variants"])):
            # Keep all alpha, including antialiasing, in the crop.
            full=cell.getchannel("A").getbbox()
            crop=cell.crop(full)
            size=[max(1,round(crop.width*scale)),max(1,round(crop.height*scale))]
            crop=crop.resize(size,Image.Resampling.LANCZOS)
            # Anchor meaningful bounds bottom-center; retain transparent source offsets.
            x=round(256-((b[0]+b[2])/2-full[0])*scale)
            y=round(464-(b[3]-full[1])*scale)
            out=Image.new("RGBA",(512,512)); out.alpha_composite(crop,(x,y))
            box=out.getchannel("A").point(lambda v:255 if v>32 else 0).getbbox()
            if x<0 or y<0 or x+crop.width>512 or y+crop.height>512: report["qa"]["errors"].append(entry["id"]+": full alpha exceeds output")
            p=root/(entry["id"]+".png"); out.save(p)
            entry.update(outputAlphaBounds=box,anchor=[256,464],size=[512,512],sha256=sha(p),translation=[x,y])
            thumb=out.resize((256,256),Image.Resampling.LANCZOS)
            tx,ty=(i%5)*256,(i//5)*280
            sheet.paste(thumb,(tx,ty),thumb); draw.text((tx+8,ty+260),entry["id"],fill="white")
        sheet.save(root/"contact-sheet.png")
    (root/"normalized.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    if report["qa"]["errors"]: sys.exit(1)
    # Independently decode every artifact and verify the documented invariant.
    for entry in report["variants"]:
        p=root/(entry["id"]+".png"); frame=Image.open(p)
        assert frame.mode=="RGBA" and frame.size==(512,512)
        assert sha(p)==entry["sha256"]
        assert abs((entry["outputAlphaBounds"][0]+entry["outputAlphaBounds"][2])/2-256)<=1
        assert abs(entry["outputAlphaBounds"][3]-464)<=1
    assert sha(source)==report["source"]["sha256"]
    print("PASS: ten RGBA frames, shared scale, common floor and center, source unchanged")
if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("directory",type=Path); args=parser.parse_args(); run(args.directory)
