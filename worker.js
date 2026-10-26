// Chạy OpenCASCADE trong Web Worker để trang không bị đơ
importScripts('oc.js');
let ocPromise = null;

function getOC() {
    if (!ocPromise) ocPromise = new opencascade({ locateFile: f => f.endsWith('.wasm') ? 'oc.wasm' : 'oc.wasm' });
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
        while ((m = re.exec(s)) !== null) { v.push([+m[1], +m[2], +m[3]]); if (v.length === 3) { tris.push(v); v = []; } }
    }
    return tris;
}

onmessage = async (e) => {
    // Đồng bộ nhận biến repairMesh từ index.html
    const { buffer, tol, refine, repairMesh } = e.data;
    const say = (msg) => postMessage({ type: 'status', msg });
    
    try {
        say('Đang nạp OpenCASCADE (lần đầu ~60 MB)...');
        const oc = await getOC();
        say('Đang đọc STL...');
        
        let tris = parseSTL(buffer);
        if (!tris.length) throw new Error('Không đọc được tam giác nào. File có đúng định dạng STL không?');

        let skippedCount = 0;

        // Xử lý tự động lọc tam giác suy biến nếu checkbox được bật
        if (repairMesh) {
            say('Đang tự động kiểm tra và làm sạch lưới STL...');
            tris = tris.filter(tri => {
                const [p1, p2, p3] = tri;
                const isDegenerate = 
                    (p1[0] === p2[0] && p1[1] === p2[1] && p1[2] === p2[2]) ||
                    (p2[0] === p3[0] && p2[1] === p3[1] && p2[2] === p3[2]) ||
                    (p1[0] === p3[0] && p1[1] === p3[1] && p1[2] === p3[2]);
                if (isDegenerate) skippedCount++;
                return !isDegenerate;
            });
        }

        say('Đang xây dựng mô hình B-rep...');
        
        const builder = new oc.BRep_Builder();
        const compound = new oc.TopoDS_Compound();
        builder.MakeCompound(compound);

        let facesCount = 0;
        for (let i = 0; i < tris.length; i++) {
            const t = tris[i];
            const p1 = new oc.gp_Pnt(); p1.SetCoord(t[0][0], t[0][1], t[0][2]);
            const p2 = new oc.gp_Pnt(); p2.SetCoord(t[1][0], t[1][1], t[1][2]);
            const p3 = new oc.gp_Pnt(); p3.SetCoord(t[2][0], t[2][1], t[2][2]);
            
            if (p1.IsEqual(p2, 1e-7) || p2.IsEqual(p3, 1e-7) || p3.IsEqual(p1, 1e-7)) {
                skippedCount++;
                continue;
            }

            try {
                const mkFace = new oc.BRepBuilderAPI_MakeFace(p1, p2, p3);
                if (mkFace.IsDone()) {
                    const face = mkFace.Face();
                    builder.Add(compound, face);
                    facesCount++;
                }
                mkFace.delete();
            } catch (err) {
                skippedCount++;
            }

            p1.delete(); p2.delete(); p3.delete();
        }

        let finalShape = compound;
        if (refine) {
            say('Đang gộp các mặt đồng phẳng...');
            const mkShapePr = new oc.ShapeUpgrade_UnifySameDomain(compound, true, true, false);
            mkShapePr.Build();
            finalShape = mkShapePr.Shape();
        }

        let isSolid = false;
        try {
            const s = new oc.BRepBuilderAPI_MakeSolid(oc.TopoDS.ToShell(finalShape));
            if (s.IsDone()) isSolid = true;
            s.delete();
        } catch (e) {}

        say('Đang xuất file STEP...');
        const writer = new oc.STEPControl_Writer();
        writer.Transfer(finalShape, oc.STEPControl_StepModelType.StepControl_AsIs, true, new oc.Message_ProgressRange());
        
        const tempPath = 'output.step';
        writer.Write(tempPath);

        let stepData;
        try {
            stepData = oc.FS.readFile(tempPath);
        } catch(ex) {
            stepData = new Uint8Array(0);
        }

        postMessage({
            type: 'done',
            data: stepData.buffer,
            info: {
                triangles: tris.length,
                faces: facesCount,
                solid: isSolid,
                skipped: skippedCount
            }
        });

    } catch (err) {
        postMessage({ type: 'error', msg: err.message });
    }
};
