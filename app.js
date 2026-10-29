'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const MAX_BYTES = 32 * 1024 * 1024;
  const number = n => Number(n).toLocaleString('vi-VN');
  let selectedFile = null, active = null, sequence = 0, downloadURL = null;
  const available = location.protocol !== 'file:' && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
  function log(text, tone = 'neutral') { $('log').textContent = text; $('statusBox').dataset.tone = tone; }
  function clearDownload() {
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = null;
    $('dl').removeAttribute('href'); $('dl').removeAttribute('download'); $('downloadBox').hidden = true;
    $('warnings').replaceChildren();
  }
  function busy(value) {
    $('choose').disabled = value || !available; $('file').disabled = value || !available;
    $('options').disabled = value;
    $('go').disabled = value || !selectedFile || !available;
    $('cancel').hidden = !value; $('progress').hidden = !value;
    $('statusBox').setAttribute('aria-busy', String(value));
  }
  function finish(job) {
    if (active !== job) return false;
    clearTimeout(job.deadline); clearTimeout(job.boot);
    if (job.worker) { job.worker.onmessage = null; job.worker.onerror = null; job.worker.onmessageerror = null; job.worker.terminate(); }
    active = null; busy(false); return true;
  }
  function fail(job, message) { if (finish(job)) {clearDownload();log(message,'error');} }
  function pick(files) {
    if (!available || active || !files || !files.length) return;
    clearDownload(); selectedFile = null; busy(false);
    $('selected').textContent = 'Chưa chọn file · Tối đa 32 MiB và 20.000 tam giác';
    if (files.length !== 1) { log('Vui lòng chọn một file STL mỗi lần.','error'); return; }
    const file = files[0];
    if (!/\.stl$/i.test(file.name)) {log('Chỉ hỗ trợ file có đuôi .stl.','error');return;}
    if (!file.size) {log('File STL rỗng. Hãy chọn file khác.','error');return;}
    if (file.size > MAX_BYTES) {log('File vượt giới hạn 32 MiB. Hãy giảm số tam giác trước.','error');return;}
    selectedFile = file;
    const sizeText = file.size < 1024 ? number(file.size) + ' byte' : file.size < 1048576 ? (file.size/1024).toLocaleString('vi-VN',{maximumFractionDigits:1}) + ' KiB' : (file.size/1048576).toLocaleString('vi-VN',{maximumFractionDigits:2}) + ' MiB';
    $('selected').textContent = file.name + ' · ' + sizeText;
    busy(false);log('Đã chọn file. Bạn có thể bắt đầu chuyển đổi.');
  }
  $('choose').addEventListener('click', () => {if (!active) $('file').click();});
  $('file').addEventListener('change', e => {pick(e.target.files); e.target.value = '';});
  $('drop').addEventListener('dragover', e => {e.preventDefault();if (!active && available) $('drop').classList.add('over');});
  $('drop').addEventListener('dragleave', e => {if (!$('drop').contains(e.relatedTarget)) $('drop').classList.remove('over');});
  $('drop').addEventListener('drop', e => {e.preventDefault();$('drop').classList.remove('over');pick(e.dataTransfer.files);});
  for (const event of ['dragover','drop']) window.addEventListener(event,e=>{if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();});
  $('cancel').addEventListener('click', () => {
    if (active && finish(active)) {clearDownload();log('Đã hủy. Bạn có thể thử lại hoặc chọn file khác.');}
  });
  $('go').addEventListener('click', async () => {
    if (active || !selectedFile || !available) return;
    const tol = Number($('tol').value);
    if (!$('tol').value.trim() || !Number.isFinite(tol) || tol < 1e-7 || tol > 1) {
      log('Nhập dung sai từ 0,0000001 đến 1 mm.','error');$('tol').focus();return;
    }
    const recoverCurves = $('recoverCurves').checked, curveTolerance = Number($('curveTolerance').value);
    if (recoverCurves && (!$('curveTolerance').value.trim() || !Number.isFinite(curveTolerance) || curveTolerance < 0.0001 || curveTolerance > 0.1)) {
      log('Nhập sai lệch nhận dạng từ 0,0001 đến 0,1 mm.','error');$('curveTolerance').focus();return;
    }
    const repairMesh = $('repairMesh').checked, fillHoles = repairMesh && $('fillHoles').checked, maxHoleDiameter = Number($('maxHoleDiameter').value);
    if (fillHoles && (!$('maxHoleDiameter').value.trim() || !Number.isFinite(maxHoleDiameter) || maxHoleDiameter < .001 || maxHoleDiameter > 10)) {
      log('Nhập kích thước lỗ vá từ 0,001 đến 10 mm.','error');$('maxHoleDiameter').focus();return;
    }
    clearDownload();
    const job = {id:++sequence,file:selectedFile,worker:null,boot:null,deadline:null};
    const refine = $('refine').checked;
    active = job;busy(true);log('Đang đọc file STL…');
    job.deadline = setTimeout(()=>fail(job,'Tác vụ vượt quá 3 phút và đã dừng để giải phóng bộ nhớ. Hãy giảm số tam giác hoặc thử tắt gộp mặt.'),180000);
    try {
      const buffer = await job.file.arrayBuffer();
      if (active !== job) return;
      const worker = job.worker = new Worker('worker.js?v=20261029-pre1');
      job.boot = setTimeout(()=>fail(job,'Bộ chuyển đổi không phản hồi. Kiểm tra các file chương trình và thư viện có được phục vụ qua HTTP(S).'),45000);
      worker.onerror = e => {e.preventDefault();console.error('Worker error:',e.message);fail(job,'Không khởi chạy được bộ chuyển đổi. Kiểm tra các file thư viện và chạy web qua HTTP(S), sau đó thử lại.');};
      worker.onmessageerror = () => fail(job,'Không đọc được phản hồi của bộ chuyển đổi. Hãy thử lại.');
      worker.onmessage = ({data:m}) => {
        if (active !== job || !m || m.id !== job.id) return;
        clearTimeout(job.boot);
        if (m.type === 'status') log(String(m.msg));
        else if (m.type === 'error') fail(job,'Lỗi: ' + String(m.msg || 'Không chuyển đổi được STL.'));
        else if (m.type === 'done') {
          if (!(m.data instanceof ArrayBuffer) || m.data.byteLength < 100 || !m.info || !Number.isFinite(m.info.faces) || m.info.faces < 1) {fail(job,'Bộ chuyển đổi trả về file STEP không hợp lệ.');return;}
          const signature = new TextDecoder().decode(new Uint8Array(m.data,0,Math.min(40,m.data.byteLength)));
          if (!signature.includes('ISO-10303-21')) {fail(job,'File trả về không có cấu trúc STEP hợp lệ.');return;}
          if (!finish(job)) return;
          try {
            downloadURL = URL.createObjectURL(new Blob([m.data],{type:'application/step'}));
            const base = job.file.name.replace(/\.stl$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'') || 'model';
            $('dl').href = downloadURL; $('dl').download = base + '.step'; $('dl').textContent = 'Tải ' + base + '.step';
            $('downloadBox').hidden = false;
            const i = m.info;
            log('Hoàn tất: ' + number(i.triangles) + ' tam giác → ' + number(i.faces) + ' mặt.\n' +
              (i.solid ? number(i.solids) + ' khối kín (solid).' : 'Kết quả có mặt/vỏ chưa tạo thành khối kín.') +
              (i.reconstruction ? '\nĐã dựng mặt cong thật: lỗ Ø' + Number(i.reconstruction.pocketDiameter).toLocaleString('vi-VN',{maximumFractionDigits:4}) + ' mm; bo R' + Number(i.reconstruction.filletRadius).toLocaleString('vi-VN',{maximumFractionDigits:4}) + ' mm.\nSai lệch lấy mẫu hai chiều: ' + Number(i.reconstruction.sampledMax).toLocaleString('vi-VN',{maximumFractionDigits:5}) + ' mm.' : '') +
              (i.preprocessing ? '\nTiền xử lý: ghép ' + number(i.preprocessing.weldedVertices) + ' đỉnh; loại ' + number(i.preprocessing.removedTriangles) + ' mặt lỗi; sửa hướng ' + number(i.preprocessing.flippedTriangles) + ' tam giác; vá ' + number(i.preprocessing.holesFilled) + ' lỗ (thêm ' + number(i.preprocessing.trianglesAdded) + ' tam giác).\nCòn ' + number(i.preprocessing.after.boundaryEdges) + ' cạnh biên hở và ' + number(i.preprocessing.after.nonmanifoldEdges) + ' cạnh bất thường.' : '') +
              (i.skipped ? '\nĐã loại ' + number(i.skipped) + ' tam giác suy biến hoặc trùng lặp.' : ''), i.solid ? 'success' : 'warning');
            for (const warning of (Array.isArray(i.warnings) ? i.warnings : [])) {const li=document.createElement('li');li.textContent=String(warning);$('warnings').append(li);}
          } catch { clearDownload();log('Không tạo được liên kết tải xuống. Có thể trình duyệt thiếu bộ nhớ. Hãy thử file nhỏ hơn.','error'); }
        }
      };
      worker.postMessage({type:'convert',id:job.id,buffer,tol,refine,repairMesh,fillHoles,maxHoleDiameter,recoverCurves,curveTolerance},[buffer]);
    } catch (err) { fail(job,'Không đọc hoặc khởi chạy được file. Hãy chọn lại file và thử lại.');console.error(err); }
  });
  window.addEventListener('pagehide',()=>{if (active) finish(active);clearDownload();});
  $('recoverCurves').addEventListener('change',()=>{$('curveTolerance').disabled=!$('recoverCurves').checked;});
  function repairOptions() {
    $('fillHoles').disabled = !$('repairMesh').checked;
    $('maxHoleDiameter').disabled = !$('repairMesh').checked || !$('fillHoles').checked;
  }
  $('repairMesh').addEventListener('change',repairOptions);
  $('fillHoles').addEventListener('change',repairOptions);
  repairOptions();
  busy(false);
  if (location.protocol === 'file:') log('Cần mở web qua HTTP(S). Trong thư mục chương trình, bấm CHAY-WEB.cmd; không mở trực tiếp index.html.','error');
  else if (!available) log('Trình duyệt cần hỗ trợ WebAssembly và Web Worker. Hãy mở bằng Chrome, Edge hoặc Firefox hiện đại.','error');
})();

