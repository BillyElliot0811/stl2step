# Lộ trình stl2step

Quy ước: `## [ ] N. Tên` là việc chưa làm, `## [x]` là đã xong.  
Mỗi mục có: Tiêu chí (đo được) và Phạm vi (chỉ được sửa các file này).

## [x] 1. Parser ASCII xử lý kiểu xuống dòng hỗn hợp
- **Tiêu chí**: fixture `mixed_line_endings.stl` đỏ với `stl.js` trên `main`, xanh sau khi sửa.  
- **Phạm vi**: `stl.js`, `tests/`

## [x] 2. Nhận dạng mặt trụ thành mặt trụ thật
- **Tiêu chí**: `Gatay.stl` chuyển ra ≤ 100 mặt; `cylinder.stl` ra mặt trụ; thể tích lệch ≤ 0.1%.  
- **Phạm vi**: `recognize.js`, `strip-curves.js`, `annulus-browser.js`, `tests/`

## [ ] 3. Giữ WASM đã nạp giữa các lần chuyển
- **Tiêu chí**: lần chuyển thứ hai ≤ 1 giây (đo trong Playwright).  
- **Phạm vi**: `worker.js`, `app.js`, `tests/`

## [ ] 4. Xem trước STEP cạnh STL
- **Tiêu chí**: ảnh chụp Playwright có hai khung hiển thị đồng thời (STL + STEP).  
- **Phạm vi**: `index.html`, `app.js`, `preview.js`, `preview-mesh.js`, `tests/`

## [ ] 5. Giao diện gọn hơn: bố cục hai cột, trạng thái từng bước, lỗi có thẻ hướng dẫn
- **Tiêu chí**: `#progress` có phần trăm; `#errorBox` hiện gợi ý; ảnh chụp bố cục.  
- **Phạm vi**: `index.html`, `workspace.css`, `app.js`, `tests/`

> **Ghi chú**: “giống meshy” nghĩa là trải nghiệm gọn và rõ trạng thái, không sao chép giao diện hay thương hiệu của họ.

