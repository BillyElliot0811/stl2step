/* Conservative mesh repair. Closed topology is not a self-intersection certificate. */
(function(root){
'use strict';
const Q=typeof module==='object'&&module.exports?require('./mesh-qa.js'):root.MeshQA;
const {sub,cross,dot,norm,area,bounds}=Q;
const edgeKey=(a,b)=>a<b?a+','+b:b+','+a;
function topology(triangles){
 const vertices=[],map=new Map(),faces=[],edges=new Map(),incident=[];
 for(const t of triangles){const ids=t.map(p=>{const k=p.join(',');if(!map.has(k)){map.set(k,vertices.length);vertices.push(p);incident.push([]);}return map.get(k);});const i=faces.length;faces.push(ids);for(const v of ids)incident[v].push(i);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],k=edgeKey(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push({face:i,a,b});}}
 const adj=faces.map(()=>[]),vertexAdj=vertices.map(()=>new Map());let boundaryEdges=0,nonmanifoldEdges=0,inconsistentEdges=0;
 for(const uses of edges.values()){
  if(uses.length===1)boundaryEdges++;else if(uses.length!==2)nonmanifoldEdges++;else if(uses[0].a===uses[1].a)inconsistentEdges++;
  for(let j=1;j<uses.length;j++){const a=uses[0].face,b=uses[j].face;adj[a].push(b);adj[b].push(a);}
  if(uses.length===2)for(const v of [uses[0].a,uses[0].b]){const m=vertexAdj[v],a=uses[0].face,b=uses[1].face;if(!m.has(a))m.set(a,[]);if(!m.has(b))m.set(b,[]);m.get(a).push(b);m.get(b).push(a);}
 }
 let pinchedVertices=0;
 incident.forEach((items,v)=>{const seen=new Set(),m=vertexAdj[v];let groups=0;for(const i of items)if(!seen.has(i)){groups++;const stack=[i];seen.add(i);while(stack.length)for(const n of m.get(stack.pop())||[])if(!seen.has(n)){seen.add(n);stack.push(n);}}if(groups>1)pinchedVertices++;});
 const components=[],faceComponent=new Int32Array(faces.length).fill(-1);
 for(let i=0;i<faces.length;i++)if(faceComponent[i]<0){const c=[],stack=[i],k=components.length;faceComponent[i]=k;while(stack.length){const j=stack.pop();c.push(j);for(const n of adj[j])if(faceComponent[n]<0){faceComponent[n]=k;stack.push(n);}}components.push(c);}
 const seen=new Set();let duplicates=0,degenerates=0;
 faces.forEach((f,i)=>{const k=f.slice().sort((a,b)=>a-b).join(',');if(seen.has(k))duplicates++;seen.add(k);if(new Set(f).size<3||area(triangles[i])<1e-18)degenerates++;});
 const b=bounds(triangles),ref=b.min.map((v,k)=>(v+b.max[k])/2);let signedVolume=0,totalArea=0;
 for(const t of triangles){signedVolume+=dot(sub(t[0],ref),cross(sub(t[1],ref),sub(t[2],ref)))/6;totalArea+=area(t);}
 const summary={triangles:triangles.length,vertices:vertices.length,edges:edges.size,components:components.length,boundaryEdges,nonmanifoldEdges,inconsistentEdges,pinchedVertices,duplicates,degenerates,closed:!boundaryEdges&&!nonmanifoldEdges&&!inconsistentEdges&&!pinchedVertices&&!duplicates&&!degenerates,bounds:b,area:totalArea,signedVolume,volume:Math.abs(signedVolume)};
 return {vertices,faces,edges,incident,components,faceComponent,summary};
}
function clean(triangles){const out=[],seen=new Set();for(const t of triangles){const u=sub(t[1],t[0]),v=sub(t[2],t[0]),w=sub(t[2],t[1]),lengths=[u,v,w].map(p=>dot(p,p)),k=t.map(p=>p.join(',')).sort().join(';');if(Math.min(...lengths)<=1e-14||norm(cross(u,v))<=Math.max(1e-14,Math.max(...lengths)*1e-12)||seen.has(k))continue;seen.add(k);out.push(t);}return out;}
function orient(triangles,top){
 const adjacency=triangles.map(()=>[]),bad=new Set(),flips=new Int8Array(triangles.length).fill(-1);let conflicts=0;
 for(const uses of top.edges.values()){if(uses.length===2){const [a,b]=uses,parity=a.a===b.a?1:0;adjacency[a.face].push([b.face,parity]);adjacency[b.face].push([a.face,parity]);}else if(uses.length>2)for(const u of uses)bad.add(top.faceComponent[u.face]);}
 for(let start=0;start<triangles.length;start++)if(flips[start]<0){const stack=[start];flips[start]=0;while(stack.length){const i=stack.pop();for(const [j,p]of adjacency[i]){const want=flips[i]^p;if(flips[j]<0){flips[j]=want;stack.push(j);}else if(flips[j]!==want){conflicts++;bad.add(top.faceComponent[i]);}}}}
 const boxes=top.components.map(c=>bounds(c.map(i=>triangles[i]))),ambiguous=new Set();
 if(boxes.length>256)for(let i=0;i<boxes.length;i++)ambiguous.add(i);
 else for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(boxes[i].min.every((v,k)=>v<=boxes[j].max[k]&&boxes[j].min[k]<=boxes[i].max[k])){ambiguous.add(i);ambiguous.add(j);}
 const open=new Set();for(const uses of top.edges.values())if(uses.length!==2)for(const u of uses)open.add(top.faceComponent[u.face]);
 let changed=0;
 top.components.forEach((items,c)=>{
  if(bad.has(c)){for(const i of items)flips[i]=0;return;}
  // Preserve the majority orientation for open and nested/touching components.
  let inverse=items.reduce((s,i)=>s+flips[i],0)>items.length/2;
  if(!open.has(c)&&!ambiguous.has(c)){
   const ref=boxes[c].min.map((v,k)=>(v+boxes[c].max[k])/2);let volume=0;
   for(const i of items){const t=triangles[i];volume+=(flips[i]?-1:1)*dot(sub(t[0],ref),cross(sub(t[1],ref),sub(t[2],ref)))/6;}inverse=volume<0;
  }
  for(const i of items){flips[i]^=Number(inverse);if(flips[i])changed++;}
 });
 return {triangles:triangles.map((t,i)=>flips[i]?[t[0],t[2],t[1]]:t),flipped:changed,conflicts:conflicts/2,ambiguous:ambiguous.size};
}
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const same2=(a,b,e)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=e;
function onSegment(a,b,p,e){return Math.abs(cross2(a,b,p))<=e*Math.max(e,Math.hypot(b[0]-a[0],b[1]-a[1]))&&p[0]>=Math.min(a[0],b[0])-e&&p[0]<=Math.max(a[0],b[0])+e&&p[1]>=Math.min(a[1],b[1])-e&&p[1]<=Math.max(a[1],b[1])+e;}
function segmentsIntersect(a,b,c,d,e){const u=cross2(a,b,c),v=cross2(a,b,d),w=cross2(c,d,a),x=cross2(c,d,b);return (u*v<0&&w*x<0)||onSegment(a,b,c,e)||onSegment(a,b,d,e)||onSegment(c,d,a,e)||onSegment(c,d,b,e);}
function inside(p,poly,e){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if(onSegment(a,b,p,e))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function boundaryLoops(top){
 const list=[...top.edges.values()].filter(u=>u.length===1).map(u=>u[0]),out=new Map(),incoming=new Map();
 for(const e of list){if(!out.has(e.a))out.set(e.a,[]);out.get(e.a).push(e);incoming.set(e.b,(incoming.get(e.b)||0)+1);}
 const seen=new Set(),loops=[];let ambiguousEdges=0;
 for(const first of list)if(!seen.has(first)){const loop=[],edges=[],local=new Set();let cur=first,valid=true;
  while(cur&&!local.has(cur.a)&&edges.length<=256){local.add(cur.a);seen.add(cur);loop.push(cur.a);edges.push(cur);if((out.get(cur.a)||[]).length!==1||incoming.get(cur.a)!==1){valid=false;break;}const next=out.get(cur.b)||[];if(next.length!==1){valid=false;break;}cur=next[0];}
  if(cur!==first||loop.length<3||loop.length>256)valid=false;
  if(valid)loops.push({ids:loop,edges});else ambiguousEdges+=edges.length;
 }
 return {loops,ambiguousEdges};
}
function planeFor(points,tolerance){
 const origin=points[0];let n=[0,0,0];for(let i=1;i<points.length-1;i++){const x=cross(sub(points[i],origin),sub(points[i+1],origin));if(norm(x)>norm(n))n=x;}const l=norm(n);if(l<1e-15)return null;n=n.map(x=>x/l);
 const epsilon=Math.max(1e-9,Math.min(tolerance,1e-5));if(points.some(p=>Math.abs(dot(sub(p,origin),n))>epsilon))return null;
 const axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),project=p=>p.filter((_,k)=>k!==axis).map((v,k)=>v-origin.filter((_,j)=>j!==axis)[k]);
 const poly=points.map(project),diameter=Math.max(...points.flatMap((p,i)=>points.slice(i+1).map(q=>norm(sub(p,q)))));
 return {origin,n,epsilon,project,poly,diameter};
}
function triangulate(poly,e){
 const indices=poly.map((_,i)=>i),out=[];let signed=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];signed+=a[0]*b[1]-b[0]*a[1];}const sign=Math.sign(signed);if(!sign)return null;
 for(let guard=0;indices.length>3&&guard<poly.length*poly.length;guard++){
  let cut=false;for(let k=0;k<indices.length;k++){
   const a=indices[(k+indices.length-1)%indices.length],b=indices[k],c=indices[(k+1)%indices.length],A=poly[a],B=poly[b],C=poly[c];if(sign*cross2(A,B,C)<=e*e)continue;
   if(indices.some(j=>j!==a&&j!==b&&j!==c&&sign*cross2(A,B,poly[j])>=-e*e&&sign*cross2(B,C,poly[j])>=-e*e&&sign*cross2(C,A,poly[j])>=-e*e))continue;
   out.push([a,b,c]);indices.splice(k,1);cut=true;break;
  }if(!cut)return null;
 }
 if(indices.length!==3||Math.abs(cross2(...indices.map(i=>poly[i])))<=e*e)return null;out.push(indices);return out;
}
function patchClear(triangles,loop,plane){
 const {poly,project,n,origin,epsilon:e}=plane;
 // Reject overlaps, crossings and contact with unrelated geometry in the cap plane.
 for(const t of triangles){
  const distances=t.map(p=>dot(sub(p,origin),n));if(Math.min(...distances)>e||Math.max(...distances)<-e)continue;
  const pts=t.map(project),allPlane=distances.every(d=>Math.abs(d)<=e);
  if(allPlane){
   const center=pts[0].map((v,k)=>(v+pts[1][k]+pts[2][k])/3);
   if(inside(center,poly,e))return false;
   for(const p of pts)if(inside(p,poly,e)&&!poly.some(q=>same2(p,q,e)))return false;
   for(let i=0;i<poly.length;i++)for(let j=0;j<3;j++){
    const a=poly[i],b=poly[(i+1)%poly.length],c=pts[j],d=pts[(j+1)%3];
    if(segmentsIntersect(a,b,c,d,e)&&!same2(a,c,e)&&!same2(a,d,e)&&!same2(b,c,e)&&!same2(b,d,e))return false;
   }
   // A large existing coplanar triangle enclosing the proposed patch is ambiguous.
   if(poly.some(p=>!pts.some(q=>same2(p,q,e))&&inside(p,pts,e)))return false;
  }else{
   const contacts=[];
   for(let j=0;j<3;j++){
    if(Math.abs(distances[j])<=e)contacts.push(pts[j]);
    const k=(j+1)%3;if(distances[j]*distances[k]<-e*e){const f=distances[j]/(distances[j]-distances[k]);contacts.push(pts[j].map((v,a)=>v+f*(pts[k][a]-v)));}
   }
   for(const p of contacts)if(inside(p,poly,e)&&!poly.some(q=>same2(p,q,e))) {
    // An existing edge on the boundary may have collinear points, but no contact inside.
    if(!poly.some((a,i)=>onSegment(a,poly[(i+1)%poly.length],p,e)))return false;
   }
   if(contacts.length>=2){const p=contacts[0],q=contacts[1],m=p.map((v,k)=>(v+q[k])/2);if(inside(m,poly,e)&&!poly.some((a,i)=>onSegment(a,poly[(i+1)%poly.length],m,e)))return false;}
  }
 }
 return true;
}
function process(triangles,{weldTolerance=1e-6,fillHoles=false,maxHoleDiameter=1,maxTriangles=20000}={}){
 if(!Array.isArray(triangles)||!triangles.length)throw new Error('Không có lưới để tiền xử lý.');
 if(!Number.isFinite(weldTolerance)||weldTolerance<1e-9||weldTolerance>1e-4)throw new Error('Dung sai ghép đỉnh không hợp lệ.');
 if(fillHoles&&(!Number.isFinite(maxHoleDiameter)||maxHoleDiameter<.001||maxHoleDiameter>10))throw new Error('Kích thước lỗ vá phải từ 0,001 đến 10 mm.');
 const beforeTop=topology(triangles),report={before:beforeTop.summary,after:null,weldedVertices:0,maxVertexDisplacement:0,removedTriangles:0,flippedTriangles:0,holesFilled:0,trianglesAdded:0,holesSkipped:0,skippedHoles:[],weldRolledBack:false,weldTolerance,maxHoleDiameter,fillHoles,topologyOnly:true,orientationConflicts:0,orientationAmbiguousComponents:0},warnings=[];
 let mesh=clean(triangles);report.removedTriangles=triangles.length-mesh.length;if(!mesh.length)throw new Error('Không còn tam giác hợp lệ sau tiền xử lý.');
 let top=topology(mesh);
 // Only boundary vertices can move; manifold closed meshes retain exact coordinates.
 if(top.summary.boundaryEdges&&top.summary.nonmanifoldEdges===0&&top.summary.pinchedVertices===0){
  const candidates=new Set();for(const u of top.edges.values())if(u.length===1){candidates.add(u[0].a);candidates.add(u[0].b);}
  const bins=new Map(),replacement=new Map(),origin=top.summary.bounds.min,tol=weldTolerance;let merges=0,displacement=0;
  if(top.summary.bounds.diagonal/tol<2e15)for(const id of candidates){const p=top.vertices[id],cell=p.map((v,k)=>Math.floor((v-origin[k])/tol));let best=-1,distance=tol;
   for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const j of bins.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))||[]){const d=norm(sub(p,top.vertices[j]));if(d<=distance){best=j;distance=d;}}
   if(best>=0){replacement.set(id,best);merges++;displacement=Math.max(displacement,distance);}else{const k=cell.join(',');if(!bins.has(k))bins.set(k,[]);bins.get(k).push(id);}
  }
  if(merges){const candidate=clean(top.faces.map(f=>f.map(i=>top.vertices[replacement.has(i)?replacement.get(i):i])));
   if(candidate.length){const next=topology(candidate);if(next.summary.nonmanifoldEdges<=top.summary.nonmanifoldEdges&&next.summary.pinchedVertices<=top.summary.pinchedVertices&&next.summary.boundaryEdges<=top.summary.boundaryEdges&&next.summary.components<=top.summary.components){report.weldedVertices=merges;report.maxVertexDisplacement=displacement;report.removedTriangles+=mesh.length-candidate.length;mesh=candidate;top=next;}else report.weldRolledBack=true;}else report.weldRolledBack=true;
  }
 }
 const oriented=orient(mesh,top);mesh=oriented.triangles;report.flippedTriangles=oriented.flipped;report.orientationConflicts=oriented.conflicts;report.orientationAmbiguousComponents=oriented.ambiguous;top=topology(mesh);
 const boundary=boundaryLoops(top);report.boundaryLoops=boundary.loops.length;report.ambiguousBoundaryEdges=boundary.ambiguousEdges;
 const skip=(loop,reason,diameter=null)=>{report.holesSkipped++;if(report.skippedHoles.length<50)report.skippedHoles.push({vertices:loop.ids.length,diameter,reason});};
 if(fillHoles&&boundary.loops.length){
  if(top.summary.nonmanifoldEdges||top.summary.pinchedVertices||oriented.conflicts){for(const l of boundary.loops)skip(l,'Lưới còn cạnh/đỉnh bất thường hoặc xung đột hướng.');}
  else if(boundary.loops.length>128){warnings.push('Quá nhiều biên hở; bỏ qua vá lỗ để giới hạn tài nguyên.');report.holesSkipped=boundary.loops.length;}
  else{
   const planes=boundary.loops.map(l=>planeFor(l.ids.map(i=>top.vertices[i]),weldTolerance));
   let patchWork=0;
   for(let i=0;i<boundary.loops.length;i++){
    const l=boundary.loops[i],p=planes[i];if(!p){skip(l,'Biên không phẳng hoặc suy biến.');continue;}if(p.diameter>maxHoleDiameter){skip(l,'Lớn hơn kích thước lỗ vá tối đa.',p.diameter);continue;}
    const poly=p.poly,e=p.epsilon;let ambiguous=false;
    for(let a=0;a<poly.length;a++)for(let b=a+1;b<poly.length;b++)if(b!==a+1&&!(a===0&&b===poly.length-1)&&segmentsIntersect(poly[a],poly[(a+1)%poly.length],poly[b],poly[(b+1)%poly.length],e))ambiguous=true;
    // Do not independently cap nested boundary loops (e.g. a tube mouth).
    for(let j=0;j<boundary.loops.length;j++)if(j!==i){const q=boundary.loops[j].ids.map(k=>top.vertices[k]);if(q.every(v=>Math.abs(dot(sub(v,p.origin),p.n))<=e)&&q.some(v=>inside(p.project(v),poly,e)))ambiguous=true;const pj=planes[j];if(pj&&l.ids.some(k=>Math.abs(dot(sub(top.vertices[k],pj.origin),pj.n))<=pj.epsilon&&inside(pj.project(top.vertices[k]),pj.poly,pj.epsilon)))ambiguous=true;}
    if(ambiguous){skip(l,'Biên tự cắt, lồng nhau hoặc chạm nhau.',p.diameter);continue;}
    patchWork+=mesh.length*p.poly.length;
    if(patchWork>2000000){skip(l,'Vượt ngân sách kiểm tra mặt vá.',p.diameter);continue;}
    if(!patchClear(mesh,l,p)){skip(l,'Mặt vá chạm hoặc chồng lấn hình học hiện có.',p.diameter);continue;}
    const ears=triangulate(poly,e);if(!ears){skip(l,'Không chia được biên thành tam giác an toàn.',p.diameter);continue;}
    if(mesh.length+ears.length>maxTriangles){skip(l,'Vượt giới hạn số tam giác.',p.diameter);continue;}
    const patch=ears.map(f=>[f[0],f[2],f[1]].map(k=>top.vertices[l.ids[k]]));
    const candidate=mesh.concat(patch),next=topology(candidate),old=topology(mesh).summary;
    if(next.summary.nonmanifoldEdges>old.nonmanifoldEdges||next.summary.pinchedVertices>old.pinchedVertices||next.summary.inconsistentEdges>old.inconsistentEdges||next.summary.duplicates||next.summary.degenerates||next.summary.boundaryEdges!==old.boundaryEdges-l.ids.length){skip(l,'Kiểm tra topology sau vá không đạt.',p.diameter);continue;}
    mesh=candidate;report.holesFilled++;report.trianglesAdded+=patch.length;
   }
  }
 }
 report.after=topology(mesh).summary;
 if(report.weldRolledBack)warnings.push('Đã hủy ghép đỉnh vì gây lỗi topology mới.');
 if(report.after.nonmanifoldEdges)warnings.push('Tiền xử lý còn '+report.after.nonmanifoldEdges+' cạnh có hơn 2 tam giác kề; không tự xóa mặt để đoán hình dạng.');
 if(report.after.pinchedVertices)warnings.push('Còn '+report.after.pinchedVertices+' đỉnh nối các vùng mặt bất thường.');
 if(report.after.boundaryEdges)warnings.push('Còn '+report.after.boundaryEdges+' cạnh biên hở sau tiền xử lý.');
 if(report.orientationConflicts)warnings.push('Có xung đột hướng mặt; giữ nguyên vùng không thể sửa chắc chắn.');
 if(fillHoles&&report.holesSkipped)warnings.push('Bỏ qua '+report.holesSkipped+' biên hở vì vượt kích thước hoặc chưa đủ điều kiện vá.');
 if(report.ambiguousBoundaryEdges)warnings.push('Có biên hở phân nhánh hoặc quá dài, không tự vá.');
 return {triangles:mesh,report,warnings};
}
const api={process,analyze:t=>topology(t).summary};if(typeof module==='object'&&module.exports)module.exports=api;root.MeshPreprocess=api;
})(typeof self==='object'?self:globalThis);
