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
    for name in [f"v{i:02}.png" for i in range(1,11)]+["contact-sheet.png"]:
        (root/name).unlink(missing_ok=True)
    source=root/"proposal-sheet.png"
    im=Image.open(source).convert("RGBA")
    w,h=im.size
    report={"schemaVersion":1,"source":{"path":source.as_posix(),"sha256":sha(source),"size":[w,h]},"grid":{"columns":5,"rows":2,"rectPolicy":"adaptive zero meaningful-alpha gutters; prefer full zero alpha"},"output":{"size":[512,512],"anchor":[256,464],"sharedScale":None},"alphaThreshold":32,"sourceBoundary":boundary(im.getchannel("A")),"variants":[],"qa":{"errors":[],"warnings":[]}}
    # Find zero meaningful-alpha gutters; prefer full zero alpha nearest each nominal division. Never mask pixels.
    alpha=im.getchannel("A")
    def gap(axis, start, end, nominal):
        counts=[]
        for n in range(start,end):
            line=alpha.crop((0,n,w,n+1) if axis=="y" else (n,row_top,n+1,row_bottom))
            vals=list(line.getdata())
            counts.append((n,sum(v>0 for v in vals),sum(v>32 for v in vals)))
        def bands_for(index):
            bands=[]; begin=None
            for item in counts:
                n=item[0]; count=item[index]
                if count==0 and begin is None: begin=n
                if count!=0 and begin is not None: bands.append([begin,n]); begin=None
            if begin is not None: bands.append([begin,end])
            return bands
        bands=bands_for(1)
        criterion="alpha == 0"
        if not bands: bands=bands_for(2); criterion="alpha <= 32"
        if not bands: return None
        band=min(bands,key=lambda b:abs((b[0]+b[1]-1)/2-nominal))
        cut=(band[0]+band[1])//2
        cut_counts=next(item for item in counts if item[0]==cut)
        return {"band":band,"width":band[1]-band[0],"cut":cut,"criterion":criterion,"alphaAbove0":cut_counts[1],"alphaAbove32":cut_counts[2],"bandAlphaAbove0":sum(item[1] for item in counts if band[0]<=item[0]<band[1]),"bandAlphaAbove32":sum(item[2] for item in counts if band[0]<=item[0]<band[1])}
    horizontal=gap("y",int(h*.35),int(h*.65),h/2)
    plan={"status":"draft-pending-crop-review","method":"zero meaningful-alpha gutters; prefer full zero alpha","horizontal":horizontal,"rows":[]}
    report["cropPlan"]=plan
    rectangles=[]
    if horizontal is None:
        report["qa"]["errors"].append("no zero meaningful-alpha horizontal gutter near midpoint")
    else:
        ys=[0,horizontal["cut"],h]
        for row in range(2):
            row_top,row_bottom=ys[row],ys[row+1]
            gutters=[gap("x",int(w*(k/5-.07)),int(w*(k/5+.07)),w*k/5) for k in range(1,5)]
            plan["rows"].append({"y":[row_top,row_bottom],"gutters":gutters})
            if any(g is None for g in gutters):
                report["qa"]["errors"].append(f"row {row+1}: no zero meaningful-alpha gutter near a nominal column division")
                continue
            xs=[0]+[g["cut"] for g in gutters]+[w]
            if xs!=sorted(set(xs)):
                report["qa"]["errors"].append(f"row {row+1}: gutters do not form ordered cells")
                continue
            rectangles.extend([[xs[c],row_top,xs[c+1],row_bottom] for c in range(5)])
    cells=[]
    for i,rect in enumerate(rectangles):
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
