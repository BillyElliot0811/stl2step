'use strict';
// A separate disposable worker prevents preview parsing from blocking the UI.
importScripts('stl.js?v=20261110-preview1','preview-mesh.js?v=20261110-preview1');
self.onmessage=({data})=>{
 const id=data?.id;
 try{
  const mesh=PreviewMesh.build(STL.parse(data.buffer,true));
  self.postMessage({id,type:'preview',...mesh},[mesh.positions.buffer,mesh.normals.buffer,mesh.edges.buffer]);
 }catch(error){self.postMessage({id,type:'error',message:error.message||'Không đọc được preview STL.'});}
};
