/* OpenCASCADE.js 1.1.1 bindings: keep the numbered overloads in sync with oc.js. */
'use strict';
let busy = false;
onmessage = async ({data:job}) => {
  if (!job || job.type !== 'convert' || busy) return;
  busy = true;
  const id = job.id;
  const say = (msg, percent = null) => {
    const payload = {type:'status', id, msg};
    if (percent !== null && Number.isFinite(percent)) payload.percent = Math.min(100, Math.max(0, Math.round(percent)));
    postMessage(payload);
  };
  const owned = new Set();
  const keep = value => { owned.add(value); return value; };
  const dispose = (...items) => { for (const item of items.reverse()) { if (item) { try { item.delete(); } catch {} } } };
  let oc;
  // Keep a fixed short MEMFS name for the bundled 1.1.1 string bindings.
  // The user-facing filename is applied to the Blob download in app.js.
  const outputPath = '/out.step';
  try {
    say('Đang kiểm tra và đọc file STL…', 5);
    importScripts('stl.js?v=20261109-sliver1');
    const tol = job.tol;
    if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 1e-7 || tol > 1) throw new Error('Dung sai phải từ 0,0000001 đến 1 mm.');
    const parsed = STL.parse(job.buffer, Boolean(job.repairMesh));
    // Parsing precedes the large WASM load so invalid input fails quickly.
    job.buffer = null;
    const warnings = [];
    if (parsed.skipped) warnings.push('Đã loại ' + parsed.skipped.toLocaleString('vi-VN') + ' tam giác suy biến hoặc trùng lặp.');
    importScripts('mesh-qa.js?v=20261109-sliver1','preprocess.js?v=20261109-sliver1');
    if (job.fillHoles && !job.repairMesh) throw new Error('Cần bật tiền xử lý trước khi vá lỗ.');
    let preprocessing = null, inputTopology, contactCandidate = null, contactRepair = null, preIssueWarnings = [], curveIssueWarning = null;
    if (job.repairMesh) {
      say('Đang tiền xử lý: ghép đỉnh, sửa hướng mặt và kiểm tra biên hở…', 10);
      const pre = MeshPreprocess.process(parsed.triangles,{weldTolerance:Math.min(tol,1e-4),fillHoles:Boolean(job.fillHoles),maxHoleDiameter:job.maxHoleDiameter === undefined ? 1 : job.maxHoleDiameter,maxTriangles:STL.MAX_TRIANGLES});
      parsed.triangles = pre.triangles; preprocessing = pre.report; inputTopology = pre.report.after;
      preIssueWarnings = pre.warnings; warnings.push(...pre.warnings);
    } else {
      say('Đang phân tích cấu trúc lưới…', 10);
      inputTopology = MeshPreprocess.analyze(parsed.triangles);
    }
    const topologySafe = inputTopology.nonmanifoldEdges === 0 && inputTopology.pinchedVertices === 0;
    if (job.repairMesh && job.repairContacts !== false) {
      const t = job.contactTolerance === undefined ? .01 : job.contactTolerance;
      if (typeof t !== 'number' || !Number.isFinite(t) || t < .001 || t > .05) throw new Error('Sai lệch sửa cạnh chạm phải từ 0,001 đến 0,05 mm.');
      if (!topologySafe) {
        say('Đang phân tích các cạnh chạm có bề dày bằng 0…', 15);
        importScripts('contact-detect.js?v=20261109-sliver1');
        contactCandidate = ContactDetection.detect(parsed.triangles,{tolerance:t,maxContacts:16});
        if (!contactCandidate.eligible) warnings.push('Các cạnh lỗi chưa thuộc nhóm có thể sửa tự động; giữ dạng mặt/vỏ.');
      }
    }
    if (!topologySafe && !preprocessing) warnings.push('Lưới còn cạnh/đỉnh bất thường; giữ dạng mặt/vỏ để tránh tạo khối sai.');
    let recovered = null;
    if (job.recoverCurves) {
      if (job.curveTolerance !== undefined && (typeof job.curveTolerance !== 'number' || !Number.isFinite(job.curveTolerance) || job.curveTolerance < 0.0001 || job.curveTolerance > 0.1)) throw new Error('Sai lệch nhận dạng phải từ 0,0001 đến 0,1 mm.');
      say('Đang nhận dạng lỗ tròn và bo cơ bản…', 18);
      importScripts('recognize.js?v=20261109-sliver1');
      recovered = topologySafe ? CurveRecognition.recognize(parsed.triangles,{tolerance:job.curveTolerance}) : {ok:false,reason:'Lưới còn cạnh hoặc đỉnh non-manifold sau tiền xử lý.'};
      if (!recovered.ok) {curveIssueWarning = 'Giữ mặt lưới vì chưa nhận dạng được mặt cong an toàn: ' + recovered.reason; warnings.push(curveIssueWarning);}
    }
    say('Đang nạp bộ chuyển đổi (oc.wasm khoảng 63 MiB ở lần đầu)…', 20);
    importScripts('oc.js');
    // Fetch explicitly: this older Emscripten loader can leave its ready
    // Promise pending on an HTTP/network error.
    const controller = new AbortController();
    const loadTimeout = setTimeout(() => controller.abort(),90000);
    let wasmBinary;
    try {
      const response = await fetch(new URL('oc.wasm',self.location.href),{signal:controller.signal});
      if (!response.ok) throw new Error('Không tải được oc.wasm (HTTP ' + response.status + '). Kiểm tra file thư viện trên máy chủ.');
      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      if (totalBytes > 0 && response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const chunks = [];
        let receivedBytes = 0;
        let lastReport = 0;
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.length;
          const now = performance.now();
          if (now - lastReport > 200 || receivedBytes === totalBytes) {
            lastReport = now;
            const mbDownloaded = (receivedBytes / (1024 * 1024)).toFixed(1);
            const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
            const pct = 20 + Math.round((receivedBytes / totalBytes) * 20);
            say('Đang tải bộ chuyển đổi: ' + mbDownloaded + '/' + mbTotal + ' MiB (' + Math.round((receivedBytes/totalBytes)*100) + '%)…', pct);
          }
        }
        const allChunks = new Uint8Array(receivedBytes);
        let position = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }
        wasmBinary = allChunks.buffer;
      } else {
        say('Đang nạp bộ chuyển đổi oc.wasm…', 30);
        wasmBinary = await response.arrayBuffer();
      }
      const header = new Uint8Array(wasmBinary,0,Math.min(4,wasmBinary.byteLength));
      if (header.length !== 4 || header[0] !== 0 || header[1] !== 97 || header[2] !== 115 || header[3] !== 109) throw new Error('oc.wasm bị hỏng hoặc máy chủ trả về nội dung khác. Hãy khôi phục đúng file thư viện.');
    } catch (err) {
      if (controller.signal.aborted) throw new Error('Nạp bộ chuyển đổi quá 90 giây. Kiểm tra kết nối và thử lại.');
      if (err instanceof TypeError) throw new Error('Không tải được oc.wasm. Kiểm tra kết nối và các file thư viện rồi thử lại.');
      throw err;
    } finally { clearTimeout(loadTimeout); }
    let initTimeout;
    try {
      say('Đang khởi tạo bộ chuyển đổi OpenCASCADE…', 45);
      oc = await new Promise((resolve,reject) => {
        initTimeout = setTimeout(() => reject(new Error('Không khởi tạo được bộ chuyển đổi trong 45 giây. Hãy thử lại hoặc dùng trình duyệt khác.')),45000);
        opencascade({
          wasmBinary,
          locateFile: file => new URL(file.endsWith('.wasm') ? 'oc.wasm' : file, self.location.href).href,
          onAbort: () => reject(new Error('Bộ chuyển đổi dừng khi khởi tạo. Kiểm tra oc.js/oc.wasm hoặc thử file nhỏ hơn.')),
          print: () => {}, printErr: () => {}
        }).then(resolve,reject);
      });
    } finally { clearTimeout(initTimeout); wasmBinary = null; }
    say('Đã khởi tạo bộ chuyển đổi, bắt đầu dựng hình học…', 50);
    const types = oc.TopAbs_ShapeEnum;
    function parts(shape, type, avoid = types.TopAbs_SHAPE) {
      const list = [], explorer = new oc.TopExp_Explorer_2(shape,type,avoid);
      try { while (explorer.More()) { list.push(keep(explorer.Current())); explorer.Next(); } }
      finally { explorer.delete(); }
      return list;
    }
    function count(shape, type) {
      let n = 0;
      const explorer = new oc.TopExp_Explorer_2(shape,type,types.TopAbs_SHAPE);
      try { while (explorer.More()) { n++; explorer.Next(); } }
      finally { explorer.delete(); }
      return n;
    }
    function valid(shape) {
      const check = new oc.BRepCheck_Analyzer(shape,true);
      try { return check.IsValid_2(); } finally { check.delete(); }
    }
    function bounds(shape) {
      const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
      const explorer = new oc.TopExp_Explorer_2(shape,types.TopAbs_VERTEX,types.TopAbs_SHAPE);
      try {
        while (explorer.More()) {
          let current,vertex,p;
          try {
            current = explorer.Current(); vertex = oc.TopoDS.Vertex_1(current); p = oc.BRep_Tool.Pnt(vertex);
            [p.X(),p.Y(),p.Z()].forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
          } finally { dispose(current,vertex,p); }
          explorer.Next();
        }
      } finally { explorer.delete(); }
      return {min,max};
    }
    let result, faces, allSolid, solids = 0, openShells = 0, reconstruction = null;
    if(job.recoverCurves && topologySafe){
      let candidate=null;
      try{
        importScripts('strip-curves.js?v=20261109-sliver1','annulus-browser.js?v=20261115-annulus1');
        candidate=AnnulusExperimental.recognize(parsed.triangles,job.curveTolerance);
      }catch(error){
        if(typeof error==='number'||error instanceof WebAssembly.RuntimeError)throw error;
        // Optional recognition or module loading failure retains existing conversion.
      }
      if(candidate){
        try{
          const shape=keep(AnnulusExperimental.build(oc,candidate));
          const stats=AnnulusExperimental.build.inspect(oc,shape);
          result=shape;faces=stats.faces;solids=stats.solids;allSolid=true;
          reconstruction={type:'experimental-annular-step',support:candidate.support,stats};parsed.triangles.length=0;
          for(let i=warnings.length-1;i>=0;i--)if(warnings[i]===curveIssueWarning)warnings.splice(i,1);
        }catch(error){if(typeof error==='number'||error instanceof WebAssembly.RuntimeError)throw error;warnings.push('Experimental annulus build failed; using existing conversion.');}
      }
    }
    if (!result && recovered && recovered.ok) {
      say('Đang dựng mặt trụ, cung tròn và fillet giải tích…', 65);
      importScripts('analytic-builder.js?v=20261109-sliver1');
      try {
        const analytic = AnalyticBuilder.build(oc,recovered.model,keep);
        if (Math.abs(analytic.stats.volume-recovered.diagnostics.analyticVolume) > Math.max(1e-6,recovered.diagnostics.analyticVolume*1e-6)) throw new Error('Thể tích B-rep không khớp mô hình nhận dạng.');
        result = analytic.shape; faces = analytic.stats.faces; solids = 1; allSolid = true;
        reconstruction = {...recovered.diagnostics,surfaces:analytic.stats.surfaces,radii:analytic.stats.radii};
        parsed.triangles.length = 0;
      } catch (error) {
        if (typeof error === 'number' || error instanceof WebAssembly.RuntimeError) throw error;
        warnings.push('Không dựng được mặt cong hợp lệ; giữ mặt lưới. ' + (error.message || ''));
      }
    }
    if (!result && job.recoverCurves && (topologySafe || contactCandidate?.eligible)) {
      say('Đang nhận dạng và dựng lại các dải cung tròn…', 70);
      importScripts('strip-curves.js?v=20261109-sliver1','junction-curves.js?v=20261109-sliver1','contact-kernel.js?v=20261109-sliver1');
      try {
        const smooth = StripCurves.build(oc,parsed.triangles,{tolerance:job.curveTolerance,contactCandidate,contactTolerance:job.contactTolerance},keep);
        result=smooth.shape;faces=smooth.faces;solids=1;allSolid=true;reconstruction=smooth.stats;contactRepair=smooth.contactRepair;
        for(let i=warnings.length-1;i>=0;i--)if(warnings[i]===curveIssueWarning || (contactRepair && preIssueWarnings.includes(warnings[i])))warnings.splice(i,1);
        warnings.push('Đã khôi phục các dải cung tròn đủ điều kiện; vùng cong khác có thể vẫn chia mặt.');
        parsed.triangles.length=0;
      } catch(error) {
        if(typeof error==='number'||error instanceof WebAssembly.RuntimeError)throw error;
        warnings.push('Không áp dụng dựng dải cung tròn: '+error.message);
      }
    }
    if (!result) {
    const sewing = keep(new oc.BRepBuilderAPI_Sewing(tol,true,true,true,false));
    const progress = keep(new oc.Handle_Message_ProgressIndicator_1());
    const triangles = parsed.triangles;
    const totalTriangles = triangles.length;
    say('Đang dựng ' + totalTriangles.toLocaleString('vi-VN') + ' mặt tam giác…', 55);
    for (let i = 0; i < totalTriangles; i++) {
      const items = [];
      const local = v => {items.push(v);return v;};
      try {
        const p = triangles[i].map(v=>local(new oc.gp_Pnt_3(...v)));
        const polygon = local(new oc.BRepBuilderAPI_MakePolygon_3(p[0],p[1],p[2],true));
        if (!polygon.IsDone()) throw new Error('Không dựng được cạnh tại tam giác ' + (i+1) + '.');
        const wire = local(polygon.Wire());
        const faceMaker = local(new oc.BRepBuilderAPI_MakeFace_15(wire,true));
        if (!faceMaker.IsDone()) throw new Error('Không dựng được mặt tại tam giác ' + (i+1) + '. Hãy sửa STL hoặc giảm dung sai.');
        const face = local(faceMaker.Face());
        sewing.Add(face);
      } finally { dispose(...items); }
      if (i > 0 && (i % 200 === 0 || i === totalTriangles - 1)) {
        const pct = 55 + Math.round(((i + 1) / totalTriangles) * 25);
        say('Đang dựng mặt: ' + (i+1).toLocaleString('vi-VN') + '/' + totalTriangles.toLocaleString('vi-VN') + '…', pct);
      }
    }
    triangles.length = 0;
    say('Đang khâu các cạnh theo dung sai ' + tol + ' mm…', 82);
    sewing.Perform(progress);
    if (sewing.NbDeletedFaces() > 0) throw new Error('Dung sai làm mất mặt nhỏ khi khâu. Hãy giảm dung sai và thử lại.');
    let shape = keep(sewing.SewedShape());
    if (shape.IsNull() || !count(shape,types.TopAbs_FACE)) throw new Error('Không tạo được hình học từ lưới STL.');
    let multipleEdges = sewing.NbMultipleEdges();
    if (contactCandidate && contactCandidate.eligible && count(shape,types.TopAbs_SHELL) === 1) {
      say('Đang tách các cạnh chạm bằng rãnh nhỏ trong sai lệch cho phép…', 85);
      importScripts('contact-kernel.js?v=20261109-sliver1');
      const candidates = parts(shape,types.TopAbs_SHELL);
      try {
        const rawShell = keep(oc.TopoDS.Shell_1(candidates[0]));
        const repair = ContactKernel.build(oc,rawShell,contactCandidate,{tolerance:job.contactTolerance === undefined ? .01 : job.contactTolerance},keep);
        shape = repair.shape; contactRepair = repair.stats; multipleEdges = 0;
        for (let i=warnings.length-1;i>=0;i--) if (preIssueWarnings.includes(warnings[i]) || warnings[i] === curveIssueWarning) warnings.splice(i,1);
        if (job.recoverCurves) warnings.push('Đã sửa được khối; các vùng cong gốc chưa thuộc nhóm nhận dạng vẫn giữ dạng mặt lưới.');
      } catch (error) {
        if (typeof error === 'number' || error instanceof WebAssembly.RuntimeError) throw error;
        warnings.push('Chưa sửa được cạnh chạm an toàn; giữ mặt/vỏ. ' + (error.message || ''));
      }
    }
    if (multipleEdges) warnings.push('Lưới có cạnh dùng chung bất thường (non-manifold); kết quả được giữ dạng mặt/vỏ.');
    if (job.refine) {
      say('Đang gộp các mặt đồng phẳng…', 88);
      const unify = keep(new oc.ShapeUpgrade_UnifySameDomain_2(shape,true,true,false));
      unify.SetLinearTolerance(tol);
      unify.SetAngularTolerance(1e-10);
      unify.Build();
      const refined = keep(unify.Shape());
      let refineSafe = !refined.IsNull() && count(refined,types.TopAbs_FACE) && valid(refined);
      if (refineSafe && contactRepair) {
        const p = keep(new oc.GProp_GProps_1()); oc.BRepGProp.VolumeProperties_1(refined,p,true,false,false);
        refineSafe = Math.abs(p.Mass()-contactRepair.volume) <= Math.max(1e-7,contactRepair.volume*1e-9);
      }
      if (refineSafe) shape = refined;
      else warnings.push('Không gộp được mặt an toàn; giữ nguyên các mặt đã khâu.');
    }
    say('Đang kiểm tra vỏ kín và tạo khối…', 92);
    const builder = keep(new oc.BRep_Builder());
    result = keep(new oc.TopoDS_Compound());
    builder.MakeCompound(result);
    const shells = parts(shape,types.TopAbs_SHELL);
    const looseFaces = parts(shape,types.TopAbs_FACE,types.TopAbs_SHELL);
    for (const face of looseFaces) builder.Add(result,face);
    solids = 0; openShells = 0;
    const boxes = shells.length <= 256 ? shells.map(bounds) : [];
    const ambiguous = new Set();
    for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) {
      if (boxes[i].min.every((v,k)=>v <= boxes[j].max[k]+tol && boxes[j].min[k] <= boxes[i].max[k]+tol)) { ambiguous.add(i);ambiguous.add(j); }
    }
    if (ambiguous.size || shells.length > 256) warnings.push('Có các vỏ với vùng bao chồng lấn hoặc quá nhiều vỏ: giữ dạng vỏ vì chưa xác định chắc quan hệ giữa chúng và các lỗ rỗng.');
    for (let i=0;i<shells.length;i++) {
      let shell = keep(oc.TopoDS.Shell_1(shells[i]));
      const fix = keep(new oc.ShapeFix_Shell_1());
      fix.FixFaceOrientation(shell,true,false);
      const fixed = keep(fix.Shell());
      const orientationSafe = !fixed.IsNull() && fix.NbShells() <= 1 && count(fixed,types.TopAbs_FACE) === count(shell,types.TopAbs_FACE);
      if (orientationSafe) shell = fixed;
      else warnings.push('Không thể sửa hướng mặt an toàn cho một vỏ; giữ nguyên vỏ đó.');
      let madeSolid = false;
      if ((topologySafe || contactRepair) && orientationSafe && !multipleEdges && shells.length <= 256 && !ambiguous.has(i) && oc.BRep_Tool.IsClosed_1(shell) && valid(shell)) {
        const maker = keep(new oc.BRepBuilderAPI_MakeSolid_3(shell));
        if (maker.IsDone()) {
          const solid = keep(maker.Solid());
          if (oc.BRepLib.OrientClosedSolid(solid) && valid(solid)) {
            const props = keep(new oc.GProp_GProps_1());
            oc.BRepGProp.VolumeProperties_1(solid,props,true,false,false);
            const volume = props.Mass();
            if (Number.isFinite(volume) && volume > 1e-18) { builder.Add(result,solid); solids++; madeSolid=true; }
          }
        }
      }
      if (!madeSolid) { builder.Add(result,shell); openShells++; }
    }
    if (result.NbChildren() === 0) throw new Error('Kết quả không có mặt hoặc vỏ hợp lệ.');
    if (!valid(result)) throw new Error('Hình học sau khi khâu chưa hợp lệ. Hãy sửa lưới STL hoặc thử dung sai nhỏ hơn.');
    faces = count(result,types.TopAbs_FACE);
    if (!faces) throw new Error('Kết quả không chứa mặt nào.');
    allSolid = solids > 0 && openShells === 0 && looseFaces.length === 0;
    if (contactRepair && !allSolid) throw new Error('Không xác nhận được khối kín sau sửa cạnh chạm.');
    if (contactRepair) contactRepair.finalFaces = faces;
    if (!allSolid) warnings.push('Kết quả có mặt/vỏ chưa tạo thành khối. Hãy kiểm tra độ kín trong phần mềm CAD.');
    }
    say('Đang xuất file STEP…', 96);
    const writer = keep(new oc.STEPControl_Writer_1());
    const success = oc.IFSelect_ReturnStatus.IFSelect_RetDone.value;
    const status = writer.Transfer(result,oc.STEPControl_StepModelType.STEPControl_AsIs,true);
    if (status.value !== success) throw new Error('OpenCASCADE không chuyển được hình học sang STEP.');
    if (writer.Write(outputPath).value !== success) throw new Error('Không ghi được file STEP.');
    const bytes = oc.FS.readFile(outputPath);
    if (bytes.length < 100 || !new TextDecoder().decode(bytes.subarray(0,40)).includes('ISO-10303-21')) throw new Error('File STEP xuất ra rỗng hoặc không hợp lệ.');
    const output = bytes.slice().buffer;
    say('Hoàn tất chuyển đổi!', 100);
    postMessage({type:'done',id,data:output,info:{triangles:parsed.total,faces,solid:allSolid,solids,shells:openShells,skipped:parsed.skipped,warnings,reconstruction,preprocessing,inputTopology,contactRepair,contactDetection:contactCandidate ? {eligible:contactCandidate.eligible,reason:contactCandidate.reason,contacts:contactCandidate.contacts.length} : null}},[output]);
  } catch (err) {
    let title = 'Lỗi chuyển đổi';
    let msg = '';
    let suggestion = '';

    if (typeof err === 'number') {
      title = 'Lỗi nhân hình học OpenCASCADE';
      msg = 'Bộ xử lý OpenCASCADE phát sinh mã ngoại lệ C++: ' + err + '.';
      suggestion = 'Mô hình STL có thể chứa đa giác tự cắt, mặt suy biến hoặc cạnh bất thường (non-manifold). Hãy thử bật "Tiền xử lý lưới trước khi chuyển đổi" hoặc điều chỉnh dung sai khâu.';
    } else if (err instanceof WebAssembly.RuntimeError || (err && err.name === 'RuntimeError')) {
      title = 'Tràn bộ nhớ WebAssembly (OOM)';
      msg = 'Trình duyệt bị thiếu bộ nhớ khi xử lý lưới hoặc dựng hình học 3D trong WebAssembly.';
      suggestion = 'File STL quá lớn hoặc có quá nhiều tam giác. Vui lòng giảm số tam giác (Decimate/Simplify) xuống dưới 20.000 tam giác trong phần mềm 3D (Blender, MeshLab) rồi thử lại.';
    } else if (err && err.name === 'AbortError') {
      title = 'Quá thời gian tải thư viện';
      msg = 'Quá thời gian chờ khi tải thư viện oc.wasm (90 giây).';
      suggestion = 'Vui lòng kiểm tra lại kết nối mạng hoặc máy chủ web cục bộ và thử lại.';
    } else {
      const raw = err && err.message ? String(err.message) : String(err || 'Không chuyển đổi được STL.');
      msg = raw;
      if (/out of memory|memory access|allocation failed/i.test(raw)) {
        title = 'Tràn bộ nhớ';
        suggestion = 'Hãy giảm bớt số lượng tam giác của file STL hoặc đóng các tab trình duyệt khác để giải phóng RAM.';
      } else if (/Failed to fetch|NetworkError|HTTP/i.test(raw)) {
        title = 'Lỗi tải thư viện máy chủ';
        suggestion = 'Hãy đảm bảo bạn đang chạy ứng dụng qua máy chủ HTTP cục bộ (python -m http.server 8000 hoặc python serve.py) thay vì mở trực tiếp file index.html.';
      } else if (/tam giác|lưới|STL|suy biến|trùng lặp/i.test(raw)) {
        title = 'Lỗi dữ liệu file STL';
        if (raw.includes('20.000')) {
          suggestion = 'Hãy dùng Blender hoặc MeshLab để giảm bớt số tam giác (Decimate) xuống dưới 20.000 tam giác.';
        } else if (raw.includes('suy biến') || raw.includes('trùng lặp')) {
          suggestion = 'Hãy bật tùy chọn "Tiền xử lý lưới trước khi chuyển đổi" để loại bỏ các tam giác lỗi này.';
        } else {
          suggestion = 'Hãy kiểm tra lại tính toàn vẹn của mô hình trong phần mềm CAD trước khi xuất STL.';
        }
      } else if (/Dung sai|khâu/i.test(raw)) {
        title = 'Lỗi khâu hình học';
        suggestion = 'Hãy thử điều chỉnh lại "Dung sai khâu" trong phần Tùy chọn chuyển đổi (ví dụ: tăng lên 0,001 mm hoặc giảm xuống 0,00001 mm).';
      } else {
        title = 'Lỗi chuyển đổi';
        suggestion = 'Hãy thử bật "Tiền xử lý lưới trước khi chuyển đổi" hoặc kiểm tra lại file STL nguồn.';
      }
    }
    postMessage({type:'error',id,msg,title,suggestion});
  } finally {
    if (oc) { try { oc.FS.unlink(outputPath); } catch {} }
    dispose(...owned);
    close();
  }
};






