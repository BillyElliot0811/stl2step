# STL → STEP

**Mở công cụ:** [billyelliot0811.github.io/stl2step](https://billyelliot0811.github.io/stl2step/)

Chuyển STL ASCII/nhị phân sang STEP ngay trong trình duyệt bằng OpenCASCADE.js. Nội dung STL không được gửi lên máy chủ.

## Dùng trên web

1. Mở link GitHub Pages ở trên.
2. Chọn hoặc kéo một file `.stl` vào trang, rồi bấm **Chuyển sang STEP**.
3. Đọc kết quả/cảnh báo và bấm **Tải … .step**.

Giới hạn: **32 MiB**, **20.000 tam giác/file**, **3 phút/tác vụ**. Có nút hủy để dừng và thử lại.

STL không chứa đơn vị; công cụ hiểu 1 đơn vị = 1 mm. STEP giữ bề mặt dạng các mặt phẳng từ lưới, không khôi phục lịch sử thiết kế hoặc mặt cong tham số. Lưới kín và hợp lệ có thể tạo solid; lưới hở hoặc các vỏ chưa xác định quan hệ được báo rõ là mặt/vỏ.

## GitHub Pages

Các file ứng dụng nằm ở gốc repo; `.nojekyll` cho phép phục vụ trực tiếp các file tĩnh. Cấu hình trong **Settings → Pages**:

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/ (root)`

Sau khi commit thay đổi vào `main`, chờ lần triển khai trong tab **Actions** thành công rồi tải lại trang. Nếu trình duyệt còn cache bản cũ, dùng Ctrl+F5. Khi sửa JavaScript lần tiếp theo, tăng chuỗi phiên bản trong URL `app.js`, `worker.js`, `stl.js`.

Cần giữ đủ `index.html`, `app.js`, `stl.js`, `worker.js`, `oc.js`, `oc.wasm` cùng thư mục. Không đưa `oc.wasm` vào Git LFS vì trang cần tải trực tiếp nội dung WASM.

## Chạy trên máy

Bấm **CHAY-WEB.cmd** trên Windows, hoặc chạy `python serve.py` với Python 3.8 trở lên. Không mở trực tiếp `index.html` bằng `file://`.

Xem [HUONG-DAN.md](HUONG-DAN.md) để biết tùy chọn, giới hạn và cách xử lý lỗi.

## Kiểm tra bản sửa

- 34 ca Worker/WASM: ASCII/nhị phân, kín/hở, hướng mặt, nhiều khối, dữ liệu lỗi và giới hạn tài nguyên.
- 17 kết quả STEP được đọc lại để so số mặt/số khối và thể tích mẫu solid.
- 21 kiểm tra giao diện trên Chrome, gồm hủy/thử lại, timeout và thiếu/hỏng thư viện.

Các kiểm tra dùng mẫu tổng hợp; vẫn cần xác nhận STL thực tế trong phần mềm CAD đích.
