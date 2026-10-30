/* Bounded local cuts at proved zero-width edge contacts. Not a general mesh Boolean repair. */
(function(root){
'use strict';
function build(oc,shell,detected,{tolerance=.01}={},register){
 if(!detected||!detected.eligible||!detected.contacts.length||detected.contacts.length>16)throw new Error('Không có nhóm cạnh chạm đủ điều kiện sửa.');
 if(!Number.isFinite(tolerance)||tolerance<.001||tolerance>.05)throw new Error('Sai lệch sửa cạnh chạm phải từ 0,001 đến 0,05 mm.');
 const owned=[],keep=x=>{owned.push(x);return x;},T=oc.TopAbs_ShapeEnum;
 const count=(s,type)=>{let n=0;const e=new oc.TopExp_Explorer_2(s,type,T.TopAbs_SHAPE);try{while(e.More()){n++;e.Next();}}finally{e.delete();}return n;};
 let result;
 try{
  const radius=tolerance/2,changeBound=Math.SQRT2*radius;
  const maker=keep(new oc.BRepBuilderAPI_MakeSolid_3(shell));if(!maker.IsDone())throw new Error('Không tạo được hình học trung gian để sửa cạnh chạm.');
  const provisional=keep(maker.Solid());oc.BRepLib.OrientClosedSolid(provisional);
  const tools=keep(new oc.TopoDS_Compound()),builder=keep(new oc.BRep_Builder());builder.MakeCompound(tools);
  for(const c of detected.contacts){
   const length=Math.hypot(...c.end.map((v,k)=>v-c.start[k]));
   if(length<tolerance*20||c.clearance<tolerance*1.5)throw new Error('Cạnh chạm quá gần chi tiết khác hoặc quá ngắn.');
   const axis=c.end.map((v,k)=>(v-c.start[k])/length),p=keep(new oc.gp_Pnt_3(...c.start.map((v,k)=>v-axis[k]*radius))),d=keep(new oc.gp_Dir_4(...axis)),ax=keep(new oc.gp_Ax2_3(p,d)),cylinder=keep(new oc.BRepPrimAPI_MakeCylinder_3(ax,radius,length+2*radius));
   const tool=keep(cylinder.Shape());if(tool.IsNull())throw new Error('Không dựng được dụng cụ tách cạnh chạm.');builder.Add(tools,tool);
  }
  const cut=keep(new oc.BRepAlgoAPI_Cut_3(provisional,tools));if(!cut.IsDone())throw new Error('Không tách được cạnh chạm bằng phép cắt hình học.');
  result=cut.Shape();if(result.IsNull())throw new Error('Sửa cạnh chạm trả về hình học rỗng.');
  const analyzer=keep(new oc.BRepCheck_Analyzer(result,true));
  if(!analyzer.IsValid_2()||count(result,T.TopAbs_SOLID)!==1||count(result,T.TopAbs_SHELL)!==1)throw new Error('Kết quả sửa cạnh chạm chưa là một khối hợp lệ.');
  const ex=keep(new oc.TopExp_Explorer_2(result,T.TopAbs_SHELL,T.TopAbs_SHAPE));const sh=keep(ex.Current()),fixedShell=keep(oc.TopoDS.Shell_1(sh));if(!oc.BRep_Tool.IsClosed_1(fixedShell))throw new Error('Vỏ sau sửa cạnh chạm chưa kín.');
  const prop=keep(new oc.GProp_GProps_1());oc.BRepGProp.VolumeProperties_1(result,prop,true,false,false);const volume=prop.Mass(),sourceVolume=detected.sourceVolume,volumeChange=volume-sourceVolume;
  if(!Number.isFinite(volume)||volume<=0||!Number.isFinite(sourceVolume)||sourceVolume<=0||volumeChange>Math.max(1e-6,sourceVolume*1e-9)||Math.abs(volumeChange)/sourceVolume>1e-4)throw new Error('Thay đổi thể tích sau sửa vượt giới hạn cho phép.');
  const box=keep(new oc.Bnd_Box_1());oc.BRepBndLib.Add(result,box,false);const lo=keep(box.CornerMin()),hi=keep(box.CornerMax()),bounds={min:[lo.X(),lo.Y(),lo.Z()],max:[hi.X(),hi.Y(),hi.Z()]};
  const bboxError=Math.max(...bounds.min.map((v,k)=>Math.abs(v-detected.sourceBounds.min[k])),...bounds.max.map((v,k)=>Math.abs(v-detected.sourceBounds.max[k])));
  if(bboxError>Math.max(1e-6,tolerance*.001))throw new Error('Sửa cạnh chạm làm đổi kích thước bao ngoài.');
  const stats={method:'local-cylindrical-clearance',contacts:detected.contacts.length,radius,tolerance,localEditBound:changeBound,boundMeaning:'All cutting tools lie within this distance of original contact segments; not a certified global Hausdorff distance.',valid:true,solid:true,solids:1,shells:1,closed:true,faces:count(result,T.TopAbs_FACE),sourceVolume,volume,volumeChange,relativeVolumeChange:volumeChange/sourceVolume,bounds,bboxError,selfIntersectionCheck:'not-available-in-bundled-kernel',regions:detected.contacts.map(c=>({start:c.start,end:c.end,clearance:c.clearance}))};
  if(register)register(result);
  return {shape:result,stats};
 }catch(e){if(result)try{result.delete();}catch{}throw e;}
 finally{for(const o of owned.reverse())try{o.delete();}catch{}}
}
const api={build};if(typeof module==='object'&&module.exports)module.exports=api;root.ContactKernel=api;
})(typeof self==='object'?self:globalThis);

