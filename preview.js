'use strict';
(() => {
 const $=id=>document.getElementById(id),canvas=$('modelCanvas'),message=$('previewMessage'),info=$('modelInfo');
 let gl,program,pos,normal,edges,count=0,serial=0,worker=null,deadline=null,frame=0,lost=false;
 let yaw=.65,pitch=-.45,zoom=1,pan=[0,0];const pointers=new Map();
 function text(s){message.textContent=s;message.hidden=!s;}
 function dispose(){if(gl&&!lost)for(const b of [pos,normal,edges])if(b)gl.deleteBuffer(b);pos=normal=edges=null;count=0;}
 function stop(){if(worker)worker.terminate();worker=null;clearTimeout(deadline);}
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Không tạo được shader preview.');return s;}
 function init(){
  gl=canvas.getContext('webgl',{alpha:false,antialias:true});if(!gl)throw Error('Thiết bị không hỗ trợ WebGL. Bạn vẫn có thể chuyển đổi STL.');
  const vs=shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec3 n;uniform vec2 angles;uniform vec2 scale;uniform vec2 pan;varying vec3 normal;vec3 turn(vec3 v){float a=angles.x,b=angles.y;vec3 q=vec3(cos(a)*v.x+sin(a)*v.z,v.y,-sin(a)*v.x+cos(a)*v.z);return vec3(q.x,cos(b)*q.y-sin(b)*q.z,sin(b)*q.y+cos(b)*q.z);}void main(){vec3 q=turn(p);gl_Position=vec4(q.xy*scale+pan,-q.z*.25,1.);normal=turn(n);}');
  const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 normal;uniform bool lines;void main(){float l=.3+.7*abs(dot(normalize(normal),normalize(vec3(.4,.7,1.))));gl_FragColor=lines?vec4(.12,.2,.28,1.):vec4(vec3(.55,.75,.88)*l,1.);}');
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Không khởi tạo được preview.');gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
 }
 function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;}
 function attr(name,b){const a=gl.getAttribLocation(program,name);if(b){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(a);gl.vertexAttrib3f(a,0,0,1);}}
 function draw(){frame=0;if(!gl||lost)return;const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.105,.13,.17,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!count)return;
  gl.useProgram(program);gl.uniform2f(gl.getUniformLocation(program,'angles'),yaw,pitch);const aspect=canvas.width/canvas.height;gl.uniform2f(gl.getUniformLocation(program,'scale'),.84*zoom/Math.max(1,aspect),.84*zoom*Math.min(1,aspect));gl.uniform2f(gl.getUniformLocation(program,'pan'),...pan);
  const mode=$('renderMode').value;
  if(mode!=='wire'){attr('p',pos);attr('n',normal);gl.uniform1i(gl.getUniformLocation(program,'lines'),0);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);gl.drawArrays(gl.TRIANGLES,0,count*3);gl.disable(gl.POLYGON_OFFSET_FILL);}
  if(mode!=='solid'){attr('p',edges);attr('n',null);gl.uniform1i(gl.getUniformLocation(program,'lines'),1);gl.drawArrays(gl.LINES,0,count*6);}
 }
 function render(){if(!frame)frame=requestAnimationFrame(draw);}
 function fit(){$('cameraView').value='iso';yaw=.65;pitch=-.45;zoom=1;pan=[0,0];render();}
 async function load(file){const id=++serial;stop();dispose();info.textContent='Chưa có mô hình';fit();if(!file){text('Chọn hoặc kéo file STL vào bảng bên trái để xem mô hình.');return;}
  text('Đang đọc mô hình 3D…');if(!gl||lost){text('Preview 3D không khả dụng. Chức năng chuyển đổi vẫn sử dụng được.');return;}
  try{const bytes=await file.arrayBuffer();if(id!==serial)return;worker=new Worker('preview-worker.js?v=20261110-preview1');
   const fail=s=>{if(id!==serial)return;stop();dispose();render();text(s);};
   worker.onerror=e=>{e.preventDefault();fail('Không tải được preview. Bạn vẫn có thể thử chuyển đổi.');};
   worker.onmessage=({data:m})=>{if(id!==serial||m.id!==id)return;stop();if(m.type==='error'){fail(m.message);return;}try{pos=buffer(m.positions);normal=buffer(m.normals);edges=buffer(m.edges);count=m.triangles;info.textContent=m.bounds.size.map(v=>v.toLocaleString('vi-VN',{maximumFractionDigits:2})).join(' × ')+' mm · '+m.triangles.toLocaleString('vi-VN')+' tam giác'+(m.skipped?' · Bỏ '+m.skipped+' mặt trùng/suy biến trong preview':'');canvas.dataset.triangles=String(count);text('');fit();}catch{fail('Không đủ tài nguyên để hiển thị mô hình.');}};
   deadline=setTimeout(()=>fail('Preview vượt thời gian chờ. Bạn vẫn có thể chuyển đổi.'),20000);worker.postMessage({id,buffer:bytes},[bytes]);
  }catch{if(id===serial){stop();text('Không đọc được file để xem trước.');}}
 }
 window.addEventListener('stl-selected',e=>{canvas.dataset.triangles='0';load(e.detail);});
 $('fitView').onclick=fit;$('renderMode').onchange=render;
 $('cameraView').onchange=e=>{[yaw,pitch]=({front:[0,0],top:[0,Math.PI/2],right:[Math.PI/2,0],iso:[.65,-.45]})[e.target.value];pan=[0,0];zoom=1;render();};
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);canvas.focus();});
 canvas.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const other=[...pointers].find(([id])=>id!==e.pointerId)?.[1],dx=e.clientX-old[0],dy=e.clientY-old[1];if(other){const before=Math.hypot(old[0]-other[0],old[1]-other[1]),after=Math.hypot(e.clientX-other[0],e.clientY-other[1]);if(before>2)zoom=Math.max(.2,Math.min(8,zoom*after/before));pan[0]+=dx/canvas.clientWidth;pan[1]-=dy/canvas.clientHeight;}else if(e.buttons===2||e.shiftKey){pan[0]+=dx*2/canvas.clientWidth;pan[1]-=dy*2/canvas.clientHeight;}else{yaw+=dx*.009;pitch+=dy*.009;}pointers.set(e.pointerId,[e.clientX,e.clientY]);render();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointers.delete(e.pointerId));
 canvas.oncontextmenu=e=>e.preventDefault();canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.2,Math.min(8,zoom*Math.exp(-e.deltaY*.001)));render();},{passive:false});
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','f','F'].includes(e.key))return;e.preventDefault();if(e.key.toLowerCase()==='f')fit();else if(e.key==='+'||e.key==='-')zoom=Math.max(.2,Math.min(8,zoom*(e.key==='+'?1.1:1/1.1)));else{yaw+=(e.key==='ArrowRight'?.1:e.key==='ArrowLeft'?-.1:0);pitch+=(e.key==='ArrowDown'?.1:e.key==='ArrowUp'?-.1:0);}render();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stop();dispose();text('Mất kết nối đồ họa. Tải lại trang để bật preview; chuyển đổi vẫn sử dụng được.');});
 new ResizeObserver(render).observe(canvas);
 window.addEventListener('pagehide',()=>{serial++;stop();dispose();cancelAnimationFrame(frame);});
 try{init();render();}catch(e){text(e.message);}
})();
