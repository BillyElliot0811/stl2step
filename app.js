'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const MAX_BYTES = 32 * 1024 * 1024;
  const number = n => Number(n).toLocaleString('vi-VN');
  let selectedFile = null, active = null, sequence = 0, downloadURL = null;
  const available = location.protocol !== 'file:' && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';

  function log(text, tone = 'neutral') {
    $('log').textContent = text;
    $('statusBox').dataset.tone = tone;
    if (tone !== 'error') {
      $('errorBox').hidden = true;
    }
  }

  function showError(title, message, suggestion = '') {
    $('statusBox').dataset.tone = 'error';
    $('errorBox').hidden = false;
    $('errorTitle').textContent = title || 'Chuyển đổi thất bại';
    $('errorMsg').textContent = message;
    if (suggestion) {
      $('errorSuggestionWrap').hidden = false;
      $('errorSuggestion').textContent = suggestion;
    } else {
      $('errorSuggestionWrap').hidden = true;
    }
    $('log').textContent = '';
  }

  function updateProgress(percent, label) {
    $('progressContainer').hidden = false;
    const p = Math.min(100, Math.max(0, Math.round(percent)));
    $('progress').value = p;
    $('progressPercent').textContent = p + '%';
    if (label) $('progressText').textContent = label;
  }

  function clearDownload() {
    $('elapsed').hidden = true;
    $('progressContainer').hidden = true;
    $('errorBox').hidden = true;
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = null;
    $('dl').removeAttribute('href'); $('dl').removeAttribute('download'); $('downloadBox').hidden = true;
    $('warnings').replaceChildren();
  }

  function busy(value) {
    $('choose').disabled = value || !available; $('file').disabled = value || !available;
    $('options').disabled = value;
    $('go').disabled = value || !selectedFile || !available;
    $('cancel').hidden = !value;
    $('progressContainer').hidden = !value;
    $('runningHelp').hidden = !value;
    $('statusBox').setAttribute('aria-busy', String(value));
    if (value) {
      updateProgress(0, 'Đang chuẩn bị…');
      $('errorBox').hidden = true;
    }
  }

  function finish(job) {
    if (active !== job) return false;
    clearTimeout(job.deadline); clearTimeout(job.boot);
    clearInterval(job.clock);
    showElapsed(job);
    if (job.worker) { job.worker.onmessage = null; job.worker.onerror = null; job.worker.onmessageerror = null; job.worker.terminate(); }
    active = null; busy(false); return true;
  }

  function showElapsed(job) {
    const seconds = Math.floor((performance.now() - job.started) / 1000);
    $('elapsed').textContent = 'Thời gian đã chạy: ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0');
    $('elapsed').hidden = false;
  }

  function fail(job, message, title = 'Chuyển đổi thất bại', suggestion = '') {
    if (finish(job)) {
      clearDownload();
      showError(title, message, suggestion);
    }
  }

  function focusOption(id) { $('settings').open = true; $(id).focus(); }

  function pick(files) {
    if (!available || active || !files || !files.length) return;
    clearDownload(); selectedFile = null; busy(false);
    window.dispatchEvent(new CustomEvent('stl-selected',{detail:null}));
    $('selected').textContent = 'Chưa chọn file · Tối đa 32 MiB và 20.000 tam giác';
    if (files.length !== 1) {
      showError('Chọn nhiều file', 'Vui lòng chọn duy nhất một file STL mỗi lần.', 'Kéo thả hoặc chọn đúng 1 file .stl.');
      return;
    }
    const file = files[0];
    if (!/\.stl$/i.test(file.name)) {
      showError('Định dạng không hỗ trợ', 'Chỉ hỗ trợ file có định dạng đuôi .stl.', 'Vui lòng chọn file STL dạng nhị phân hoặc ASCII.');
      return;
    }
    if (!file.size) {
      showError('File rỗng', 'File STL bạn chọn có dung lượng 0 byte.', 'Vui lòng kiểm tra lại file hoặc xuất lại mô hình từ phần mềm thiết kế CAD.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showError('Dung lượng quá lớn', 'File vượt giới hạn 32 MiB cho phép.', 'Hãy giảm bớt số lượng tam giác hoặc làm sạch mô hình trước khi chuyển đổi.');
      return;
    }
    selectedFile = file;
    window.dispatchEvent(new CustomEvent('stl-selected',{detail:file}));
    const sizeText = file.size < 1024 ? number(file.size) + ' byte' : file.size < 1048576 ? (file.size/1024).toLocaleString('vi-VN',{maximumFractionDigits:1}) + ' KiB' : (file.size/1048576).toLocaleString('vi-VN',{maximumFractionDigits:2}) + ' MiB';
    $('selected').textContent = file.name + ' · ' + sizeText;
    busy(false);
    log('Đã chọn file. Bạn có thể bắt đầu chuyển đổi.');
  }

  $('choose').addEventListener('click', () => {if (!active) $('file').click();});
  $('file').addEventListener('change', e => {pick(e.target.files); e.target.value = '';});
  $('drop').addEventListener('dragover', e => {e.preventDefault();if (!active && available) $('drop').classList.add('over');});
  $('drop').addEventListener('dragleave', e => {if (!$('drop').contains(e.relatedTarget)) $('drop').classList.remove('over');});
  $('drop').addEventListener('drop', e => {e.preventDefault();$('drop').classList.remove('over');pick(e.dataTransfer.files);});
  for (const event of ['dragover','drop']) window.addEventListener(event,e=>{if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();});

  $('cancel').addEventListener('click', () => {
    if (active && finish(active)) {clearDownload();log('Đã hủy tác vụ. Bạn có thể thử lại hoặc chọn file khác.');}
  });

  $('go').addEventListener('click', async () => {
    if (active || !selectedFile || !available) return;
    const tol = Number($('tol').value);
    if (!$('tol').value.trim() || !Number.isFinite(tol) || tol < 1e-7 || tol > 1) {
      showError('Dung sai khâu không hợp lệ', 'Dung sai khâu phải là số nằm trong khoảng từ 0,0000001 đến 1 mm.', 'Hãy nhập một số hợp lệ trong khoảng cho phép (mặc định: 0,0001 mm).');
      focusOption('tol');return;
    }
    const recoverCurves = $('recoverCurves').checked, curveTolerance = Number($('curveTolerance').value);
    if (recoverCurves && (!$('curveTolerance').value.trim() || !Number.isFinite(curveTolerance) || curveTolerance < 0.0001 || curveTolerance > 0.1)) {
      showError('Sai lệch nhận dạng không hợp lệ', 'Sai lệch nhận dạng phải từ 0,0001 đến 0,1 mm.', 'Hãy nhập số sai lệch hợp lệ (mặc định: 0,01 mm).');
      focusOption('curveTolerance');return;
    }
    const repairMesh = $('repairMesh').checked, fillHoles = repairMesh && $('fillHoles').checked, maxHoleDiameter = Number($('maxHoleDiameter').value);
    if (fillHoles && (!$('maxHoleDiameter').value.trim() || !Number.isFinite(maxHoleDiameter) || maxHoleDiameter < .001 || maxHoleDiameter > 10)) {
      showError('Kích thước lỗ vá không hợp lệ', 'Kích thước lỗ vá tối đa phải từ 0,001 đến 10 mm.', 'Hãy nhập số hợp lệ hoặc tắt tùy chọn vá lỗ.');
      focusOption('maxHoleDiameter');return;
    }
    const repairContacts = repairMesh && $('repairContacts').checked, contactTolerance = Number($('contactTolerance').value);
    if (repairContacts && (!$('contactTolerance').value.trim() || !Number.isFinite(contactTolerance) || contactTolerance < .001 || contactTolerance > .05)) {
      showError('Sai lệch sửa cạnh chạm không hợp lệ', 'Sai lệch sửa cạnh chạm phải từ 0,001 đến 0,05 mm.', 'Hãy nhập giá trị sai lệch hợp lệ (mặc định: 0,01 mm).');
      focusOption('contactTolerance');return;
    }

    clearDownload();
    const job = {id:++sequence,file:selectedFile,worker:null,boot:null,deadline:null,clock:null,started:performance.now()};
    const refine = $('refine').checked;
    active = job;busy(true);log('Đang đọc file STL…');
    showElapsed(job);
    job.clock = setInterval(() => {if (active === job) showElapsed(job);},1000);
    job.deadline = setTimeout(()=>fail(
      job,
      'Tác vụ vượt quá giới hạn 3 phút và đã dừng để giải phóng bộ nhớ.',
      'Quá thời gian xử lý (3 phút)',
      'Hãy giảm bớt số lượng tam giác (dưới 20.000 tam giác) hoặc thử tắt tùy chọn "Gộp các mặt đồng phẳng".'
    ),180000);

    try {
      const buffer = await job.file.arrayBuffer();
      if (active !== job) return;
      const worker = job.worker = new Worker('worker.js?v=20261118-progress1');
      job.boot = setTimeout(()=>fail(
        job,
        'Bộ chuyển đổi không phản hồi trong 45 giây.',
        'Không phản hồi',
        'Kiểm tra xem trang web có được phục vụ qua máy chủ HTTP(S) không và file oc.wasm có tải được không.'
      ),45000);
      worker.onerror = e => {
        e.preventDefault();
        console.error('Worker error:',e.message);
        fail(
          job,
          'Không khởi chạy được bộ chuyển đổi trong Web Worker.',
          'Lỗi Web Worker',
          'Kiểm tra các file thư viện và đảm bảo trang web được phục vụ qua HTTP(S) (ví dụ: python -m http.server 8000).'
        );
      };
      worker.onmessageerror = () => fail(
        job,
        'Không đọc được phản hồi từ bộ chuyển đổi Web Worker.',
        'Lỗi đọc phản hồi',
        'Bộ chuyển đổi có thể đã gặp sự cố bộ nhớ khi chuyển dữ liệu về luồng chính. Hãy thử lại với file nhỏ hơn.'
      );
      worker.onmessage = ({data:m}) => {
        if (active !== job || !m || m.id !== job.id) return;
        clearTimeout(job.boot);
        if (m.type === 'status') {
          if (typeof m.percent === 'number') updateProgress(m.percent, m.msg);
          log(String(m.msg));
        } else if (m.type === 'error') {
          fail(job, String(m.msg || 'Không chuyển đổi được STL.'), m.title, m.suggestion);
        } else if (m.type === 'done') {
          if (!(m.data instanceof ArrayBuffer) || m.data.byteLength < 100 || !m.info || !Number.isFinite(m.info.faces) || m.info.faces < 1) {
            fail(job,'Bộ chuyển đổi trả về file STEP không hợp lệ.','Lỗi file STEP','Dữ liệu xuất ra bị rỗng hoặc thiếu mặt.');return;
          }
          const signature = new TextDecoder().decode(new Uint8Array(m.data,0,Math.min(40,m.data.byteLength)));
          if (!signature.includes('ISO-10303-21')) {
            fail(job,'File trả về không có cấu trúc STEP hợp lệ.','Định dạng STEP không đúng','Nội dung file không chứa chữ ký chuẩn ISO-10303-21.');return;
          }
          updateProgress(100, 'Hoàn tất chuyển đổi!');
          if (!finish(job)) return;
          try {
            downloadURL = URL.createObjectURL(new Blob([m.data],{type:'application/step'}));
            const base = job.file.name.replace(/\.stl$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'') || 'model';
            $('dl').href = downloadURL; $('dl').download = base + '.step'; $('dl').textContent = 'Tải ' + base + '.step';
            $('downloadBox').hidden = false;
            const i = m.info;
            log('Hoàn tất: ' + number(i.triangles) + ' tam giác → ' + number(i.faces) + ' mặt.\n' +
              (i.solid ? number(i.solids) + ' khối kín (solid).' : 'Kết quả có mặt/vỏ chưa tạo thành khối kín.') +
              (i.reconstruction?.type === 'experimental-annular-step' ? '\nĐã dựng lại thành vòng và phần khoét bậc bằng mặt cong giải tích.\nChưa đo sai lệch hai chiều cho kết quả này trong trình duyệt.' : i.reconstruction?.method === 'circular-extrusion-bands' ? '\nĐã dựng lại ' + number(i.reconstruction.bands) + ' dải cung tròn thành mặt trụ; ' + number(i.reconstruction.splineBands || 0) + ' dải spline.' + (i.reconstruction.junctions ? '\nĐã nối ' + number(i.reconstruction.junctions) + ' vùng bo giao với chi tiết; loại ' + number(i.reconstruction.junctionFacesRemoved) + ' mặt nhỏ.' : '') + '\nSai lệch spline lấy mẫu: ' + Number(i.reconstruction.splineSampledMax || 0).toLocaleString('vi-VN',{maximumFractionDigits:5}) + ' mm.\nSai lệch cung so với dây lưới tối đa: ' + Number(i.reconstruction.maxChordDeviation).toLocaleString('vi-VN',{maximumFractionDigits:5}) + ' mm; thể tích tổng đổi ' + (100*i.reconstruction.relativeVolumeChange).toLocaleString('vi-VN',{maximumFractionDigits:5}) + '%.' : i.reconstruction ? '\nĐã dựng mặt cong thật: lỗ Ø' + Number(i.reconstruction.pocketDiameter).toLocaleString('vi-VN',{maximumFractionDigits:4}) + ' mm; bo R' + Number(i.reconstruction.filletRadius).toLocaleString('vi-VN',{maximumFractionDigits:4}) + ' mm.\nSai lệch lấy mẫu hai chiều: ' + Number(i.reconstruction.sampledMax).toLocaleString('vi-VN',{maximumFractionDigits:5}) + ' mm.' : '') +
              (i.preprocessing ? '\nTiền xử lý: ghép ' + number(i.preprocessing.weldedVertices) + ' đỉnh; loại ' + number(i.preprocessing.removedTriangles) + ' mặt lỗi; sửa hướng ' + number(i.preprocessing.flippedTriangles) + ' tam giác; vá ' + number(i.preprocessing.holesFilled) + ' lỗ (thêm ' + number(i.preprocessing.trianglesAdded) + ' tam giác).\nSau bước xử lý lưới: ' + number(i.preprocessing.after.boundaryEdges) + ' cạnh biên hở và ' + number(i.preprocessing.after.nonmanifoldEdges) + ' cạnh bất thường.' : '') +
              (i.contactRepair ? '\nĐã sửa ' + number(i.contactRepair.contacts) + ' cạnh chạm bằng rãnh R' + Number(i.contactRepair.radius).toLocaleString('vi-VN',{maximumFractionDigits:5}) + ' mm.\nVùng thay đổi nằm trong ' + Number(i.contactRepair.localEditBound).toLocaleString('vi-VN',{maximumFractionDigits:5}) + ' mm quanh cạnh gốc; thể tích đổi ' + (100*i.contactRepair.relativeVolumeChange).toLocaleString('vi-VN',{maximumFractionDigits:8}) + '%.' : '') +
              (i.skipped ? '\nĐã loại ' + number(i.skipped) + ' tam giác suy biến hoặc trùng lặp.' : ''), i.solid ? 'success' : 'warning');
            for (const warning of (Array.isArray(i.warnings) ? i.warnings : [])) {const li=document.createElement('li');li.textContent=String(warning);$('warnings').append(li);}
          } catch {
            clearDownload();
            showError('Lỗi tạo liên kết tải', 'Không tạo được liên kết tải xuống. Có thể trình duyệt thiếu bộ nhớ.', 'Hãy thử chuyển đổi file nhỏ hơn hoặc đóng các ứng dụng khác.');
          }
        }
      };
      worker.postMessage({type:'convert',id:job.id,buffer,tol,refine,repairMesh,fillHoles,maxHoleDiameter,repairContacts,contactTolerance,recoverCurves,curveTolerance},[buffer]);
    } catch (err) {
      fail(job,'Không đọc hoặc khởi chạy được file. Hãy chọn lại file và thử lại.','Lỗi đọc file','Đảm bảo file không bị khóa bởi ứng dụng khác và có định dạng STL hợp lệ.');
      console.error(err);
    }
  });

  window.addEventListener('pagehide',()=>{if (active) finish(active);clearDownload();});
  $('recoverCurves').addEventListener('change',()=>{$('curveTolerance').disabled=!$('recoverCurves').checked;});

  function repairOptions() {
    $('fillHoles').disabled = !$('repairMesh').checked;
    $('repairContacts').disabled = !$('repairMesh').checked;
    $('contactTolerance').disabled = !$('repairMesh').checked || !$('repairContacts').checked;
    $('maxHoleDiameter').disabled = !$('repairMesh').checked || !$('fillHoles').checked;
  }
  $('repairMesh').addEventListener('change',repairOptions);
  $('fillHoles').addEventListener('change',repairOptions);
  $('repairContacts').addEventListener('change',repairOptions);
  repairOptions();
  busy(false);

  if (location.protocol === 'file:') {
    showError('Cần mở qua máy chủ HTTP', 'Cần mở web qua HTTP(S) để tải WebAssembly và Web Worker.', 'Trong thư mục chương trình, bấm CHAY-WEB.cmd hoặc chạy: python -m http.server 8000 rồi mở http://localhost:8000; không mở trực tiếp index.html.');
  } else if (!available) {
    showError('Trình duyệt không hỗ trợ', 'Trình duyệt cần hỗ trợ WebAssembly và Web Worker.', 'Hãy mở trang web bằng Google Chrome, Microsoft Edge hoặc Firefox phiên bản mới.');
  }
})();
