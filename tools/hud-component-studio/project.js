/* Shared, deterministic project paths and canvas snapping. */
(function(root){
'use strict';
function projectPath(value){if(typeof value!=='string'||!/^projects\/[a-zA-Z0-9_-]+\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.json$/.test(value))throw Error('Project must be a JSON file under projects/<name>/');return value;}
function assetSource(src,path){if(!src||src.startsWith('data:')||path==='scene.json')return src;if(!/^assets\/[a-zA-Z0-9_./-]+$/.test(src)||src.includes('..'))throw Error('Invalid project asset path');return path.slice(0,path.lastIndexOf('/')+1)+src;}
function snapRect(rect,canvas,others,step=8,tolerance=6){const guides=[];const result={dx:0,dy:0,guides};for(const axis of ['x','y']){const size=axis==='x'?'width':'height',anchors=[rect[axis],rect[axis]+rect[size]/2,rect[axis]+rect[size]],targets=[0,canvas[size]/2,canvas[size],...others.flatMap(r=>[r[axis],r[axis]+r[size]/2,r[axis]+r[size]])];let distance=tolerance+1,correction=0,target;for(const a of anchors)for(const t of targets){if(Math.abs(t-a)<distance){distance=Math.abs(t-a);correction=t-a;target=t;}}const grid=Math.round(rect[axis]/step)*step;if(Math.abs(grid-rect[axis])<distance){distance=Math.abs(grid-rect[axis]);correction=grid-rect[axis];target=grid;}if(distance<=tolerance){result[axis==='x'?'dx':'dy']=correction;guides.push({axis,value:target});}}return result;}
const api={projectPath,assetSource,snapRect};if(typeof module!=='undefined')module.exports=api;else root.StudioProject=api;
})(typeof window==='undefined'?globalThis:window);
