(function(root){
'use strict';
// Sampled distances are diagnostics, not certified Hausdorff bounds.
// surfaceDistance measures UNTRIMMED supporting surfaces, not face trims.
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const add=(a,b)=>a.map((v,k)=>v+b[k]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>scale(a,1/norm(a));
const area=t=>norm(cross(sub(t[1],t[0]),sub(t[2],t[0])))/2;
function bounds(triangles) {
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const t of triangles)for(const p of t)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
 return {min,max,size:sub(max,min),diagonal:norm(sub(max,min))};
}
function metrics(triangles,{weldTolerance=1e-6}={}) {
 if(!triangles.length)throw new Error('Empty mesh');
 if(!(weldTolerance>0))throw new Error('Positive weldTolerance required');
 const box=bounds(triangles),ref=box.min.map((v,k)=>(v+box.max[k])/2);
 const vertexMap=new Map(),edges=new Map(),adj=triangles.map(()=>[]),triangleKeys=new Set();
 let surfaceArea=0,signedVolume=0,duplicates=0,degenerates=0;
 const vertex=p=>{const key=p.map(v=>Math.round(v/weldTolerance)).join(',');if(!vertexMap.has(key))vertexMap.set(key,vertexMap.size);return vertexMap.get(key);};
 triangles.forEach((t,i)=>{
   surfaceArea+=area(t);signedVolume+=dot(sub(t[0],ref),cross(sub(t[1],ref),sub(t[2],ref)))/6;
   const ids=t.map(vertex),key=ids.slice().sort((a,b)=>a-b).join(',');
   if(new Set(ids).size<3||area(t)<1e-18)degenerates++;
   if(triangleKeys.has(key))duplicates++;triangleKeys.add(key);
   for(let j=0;j<3;j++){
     const a=ids[j],b=ids[(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b);
     if(!edges.has(key))edges.set(key,[]);edges.get(key).push({triangle:i,direction:a<b?1:-1});
   }
 });
 let boundaryEdges=0,nonmanifoldEdges=0,inconsistentEdges=0;
 for(const uses of edges.values()){
   if(uses.length===1)boundaryEdges++;else if(uses.length!==2)nonmanifoldEdges++;else if(uses[0].direction===uses[1].direction)inconsistentEdges++;
   for(let j=1;j<uses.length;j++){adj[uses[0].triangle].push(uses[j].triangle);adj[uses[j].triangle].push(uses[0].triangle);}
 }
 let components=0;const visited=new Set();
 for(let i=0;i<triangles.length;i++)if(!visited.has(i)){components++;const stack=[i];visited.add(i);while(stack.length)for(const n of adj[stack.pop()])if(!visited.has(n)){visited.add(n);stack.push(n);}}
 return {triangles:triangles.length,vertices:vertexMap.size,edges:edges.size,components,duplicates,degenerates,boundaryEdges,nonmanifoldEdges,inconsistentEdges,closed:boundaryEdges===0&&nonmanifoldEdges===0&&inconsistentEdges===0&&duplicates===0&&degenerates===0,bounds:box,area:surfaceArea,signedVolume,volume:Math.abs(signedVolume)};
}
function triangleDistance2(p,[a,b,c]) {
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return dot(ap,ap);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
 if(d3>=0&&d4<=d3)return dot(bp,bp);
 const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3),q=sub(p,add(a,scale(ab,v)));return dot(q,q);}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
 if(d6>=0&&d5<=d6)return dot(cp,cp);
 const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6),q=sub(p,add(a,scale(ac,w)));return dot(q,q);}
 const va=d3*d6-d5*d4;
 if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)),q=sub(p,add(b,scale(sub(c,b),w)));return dot(q,q);}
 const denom=va+vb+vc;
 if(Math.abs(denom)<1e-30){const segment=(x,y)=>{const v=sub(y,x),l=dot(v,v),q=sub(p,add(x,scale(v,l?Math.max(0,Math.min(1,dot(sub(p,x),v)/l)):0)));return dot(q,q);};return Math.min(segment(a,b),segment(b,c),segment(c,a));}
 const q=sub(p,add(a,add(scale(ab,vb/denom),scale(ac,vc/denom))));return dot(q,q);
}
const boxDistance2=(p,b)=>p.reduce((s,v,k)=>s+(v<b.min[k]?b.min[k]-v:v>b.max[k]?v-b.max[k]:0)**2,0);
function makeBVH(triangles,leafSize=12) {
 function build(items){
   const box=bounds(items.map(i=>triangles[i]));
   if(items.length<=leafSize)return {box,items};
   const axis=box.size.indexOf(Math.max(...box.size));
   items.sort((a,b)=>triangles[a].reduce((s,p)=>s+p[axis],0)-triangles[b].reduce((s,p)=>s+p[axis],0));
   const m=items.length>>1;return {box,left:build(items.slice(0,m)),right:build(items.slice(m))};
 }
 const tree=build(triangles.map((_,i)=>i));
 return p=>{
   let best=Infinity;
   const visit=node=>{if(boxDistance2(p,node.box)>=best)return;if(node.items){for(const i of node.items)best=Math.min(best,triangleDistance2(p,triangles[i]));return;}
    const a=boxDistance2(p,node.left.box),b=boxDistance2(p,node.right.box);if(a<b){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}};
   visit(tree);return Math.sqrt(best);
 };
}
function* samples(triangles,{subdivisions=3}={}) {
 if(!Number.isInteger(subdivisions)||subdivisions<1)throw new Error('subdivisions must be a positive integer');
 const perTriangle=(subdivisions+1)*(subdivisions+2)/2;
 for(let triangle=0;triangle<triangles.length;triangle++){
  const t=triangles[triangle],weight=area(t)/perTriangle;
  for(let i=0;i<=subdivisions;i++)for(let j=0;j<=subdivisions-i;j++){
   const u=i/subdivisions,v=j/subdivisions,w=1-u-v;
   yield {point:t[0].map((x,k)=>u*x+v*t[1][k]+w*t[2][k]),triangle,weight,kind:(i===0||j===0||i+j===subdivisions)?'boundary':'interior'};
  }
 }
}
function distanceSummary(triangles,distance,options={}) {
 let max=0,maxPoint=null,weighted=0,squared=0,weight=0,count=0,interiorMax=0;const values=[];
 for(const s of samples(triangles,options)){
   const d=distance(s.point,s.triangle);if(!Number.isFinite(d)||d<0)throw new Error('Distance function returned an invalid result');
   if(d>max){max=d;maxPoint=s.point;}if(s.kind==='interior')interiorMax=Math.max(interiorMax,d);
   weighted+=d*s.weight;squared+=d*d*s.weight;weight+=s.weight;count++;values.push({d,weight:s.weight});
 }
 values.sort((a,b)=>a.d-b.d);let accumulated=0,p95=0;for(const item of values){accumulated+=item.weight;if(accumulated>=weight*.95){p95=item.d;break;}}
 return {samples:count,max,maxPoint,interiorMax,areaWeightedMean:weighted/weight,areaWeightedRMS:Math.sqrt(squared/weight),areaWeightedP95:p95};
}
function compareMeshes(source,candidate,options={}) {
 const sourceMetrics=metrics(source,options),candidateMetrics=metrics(candidate,options);
 const sourceToCandidate=distanceSummary(source,makeBVH(candidate),options),candidateToSource=distanceSummary(candidate,makeBVH(source),options);
 return {source:sourceMetrics,candidate:candidateMetrics,sourceToCandidate,candidateToSource,sampledSymmetricMax:Math.max(sourceToCandidate.max,candidateToSource.max),volumeChange:candidateMetrics.volume-sourceMetrics.volume,relativeVolumeChange:(candidateMetrics.volume-sourceMetrics.volume)/Math.max(sourceMetrics.volume,1e-30),areaChange:candidateMetrics.area-sourceMetrics.area};
}
function surfaceDistance(point,surface) {
 const q=sub(point,surface.origin||[0,0,0]);
 if(surface.type==='sphere')return Math.abs(norm(q)-surface.radius);
 const axis=unit(surface.axis||[0,0,1]),z=dot(q,axis),radial=norm(sub(q,scale(axis,z)));
 if(surface.type==='plane')return Math.abs(z);
 if(surface.type==='cylinder')return Math.abs(radial-surface.radius);
 if(surface.type==='torus')return Math.abs(Math.hypot(radial-surface.majorRadius,z)-surface.minorRadius);
 throw new Error('Unknown surface '+surface.type);
}

const api={add,sub,scale,dot,cross,norm,unit,area,bounds,metrics,triangleDistance2,makeBVH,samples,distanceSummary,compareMeshes,surfaceDistance};
if(typeof module==="object"&&module.exports)module.exports=api;
root.MeshQA=api;
})(typeof self==="object"?self:globalThis);
