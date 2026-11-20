/**
 * tests/make-fixtures.js
 * Sinh các file mẫu STL phục vụ kiểm thử Playwright tự động.
 * Node thuần, không phụ thuộc thư viện bên ngoài.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

function toAsciiStl(name, triangles) {
  let out = `solid ${name}\n`;
  for (const t of triangles) {
    const u = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]];
    const v = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
    let n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(...n);
    if (len > 1e-12) {
      n = n.map(c => (c / len).toFixed(6));
    } else {
      n = ['0.000000', '0.000000', '0.000000'];
    }
    out += `  facet normal ${n[0]} ${n[1]} ${n[2]}\n    outer loop\n`;
    for (const p of t) {
      out += `      vertex ${p[0]} ${p[1]} ${p[2]}\n`;
    }
    out += `    endloop\n  endfacet\n`;
  }
  out += `endsolid ${name}\n`;
  return out;
}

function makeBoxFaces(x0, y0, z0, x1, y1, z1, omitTop = false) {
  const faces = [
    // Bottom (z0)
    [[x0, y0, z0], [x1, y1, z0], [x1, y0, z0]],
    [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    // Front (y0)
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1]],
    [[x0, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    // Back (y1)
    [[x0, y1, z0], [x1, y1, z1], [x1, y1, z0]],
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1]],
    // Left (x0)
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1]],
    [[x0, y0, z0], [x0, y1, z1], [x0, y1, z0]],
    // Right (x1)
    [[x1, y0, z0], [x1, y1, z1], [x1, y0, z1]],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
  ];
  if (!omitTop) {
    faces.push(
      // Top (z1)
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1]],
      [[x0, y0, z1], [x1, y1, z1], [x0, y1, z1]]
    );
  }
  return faces;
}

// 1. cube.stl (12 tam giác)
function makeCube() {
  return makeBoxFaces(0, 0, 0, 10, 10, 10);
}

// 2. cylinder.stl (hình trụ kín, 48 đoạn)
function makeCylinder(r = 5, h = 10, n = 48) {
  const triangles = [];
  // Đáy dưới (z=0, normal -z)
  for (let i = 0; i < n; i++) {
    const a1 = (i * 2 * Math.PI) / n;
    const a2 = ((i + 1) * 2 * Math.PI) / n;
    const p1 = [+(r * Math.cos(a2)).toFixed(5), +(r * Math.sin(a2)).toFixed(5), 0];
    const p2 = [+(r * Math.cos(a1)).toFixed(5), +(r * Math.sin(a1)).toFixed(5), 0];
    triangles.push([[0, 0, 0], p1, p2]);
  }
  // Đáy trên (z=h, normal +z)
  for (let i = 0; i < n; i++) {
    const a1 = (i * 2 * Math.PI) / n;
    const a2 = ((i + 1) * 2 * Math.PI) / n;
    const p1 = [+(r * Math.cos(a1)).toFixed(5), +(r * Math.sin(a1)).toFixed(5), h];
    const p2 = [+(r * Math.cos(a2)).toFixed(5), +(r * Math.sin(a2)).toFixed(5), h];
    triangles.push([[0, 0, h], p1, p2]);
  }
  // Thân trụ (z: 0 -> h)
  for (let i = 0; i < n; i++) {
    const a1 = (i * 2 * Math.PI) / n;
    const a2 = ((i + 1) * 2 * Math.PI) / n;
    const b1 = [+(r * Math.cos(a1)).toFixed(5), +(r * Math.sin(a1)).toFixed(5), 0];
    const b2 = [+(r * Math.cos(a2)).toFixed(5), +(r * Math.sin(a2)).toFixed(5), 0];
    const t1 = [+(r * Math.cos(a1)).toFixed(5), +(r * Math.sin(a1)).toFixed(5), h];
    const t2 = [+(r * Math.cos(a2)).toFixed(5), +(r * Math.sin(a2)).toFixed(5), h];
    triangles.push([b1, b2, t2]);
    triangles.push([b1, t2, t1]);
  }
  return triangles;
}

// 3. planar_hole.stl (khối hộp 10x10x10 có 1 lỗ phẳng nhỏ 0.4x0.4 mm tại đỉnh z=10)
function makePlanarHole() {
  const base = makeBoxFaces(0, 0, 0, 10, 10, 10, true);
  const z = 10;
  // Mặt phẳng trên z=10 chừa một lỗ vuông [4.8, 4.8] đến [5.2, 5.2] (đường kính ~0.566 mm <= 1.0 mm)
  const topFaces = [
    // Vành dưới
    [[0, 0, z], [10, 0, z], [5.2, 4.8, z]],
    [[0, 0, z], [5.2, 4.8, z], [4.8, 4.8, z]],
    // Vành phải
    [[10, 0, z], [10, 10, z], [5.2, 5.2, z]],
    [[10, 0, z], [5.2, 5.2, z], [5.2, 4.8, z]],
    // Vành trên
    [[10, 10, z], [0, 10, z], [4.8, 5.2, z]],
    [[10, 10, z], [4.8, 5.2, z], [5.2, 5.2, z]],
    // Vành trái
    [[0, 10, z], [0, 0, z], [4.8, 4.8, z]],
    [[0, 10, z], [4.8, 4.8, z], [4.8, 5.2, z]],
  ];
  return base.concat(topFaces);
}

// 4. edge_contact.stl (2 khối hộp tiếp xúc tại cạnh x=0, y=0, z in [0, 10] bề dày 0)
function makeEdgeContact() {
  const c1 = makeBoxFaces(-10, 0, 0, 0, 10, 10);
  const c2 = makeBoxFaces(0, -10, 0, 10, 0, 10);
  return c1.concat(c2);
}

// 5. open_mesh.stl (khối hộp hở mặt trên z=10, đường kính hở ~14 mm > 10 mm)
function makeOpenMesh() {
  return makeBoxFaces(0, 0, 0, 10, 10, 10, true);
}

// 6. corrupt_text.stl (file văn bản đổi đuôi .stl)
function makeCorruptText() {
  return [
    'Tài liệu văn bản thuần không phải dữ liệu mô hình 3D STL.',
    'Chuyển STL sang STEP - Kiểm tra phản hồi khi gặp file hỏng.',
    'Tập tin này thiếu cấu trúc solid, facet normal, outer loop và vertex.',
    'Dòng kết thúc thử nghiệm xử lý an toàn và không gây treo giao diện.',
  ].join('\n');
}

const files = {
  'cube.stl': toAsciiStl('cube', makeCube()),
  'cylinder.stl': toAsciiStl('cylinder', makeCylinder(5, 10, 48)),
  'planar_hole.stl': toAsciiStl('planar_hole', makePlanarHole()),
  'edge_contact.stl': toAsciiStl('edge_contact', makeEdgeContact()),
  'open_mesh.stl': toAsciiStl('open_mesh', makeOpenMesh()),
  'corrupt_text.stl': makeCorruptText(),
};

console.log('=== Sinh các file STL fixtures ===');
for (const [filename, content] of Object.entries(files)) {
  const filepath = path.join(FIXTURES_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  const stat = fs.statSync(filepath);
  const sizeKB = (stat.size / 1024).toFixed(2);
  console.log(`- ${filename}: ${stat.size} bytes (~${sizeKB} KB) -> Đạt giới hạn < 100 KB`);
  if (stat.size >= 100 * 1024) {
    throw new Error(`File ${filename} vượt quá giới hạn 100 KB (${stat.size} bytes)`);
  }
}
console.log('Đã sinh thành công toàn bộ 6 file fixtures!');
