# STL → STEP

**Mở công cụ:** [billyelliot0811.github.io/stl2step](https://billyelliot0811.github.io/stl2step/)

Chuyển STL ASCII/nhị phân sang STEP ngay trong trình duyệt bằng OpenCASCADE.js. Nội dung STL không được gửi lên máy chủ.

## Dùng trên web

1. Mở link GitHub Pages ở trên.
2. Chọn hoặc kéo một file `.stl` vào trang, rồi bấm **Chuyển sang STEP**.
3. Đọc kết quả/cảnh báo và bấm **Tải … .step**.

Giới hạn: **32 MiB**, **20.000 tam giác/file**, **3 phút/tác vụ**. Có nút hủy để dừng và thử lại.

STL không chứa đơn vị; công cụ hiểu 1 đơn vị = 1 mm. Có tùy chọn nhận dạng mặt trụ/cung tròn và bo cơ bản; nếu không đủ tin cậy, công cụ giữ các mặt phẳng từ lưới. Không khôi phục cây feature/lịch sử thiết kế của Inventor. Lưới kín và hợp lệ có thể tạo solid; lưới hở hoặc các vỏ chưa xác định quan hệ được báo rõ là mặt/vỏ.

## Nhận dạng mặt cong (thử nghiệm)

Hỗ trợ bước đầu nhóm nắp/tấm có **đế chữ nhật bo đều góc và cạnh đáy với cùng bán kính, một gờ chữ nhật và một hốc trụ kín đáy**. Thông số được đo từ lưới; hỗ trợ đổi kích thước, xoay và tịnh tiến, không phụ thuộc tên file.

Sai lệch nhận dạng mặc định **0.01 mm**, tách biệt với dung sai khâu. Kiểm tra vòng tròn, các mặt phẳng, toàn bộ đỉnh, điểm trong tam giác, hướng mặt, thể tích, và lấy mẫu mặt dựng lại so với STL. Chỉ xuất mặt cong khi tạo được một solid hợp lệ; nếu không thì quay về chế độ mặt lưới, kèm lý do. Sai lệch hiển thị là **sai lệch lấy mẫu**, chưa phải giới hạn được chứng minh cho mọi điểm.

Chưa hỗ trợ chung mọi loại fillet, bo biến thiên, mặt tự do, nhiều hốc hay dữ liệu scan nhiễu. Hãy kiểm tra STEP trong CAD trước khi dùng cho sản xuất.

## GitHub Pages

Các file ứng dụng nằm ở gốc repo; `.nojekyll` cho phép phục vụ trực tiếp các file tĩnh. Cấu hình trong **Settings → Pages**:

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/ (root)`

Sau khi commit thay đổi vào `main`, chờ lần triển khai trong tab **Actions** thành công rồi tải lại trang. Nếu trình duyệt còn cache bản cũ, dùng Ctrl+F5. Khi sửa JavaScript lần tiếp theo, tăng chuỗi phiên bản trong các URL JavaScript được thay đổi trong HTML và Worker.

Cần giữ đủ `index.html`, `app.js`, `stl.js`, `worker.js`, `oc.js`, `oc.wasm`, `mesh-qa.js`, `recognize.js`, `analytic-builder.js` cùng thư mục. Không đưa `oc.wasm` vào Git LFS vì trang cần tải trực tiếp nội dung WASM.

## Chạy trên máy

Bấm **CHAY-WEB.cmd** trên Windows, hoặc chạy `python serve.py` với Python 3.8 trở lên. Không mở trực tiếp `index.html` bằng `file://`.

Xem [HUONG-DAN.md](HUONG-DAN.md) để biết tùy chọn, giới hạn và cách xử lý lỗi.

## Kiểm tra bản sửa

- 34 ca Worker/WASM: ASCII/nhị phân, kín/hở, hướng mặt, nhiều khối, dữ liệu lỗi và giới hạn tài nguyên.
- 17 kết quả STEP được đọc lại để so số mặt/số khối và thể tích mẫu solid.
- 21 kiểm tra giao diện trên Chrome, gồm hủy/thử lại, timeout và thiếu/hỏng thư viện.

Bản nhận dạng có thêm 18 ca hình học (mẫu thực, xoay/tịnh tiến/đổi tỉ lệ, hai mô hình tổng hợp khác kích thước, lưới thô và các trường hợp từ chối) và 4 kiểm tra Worker cho lựa chọn/tự quay về mặt lưới. STEP mẫu thực được đọc lại để kiểm tra một solid hợp lệ với các mặt trụ, mặt cầu và cạnh tròn thật. Vẫn cần xác nhận từng STL thực tế trong phần mềm CAD đích.
