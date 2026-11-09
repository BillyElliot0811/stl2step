/* Finish convex cylindrical bands interrupted by embossed details. */
(function(root){
'use strict';
const xyz=p=>[p.X(),p.Y(),p.Z()],dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),sub=(a,b)=>a.map((x,k)=>x-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function finish(oc,input,triangles,tolerance,keep,normalized=false){
 const T=oc.TopAbs_ShapeEnum,parts=(s,t)=>{const e=keep(new oc.TopExp_Explorer_2(s,t,T.TopAbs_SHAPE)),out=[];while(e.More()){out.push(keep(e.Current()));e.Next();}return out;};
 const volume=s=>{const p=keep(new oc.GProp_GProps_1());oc.BRepGProp.VolumeProperties_1(s,p,true,false,false);return p.Mass();};
 const bounds=s=>{const b=keep(new oc.Bnd_Box_1());oc.BRepBndLib.AddOptimal(s,b,false,false);return [...xyz(keep(b.CornerMin())),...xyz(keep(b.CornerMax()))];};
 const valid=s=>!s.IsNull()&&parts(s,T.TopAbs_SOLID).length===1&&parts(s,T.TopAbs_SHELL).length===1&&oc.BRep_Tool.IsClosed_1(keep(oc.TopoDS.Shell_1(parts(s,T.TopAbs_SHELL)[0])))&&keep(new oc.BRepCheck_Analyzer(s,true)).IsValid_2();
 let shape=input,finished=0,removed=0;const rejected=[];
 if(triangles.length>10000)return {shape,finished,removed,rejected};
 const candidates=[];
 for(const f of parts(input,T.TopAbs_FACE)){
  const ad=keep(new oc.BRepAdaptor_Surface_2(keep(oc.TopoDS.Face_1(f)),true));if(ad.GetType().value!==1)continue;
  const c=keep(ad.Cylinder()),pos=keep(c.Position()),o=xyz(keep(c.Location())),x=xyz(keep(pos.XDirection())),y=xyz(keep(pos.YDirection())),z=xyz(keep(pos.Direction())),r=c.Radius(),lo=ad.FirstUParameter(),hi=ad.LastUParameter(),vl=ad.FirstVParameter(),vh=ad.LastVParameter(),mid=(lo+hi)/2;
  if(r<tolerance*20||hi-lo<.1||hi-lo>Math.PI*1.9||!Number.isFinite(vh-vl))continue;
  const coords=p=>{const v=sub(p,o),xx=dot(v,x),yy=dot(v,y);let u=Math.atan2(yy,xx);u+=Math.round((mid-u)/(2*Math.PI))*2*Math.PI;return {u,v:dot(v,z),err:Math.abs(Math.hypot(xx,yy)-r),radial:x.map((n,k)=>n*xx+y[k]*yy)};};
  let low=lo,high=hi,support=0;
  for(const tri of triangles){const ps=tri.map(coords),n=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])),len=Math.hypot(...n);if(!len)continue;
   if(ps.every(p=>p.err<Math.min(1e-4,tolerance*.01)&&p.u>=lo-.2&&p.u<=hi+.2&&p.v>=vl-1e-4&&p.v<=vh+1e-4&&dot(n,p.radial)/(len*r)>.99)){low=Math.min(low,...ps.map(p=>p.u));high=Math.max(high,...ps.map(p=>p.u));support++;}}
  const extension=Math.max(lo-low,high-hi),sag=r*(1-Math.cos(extension/2));if(extension<.001||sag>tolerance*.9||support<4)continue;
  candidates.push({c,pos,coords,r,lo,hi,low,high,vl,vh,z,extension,sag});
 }
 // Normalize curve parameter ranges before exact bounds and Boolean operations.
 // STEP normalization makes trimmed parameter ranges consistent for the Boolean pass.
 if(candidates.length&&!normalized){
  const path='/j.step';
  try{const writer=keep(new oc.STEPControl_Writer_1());if(writer.Transfer(input,oc.STEPControl_StepModelType.STEPControl_AsIs,true).value!==1||writer.Write(path).value!==1)throw Error('Cannot normalize junction input');const reader=keep(new oc.STEPControl_Reader_1());if(reader.ReadFile(path).value!==1||reader.TransferRoots()<1)throw Error('Cannot reload junction input');const result=finish(oc,keep(reader.OneShape()),triangles,tolerance,keep,true);return result.finished?result:{...result,shape:input};}
  catch(e){if(typeof e==='number'||e instanceof WebAssembly.RuntimeError)throw e;return {shape:input,finished:0,removed:0,rejected:[e.message||String(e)]};}
  finally{try{oc.FS.unlink(path);}catch(_){}}
 }
 for(const s of candidates.slice(0,8)){
  try{
   const oldFaces=parts(shape,T.TopAbs_FACE).length,oldVolume=volume(shape),oldBounds=bounds(shape),eps=Math.min(5e-5,tolerance*.005);
   // Work on a copy: increasing local modelling tolerance must not mutate fallback.
   const copy=keep(new oc.BRepBuilderAPI_Copy_2(shape,true,false)),base=keep(copy.Shape());
   const location=keep(s.c.Location()),origin=xyz(location),offset=s.z.map(n=>n*s.vh),axis=keep(new oc.gp_Ax2_2(keep(new oc.gp_Pnt_3(...origin.map((n,k)=>n+offset[k]))),keep(new oc.gp_Dir_4(...s.z)),keep(s.pos.XDirection())));
   const edgeArc=radius=>{const circ=keep(new oc.gp_Circ_2(axis,radius)),arc=keep(new oc.GC_MakeArcOfCircle_1(circ,s.low,s.high,true)),h=keep(arc.Value()),curve=keep(h.get()),handle=keep(new oc.Handle_Geom_Curve_2(curve));return {edge:keep(keep(new oc.BRepBuilderAPI_MakeEdge_24(handle)).Edge()),p:keep(curve.Value(s.low)),q:keep(curve.Value(s.high))};};
   const outer=edgeArc(s.r),inner=edgeArc(s.r-Math.min(s.r*.1,tolerance*20)),w=keep(new oc.BRepBuilderAPI_MakeWire_1());w.Add_1(outer.edge);w.Add_1(keep(keep(new oc.BRepBuilderAPI_MakeEdge_3(outer.q,inner.q)).Edge()));w.Add_1(keep(oc.TopoDS.Edge_1(keep(inner.edge.Reversed()))));w.Add_1(keep(keep(new oc.BRepBuilderAPI_MakeEdge_3(inner.p,outer.p)).Edge()));
   const face=keep(keep(new oc.BRepBuilderAPI_MakeFace_15(keep(w.Wire()),true)).Face()),tool=keep(keep(new oc.BRepPrimAPI_MakePrism_1(face,keep(new oc.gp_Vec_4(...s.z.map(n=>n*(s.vl-s.vh)))),false,true)).Shape());
   oc.BRepLib.OrientClosedSolid(keep(oc.TopoDS.Solid_1(tool)));
   const tol=keep(new oc.ShapeFix_ShapeTolerance());tol.SetTolerance(tool,eps,T.TopAbs_SHAPE);tol.SetTolerance(base,eps,T.TopAbs_SHAPE);
   const fuse=keep(new oc.BRepAlgoAPI_Fuse_3(base,tool)),unify=keep(new oc.ShapeUpgrade_UnifySameDomain_2(keep(fuse.Shape()),true,true,false));unify.SetLinearTolerance(eps);unify.SetAngularTolerance(1e-8);unify.Build();let candidate=keep(unify.Shape());
   const leftovers=[];
   for(const f of parts(candidate,T.TopAbs_FACE)){
    const face=keep(oc.TopoDS.Face_1(f)),ad=keep(new oc.BRepAdaptor_Surface_2(face,true));if(ad.GetType().value!==0)continue;
    const n=xyz(keep(keep(keep(ad.Plane()).Axis()).Direction())),vertices=parts(face,T.TopAbs_VERTEX);if(!vertices.length)continue;
    if(vertices.every(v=>{const p=s.coords(xyz(keep(oc.BRep_Tool.Pnt(keep(oc.TopoDS.Vertex_1(v))))));return p.err<Math.min(1e-4,tolerance*.01)&&p.u>=s.low-1e-5&&p.u<=s.high+1e-5&&p.v>=s.vl-1e-4&&p.v<=s.vh+1e-4&&Math.abs(dot(n,p.radial)/s.r)>.99;}))leftovers.push(face);
   }
   if(leftovers.length&&leftovers.length<=8){const heal=keep(new oc.BRepAlgoAPI_Defeaturing());heal.SetShape(candidate);leftovers.forEach(f=>heal.AddFaceToRemove(f));heal.Build();candidate=keep(heal.Shape());}
   const count=parts(candidate,T.TopAbs_FACE).length,v=volume(candidate),box=bounds(candidate),budget=tolerance*s.r*s.extension*(s.vh-s.vl)*2;
   if(!valid(candidate)||count>=oldFaces||v<oldVolume-.001||v-oldVolume>budget||Math.abs(v-oldVolume)>oldVolume*.0001||Math.max(...box.map((n,k)=>Math.abs(n-oldBounds[k])))>tolerance)throw Error('Junction reconstruction did not pass solid, volume or bounds checks: '+JSON.stringify({valid:valid(candidate),count,volumeDelta:v-oldVolume,budget,bbox:Math.max(...box.map((n,k)=>Math.abs(n-oldBounds[k])))}));
   shape=candidate;finished++;removed+=oldFaces-count;
  }catch(e){if(typeof e==='number'||e instanceof WebAssembly.RuntimeError)throw e;rejected.push(e.message||String(e));}
 }
 // A Boolean junction can leave tiny, almost coplanar patches at an embossed
 // detail. Merge only patches sharing an edge with a much larger plane.
 // Keep this bounded and optional: every unsuccessful pass retains its input.
 const beforeCleanup=shape;let cleanupRemoved=0;
 if(finished){
  try{const writer=keep(new oc.STEPControl_Writer_1());if(writer.Transfer(shape,oc.STEPControl_StepModelType.STEPControl_AsIs,true).value!==1||writer.Write('/c.step').value!==1)throw Error('Cannot normalize planar cleanup');const reader=keep(new oc.STEPControl_Reader_1());if(reader.ReadFile('/c.step').value!==1||reader.TransferRoots()<1)throw Error('Cannot reload planar cleanup');shape=keep(reader.OneShape());}
  catch(e){if(typeof e==='number'||e instanceof WebAssembly.RuntimeError)throw e;return {shape:beforeCleanup,finished,removed,rejected:[...rejected,e.message||String(e)]};}
  finally{try{oc.FS.unlink('/c.step');}catch(_){}}
 }
 if(finished)for(let pass=0;pass<4;pass++){
  try{
   const oldFaces=parts(shape,T.TopAbs_FACE).length;if(oldFaces>512)break;
   const base=keep(keep(new oc.BRepBuilderAPI_Copy_2(shape,true,false)).Shape()),rows=[];
   for(const f of parts(base,T.TopAbs_FACE)){
    const face=keep(oc.TopoDS.Face_1(f)),ad=keep(new oc.BRepAdaptor_Surface_2(face,true));if(ad.GetType().value!==0)continue;
    const plane=keep(ad.Plane()),normal=xyz(keep(keep(plane.Axis()).Direction())),p=keep(new oc.GProp_GProps_1());oc.BRepGProp.SurfaceProperties_1(face,p,true,false);
    rows.push({face,plane,normal,area:p.Mass(),edges:parts(face,T.TopAbs_EDGE),vertices:parts(face,T.TopAbs_VERTEX)});
   }
   const eps=Math.min(1e-5,tolerance*.001),eligible=rows.filter(a=>a.area>0&&a.vertices.length&&rows.some(b=>b!==a&&b.area>a.area*50&&Math.abs(dot(a.normal,b.normal))>1-5e-9&&a.edges.some(e=>b.edges.some(q=>e.IsSame(q)))&&a.vertices.every(v=>b.plane.Distance_1(keep(oc.BRep_Tool.Pnt(keep(oc.TopoDS.Vertex_1(v)))))<eps)));
   if(!eligible.length||eligible.length>8)break;
   const oldVolume=volume(shape),oldBounds=bounds(shape),heal=keep(new oc.BRepAlgoAPI_Defeaturing());heal.SetShape(base);eligible.forEach(a=>heal.AddFaceToRemove(a.face));heal.Build();const next=keep(heal.Shape());
   if(!valid(next))break;
   const count=parts(next,T.TopAbs_FACE).length,delta=Math.abs(volume(next)-oldVolume),box=bounds(next);
   if(count>=oldFaces||delta>Math.min(.001,oldVolume*1e-7)||Math.max(...box.map((v,k)=>Math.abs(v-oldBounds[k])))>eps)break;
   shape=next;removed+=oldFaces-count;cleanupRemoved+=oldFaces-count;
  }catch(e){if(typeof e==='number'||e instanceof WebAssembly.RuntimeError)throw e;rejected.push('Planar junction cleanup: '+(e.message||String(e)));break;}
 }
 if(!cleanupRemoved)shape=beforeCleanup;
 return {shape,finished,removed,rejected};
}
const api={finish};if(typeof module==='object'&&module.exports)module.exports=api;root.JunctionCurves=api;
})(typeof self==='object'?self:globalThis);

