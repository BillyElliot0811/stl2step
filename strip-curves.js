/* Recover circular extrusion bands and rebuild their planar cap wires. */
(function(root){
'use strict';
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),sub=(a,b)=>a.map((x,k)=>x-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(x=>x/Math.hypot(...a));
const key=(a,b)=>a<b?a+','+b:b+','+a;
function detect(ts,tolerance=.01,{splineMode=false,exclude=[]}={}){
 if(!Number.isFinite(tolerance)||tolerance<.0001||tolerance>.1)throw Error('Invalid curve tolerance');
 if(ts.length>10000)return {vertices:[],groups:[],strips:[],reason:'Mesh exceeds bounded strip recognition budget'};
 let fitWork=0;
 const vs=[],vm=new Map(),edges=new Map();
 const id=p=>{const k=p.join(',');if(!vm.has(k)){vm.set(k,vs.length);vs.push(p);}return vm.get(k);};
 const fs=ts.map((t,i)=>{const ids=t.map(id),normal=unit(cross(sub(t[1],t[0]),sub(t[2],t[0])));for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],s=key(a,b);if(!edges.has(s))edges.set(s,[]);edges.get(s).push({i,a,b});}return {ids,normal};});
 const parent=fs.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(const e of edges.values())if(e.length===2&&dot(fs[e[0].i].normal,fs[e[1].i].normal)>1-1e-10)parent[find(e[0].i)]=find(e[1].i);
 const gm=new Map();fs.forEach((f,i)=>{const g=find(i);if(!gm.has(g))gm.set(g,{ids:[],normal:f.normal,boundary:[]});gm.get(g).ids.push(i);});
 for(const e of edges.values())for(const h of e)if(e.length!==2||find(e[0].i)!==find(e[1].i))gm.get(find(h.i)).boundary.push(h);
 const groups=[...gm.values()];groups.forEach((g,i)=>{g.index=i;g.ids.forEach(j=>fs[j].group=i);const remaining=new Set(g.boundary);g.loops=[];while(remaining.size){const first=remaining.values().next().value,loop=[first.a];let e=first;do{remaining.delete(e);if(e.b===first.a)break;loop.push(e.b);const next=[...remaining].filter(h=>h.a===e.b);if(!next.length){g.bad=true;break;}const incoming=unit(sub(vs[e.b],vs[e.a]));next.sort((a,b)=>{const angle=h=>{const v=unit(sub(vs[h.b],vs[h.a]));return Math.atan2(dot(cross(incoming,v),g.normal),dot(incoming,v));};return angle(b)-angle(a);});e=next[0];}while(remaining.size);g.loops.push(loop);if(g.bad)break;}});
 const panels=[];
 for(const g of groups){if(g.bad||g.loops.length!==1)continue;let q=g.loops[0].slice(),changed=true;while(changed&&q.length>3){changed=false;for(let i=0;i<q.length;i++){const a=unit(sub(vs[q[i]],vs[q[(i+q.length-1)%q.length]])),b=unit(sub(vs[q[(i+1)%q.length]],vs[q[i]]));if(dot(a,b)>1-1e-10){q.splice(i,1);changed=true;break;}}}if(q.length!==4)continue;
  for(let k=0;k<2;k++){const a=vs[q[k]],b=vs[q[k+1]],c=vs[q[(k+2)%4]],d=vs[q[(k+3)%4]],v=sub(b,a),w=sub(c,d);if(Math.hypot(...sub(v,w))>1e-5||Math.abs(dot(unit(v),unit(sub(d,a))))>1e-5)continue;panels.push({g:g.index,q,ends:[key(q[k],q[k+1]),key(q[(k+2)%4],q[(k+3)%4])],axis:unit(v)});}
 }
 const strips=[],used=new Set(exclude);
 for(const seed of panels){if(used.has(seed.g))continue;const pool=panels.filter(p=>!used.has(p.g)&&Math.abs(dot(p.axis,seed.axis))>1-1e-10),adj=new Map();for(const p of pool)for(const e of p.ends){if(!adj.has(e))adj.set(e,[]);adj.get(e).push(p);}const found=new Map(),todo=[seed];while(todo.length){const p=todo.pop();if(found.has(p.g))continue;found.set(p.g,p);for(const e of p.ends)for(const n of adj.get(e)||[])if(dot(groups[p.g].normal,groups[n.g].normal)>Math.cos(Math.PI/12)&&!found.has(n.g))todo.push(n);}
  if(found.size<4)continue;
  const boundary=[...found.values()].flatMap(p=>p.ends).filter(e=>[...found.values()].filter(p=>p.ends.includes(e)).length===1);if(boundary.length!==2)continue;
  const order=[],chain=[boundary[0]];let edge=boundary[0],prev=-1;while(true){const p=(adj.get(edge)||[]).find(p=>found.has(p.g)&&p.g!==prev);if(!p)break;order.push(p);prev=p.g;edge=p.ends.find(e=>e!==edge);chain.push(edge);if(edge===boundary[1])break;if(order.length>found.size)break;}if(order.length!==found.size)continue;
  const axis=seed.axis;let lo=null,hi=null;const lower=[],upper=[];for(const e of chain){const ids=e.split(',').map(Number).sort((a,b)=>dot(vs[a],axis)-dot(vs[b],axis));lower.push(ids[0]);upper.push(ids[1]);if(lo===null){lo=dot(vs[ids[0]],axis);hi=dot(vs[ids[1]],axis);}if(Math.abs(dot(vs[ids[0]],axis)-lo)>1e-5||Math.abs(dot(vs[ids[1]],axis)-hi)>1e-5){lo=NaN;break;}}if(!Number.isFinite(lo))continue;
  for(let start=0;start<order.length-3;start++){let accepted=false;for(let end=order.length;end>=start+4;end--){if((fitWork+=end-start)>1000000)return {vertices:[],groups:[],strips:[],reason:'Curve fit budget exceeded'};const runOrder=order.slice(start,end),runLower=lower.slice(start,end+1),runUpper=upper.slice(start,end+1);
  const p0=vs[runLower[0]],pm=vs[runLower[Math.floor(runLower.length/2)]],pe=vs[runLower.at(-1)],u=unit(sub(pm,p0)),v=unit(cross(axis,u)),coords=runLower.map(i=>[dot(sub(vs[i],p0),u),dot(sub(vs[i],p0),v)]),a=coords[Math.floor(coords.length/2)],b=coords.at(-1),det=2*(a[0]*b[1]-a[1]*b[0]);if(Math.abs(det)<1e-10)continue;const aa=dot(a,a),bb=dot(b,b),c=[(aa*b[1]-bb*a[1])/det,(a[0]*bb-b[0]*aa)/det],radius=Math.hypot(...c),residual=Math.max(...coords.map(p=>Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1])-radius)));let sag=0;for(let i=1;i<coords.length;i++){const chord=Math.hypot(...sub(coords[i],coords[i-1]));sag=Math.max(sag,radius-Math.sqrt(Math.max(0,radius*radius-chord*chord/4)));}if(!splineMode&&(residual>Math.min(tolerance*.05,1e-4)||sag+residual>tolerance))continue;
  let turn=0,sign=0,monotone=true;for(let i=1;i<coords.length;i++){const a=sub(coords[i-1],c),b=sub(coords[i],c),angle=Math.atan2(a[0]*b[1]-a[1]*b[0],dot(a,b));if(Math.abs(angle)>Math.PI/12+1e-4||Math.abs(angle)<1e-8||(sign&&sign*angle<0))monotone=false;sign=Math.sign(angle);turn+=angle;}if(!splineMode&&(!monotone||Math.abs(turn)<.05||Math.abs(turn)>Math.PI*1.99))continue;
  const caps=[runLower,runUpper].map(ids=>ids.slice(1).map((b,i)=>{const es=edges.get(key(ids[i],b))||[];return es.map(e=>fs[e.i].group).filter(g=>!runOrder.some(p=>p.g===g));}));if(caps.some(cap=>cap.some(gs=>gs.length!==1)||new Set(cap.flat()).size!==1))continue;
  if(runOrder.some(p=>used.has(p.g)))continue;for(const p of runOrder)used.add(p.g);strips.push({kind:splineMode?'spline':'circle',groups:runOrder.map(p=>p.g),lower:runLower,upper:runUpper,axis,length:hi-lo,radius,residual,sag,caps:caps.map(cap=>cap[0][0]),normal:groups[runOrder[Math.floor(runOrder.length/2)].g].normal});start=end-1;accepted=true;break;} }
 }
 return {vertices:vs,groups,strips};
}



function sewBands(oc,d,keep=x=>x,tolerance=.01){
 const point=p=>keep(new oc.gp_Pnt_3(...p)),vs=d.vertices,removed=new Set(),arcs=new Map(),sew=keep(new oc.BRepBuilderAPI_Sewing(1e-4,true,true,true,false));
 function arc(ids,kind){if(kind==='spline'){
 const points=keep(new oc.TColgp_Array1OfPnt_2(1,ids.length));ids.forEach((id,i)=>points.SetValue(i+1,point(vs[id])));
 const fit=keep(new oc.GeomAPI_PointsToBSpline_2(points,3,3,oc.GeomAbs_Shape.GeomAbs_C2,1e-7));if(!fit.IsDone())throw Error('Spline fit failed');
 const h=keep(fit.Curve()),curveObject=keep(h.get()),samples=[],n=2048,a=curveObject.FirstParameter(),b=curveObject.LastParameter();
 for(let i=0;i<=n;i++){const p=curveObject.Value(a+(b-a)*i/n);samples.push([p.X(),p.Y(),p.Z()]);p.delete();}
 if(Math.hypot(...sub(samples[0],vs[ids[0]]))>1e-5||Math.hypot(...sub(samples.at(-1),vs[ids.at(-1)]))>1e-5)throw Error('Spline endpoints moved');
 const distance=(p,chain)=>{let best=Infinity;for(let i=1;i<chain.length;i++){const v=sub(chain[i],chain[i-1]),w=sub(p,chain[i-1]),t=Math.max(0,Math.min(1,dot(v,w)/dot(v,v)));best=Math.min(best,Math.hypot(...sub(w,v.map(x=>x*t))));}return best;};
 const original=ids.map(i=>vs[i]);let error=Math.max(...samples.map(p=>distance(p,original)));
 for(let i=1;i<original.length;i++)for(let j=0;j<=8;j++)error=Math.max(error,distance(original[i-1].map((x,k)=>x+(original[i][k]-x)*j/8),samples));
 if(!Number.isFinite(error)||error>tolerance*.9)throw Error('Spline sampled deviation '+error+' ('+ids.length+' points) exceeds tolerance');
 d.splineSampledMax=Math.max(d.splineSampledMax||0,error);
 const handle=keep(new oc.Handle_Geom_Curve_2(curveObject)),maker=keep(new oc.BRepBuilderAPI_MakeEdge_24(handle));return keep(maker.Edge());
 }const a=keep(new oc.GC_MakeArcOfCircle_4(point(vs[ids[0]]),point(vs[ids[Math.floor(ids.length/2)]]),point(vs[ids.at(-1)])));const h=keep(a.Value()),curve=keep(new oc.Handle_Geom_Curve_2(h.get())),maker=keep(new oc.BRepBuilderAPI_MakeEdge_24(curve));return keep(maker.Edge());}
 const accepted=[];for(const s of d.strips){let ends;try{ends=[arc(s.lower,s.kind),arc(s.upper,s.kind)];}catch(e){if(s.kind!=='spline'||typeof e==='number'||e instanceof WebAssembly.RuntimeError)throw e;(d.rejectedSplines||(d.rejectedSplines=[])).push(e.message);continue;}accepted.push(s);s.groups.forEach(g=>removed.add(g));for(const [j,ids] of [s.lower,s.upper].entries()){const a={ids,edge:ends[j]};for(let i=1;i<ids.length;i++)arcs.set(key(ids[i-1],ids[i]),a);}const edge=arcs.get(key(s.lower[0],s.lower[1])).edge,vec=keep(new oc.gp_Vec_4(...s.axis.map(v=>v*s.length))),prism=keep(new oc.BRepPrimAPI_MakePrism_1(edge,vec,false,true)),face=keep(prism.Shape());const tangent=sub(vs[s.lower[Math.min(s.lower.length-1,Math.floor(s.lower.length/2)+1)]],vs[s.lower[Math.max(0,Math.floor(s.lower.length/2)-1)]]);if(dot(cross(tangent,s.axis),s.normal)<0)face.Reverse();sew.Add(face);}
 d.strips=accepted;if(!accepted.length)throw Error('No curved bands passed validation');
 function wire(loop){let start=loop.findIndex((a,i)=>arcs.get(key(a,loop[(i+1)%loop.length]))!==arcs.get(key(loop[(i+loop.length-1)%loop.length],a)));if(start<0)start=0;const q=loop.slice(start).concat(loop.slice(0,start)),w=keep(new oc.BRepBuilderAPI_MakeWire_1());for(let i=0;i<q.length;){const a=q[i],b=q[(i+1)%q.length],arc=arcs.get(key(a,b));if(arc){if(a!==arc.ids[0]&&a!==arc.ids.at(-1))throw Error('Partial arc boundary');let edge=arc.edge;if(a!==arc.ids[0])edge=keep(oc.TopoDS.Edge_1(keep(edge.Reversed())));w.Add_1(edge);i+=arc.ids.length-1;}else{const e=keep(new oc.BRepBuilderAPI_MakeEdge_3(point(vs[a]),point(vs[b])));w.Add_1(keep(e.Edge()));i++;}}if(!w.IsDone())throw Error('Wire failed');return keep(w.Wire());}
 for(const g of d.groups){if(removed.has(g.index))continue;if(g.bad)throw Error('Branching planar boundary '+g.index);const origin=vs[g.loops[0][0]];if(g.loops.some(l=>l.some(i=>Math.abs(dot(sub(vs[i],origin),g.normal))>Math.min(5e-5,tolerance*.05))))throw Error('Nonplanar cap');const area=loop=>loop.reduce((sum,a,i)=>sum+dot(cross(vs[a],vs[loop[(i+1)%loop.length]]),g.normal),0);const loops=g.loops.slice().sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));const maker=keep(new oc.BRepBuilderAPI_MakeFace_15(wire(loops[0]),true));for(const l of loops.slice(1))maker.Add(wire(l));if(!maker.IsDone())throw Error('Face failed '+g.index);const face=keep(maker.Face()),ad=keep(new oc.BRepAdaptor_Surface_2(face,true)),pl=keep(ad.Plane()),axis=keep(pl.Axis()),dir=keep(axis.Direction());if(dot([dir.X(),dir.Y(),dir.Z()],g.normal)<0)face.Reverse();sew.Add(face);}
 sew.Perform(keep(new oc.Handle_Message_ProgressIndicator_1()));return {shape:keep(sew.SewedShape()),free:sew.NbFreeEdges(),multiple:sew.NbMultipleEdges()};
}


function build(oc,triangles,{tolerance=.01,contactCandidate=null,contactTolerance=.01}={},keep){
 const d=detect(triangles,tolerance),splines=detect(triangles,tolerance,{splineMode:true,exclude:d.strips.flatMap(s=>s.groups)});splines.strips=splines.strips.filter(s=>s.lower.length<=129).slice(0,32);for(const s of splines.strips){const lengths=s.lower.slice(1).map((b,i)=>Math.hypot(...sub(d.vertices[b],d.vertices[s.lower[i]]))),median=lengths.slice().sort((a,b)=>a-b)[Math.floor(lengths.length/2)];let a=0,b=lengths.length;while(b-a>=5&&lengths[a]>median*3)a++;while(b-a>=5&&lengths[b-1]>median*3)b--;s.lower=s.lower.slice(a,b+1);s.upper=s.upper.slice(a,b+1);s.groups=s.groups.slice(a,b);}d.strips.push(...splines.strips);if(!d.strips.length)throw Error('Không tìm thấy dải cung tròn đủ điều kiện.');
 const T=oc.TopAbs_ShapeEnum,parts=(s,t)=>{const ex=keep(new oc.TopExp_Explorer_2(s,t,T.TopAbs_SHAPE)),out=[];while(ex.More()){out.push(keep(ex.Current()));ex.Next();}return out;};
 const before=root.MeshPreprocess.analyze(triangles),sewn=sewBands(oc,d,keep,tolerance),shells=parts(sewn.shape,T.TopAbs_SHELL);
 if(sewn.free||shells.length!==1||(!contactCandidate?.eligible&&sewn.multiple))throw Error('Mặt cong dựng lại chưa tạo một vỏ kín.');
 const shell=keep(oc.TopoDS.Shell_1(shells[0]));if(parts(sewn.shape,T.TopAbs_FACE).length!==parts(shell,T.TopAbs_FACE).length)throw Error('Loose faces outside shell');if(!oc.BRep_Tool.IsClosed_1(shell))throw Error('Vỏ mặt cong chưa kín.');
 let shape=keep(keep(new oc.BRepBuilderAPI_MakeSolid_3(shell)).Solid());oc.BRepLib.OrientClosedSolid(shape);
 const volume=s=>{const p=keep(new oc.GProp_GProps_1());oc.BRepGProp.VolumeProperties_1(s,p,true,false,false);return p.Mass();};
 const reconstructedVolume=volume(shape);if(!Number.isFinite(reconstructedVolume)||reconstructedVolume<=0||Math.abs(reconstructedVolume-before.volume)>Math.abs(before.volume)*.001)throw Error('Thể tích sau nhận dạng vượt giới hạn 0,1%.');
 let contactRepair=null;
 if(contactCandidate?.eligible){const cut=root.ContactKernel.build(oc,shell,{...contactCandidate,sourceVolume:reconstructedVolume},{tolerance:contactTolerance},keep);shape=cut.shape;contactRepair=cut.stats;}
 if(!keep(new oc.BRepCheck_Analyzer(shape,true)).IsValid_2()||parts(shape,T.TopAbs_SOLID).length!==1||parts(shape,T.TopAbs_SHELL).length!==1)throw Error('Khối mặt cong không hợp lệ.');
 const box=keep(new oc.Bnd_Box_1());oc.BRepBndLib.Add(shape,box,false);const lo=keep(box.CornerMin()),hi=keep(box.CornerMax()),bounds={min:[lo.X(),lo.Y(),lo.Z()],max:[hi.X(),hi.Y(),hi.Z()]},bboxError=Math.max(...bounds.min.map((v,k)=>Math.abs(v-before.bounds.min[k])),...bounds.max.map((v,k)=>Math.abs(v-before.bounds.max[k])));if(bboxError>tolerance)throw Error('Kích thước bao sau nhận dạng vượt dung sai.');
 const faces=parts(shape,T.TopAbs_FACE).length,finalVolume=volume(shape);return {shape,contactRepair,faces,stats:{method:'circular-extrusion-bands',bands:d.strips.filter(s=>s.kind==='circle').length,splineBands:d.strips.filter(s=>s.kind==='spline').length,splineSampledMax:d.splineSampledMax||0,rejectedSplines:d.rejectedSplines||[],maxFitResidual:Math.max(0,...d.strips.filter(s=>s.kind==='circle').map(s=>s.residual)),maxChordDeviation:Math.max(0,...d.strips.filter(s=>s.kind==='circle').map(s=>s.sag+s.residual)),sourceVolume:before.volume,volume:finalVolume,relativeVolumeChange:(finalVolume-before.volume)/before.volume,bboxError,tolerance,radii:d.strips.filter(s=>s.kind==='circle').map(s=>s.radius)}};
}
const api={detect,build};if(typeof module==='object'&&module.exports)module.exports=api;root.StripCurves=api;
})(typeof self==='object'?self:globalThis);

