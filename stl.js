/* Strict STL reader shared by the worker and regression tests. */
'use strict';
const STL = (() => {
  const MAX_BYTES = 32 * 1024 * 1024;
  const MAX_TRIANGLES = 20000;
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  const vector = new RegExp('^(' + number + ')\\s+(' + number + ')\\s+(' + number + ')$');
  function point(text) {
    const match = vector.exec(text);
    if (!match) throw new Error('STL có tọa độ hoặc pháp tuyến không hợp lệ.');
    return match.slice(1).map(value => {
      const n = Number(value);
      if (!Number.isFinite(n) || Math.abs(n) > 1e9) throw new Error('STL có số không hữu hạn hoặc tọa độ quá lớn (> 1 tỷ đơn vị).');
      return n;
    });
  }
  function parse(buffer, repair) {
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength) throw new Error('File STL rỗng hoặc không đọc được.');
    if (buffer.byteLength > MAX_BYTES) throw new Error('File vượt giới hạn 32 MiB. Hãy giảm số tam giác trước.');
    let triangles = [];
    const dv = new DataView(buffer);
    const n = buffer.byteLength >= 84 ? dv.getUint32(80, true) : -1;
    if (n >= 0 && 84 + n * 50 === buffer.byteLength) {
      if (n > MAX_TRIANGLES) throw new Error('STL vượt giới hạn 20.000 tam giác. Hãy đơn giản hóa lưới trước.');
      for (let i = 0; i < n; i++) {
        const tri = [];
        for (let j = 0; j < 3; j++) {
          const p = [];
          for (let k = 0; k < 3; k++) {
            const value = dv.getFloat32(84 + i * 50 + 12 + j * 12 + k * 4, true);
            if (!Number.isFinite(value) || Math.abs(value) > 1e9) throw new Error('STL có tọa độ không hữu hạn hoặc quá lớn.');
            p.push(value);
          }
          tri.push(p);
        }
        triangles.push(tri);
      }
    } else {
      let text;
      try { text = new TextDecoder('utf-8', {fatal:true}).decode(buffer); }
      catch { throw new Error('STL nhị phân bị thiếu dữ liệu hoặc số tam giác trong header không khớp.'); }
      if (!/^\s*solid(?:\s|$)/i.test(text) || text.includes('\0')) throw new Error('File không phải STL hợp lệ, hoặc STL nhị phân bị thiếu/thừa dữ liệu.');
      let state = 'solid', tri = [], solids = 0;
      for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (state === 'solid' && /^solid(?:\s.*)?$/i.test(line)) { state = 'facet'; solids++; }
        else if (state === 'facet' && /^endsolid(?:\s.*)?$/i.test(line)) state = 'solid';
        else if (state === 'facet' && /^facet\s+normal\s+/i.test(line)) { point(line.replace(/^facet\s+normal\s+/i, '')); tri = []; state = 'loop'; }
        else if (state === 'loop' && /^outer\s+loop$/i.test(line)) state = 'vertex';
        else if (state === 'vertex' && /^vertex\s+/i.test(line)) { tri.push(point(line.replace(/^vertex\s+/i, ''))); if (tri.length === 3) state = 'endloop'; }
        else if (state === 'endloop' && /^endloop$/i.test(line)) state = 'endfacet';
        else if (state === 'endfacet' && /^endfacet$/i.test(line)) {
          triangles.push(tri); state = 'facet';
          if (triangles.length > MAX_TRIANGLES) throw new Error('STL vượt giới hạn 20.000 tam giác. Hãy đơn giản hóa lưới trước.');
        } else throw new Error('Cấu trúc STL ASCII không hợp lệ hoặc facet bị thiếu đỉnh.');
      }
      if (state !== 'solid' || !solids) throw new Error('STL ASCII bị thiếu endfacet hoặc endsolid.');
    }
    const total = triangles.length;
    if (!total) throw new Error('STL không chứa tam giác nào.');
    let skipped = 0;
    const seen = new Set(), clean = [];
    for (const t of triangles) {
      const u = t[1].map((v, k) => v - t[0][k]), v = t[2].map((x, k) => x - t[0][k]);
      const w = t[2].map((x, k) => x - t[1][k]);
      const cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const lengths = [u,v,w].map(p => p.reduce((a,x)=>a+x*x,0));
      const degenerate = Math.min(...lengths) <= 1e-14 || Math.hypot(...cross) <= Math.max(1e-14, Math.max(...lengths)*1e-12);
      const key = t.map(p=>p.join(',')).sort().join(';');
      if (degenerate || seen.has(key)) {
        if (!repair) throw new Error('STL có tam giác suy biến hoặc trùng lặp. Bật làm sạch lưới để loại bỏ, hoặc sửa STL trước.');
        skipped++; continue;
      }
      seen.add(key); clean.push(t);
    }
    if (!clean.length) throw new Error('Không còn tam giác hợp lệ sau khi làm sạch.');
    return {triangles:clean,total,skipped};
  }
  return {parse,MAX_BYTES,MAX_TRIANGLES};
})();
if (typeof module !== 'undefined') module.exports = STL;
