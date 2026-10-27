/* Parametric analytic reconstruction using the bundled OpenCASCADE.js 1.1.1 API.
 * Canonical coordinates: centered XY base, bottom Z=0, height along +Z.
 * Optional frame maps canonical coordinates with origin + u*x + v*y + n*z.
 * A caller keep callback transfers every OC wrapper to the caller's ownership.
 */
(function(root) {
  'use strict';
  function build(oc, model, register) {
    const owned = [], keep = register || (item => { owned.push(item); return item; });
    const dispose = () => { for (const item of owned.reverse()) { try { item.delete(); } catch {} } owned.length=0; };
    const pnt=(...xyz)=>keep(new oc.gp_Pnt_3(...xyz));
    const type=oc.TopAbs_ShapeEnum, tolerance=1e-6;
    function expect(condition, text) { if (!condition) throw new Error(text); }
    function finite(value) { return typeof value==='number' && Number.isFinite(value); }
    function positive(value) { return finite(value) && value>0; }
    function all(s, kind) {
      const list=[], explorer=keep(new oc.TopExp_Explorer_2(s,kind,type.TopAbs_SHAPE));
      while(explorer.More()) { list.push(keep(explorer.Current())); explorer.Next(); }
      return list;
    }
    function vertices(edge) {
      return all(edge,type.TopAbs_VERTEX).map(item=>{
        const vertex=keep(oc.TopoDS.Vertex_1(item)),point=keep(oc.BRep_Tool.Pnt(vertex));
        return [point.X(),point.Y(),point.Z()];
      });
    }
    function uniqueEdges(s) {
      const list=[];
      for(const item of all(s,type.TopAbs_EDGE)) {
        const edge=keep(oc.TopoDS.Edge_1(item));
        if(!list.some(other=>edge.IsSame(other))) list.push(edge);
      }
      return list;
    }
    function makeBox(width,depth,height,center,z) {
      const maker=keep(new oc.BRepPrimAPI_MakeBox_2(pnt(center[0]-width/2,center[1]-depth/2,z),width,depth,height));
      return keep(maker.Shape());
    }
    function fillet(shape,radius,predicate) {
      const maker=keep(new oc.BRepFilletAPI_MakeFillet(shape,oc.ChFi3d_FilletShape.ChFi3d_Rational));
      let selected=0;
      for(const edge of uniqueEdges(shape)) if(predicate(vertices(edge))) { maker.Add_2(radius,edge);selected++; }
      expect(selected>0,'Không xác định được cạnh cần bo tròn.');
      maker.Build();
      expect(maker.IsDone(),'Không dựng được fillet giải tích an toàn.');
      const result=keep(maker.Shape());
      expect(!result.IsNull(),'Fillet trả về hình học rỗng.');
      return result;
    }
    function inspect(shape) {
      const check=keep(new oc.BRepCheck_Analyzer(shape,true)),props=keep(new oc.GProp_GProps_1());
      oc.BRepGProp.VolumeProperties_1(shape,props,true,false,false);
      const types={planes:0,cylinders:0,cones:0,spheres:0,tori:0,other:0},radii={cylinders:[],spheres:[],tori:[]};
      const faces=all(shape,type.TopAbs_FACE);
      for(const item of faces) {
        const face=keep(oc.TopoDS.Face_1(item)),adaptor=keep(new oc.BRepAdaptor_Surface_2(face,true));
        const t=adaptor.GetType().value,names=['planes','cylinders','cones','spheres','tori'];
        types[names[t]||'other']++;
        if(t===1)radii.cylinders.push(keep(adaptor.Cylinder()).Radius());
        if(t===3)radii.spheres.push(keep(adaptor.Sphere()).Radius());
        if(t===4){const torus=keep(adaptor.Torus());radii.tori.push([torus.MajorRadius(),torus.MinorRadius()]);}
      }
      return {valid:check.IsValid_2(),volume:props.Mass(),faces:faces.length,solids:all(shape,type.TopAbs_SOLID).length,surfaces:types,radii};
    }
    try {
      expect(model && model.base,'Thiếu thông số hình học để dựng lại mặt cong.');
      const base=model.base,boss=model.boss,recess=model.recess;
      expect([base.width,base.depth,base.height].every(positive),'Kích thước đế không hợp lệ.');
      const cr=base.cornerRadius||0,br=base.bottomRadius||0;
      expect(finite(cr)&&finite(br)&&cr>=0&&br>=0&&cr<Math.min(base.width,base.depth)/2&&br<base.height,'Bán kính fillet vượt giới hạn hình học.');
      let shape=makeBox(base.width,base.depth,base.height,[0,0],0);
      const bottom=points=>points.length===2&&points.every(p=>Math.abs(p[2])<tolerance);
      const vertical=points=>points.length===2&&Math.abs(points[0][0]-points[1][0])<tolerance&&Math.abs(points[0][1]-points[1][1])<tolerance;
      if(cr>0&&br>0&&Math.abs(cr-br)<tolerance) shape=fillet(shape,cr,points=>bottom(points)||vertical(points));
      else {
        if(cr>0) shape=fillet(shape,cr,vertical);
        if(br>0) shape=fillet(shape,br,bottom);
      }
      let top=base.height;
      if(boss) {
        const center=boss.center||[0,0];
        expect([boss.width,boss.depth,boss.height].every(positive)&&center.length===2&&center.every(finite),'Kích thước gờ không hợp lệ.');
        expect(Math.abs(center[0])+boss.width/2<base.width/2&&Math.abs(center[1])+boss.depth/2<base.depth/2,'Gờ phải nằm trong mặt đế.');
        const added=makeBox(boss.width,boss.depth,boss.height,center,base.height),maker=keep(new oc.BRepAlgoAPI_Fuse_3(shape,added));
        expect(maker.IsDone(),'Không hợp khối được phần gờ.');shape=keep(maker.Shape());top+=boss.height;
      }
      if(recess) {
        const center=recess.center||[0,0];
        expect(positive(recess.radius)&&finite(recess.floor)&&recess.floor>=0&&recess.floor<top&&center.length===2&&center.every(finite),'Thông số hốc tròn không hợp lệ.');
        const direction=keep(new oc.gp_Dir_4(0,0,1)),axis=keep(new oc.gp_Ax2_3(pnt(center[0],center[1],recess.floor),direction));
        const cylinder=keep(new oc.BRepPrimAPI_MakeCylinder_3(axis,recess.radius,top-recess.floor+Math.max(1,top*0.1)));
        const maker=keep(new oc.BRepAlgoAPI_Cut_3(shape,keep(cylinder.Shape())));
        expect(maker.IsDone(),'Không cắt được hốc tròn.');shape=keep(maker.Shape());
      }
      if(model.frame) {
        const {origin,u,v,n}=model.frame;
        expect([origin,u,v,n].every(a=>Array.isArray(a)&&a.length===3&&a.every(finite)),'Hệ trục dựng lại không hợp lệ.');
        const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
        expect([u,v,n].every(a=>Math.abs(dot(a,a)-1)<1e-6)&&Math.abs(dot(u,v))<1e-6&&Math.abs(dot(u,n))<1e-6&&Math.abs(dot(v,n))<1e-6,'Hệ trục dựng lại phải vuông góc và có chiều dài đơn vị.');
        const handedness=(u[1]*v[2]-u[2]*v[1])*n[0]+(u[2]*v[0]-u[0]*v[2])*n[1]+(u[0]*v[1]-u[1]*v[0])*n[2];
        expect(handedness>0.999999,'Hệ trục dựng lại phải có hướng tay phải.');
        const transform=keep(new oc.gp_Trsf_1());
        transform.SetValues(u[0],v[0],n[0],origin[0],u[1],v[1],n[1],origin[1],u[2],v[2],n[2],origin[2]);
        const maker=keep(new oc.BRepBuilderAPI_Transform_2(shape,transform,true));
        expect(maker.IsDone(),'Không đặt được mô hình về hệ trục STL.');shape=keep(maker.Shape());
      }
      const stats=inspect(shape);
      expect(stats.valid&&stats.solids===1&&finite(stats.volume)&&stats.volume>0&&stats.surfaces.other===0,'Mô hình khôi phục không đạt kiểm tra khối kín giải tích.');
      return {shape,stats,dispose};
    } catch(error) { dispose();throw error; }
  }
  const api={build};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AnalyticBuilder=api;
})(typeof self==='object'?self:globalThis);
