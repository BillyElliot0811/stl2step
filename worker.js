/* OpenCASCADE.js 1.1.1 bindings: keep the numbered overloads in sync with oc.js. */
'use strict';
let busy = false;
onmessage = async ({data:job}) => {
  if (!job || job.type !== 'convert' || busy) return;
  busy = true;
  const id = job.id;
  const say = msg => postMessage({type:'status',id,msg});
  const owned = new Set();
  const keep = value => { owned.add(value); return value; };
  const dispose = (...items) => { for (const item of items.reverse()) { if (item) { try { item.delete(); } catch {} } } };
  let oc;
  // Keep a fixed short MEMFS name for the bundled 1.1.1 string bindings.
  // The user-facing filename is applied to the Blob download in app.js.
  const outputPath = '/out.step';
  try {
    say('Đang kiểm tra file STL…');
    importScripts('stl.js?v=20261027-curves1');
    const tol = job.tol;
    if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 1e-7 || tol > 1) throw new Error('Dung sai phải từ 0,0000001 đến 1 mm.');
    const parsed = STL.parse(job.buffer, Boolean(job.repairMesh));
    // Parsing precedes the large WASM load so invalid input fails quickly.
    job.buffer = null;
    const warnings = [];
    if (parsed.skipped) warnings.push('Đã loại ' + parsed.skipped.toLocaleString('vi-VN') + ' tam giác suy biến hoặc trùng lặp.');
    let recovered = null;
    if (job.recoverCurves) {
      if (job.curveTolerance !== undefined && (typeof job.curveTolerance !== 'number' || !Number.isFinite(job.curveTolerance) || job.curveTolerance < 0.0001 || job.curveTolerance > 0.1)) throw new Error('Sai lệch nhận dạng phải từ 0,0001 đến 0,1 mm.');
      say('Đang nhận dạng lỗ tròn và bo cơ bản…');
      importScripts('mesh-qa.js?v=20261027-curves1','recognize.js?v=20261027-curves1');
      recovered = CurveRecognition.recognize(parsed.triangles,{tolerance:job.curveTolerance});
      if (!recovered.ok) warnings.push('Giữ mặt lưới vì chưa nhận dạng được mặt cong an toàn: ' + recovered.reason);
    }
    say('Đang nạp bộ chuyển đổi (oc.wasm khoảng 63 MiB ở lần đầu)…');
    importScripts('oc.js');
    // Fetch explicitly: this older Emscripten loader can leave its ready
    // Promise pending on an HTTP/network error.
    const controller = new AbortController();
    const loadTimeout = setTimeout(() => controller.abort(),90000);
    let wasmBinary;
    try {
      const response = await fetch(new URL('oc.wasm',self.location.href),{signal:controller.signal});
      if (!response.ok) throw new Error('Không tải được oc.wasm (HTTP ' + response.status + '). Kiểm tra file thư viện trên máy chủ.');
      wasmBinary = await response.arrayBuffer();
      const header = new Uint8Array(wasmBinary,0,Math.min(4,wasmBinary.byteLength));
      if (header.length !== 4 || header[0] !== 0 || header[1] !== 97 || header[2] !== 115 || header[3] !== 109) throw new Error('oc.wasm bị hỏng hoặc máy chủ trả về nội dung khác. Hãy khôi phục đúng file thư viện.');
    } catch (err) {
      if (controller.signal.aborted) throw new Error('Nạp bộ chuyển đổi quá 90 giây. Kiểm tra kết nối và thử lại.');
      if (err instanceof TypeError) throw new Error('Không tải được oc.wasm. Kiểm tra kết nối và các file thư viện rồi thử lại.');
      throw err;
    } finally { clearTimeout(loadTimeout); }
    let initTimeout;
    try {
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
    if (recovered && recovered.ok) {
      say('Đang dựng mặt trụ, cung tròn và fillet giải tích…');
      importScripts('analytic-builder.js?v=20261027-curves1');
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
    if (!result) {
    const sewing = keep(new oc.BRepBuilderAPI_Sewing(tol,true,true,true,false));
    const progress = keep(new oc.Handle_Message_ProgressIndicator_1());
    const triangles = parsed.triangles;
    say('Đang dựng ' + triangles.length.toLocaleString('vi-VN') + ' mặt tam giác…');
    for (let i = 0; i < triangles.length; i++) {
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
      if (i > 0 && i % 500 === 0) say('Đang dựng mặt: ' + i.toLocaleString('vi-VN') + '/' + triangles.length.toLocaleString('vi-VN') + '…');
    }
    triangles.length = 0;
    say('Đang khâu các cạnh theo dung sai ' + tol + ' mm…');
    sewing.Perform(progress);
    if (sewing.NbDeletedFaces() > 0) throw new Error('Dung sai làm mất mặt nhỏ khi khâu. Hãy giảm dung sai và thử lại.');
    let shape = keep(sewing.SewedShape());
    if (shape.IsNull() || !count(shape,types.TopAbs_FACE)) throw new Error('Không tạo được hình học từ lưới STL.');
    const multipleEdges = sewing.NbMultipleEdges();
    if (multipleEdges) warnings.push('Lưới có cạnh dùng chung bất thường (non-manifold); kết quả được giữ dạng mặt/vỏ.');
    if (job.refine) {
      say('Đang gộp các mặt đồng phẳng…');
      const unify = keep(new oc.ShapeUpgrade_UnifySameDomain_2(shape,true,true,false));
      unify.SetLinearTolerance(tol);
      unify.SetAngularTolerance(1e-10);
      unify.Build();
      const refined = keep(unify.Shape());
      if (!refined.IsNull() && count(refined,types.TopAbs_FACE) && valid(refined)) shape = refined;
      else warnings.push('Không gộp được mặt an toàn; giữ nguyên các mặt đã khâu.');
    }
    say('Đang kiểm tra vỏ kín và tạo khối…');
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
      if (orientationSafe && !multipleEdges && shells.length <= 256 && !ambiguous.has(i) && oc.BRep_Tool.IsClosed_1(shell) && valid(shell)) {
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
    if (!allSolid) warnings.push('Kết quả có mặt/vỏ chưa tạo thành khối. Hãy kiểm tra độ kín trong phần mềm CAD.');
    }
    say('Đang xuất file STEP…');
    const writer = keep(new oc.STEPControl_Writer_1());
    const success = oc.IFSelect_ReturnStatus.IFSelect_RetDone.value;
    const status = writer.Transfer(result,oc.STEPControl_StepModelType.STEPControl_AsIs,true);
    if (status.value !== success) throw new Error('OpenCASCADE không chuyển được hình học sang STEP.');
    if (writer.Write(outputPath).value !== success) throw new Error('Không ghi được file STEP.');
    const bytes = oc.FS.readFile(outputPath);
    if (bytes.length < 100 || !new TextDecoder().decode(bytes.subarray(0,40)).includes('ISO-10303-21')) throw new Error('File STEP xuất ra rỗng hoặc không hợp lệ.');
    const output = bytes.slice().buffer;
    postMessage({type:'done',id,data:output,info:{triangles:parsed.total,faces,solid:allSolid,solids,shells:openShells,skipped:parsed.skipped,warnings,reconstruction}},[output]);
  } catch (err) {
    const msg = err && err.message ? err.message : 'Bộ chuyển đổi gặp lỗi hình học hoặc thiếu bộ nhớ. Hãy giảm số tam giác/sửa STL rồi thử lại.';
    postMessage({type:'error',id,msg});
  } finally {
    if (oc) { try { oc.FS.unlink(outputPath); } catch {} }
    dispose(...owned);
    close();
  }
};






