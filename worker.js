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
    // Nhận thêm biến autoRepair từ index.html gửi sang
    const { buffer, tol, refine, autoRepair } = e.data;
    const say = (msg) => postMessage({ type: 'status', msg });
    try {
        say('Đang nạp OpenCASCADE (lần đầu ~60 MB)...');
        const oc = await getOC();
        say('Đang đọc STL...');
        
        let tris = parseSTL(buffer);
        if (!tris.length) throw new Error('Không đọc được tam giác nào. File có đúng định dạng STL không?');

        let skippedCount = 0;

        // Xử lý tự động lọc lưới / vá lỗi nếu checkbox được bật
        if (autoRepair) {
            say('Đang tự động kiểm tra và làm sạch lưới STL...');
            tris = tris.filter(tri => {
                const [p1, p2, p3] = tri;
                // Kiểm tra tam giác suy biến (các đỉnh trùng nhau, diện tích = 0)
                const isDegenerate = 
                    (p1[0] === p2[0] && p1[1] === p2[1] && p1[2] === p2[2]) ||
                    (p2[0] === p3[0] && p2[1] === p3[1] && p2[2] === p3[2]) ||
                    (p1[0] === p3[0] && p1[1] === p3[1] && p1[2] === p3[2]);
                if (isDegenerate) skippedCount++;
                return !isDegenerate;
            });
        }

        // --- Từ đoạn này trở xuống là logic dựng hình OpenCASCADE cũ của bạn ---
        say('Đang xây dựng mô hình B-rep...');
        
        // Tạo các builder OpenCASCADE để chuyển danh sách tam giác thành file STEP
        const builder = new oc.BRep_Builder();
        const comp = new oc.TopoDS_Compound();
        builder.MakeCompound(comp);

        let facesCount = 0;
        // (Giữ nguyên phần thuật toán tạo mặt phẳng / gộp mặt phía dưới theo mã nguồn gốc của bạn...)

    } catch (err) {
        postMessage({ type: 'error', msg: err.message });
    }
};
