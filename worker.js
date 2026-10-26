// Chạy OpenCASCADE trong Web Worker để trang không bị đơ
importScripts('oc.js');
let ocPromise = null;
function getOC() {
  if (!ocPromise) ocPromise = new opencascade({ locateFile: f => f.endsWith('.wasm') ? 'oc.wasm' : f });
  return ocPromise;
}
function parseSTL(buf) {
  const dv = new DataView(buf), tris = [];
  const isBin = buf.byteLength === 84 + 50 * dv.getUint32(80, true);
  if (isBin) {
    const n = dv.getUint32(80, true);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12, t = [];
      for (let k = 0; k < 3; k++) t.push([dv.getFloat32(o + k*12, true), dv.getFloat32(o + k*12 + 4, true), dv.getFloat32(o + k*12 + 8, true)]);
      tris.push(t);
    }
  } else {
    const s = new TextDecoder().decode(buf), re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
    let m, v = [];
    while ((m = re.exec(s))) { v.push([+m[1], +m[2], +m[3]]); if (v.length === 3) { tris.push(v); v = []; } }
  }
  return tris;
}
onmessage = async (e) => {
  const { buffer, tol, refine, autoRepair } = e.data;
  const say = (msg) => postMessage({ type: 'status', msg });
  try {
  say('Đang nạp OpenCASCADE (lần đầu ~60 MB)...');
  const oc = await getOC();
  say('Đang đọc STL...');
        
  let tris = parseSTL(buffer); // <-- 2. Đổi từ const thành let
        if (!tris.length) throw new Error('Không đọc được tam giác nào. File có đúng định dạng STL không?');

        // ==========================================
        // CHÈN BƯỚC XỬ LÝ / VÁ LỖ (B1) Ở ĐÂY:
        // ==========================================
        if (autoRepair) {
            say('Đang tự động kiểm tra và làm sạch lưới STL...');
            // Lọc bỏ các tam giác lỗi / trùng lặp diện tích = 0
            tris = tris.filter(tri => {
                // Kiểm tra 3 đỉnh của tam giác có bị trùng nhau không
                const [p1, p2, p3] = tri;
                const isDegenerate = 
                    (p1[0] === p2[0] && p1[1] === p2[1] && p1[2] === p2[2]) ||
                    (p2[0] === p3[0] && p2[1] === p3[1] && p2[2] === p3[2]) ||
                    (p1[0] === p3[0] && p1[1] === p3[1] && p1[2] === p3[2]);
                return !isDegenerate;
            });
        }
    say(`Đang dựng ${tris.length.toLocaleString()} mặt và khâu lại...`);
    const sew = new oc.BRepBuilderAPI_Sewing(tol, true, true, true, false);
    let skipped = 0;
    for (const t of tris) {
      const p = t.map(v => new oc.gp_Pnt_3(v[0], v[1], v[2]));
      const poly = new oc.BRepBuilderAPI_MakePolygon_3(p[0], p[1], p[2], true);
      if (!poly.IsDone()) { skipped++; continue; }
      const face = new oc.BRepBuilderAPI_MakeFace_15(poly.Wire(), true);
      if (face.IsDone()) sew.Add(face.Face()); else skipped++;
    }
    sew.Perform(new oc.Handle_Message_ProgressIndicator_1());
    let shape = sew.SewedShape();
    let solid = false;
    const ex = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_SHELL, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    if (ex.More()) { shape = new oc.BRepBuilderAPI_MakeSolid_3(oc.TopoDS.Shell_1(ex.Current())).Solid(); solid = true; }
    if (refine) {
      say('Đang gộp các mặt đồng phẳng...');
      const un = new oc.ShapeUpgrade_UnifySameDomain_2(shape, true, true, true);
      un.Build(); shape = un.Shape();
    }
    let faces = 0;
    const fe = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (fe.More()) { faces++; fe.Next(); }
    say('Đang ghi file STEP...');
    const w = new oc.STEPControl_Writer_1();
    w.Transfer(shape, oc.STEPControl_StepModelType.STEPControl_AsIs, true);
    w.Write('/out.step');
    const data = oc.FS.readFile('/out.step');
    postMessage({ type: 'done', data, info: { triangles: tris.length, skipped, faces, solid } }, [data.buffer]);
  } catch (err) {
    postMessage({ type: 'error', msg: String(err && err.message || err) });
  }
};
