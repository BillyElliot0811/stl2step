/* Conservative recognition of rounded cap/slab parts with a rectangular boss
 * and one blind circular recess. All parameters come from mesh geometry.
 * Unsupported or uncertain meshes continue through the faceted converter.
 */
(function(root){
'use strict';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a);return a.map(x=>x/d);};
const mix=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
const reject=message=>{throw new Error(message);};
function solveCircle(points,eps){
 if(points.length<12)return null;
 const mean=[0,1].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length);
 let xx=0,xy=0,yy=0,xq=0,yq=0;
 for(const p of points){const x=p[0]-mean[0],y=p[1]-mean[1],q=x*x+y*y;xx+=x*x;xy+=x*y;yy+=y*y;xq+=x*q;yq+=y*q;}
 const det=xx*yy-xy*xy;if(det<=1e-16*xx*yy)return null;
 const center=[mean[0]+(xq*yy-yq*xy)/(2*det),mean[1]+(yq*xx-xq*xy)/(2*det)];
 const radii=points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1]));
 const radius=radii.reduce((a,b)=>a+b,0)/radii.length;
 const residual=Math.max(...radii.map(r=>Math.abs(r-radius)));
 const angles=points.map(p=>Math.atan2(p[1]-center[1],p[0]-center[0])).sort((a,b)=>a-b);
 let maxGap=angles[0]+2*Math.PI-angles.at(-1);for(let i=1;i<angles.length;i++)maxGap=Math.max(maxGap,angles[i]-angles[i-1]);
 return radius>eps&&residual<=eps&&maxGap<0.55?{center,radius,residual,maxGap}:null;
}
function roundedDistance(p,m){
 const b=m.base,r=b.cornerRadius,a=b.width/2-r,c=b.depth/2-r;
 const base=Math.max(Math.hypot(Math.max(Math.abs(p[0])-a,0),Math.max(Math.abs(p[1])-c,0),Math.max(r-p[2],0))-r,p[2]-b.height);
 const boss=m.boss,q=[Math.abs(p[0]-boss.center[0])-boss.width/2,Math.abs(p[1]-boss.center[1])-boss.depth/2,Math.abs(p[2]-(b.height+boss.height/2))-boss.height/2];
 const box=Math.hypot(...q.map(x=>Math.max(x,0)))+Math.min(Math.max(...q),0);
 const h=m.recess,cut=Math.max(Math.hypot(p[0]-h.center[0],p[1]-h.center[1])-h.radius,h.floor-p[2]);
 return Math.max(Math.min(base,box),-cut);
}
function analyticVolume(m){
 const b=m.base,r=b.cornerRadius,a=b.width-2*r,c=b.depth-2*r;
 // Lower fillet: core prism + four quarter cylinders + four sphere octants.
 const slab=a*c*r+(a+c)*Math.PI*r*r/2+2*Math.PI*r*r*r/3+(b.width*b.depth-(4-Math.PI)*r*r)*(b.height-r);
 return slab+m.boss.width*m.boss.depth*m.boss.height-Math.PI*m.recess.radius*m.recess.radius*(b.height+m.boss.height-m.recess.floor);
}
function candidateSamples(m,tolerance){
 const out=[],r=m.base.cornerRadius,a=m.base.width/2-r,c=m.base.depth/2-r,h=m.base.height,top=h+m.boss.height;
 const angular=Math.min(64,Math.max(10,Math.ceil(Math.PI/2/Math.sqrt(2*tolerance/Math.max(r,m.recess.radius))))),linear=10;
 const add=p=>{const b=m.boss; if(Math.abs(p[2]-h)<1e-8&&Math.abs(p[0]-b.center[0])<b.width/2-1e-8&&Math.abs(p[1]-b.center[1])<b.depth/2-1e-8)return; if(Math.abs(roundedDistance(p,m))<Math.max(1e-7,tolerance*0.001))out.push(p);};
 const grid=(u,v,w)=>{for(let i=0;i<=linear;i++)for(let j=0;j<=linear;j++)add(w(i/linear,j/linear));};
 grid(0,0,(s,t)=>[-a+2*a*s,-c+2*c*t,0]);
 grid(0,0,(s,t)=>[-m.base.width/2+m.base.width*s,-m.base.depth/2+m.base.depth*t,h]);
 for(const sx of [-1,1])for(const sy of [-1,1]){
  for(let j=0;j<=angular;j++)for(let k=0;k<=angular;k++){
   const theta=j/angular*Math.PI/2,phi=k/angular*Math.PI/2;
   add([sx*(a+r*Math.sin(theta)*Math.cos(phi)),sy*(c+r*Math.sin(theta)*Math.sin(phi)),r-r*Math.cos(theta)]);
  }
  for(let i=0;i<=angular;i++)for(let j=0;j<=linear;j++){
   const t=i/angular*Math.PI/2,z=r+(h-r)*j/linear;
   add([sx*(a+r*Math.cos(t)),sy*(c+r*Math.sin(t)),z]);
  }
 }
 for(const sign of [-1,1]){
  for(let i=0;i<=angular;i++)for(let j=0;j<=linear;j++){
   const angle=i/angular*Math.PI/2;
   add([-a+2*a*j/linear,sign*(c+r*Math.sin(angle)),r-r*Math.cos(angle)]);
   add([sign*(a+r*Math.sin(angle)),-c+2*c*j/linear,r-r*Math.cos(angle)]);
  }
  grid(0,0,(s,t)=>[-a+2*a*s,sign*(c+r),r+(h-r)*t]);
  grid(0,0,(s,t)=>[sign*(a+r),-c+2*c*s,r+(h-r)*t]);
  const b=m.boss;
  grid(0,0,(s,t)=>[b.center[0]-b.width/2+b.width*s,b.center[1]+sign*b.depth/2,h+(top-h)*t]);
  grid(0,0,(s,t)=>[b.center[0]+sign*b.width/2,b.center[1]-b.depth/2+b.depth*s,h+(top-h)*t]);
 }
 const b=m.boss;
 grid(0,0,(s,t)=>[b.center[0]-b.width/2+b.width*s,b.center[1]-b.depth/2+b.depth*t,top]);
 const hole=m.recess,ringN=Math.max(48,angular*4);
 for(let i=0;i<ringN;i++)for(let j=0;j<=linear;j++){
  const phi=2*Math.PI*i/ringN,dx=hole.radius*Math.cos(phi),dy=hole.radius*Math.sin(phi);
  add([hole.center[0]+dx,hole.center[1]+dy,hole.floor+(top-hole.floor)*j/linear]);
  add([hole.center[0]+dx*j/linear,hole.center[1]+dy*j/linear,hole.floor]);
 }
 return out;
}
function recognize(triangles,{tolerance=0.01}={}){
 try{
 if(!Number.isFinite(tolerance)||tolerance<0.0001||tolerance>0.1)reject('Dung sai nhận dạng phải từ 0,0001 đến 0,1 mm.');
 if(triangles.length<100)reject('Chưa đủ dữ liệu cho nhóm chi tiết nắp/tấm bo tròn.');
 const QA=root.MeshQA||(typeof require==='function'?require('./mesh-qa.js'):null);
 if(!QA)reject('Thiếu bộ kiểm tra hình học.');
 const metrics=QA.metrics(triangles,{weldTolerance:1e-7});
 if(!metrics.closed||metrics.components!==1)reject('Nhận dạng mặt cong cần một lưới kín, liên thông, có hướng nhất quán.');
 const scale=metrics.bounds.diagonal,eps=Math.max(1e-7,scale*1e-6),fitEps=Math.max(2e-6,Math.min(tolerance/10,scale*1e-5));
 const ref=metrics.bounds.min.map((x,k)=>(x+metrics.bounds.max[k])/2),vertices=[],ids=new Map();
 const vertex=p=>{const key=p.join(',');if(!ids.has(key)){ids.set(key,vertices.length);vertices.push(p);}return ids.get(key);};
 const faces=triangles.map(t=>{const q=cross(sub(t[1],t[0]),sub(t[2],t[0])),length=Math.hypot(...q);return {ids:t.map(vertex),normal:q.map(x=>x/length),area:length/2};});
 const sorted=faces.slice().sort((a,b)=>b.area-a.area),groups=[];
 for(const f of sorted){let g=groups.find(g=>Math.abs(dot(g.normal,f.normal))>1-1e-7);if(!g&&groups.length<256){g={normal:f.normal,area:0};groups.push(g);}if(g)g.area+=f.area;}
 groups.sort((a,b)=>b.area-a.area);
 const axisA=groups[0]?.normal,axisB=groups.find(g=>Math.abs(dot(g.normal,axisA))<1e-4)?.normal;
 if(!axisB)reject('Không tìm được hệ mặt phẳng vuông góc đáng tin cậy.');
 const u0=unit(axisA),u1=unit(sub(axisB,u0.map(x=>x*dot(axisB,u0)))),axes=[u0,u1,unit(cross(u0,u1))];
 const failures=[];
 for(let axis=0;axis<3;axis++)for(const sign of [1,-1]){
  let stage=0;
  try{
   const n=axes[axis].map(x=>x*sign),u=axes[(axis+1)%3],v=unit(cross(n,u));
   const local=vertices.map(p=>{const q=sub(p,ref);return [dot(q,u),dot(q,v),dot(q,n)];});
   const levels=[];
   for(let i=0;i<faces.length;i++)if(Math.abs(dot(faces[i].normal,n))>1-1e-7){
    const z=faces[i].ids.reduce((s,id)=>s+local[id][2],0)/3;
    let group=levels.find(g=>Math.abs(g.z-z)<eps);if(!group){group={z,faces:[],area:0};levels.push(group);}group.faces.push(i);group.area+=faces[i].area;
   }
   levels.sort((a,b)=>a.z-b.z);
   if(levels.length!==4)reject('Số tầng phẳng chưa thuộc nhóm nắp có một hốc tròn.');
   stage=1;
   function loops(group){
    const edges=new Map();for(const id of group.faces){const f=faces[id];for(let k=0;k<3;k++){const a=f.ids[k],b=f.ids[(k+1)%3],key=Math.min(a,b)+','+Math.max(a,b);const e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});}}
    const adj=new Map();for(const e of edges.values())if(e.count===1){for(const [a,b]of [[e.a,e.b],[e.b,e.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}}
    if([...adj.values()].some(a=>a.length!==2))reject('Biên mặt phẳng không tạo vòng kín đơn giản.');
    const seen=new Set(),out=[];
    for(const start of adj.keys())if(!seen.has(start)){let at=start,previous=-1;const loop=[];do{if(seen.has(at))reject('Vòng biên mặt phẳng tự giao.');seen.add(at);loop.push(local[at]);const next=adj.get(at).find(x=>x!==previous);previous=at;at=next;}while(at!==start&&loop.length<=adj.size);out.push(loop);}
    return out;
   }
   const low=levels[0],high=levels[3],bottomLoops=loops(low),topLoops=loops(high);
   if(bottomLoops.length!==1||topLoops.length!==2)reject('Mặt đáy hoặc mặt trên chưa khớp dạng nắp một hốc.');
   stage=2;
   const box=points=>({min:[0,1].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1].map(k=>Math.max(...points.map(p=>p[k])))});
   const bottomBox=box(bottomLoops[0]),bottomSize=bottomBox.max.map((x,k)=>x-bottomBox.min[k]);
   if(Math.abs(low.area-bottomSize[0]*bottomSize[1])>Math.max(eps*scale,low.area*1e-5))reject('Đáy không phải mặt chữ nhật đầy đủ.');
   stage=3;
   const topCircles=topLoops.map(loop=>solveCircle(loop,fitEps)),circleIndex=topCircles.findIndex(Boolean);
   if(circleIndex<0||topCircles.filter(Boolean).length!==1)reject('Không xác định được biên tròn đầy đủ trên mặt trên.');
   const ring=topCircles[circleIndex],bossLoop=topLoops[1-circleIndex],bossBox=box(bossLoop),bossSize=bossBox.max.map((x,k)=>x-bossBox.min[k]);
   if(bossLoop.some(p=>Math.min(Math.abs(p[0]-bossBox.min[0]),Math.abs(p[0]-bossBox.max[0]),Math.abs(p[1]-bossBox.min[1]),Math.abs(p[1]-bossBox.max[1]))>fitEps))reject('Biên gờ trên không phải hình chữ nhật.');
   stage=4;
   let floorIndex=-1;
   for(let i=1;i<3;i++){const rings=loops(levels[i]);if(rings.length===1){const c=solveCircle(rings[0],fitEps);if(c&&Math.hypot(c.center[0]-ring.center[0],c.center[1]-ring.center[1])<fitEps&&Math.abs(c.radius-ring.radius)<fitEps)floorIndex=i;}}
   if(floorIndex<0)reject('Không có đáy hốc cùng tâm và bán kính với miệng hốc.');
   stage=5;
   const baseIndex=3-floorIndex,baseLevel=levels[baseIndex];
   const fullBox=box(local),fullSize=fullBox.max.map((x,k)=>x-fullBox.min[k]),baseCenter=fullBox.min.map((x,k)=>(x+fullBox.max[k])/2);
   const radii=fullSize.map((x,k)=>(x-bottomSize[k])/2),radius=(radii[0]+radii[1])/2;
   if(radius<=fitEps||Math.abs(radii[0]-radii[1])>fitEps||bottomBox.min.some((x,k)=>Math.abs((x+bottomBox.max[k])/2-baseCenter[k])>fitEps))reject('Không khớp bo đáy và bo góc có cùng bán kính.');
   const m={base:{width:fullSize[0],depth:fullSize[1],height:baseLevel.z-low.z,cornerRadius:radius,bottomRadius:radius},boss:{width:bossSize[0],depth:bossSize[1],height:high.z-baseLevel.z,center:bossBox.min.map((x,k)=>(x+bossBox.max[k])/2-baseCenter[k])},recess:{radius:ring.radius,floor:levels[floorIndex].z-low.z,center:ring.center.map((x,k)=>x-baseCenter[k])},frame:{origin:ref.map((x,k)=>x+u[k]*baseCenter[0]+v[k]*baseCenter[1]+n[k]*low.z),u,v,n}};
   if(!(m.base.height>radius+eps&&m.boss.height>eps&&m.recess.floor>eps&&m.recess.floor<high.z-low.z-eps))reject('Các chiều cao chưa tạo được cấu trúc nắp hợp lệ.');
   if(m.recess.center.some((x,k)=>Math.abs(x-m.boss.center[k])+ring.radius>bossSize[k]/2-fitEps))reject('Hốc tròn chạm hoặc vượt biên gờ chữ nhật.');
   stage=6;
   const canonical=local.map(p=>[p[0]-baseCenter[0],p[1]-baseCenter[1],p[2]-low.z]);
   let vertexError=0;for(const p of canonical)vertexError=Math.max(vertexError,Math.abs(roundedDistance(p,m)));
   if(vertexError>fitEps)reject('Có đỉnh STL không khớp mô hình mặt tròn/bo được nhận dạng.');
   stage=7;
   const localTriangles=faces.map(f=>f.ids.map(id=>canonical[id]));
   let sampleError=0,normalMin=1,weight=0,squared=0;
   const gradientStep=Math.max(1e-6,scale*1e-7),orientation=metrics.signedVolume<0?-1:1;
   for(let i=0;i<localTriangles.length;i++){
    const t=localTriangles[i],centroid=t[0].map((x,k)=>(x+t[1][k]+t[2][k])/3),list=[centroid,mix(t[0],t[1],0.5),mix(t[1],t[2],0.5),mix(t[2],t[0],0.5)];
    for(const p of list){const e=Math.abs(roundedDistance(p,m));sampleError=Math.max(sampleError,e);squared+=e*e*faces[i].area/4;weight+=faces[i].area/4;}
    const grad=[0,1,2].map(k=>{const a=centroid.slice(),b=centroid.slice();a[k]+=gradientStep;b[k]-=gradientStep;return roundedDistance(a,m)-roundedDistance(b,m);});
    const length=Math.hypot(...grad);
    if(length>gradientStep*0.01){const faceN=[dot(faces[i].normal,u),dot(faces[i].normal,v),dot(faces[i].normal,n)].map(x=>x*orientation);normalMin=Math.min(normalMin,dot(faceN,grad)/length);}
   }
   if(sampleError>tolerance||normalMin<0.95)reject('Sai lệch mặt hoặc hướng mặt vượt giới hạn nhận dạng.');
   stage=8;
   const volume=analyticVolume(m),volumeError=Math.abs(volume-metrics.volume)/metrics.volume;
   if(!Number.isFinite(volume)||volume<=0||volumeError>0.001)reject('Thể tích dựng lại lệch quá 0,1% so với lưới.');
   stage=9;
   const nearest=QA.makeBVH(localTriangles),surfaceSamples=candidateSamples(m,tolerance/2);
   let reverseError=0;for(const p of surfaceSamples){reverseError=Math.max(reverseError,nearest(p));if(reverseError>tolerance)break;}
   if(reverseError>tolerance)reject('Mặt cong dựng lại có vùng không khớp lưới STL.');
   return {ok:true,model:m,diagnostics:{kind:'rounded-cap-with-blind-circular-pocket',vertexMax:vertexError,meshSampleMax:sampleError,analyticSampleMax:reverseError,sampledMax:Math.max(sampleError,reverseError),rms:Math.sqrt(squared/weight),normalMinDot:normalMin,sourceVolume:metrics.volume,analyticVolume:volume,relativeVolumeError:volumeError,surfaceSamples:surfaceSamples.length,tolerance,pocketDiameter:2*ring.radius,filletRadius:radius}};
  }catch(error){failures.push({stage,reason:error.message});}
 }
 failures.sort((a,b)=>b.stage-a.stage);
 reject(failures[0]?.reason||'Chưa nhận dạng được mặt cong một cách chắc chắn.');
 }catch(error){return {ok:false,reason:error.message||'Chưa nhận dạng được mặt cong.'};}
}
const api={recognize,roundedDistance,analyticVolume,candidateSamples};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CurveRecognition=api;
})(typeof self==='object'?self:globalThis);


