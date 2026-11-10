/* Display-only buffers. Never used as conversion input. */
(function(root){
'use strict';
function build(parsed){
 const triangles=parsed.triangles,count=triangles.length;
 if(!count||count>20000)throw Error('Preview chỉ hỗ trợ tối đa 20.000 tam giác.');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const tri of triangles)for(const p of tri)for(let k=0;k<3;k++){
  if(!Number.isFinite(p[k]))throw Error('Tọa độ preview không hợp lệ.');
  min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);
 }
 const size=max.map((v,k)=>v-min[k]),center=min.map((v,k)=>v+size[k]/2),radius=Math.hypot(...size)/2;
 if(!(radius>0))throw Error('Mô hình không có kích thước để hiển thị.');
 // Normalize before Float32 conversion, preserving detail far from the origin.
 const positions=new Float32Array(count*9),normals=new Float32Array(count*9),edges=new Float32Array(count*18);
 let offset=0,line=0;
 for(const tri of triangles){
  const a=tri[1].map((v,k)=>v-tri[0][k]),b=tri[2].map((v,k)=>v-tri[0][k]);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);
  const p=tri.map(v=>v.map((x,k)=>(x-center[k])/radius));
  for(let i=0;i<3;i++)for(let k=0;k<3;k++){positions[offset]=p[i][k];normals[offset++]=len?n[k]/len:0;}
  for(const [i,j] of [[0,1],[1,2],[2,0]])for(const v of [p[i],p[j]])for(const x of v)edges[line++]=x;
 }
 return {positions,normals,edges,bounds:{min,max,size,center,radius},triangles:count,sourceTriangles:parsed.total,skipped:parsed.skipped};
}
const api={build};if(typeof module==='object'&&module.exports)module.exports=api;root.PreviewMesh=api;
})(typeof self==='object'?self:globalThis);
