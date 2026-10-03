"""Extract complete figures from a transparent atlas without cutting at grid lines."""
import numpy as np
from PIL import Image


def extract_figures(atlas, count=15, threshold=32):
    alpha=np.asarray(atlas.getchannel('A'))
    labels=np.zeros(alpha.shape,dtype=np.int32)
    parents=[0]
    def root(n):
        while parents[n]!=n:
            parents[n]=parents[parents[n]]
            n=parents[n]
        return n
    previous=[]
    for y,row in enumerate(alpha):
        edges=np.diff(np.concatenate(([False],row>threshold,[False])).astype(np.int8))
        spans=list(zip(np.flatnonzero(edges==1),np.flatnonzero(edges==-1)))
        current=[];j=0
        for x0,x1 in spans:
            while j<len(previous) and previous[j][1]<x0:j+=1
            adjacent=[];k=j
            while k<len(previous) and previous[k][0]<=x1:
                adjacent.append(root(previous[k][2]));k+=1
            if adjacent:
                label=min(adjacent)
                for other in adjacent:parents[root(other)]=label
            else:
                label=len(parents);parents.append(label)
            labels[y,x0:x1]=label;current.append((x0,x1,label))
        previous=current
    lookup=np.array([root(i) for i in range(len(parents))],dtype=np.int32)
    labels=lookup[labels]
    ids,areas=np.unique(labels[labels>0],return_counts=True)
    components=[]
    for label,area in zip(ids,areas):
        ys,xs=np.nonzero(labels==label)
        components.append({'id':int(label),'area':int(area),'box':(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1))})
    main=sorted(components,key=lambda c:c['area'],reverse=True)[:count]
    if len(main)<count or min(c['area'] for c in main)<=atlas.width*atlas.height/1000:
        if threshold<192:return extract_figures(atlas,count,min(192,threshold*2))
        raise AssertionError(f'Touching figures need a corrected source: {main}')
    center=lambda c:((c['box'][0]+c['box'][2])/2,(c['box'][1]+c['box'][3])/2)
    by_y=sorted(main,key=lambda c:center(c)[1]);ordered=[]
    for start in range(0,count,4):ordered.extend(sorted(by_y[start:start+4],key=lambda c:center(c)[0]))
    owner={c['id']:i for i,c in enumerate(ordered)}
    def distance(a,b):
        ax0,ay0,ax1,ay1=a['box'];bx0,by0,bx1,by1=b['box']
        dx=max(bx0-ax1,ax0-bx1,0);dy=max(by0-ay1,ay0-by1,0)
        cx,cy=center(a);mx,my=center(b)
        return dx*dx+dy*dy+0.001*((cx-mx)**2+(cy-my)**2)
    for c in components:
        if c['id'] not in owner:owner[c['id']]=min(range(count),key=lambda i:distance(c,ordered[i]))
    assignment=np.full(len(parents),-1,dtype=np.int16)
    for label,index in owner.items():assignment[label]=index
    groups=assignment[labels]
    # Soft glow can bridge neighboring figures at alpha 1. Identify bodies at
    # alpha 33, then grow their ownership back through every original alpha
    # pixel; the source alpha itself is never thresholded or discarded.
    pending=(alpha>0)&(groups<0)
    while pending.any():
        padded=np.pad(np.where(groups<0,count,groups),1,constant_values=count)
        nearest=np.minimum.reduce([padded[dy:dy+alpha.shape[0],dx:dx+alpha.shape[1]] for dy,dx in [(0,0),(0,1),(0,2),(1,0),(1,2),(2,0),(2,1),(2,2)]])
        fill=pending&(nearest<count)
        if not fill.any():break
        groups[fill]=nearest[fill];pending[fill]=False
    # Detached low-alpha sparks have no opaque body to grow from.
    if pending.any():
        ys,xs=np.nonzero(pending);costs=[]
        for c in ordered:
            x0,y0,x1,y1=c['box'];cx,cy=center(c)
            dx=np.maximum(np.maximum(x0-xs,xs-x1),0);dy=np.maximum(np.maximum(y0-ys,ys-y1),0)
            costs.append(dx*dx+dy*dy+0.001*((xs-cx)**2+(ys-cy)**2))
        groups[ys,xs]=np.argmin(costs,axis=0)
    crops=[];bounds=[];pixel_counts=[];core_bounds=[]
    for i in range(count):
        owned=groups==i;ys,xs=np.nonzero(owned&(alpha>threshold))
        core=(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1));core_bounds.append(core)
        # Ignore isolated near-transparent background specks far from the
        # painted body. Keep a soft-edge allowance without letting invisible
        # noise change the figure's scale or foot anchor.
        box=(max(0,core[0]-12),max(0,core[1]-12),min(atlas.width,core[2]+12),min(atlas.height,core[3]+12))
        crop=atlas.crop(box)
        crop.putalpha(Image.fromarray(np.where(owned,alpha,0).astype(np.uint8)).crop(box))
        crops.append(crop);bounds.append(box);pixel_counts.append(int(owned.sum()))
    assert sum(pixel_counts)==int((alpha>0).sum()), 'Every visible source pixel must belong to exactly one pose'
    assert sum(int((np.asarray(crop.getchannel('A'))>192).sum()) for crop in crops)==int((alpha>192).sum()), 'Never discard or duplicate opaque body/weapon pixels'
    return crops, {'method':'connected-alpha-reading-order','bodyAlphaThreshold':threshold,'softEdgePadding':12,'bounds':bounds,'coreBounds':core_bounds,'visiblePixels':pixel_counts,'components':len(components)}
