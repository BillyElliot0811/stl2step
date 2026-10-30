/* Detect isolated four-face edge contacts between extruded convex material tips.
 * Detection is conservative: ordinary holes, intersecting sheets and defect
 * chains are intentionally not eligible for the contact regularization. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./mesh-qa.js'):root.MeshQA);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ContactDetection=api;
})(typeof self!=='undefined'?self:globalThis,function(QA){
'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(...a), unit=a=>mul(a,1/len(a));
const normal=t=>unit(cross(sub(t[1],t[0]),sub(t[2],t[0])));
const key=(a,b)=>a<b?a+':'+b:b+':'+a;
function topology(triangles){
 const vertices=[],ids=new Map(),faces=[],edges=new Map(),incident=[];
 for(let i=0;i<triangles.length;i++){
  const f=triangles[i].map(p=>{
   const k=p.map(x=>x===0?0:x).join(',');let id=ids.get(k);
   if(id===undefined){id=vertices.length;ids.set(k,id);vertices.push(p);incident.push([]);}
   incident[id].push(i);return id;
  });faces.push(f);
  for(let j=0;j<3;j++){
   const a=f[j],b=f[(j+1)%3],k=key(a,b);
   if(!edges.has(k))edges.set(k,{a:Math.min(a,b),b:Math.max(a,b),uses:[]});
   edges.get(k).uses.push({face:i,a,b});
  }
 }
 return {vertices,faces,edges,incident};
}
function fanComponents(top,vertex){
 const todo=new Set(top.incident[vertex]),result=[];
 while(todo.size){
  const seed=todo.values().next().value,q=[seed],part=[];todo.delete(seed);
  while(q.length){
   const f=q.pop();part.push(f);
   for(const v of top.faces[f]){
    if(v===vertex)continue;const edge=top.edges.get(key(vertex,v));
    if(edge.uses.length!==2)continue;
    for(const use of edge.uses)if(todo.delete(use.face))q.push(use.face);
   }
  }result.push(part);
 }return result;
}
function pointTriangleDistance(p,t){
 const a=t[0],b=t[1],c=t[2],ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return len(ap);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
 if(d3>=0&&d4<=d3)return len(bp);
 const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0)return len(sub(p,add(a,mul(ab,d1/(d1-d3)))));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
 if(d6>=0&&d5<=d6)return len(cp);
 const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0)return len(sub(p,add(a,mul(ac,d2/(d2-d6)))));
 const va=d3*d6-d5*d4;
 if(va<=0&&d4-d3>=0&&d5-d6>=0)return len(sub(p,add(b,mul(sub(c,b),(d4-d3)/((d4-d3)+(d5-d6))))));
 const denom=1/(va+vb+vc);return len(sub(p,add(a,add(mul(ab,vb*denom),mul(ac,vc*denom)))));
}
function segmentDistance(p1,q1,p2,q2){
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r),clamp=v=>Math.max(0,Math.min(1,v));
 let s,t;
 if(a<1e-30&&e<1e-30)return len(r);
 if(a<1e-30){s=0;t=clamp(f/e);}
 else{const c=dot(d1,r);if(e<1e-30){t=0;s=clamp(-c/a);}else{
  const b=dot(d1,d2),denom=a*e-b*b;s=Math.abs(denom)>1e-30?clamp((b*f-c*e)/denom):0;t=(b*s+f)/e;
  if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}
 }}return len(sub(add(p1,mul(d1,s)),add(p2,mul(d2,t))));
}
function segmentTriangleDistance(a,b,t){
 const n=cross(sub(t[1],t[0]),sub(t[2],t[0])),ab=sub(b,a),den=dot(n,ab);
 if(Math.abs(den)>1e-20){
  const s=dot(n,sub(t[0],a))/den;
  if(s>=0&&s<=1&&pointTriangleDistance(add(a,mul(ab,s)),t)<1e-8)return 0;
 }
 let d=Math.min(pointTriangleDistance(a,t),pointTriangleDistance(b,t));
 for(let j=0;j<3;j++)d=Math.min(d,segmentDistance(a,b,t[j],t[(j+1)%3]));return d;
}
// A bounded conservative triangle-interference guard. This catches proper crossings,
// overlaps and contacts outside a shared topological vertex/edge; uncertain cases
// refuse repair rather than certify arbitrary self-intersecting input.
function intersectionGuard(triangles,top,box,maxWork=500000){
 const eps=Math.max(1e-9,box.diagonal*1e-10),normals=triangles.map(normal),items=triangles.map((t,i)=>({i,min:[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...t.map(p=>p[k])))}));
 const axis=box.size.indexOf(Math.max(...box.size));items.sort((a,b)=>a.min[axis]-b.min[axis]);let work=0,pairs=0;
 const segmentPoint=(p,a,b)=>{const ab=sub(b,a),l=dot(ab,ab),q=add(a,mul(ab,l?Math.max(0,Math.min(1,dot(sub(p,a),ab)/l)):0));return len(sub(p,q));};
 function pair(a,b){
  const A=triangles[a],B=triangles[b],shared=top.faces[a].filter(v=>top.faces[b].includes(v)),sharedPoints=shared.map(v=>top.vertices[v]);
  const allowed=p=>sharedPoints.some(q=>len(sub(p,q))<=eps*4)||(sharedPoints.length===2&&segmentPoint(p,...sharedPoints)<=eps*4);
  const na=normals[a],nb=normals[b],da=A.map(p=>dot(sub(p,B[0]),nb)),db=B.map(p=>dot(sub(p,A[0]),na));
  if(Math.min(...da)>eps||Math.max(...da)<-eps||Math.min(...db)>eps||Math.max(...db)<-eps)return false;
  if(len(cross(na,nb))<1e-8){
   if(da.some(d=>Math.abs(d)>eps)||db.some(d=>Math.abs(d)>eps))return false;
   const omit=na.map(Math.abs).indexOf(Math.max(...na.map(Math.abs))),project=p=>p.filter((_,k)=>k!==omit),AA=A.map(project),BB=B.map(project),orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
   const threshold=eps*Math.max(...A.flatMap((p,i)=>A.slice(i+1).map(q=>len(sub(p,q)))),...B.flatMap((p,i)=>B.slice(i+1).map(q=>len(sub(p,q))))),inside=(p,t)=>{const d=t.map((v,i)=>orient(v,t[(i+1)%3],p));return d.every(x=>x>threshold)||d.every(x=>x<-threshold);};
   if(AA.some(p=>inside(p,BB))||BB.some(p=>inside(p,AA)))return true;
   const center=t=>t[0].map((v,k)=>(v+t[1][k]+t[2][k])/3);if(inside(center(AA),BB)||inside(center(BB),AA))return true;
   for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const p=AA[i],q=AA[(i+1)%3],r=BB[j],u=BB[(j+1)%3],o=[orient(p,q,r),orient(p,q,u),orient(r,u,p),orient(r,u,q)];
    if(o[0]*o[1]<-threshold*threshold&&o[2]*o[3]<-threshold*threshold)return true;
    for(const point of [A[i],A[(i+1)%3]])if(segmentPoint(point,B[j],B[(j+1)%3])<=eps&&!allowed(point))return true;
    for(const point of [B[j],B[(j+1)%3]])if(segmentPoint(point,A[i],A[(i+1)%3])<=eps&&!allowed(point))return true;
   }
   return false;
  }
  for(const [T,U,dist]of [[A,B,da],[B,A,db]])for(let i=0;i<3;i++){
   if(Math.abs(dist[i])<=eps&&pointTriangleDistance(T[i],U)<=eps&&!allowed(T[i]))return true;
   const j=(i+1)%3;if(dist[i]*dist[j]<-eps*eps){const f=dist[i]/(dist[i]-dist[j]),p=add(T[i],mul(sub(T[j],T[i]),f));if(pointTriangleDistance(p,U)<=eps&&!allowed(p))return true;}
  }
  return false;
 }
 for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length&&items[b].min[axis]<=items[a].max[axis]+eps;b++){
  if(++work>maxWork)return {ok:false,reason:'Triangle-interference check exceeded its work budget.',work,pairs};
  const A=items[a],B=items[b];if(A.min.some((v,k)=>v>B.max[k]+eps||B.min[k]>A.max[k]+eps))continue;pairs++;
  if(pair(A.i,B.i))return {ok:false,reason:'Triangle intersections or overlaps outside shared mesh edges were found.',work,pairs,faces:[A.i,B.i]};
 }
 return {ok:true,work,pairs,epsilon:eps};
}
function detect(triangles,options={}){
 const tolerance=options.tolerance===undefined?.01:Number(options.tolerance),maxContacts=options.maxContacts===undefined?16:Number(options.maxContacts);
 if(!Number.isFinite(tolerance)||tolerance<.001||tolerance>.05)throw new Error('Contact tolerance must be between 0.001 and 0.05 mm.');
 if(!Number.isInteger(maxContacts)||maxContacts<1||maxContacts>64)throw new Error('Invalid maximum contact count.');
 const metrics=QA.metrics(triangles),base={eligible:false,contacts:[],reason:'',sourceVolume:metrics.volume,sourceSignedVolume:metrics.signedVolume,sourceBounds:metrics.bounds,sourceTriangles:triangles.length};
 function reject(reason){return {...base,reason};}
 if(!metrics.nonmanifoldEdges)return {...base,reason:'No non-manifold edge contacts.'};
 if(metrics.components!==1)return reject('Multiple disconnected or nested mesh components are unsupported for local contact repair.');
 if(metrics.boundaryEdges||metrics.inconsistentEdges||metrics.degenerates||metrics.duplicates)return reject('Other mesh defects must be repaired before edge contacts.');
 if(metrics.signedVolume<=0)return reject('Ambiguous or reversed global orientation.');
 const top=topology(triangles),bad=[...top.edges.values()].filter(e=>e.uses.length!==2);
 if(!bad.length)return reject('Exact and tolerance-based contact topology do not agree.');
 if(bad.length>maxContacts)return reject('Too many edge contacts for conservative repair.');
 if(bad.some(e=>e.uses.length!==4))return reject('Only isolated four-face edge contacts are supported.');
 const normals=triangles.map(normal),contacts=[],angular=2e-5;
 for(const edge of bad){
  const A=top.vertices[edge.a],B=top.vertices[edge.b],length=len(sub(B,A)),axis=unit(sub(B,A));
  if(length<tolerance*20)return reject('Contact is too short for the selected tolerance.');
  if(edge.uses.filter(u=>u.a===edge.a).length!==2)return reject('Inconsistent orientation at a four-face edge.');
  if(bad.some(e=>e!==edge&&[e.a,e.b].some(v=>v===edge.a||v===edge.b)))return reject('Connected defect chains are unsupported.');
  if(edge.uses.some(u=>Math.abs(dot(normals[u.face],axis))>angular))return reject('Contact side faces are not extruded along the edge.');
  const radial=edge.uses.map(u=>{
   const p=top.vertices[top.faces[u.face].find(v=>v!==edge.a&&v!==edge.b)],d=sub(p,A);
   return unit(sub(d,mul(axis,dot(d,axis))));
  });
  if(radial.some((r,i)=>!radial.some((s,j)=>i!==j&&dot(r,s)<-1+angular*angular)))return reject('Four-face edge is not a pair of crossing tip boundaries.');
  let capProof=null;
  for(const [end,sign] of [[edge.b,1],[edge.a,-1]]){
   const comps=fanComponents(top,end);
   if(comps.length!==2)continue;
   const wedges=[];
   for(const comp of comps){
    const ix=edge.uses.map((u,i)=>comp.includes(u.face)?i:-1).filter(i=>i>=0);
    if(ix.length!==2||!comp.some(i=>dot(normals[i],axis)*sign>1-angular))continue;
    const r0=radial[ix[0]],r1=radial[ix[1]];
    if(dot(r0,r1)<-.98||dot(r0,r1)>.98)continue;
    const inward=unit(add(r0,r1));
    if(ix.some(i=>dot(normals[edge.uses[i].face],inward)>-.02))continue;
    const sides=ix.map(i=>normals[edge.uses[i].face]);
    if(comp.some(i=>!sides.some(n=>dot(n,normals[i])>1-angular*angular)&&dot(normals[i],axis)*sign<1-angular))continue;
    wedges.push({faces:comp,sideFaces:ix.map(i=>edge.uses[i].face),inward});
   }
   if(wedges.length===2){capProof={end:top.vertices[end],wedges};break;}
  }
  if(!capProof)return reject('No unambiguous convex material tip caps at the contact.');
  let clearance=Infinity;
  for(let i=0;i<triangles.length;i++){
   if(top.faces[i].includes(edge.a)||top.faces[i].includes(edge.b))continue;
   const d=segmentTriangleDistance(A,B,triangles[i]);clearance=Math.min(clearance,d);
   if(d<tolerance*1.5)return reject('Another surface is too close to the contact for a local cut.');
  }
  contacts.push({start:A.slice(),end:B.slice(),length,clearance,capProof});
 }
 const contactVertices=new Set(bad.flatMap(e=>[e.a,e.b]));
 for(let v=0;v<top.vertices.length;v++)if(!contactVertices.has(v)&&fanComponents(top,v).length!==1)return reject('Additional pinched vertices outside contact endpoints are unsupported.');
 const interference=intersectionGuard(triangles,top,metrics.bounds);
 if(!interference.ok)return {...reject(interference.reason),interference};
 // Repair neighborhoods must be separated to keep each dimensional bound local.
 for(let i=0;i<contacts.length;i++)for(let j=i+1;j<contacts.length;j++)
  if(segmentDistance(contacts[i].start,contacts[i].end,contacts[j].start,contacts[j].end)<tolerance*4)return reject('Contact repair neighborhoods overlap.');
 return {...base,eligible:true,contacts,interference,reason:'Isolated zero-width contacts between convex extruded material tips.'};
}
return {detect};
});
