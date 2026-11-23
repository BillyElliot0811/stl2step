'use strict';
const fs = require('fs');
const path = require('path');

// Hàm tham chiếu cũ (dùng text.split)
function parseOld(buffer, repair) {
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

// Trích xuất pháp tuyến từ ASCII STL để so sánh
function extractNormals(text) {
  const normals = [];
  const re = /facet\s+normal\s+([^\r\n]+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const parts = m[1].trim().split(/\s+/).map(Number);
    normals.push(parts);
  }
  return normals;
}

// Sinh file ASCII STL với 19.000 tam giác hợp lệ
function generate19kAsciiStl() {
  const triCount = 19000;
  const lines = ['solid model_19k_ascii'];
  for (let i = 0; i < triCount; i++) {
    const nx = Math.sin(i * 0.01).toFixed(7);
    const ny = Math.cos(i * 0.01).toFixed(7);
    const nz = 0.5.toFixed(7);
    lines.push(`  facet normal ${nx} ${ny} ${nz}`);
    lines.push('    outer loop');
    const x0 = (i * 0.05).toFixed(6);
    const x1 = (i * 0.05 + 0.04).toFixed(6);
    const y0 = (Math.sin(i) * 10).toFixed(6);
    const y1 = (Math.cos(i) * 10).toFixed(6);
    const z0 = (i * 0.01).toFixed(6);
    lines.push(`      vertex ${x0} ${y0} ${z0}`);
    lines.push(`      vertex ${x1} ${y0} ${z0}`);
    lines.push(`      vertex ${x0} ${y1} ${z0}`);
    lines.push('    endloop');
    lines.push('  endfacet');
  }
  lines.push('endsolid model_19k_ascii');
  return lines.join('\r\n');
}

function compareResults(name, oldRes, newRes, normals) {
  if (oldRes.total !== newRes.total) {
    throw new Error(`[${name}] total triangles mismatch: old=${oldRes.total}, new=${newRes.total}`);
  }
  if (oldRes.skipped !== newRes.skipped) {
    throw new Error(`[${name}] skipped mismatch: old=${oldRes.skipped}, new=${newRes.skipped}`);
  }
  if (oldRes.triangles.length !== newRes.triangles.length) {
    throw new Error(`[${name}] clean triangles length mismatch: old=${oldRes.triangles.length}, new=${newRes.triangles.length}`);
  }

  const EPS = 1e-9;
  for (let i = 0; i < oldRes.triangles.length; i++) {
    const triOld = oldRes.triangles[i];
    const triNew = newRes.triangles[i];
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        const diff = Math.abs(triOld[j][k] - triNew[j][k]);
        if (diff > EPS) {
          throw new Error(`[${name}] Triangle #${i} vertex #${j} coord #${k} mismatch: old=${triOld[j][k]}, new=${triNew[j][k]}, diff=${diff}`);
        }
      }
    }
  }

  if (normals && normals.length) {
    for (let i = 0; i < normals.length; i++) {
      for (let k = 0; k < 3; k++) {
        if (!Number.isFinite(normals[i][k])) {
          throw new Error(`[${name}] Normal #${i} coord #${k} not finite: ${normals[i][k]}`);
        }
      }
    }
  }
}

async function run() {
  const STL = require('../stl.js');
  console.log('=== BẮT ĐẦU KIỂM TRA SO SÁNH TƯƠNG ĐƯƠNG BẢN ĐỌC STL CŨ VÀ MỚI ===\n');

  let totalTestedTriangles = 0;

  // 1. Kiểm tra các fixture trong tests/fixtures/
  const fixturesDir = path.join(__dirname, 'fixtures');
  const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.stl'));

  for (const file of files) {
    const filePath = path.join(fixturesDir, file);
    const buf = fs.readFileSync(filePath);
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    let oldErr = null, newErr = null;
    let oldRes = null, newRes = null;

    try { oldRes = parseOld(arrayBuf, true); } catch (e) { oldErr = e; }
    try { newRes = STL.parse(arrayBuf, true); } catch (e) { newErr = e; }

    if (oldErr || newErr) {
      if (file === 'mixed_line_endings.stl') {
        console.log(`File ASCII hỗn hợp: không khớp - một bản ném lỗi: oldErr=${oldErr?.message}, newErr=${newErr?.message}`);
      }
      if (!oldErr || !newErr) {
        throw new Error(`[${file}] Một bản ném lỗi còn bản kia không: oldErr=${oldErr?.message}, newErr=${newErr?.message}`);
      }
      console.log(`✓ Fixture lỗi [${file}]: Cả hai bản đều ném lỗi phù hợp ("${newErr.message}")`);
    } else {
      let normals = null;
      try {
        const text = new TextDecoder('utf-8').decode(arrayBuf);
        if (/^\s*solid/i.test(text)) normals = extractNormals(text);
      } catch {}

      compareResults(file, oldRes, newRes, normals);
      totalTestedTriangles += newRes.total;
      if (file === 'mixed_line_endings.stl') {
        console.log(`File ASCII hỗn hợp: ${newRes.triangles.length} tam giác, khớp hoàn toàn`);
      } else {
        console.log(`✓ Fixture [${file}]: Khớp hoàn toàn (${newRes.triangles.length}/${newRes.total} tam giác, sai lệch <= 1e-9)`);
      }
    }
  }

  // 2. Kiểm tra file ASCII lớn 19.000 tam giác
  console.log('\nSinh file STL ASCII lớn (19.000 tam giác)...');
  const bigAsciiText = generate19kAsciiStl();
  const bigBuf = Buffer.from(bigAsciiText, 'utf-8');
  const bigArrayBuf = bigBuf.buffer.slice(bigBuf.byteOffset, bigBuf.byteOffset + bigBuf.byteLength);

  const t0 = performance.now();
  const oldRes = parseOld(bigArrayBuf, true);
  const tOld = performance.now() - t0;

  const t1 = performance.now();
  const newRes = STL.parse(bigArrayBuf, true);
  const tNew = performance.now() - t1;

  const normals = extractNormals(bigAsciiText);
  compareResults('ASCII_19000_triangles', oldRes, newRes, normals);
  totalTestedTriangles += newRes.total;

  console.log(`✓ File ASCII 19.000 tam giác: Khớp hoàn toàn (19.000 tam giác, sai số <= 1e-9)!`);
  console.log(`  Thời gian parse bản cũ: ${tOld.toFixed(2)} ms`);
  console.log(`  Thời gian parse bản mới: ${tNew.toFixed(2)} ms (nhanh hơn ${(tOld / tNew).toFixed(1)}x)`);

  console.log(`\n=== TỔNG KẾT: ĐÃ SO SÁNH ${totalTestedTriangles.toLocaleString()} TAM GIÁC, 100% KHỚP HOÀN TOÀN ===`);
}

run().catch(err => {
  console.error('❌ LỖI SO SÁNH:', err);
  process.exit(1);
});
