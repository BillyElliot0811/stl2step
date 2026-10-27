# STL → STEP — hướng dẫn sử dụng

## Mở web trên Windows

1. Trong thư mục này, bấm đúp **CHAY-WEB.cmd**. Máy cần Python 3.8 trở lên.
2. Trình duyệt mở địa chỉ dạng `http://127.0.0.1:8000/`. Giữ cửa sổ máy chủ mở khi sử dụng; nhấn Ctrl+C để dừng.
3. Chọn hoặc kéo **một** file `.stl`, giữ dung sai mặc định `0.0001` mm rồi bấm **Chuyển sang STEP**.
4. Chờ thông báo hoàn tất, đọc cảnh báo nếu có rồi bấm **Tải … .step**.

Nếu cổng 8000 đang bận, trình khởi chạy tự chọn cổng khác và in địa chỉ mới. Không mở trực tiếp `index.html` bằng `file://`, vì trình duyệt chặn Worker/WASM trong chế độ đó.

Có thể tự chạy từ terminal trong thư mục này:

```text
python serve.py
python serve.py --no-browser --port 8000
```

Máy chủ chỉ lắng nghe trên `127.0.0.1`. Nội dung STL không được gửi lên máy chủ; việc đọc lưới và xuất STEP diễn ra trong Web Worker. Khi đã có các file chương trình trên máy, chạy qua localhost không cần dịch vụ chuyển đổi bên ngoài.

## Các giới hạn có chủ đích

- Mỗi file tối đa **32 MiB** và **20.000 tam giác**. B-rep từ từng tam giác dùng nhiều bộ nhớ hơn STL; với file lớn, hãy giảm lưới trong phần mềm 3D trước.
- Mỗi tác vụ tối đa **3 phút**. Có nút **Hủy tác vụ** để giải phóng bộ nhớ và thử lại.
- Nạp `oc.wasm` tối đa 90 giây, khởi tạo WASM tối đa 45 giây; lỗi tải thư viện có thông báo riêng.
- Dung sai khâu hợp lệ từ **0.0000001 đến 1 mm**; mặc định **0.0001 mm**. Dung sai quá lớn có thể làm mất mặt nhỏ; khi phát hiện, công cụ dừng và yêu cầu giảm dung sai.
- File nhị phân phải có kích thước khớp số tam giác trong header. File ASCII phải có đủ cấu trúc facet/loop/vertex. File bị cắt, số vô hạn/NaN, facet không đủ đỉnh và dữ liệu rác bị từ chối.
- Tùy chọn làm sạch chỉ loại tam giác suy biến hoặc trùng lặp, kèm số lượng đã loại. Không vá lỗ hay tái tạo hình học thiếu. Tắt tùy chọn này thì lưới có các lỗi đó sẽ bị từ chối.

## Hiểu đúng file STEP

- STL **không lưu đơn vị**. Công cụ hiểu **1 đơn vị STL = 1 mm**, giữ nguyên các giá trị tọa độ. Kiểm tra lại kích thước trong CAD nếu STL gốc dùng inch hoặc đơn vị khác.
- Khi bật nhận dạng và mô hình thuộc nhóm hỗ trợ, công cụ dựng lại mặt trụ/cung tròn và các mặt bo giải tích. Nếu không đủ tin cậy, công cụ giữ các mặt phẳng từ lưới và ghi cảnh báo. Không khôi phục lịch sử thiết kế hay cây feature của Inventor.
- Công cụ khâu cạnh, sửa hướng mặt, kiểm tra hình học và chỉ đánh dấu solid khi vỏ kín tạo được khối hợp lệ với thể tích dương.
- Lưới hở được giữ dạng mặt/vỏ nếu hình học hợp lệ. Các vỏ có vùng bao chồng lấn, vỏ lồng nhau hoặc quá nhiều vỏ được giữ thận trọng ở dạng vỏ để tránh tạo sai lỗ rỗng/thể tích. Thông báo sẽ nói rõ kết quả chưa phải toàn bộ khối kín.
- Không có bảo đảm sửa được mọi STL tự giao, non-manifold hoặc lỗi số học. Nếu có cảnh báo hoặc bạn dùng cho sản xuất, kiểm tra lại hình học trong phần mềm CAD đích.

## Nhận dạng lỗ tròn và bo cơ bản (thử nghiệm)

Tùy chọn được bật mặc định. Bước đầu hỗ trợ một nhóm chi tiết cụ thể: **đế chữ nhật bo đều ở góc và cạnh đáy (cùng bán kính), một gờ chữ nhật ở trên, một hốc trụ kín đáy**. Có thể đổi kích thước, lệch tâm hốc/gờ, xoay và tịnh tiến; thông số được đo từ lưới, không dựa vào tên file.

- Sai lệch nhận dạng mặc định **0.01 mm**, cho phép 0.0001–0.1 mm. Đây là dung sai dựng lại mặt cong, khác với dung sai khâu.
- Lưới cần kín, liên thông và có hướng mặt nhất quán. Công cụ kiểm tra vòng tròn, các mặt phẳng, đỉnh lưới, điểm trong/cạnh tam giác, hướng mặt, thể tích và lấy mẫu mặt dựng lại so với lưới.
- Chỉ dùng mặt cong khi mọi kiểm tra đều đạt và B-rep tạo được một solid hợp lệ. Nếu không, tự dùng luồng chuyển đổi mặt lưới cũ và nêu lý do.
- **Sai lệch lấy mẫu là số đo trên tập điểm kiểm tra, không phải giới hạn Hausdorff được chứng minh cho mọi điểm của mô hình.** Cần xác nhận lại trong CAD trước khi dùng cho gia công.
- Chưa nhận dạng chung mọi loại fillet, bo biến thiên, nhiều hốc, mặt tự do, chi tiết quét hoặc lưới scan nhiễu. Tắt tùy chọn để luôn giữ hình học dạng mặt lưới.
- STEP có mặt trụ và mặt cong thật để CAD đo/chọn; vẫn là solid nhập khẩu, không tự tạo feature Hole/Fillet hay lịch sử thiết kế của Inventor.

## Nếu gặp lỗi

- **Không tải được oc.wasm / oc.js:** kiểm tra hai file vẫn nằm cùng thư mục, dùng HTTP(S), thử tải lại trang. Trang báo HTML thay cho WASM thường do cấu hình máy chủ sai.
- **File quá lớn / quá nhiều tam giác / quá 3 phút:** giảm số tam giác; có thể thử tắt gộp mặt để giảm thời gian.
- **Không còn tam giác hợp lệ:** STL chỉ chứa các tam giác trùng/suy biến hoặc chi tiết nhỏ hơn độ chính xác của bộ dựng hình; sửa lưới hoặc kiểm tra đơn vị gốc.
- **Kết quả chỉ là shell:** STL có thể hở hoặc gồm các vỏ chưa xác định quan hệ. Kiểm tra và sửa lưới trong CAD trước.
- **Trình duyệt không lưu file:** cho phép tải xuống cho trang và kiểm tra thư mục Downloads/chính sách trình duyệt. Chỉ bấm tải sau khi có thông báo hoàn tất.

## Cấu trúc chương trình

- `index.html`: giao diện tiếng Việt, có bố cục cho điện thoại và chế độ tối.
- `app.js`: quản lý file, trạng thái tác vụ, hủy, thời gian chờ và tải xuống.
- `stl.js`: đọc/kiểm tra STL ASCII và nhị phân, giới hạn tài nguyên.
- `worker.js`: điều phối nhận dạng/khâu mặt, kiểm tra solid và xuất STEP trong Worker.
- `recognize.js`, `mesh-qa.js`: nhận dạng nhóm chi tiết và kiểm tra sai lệch hai chiều bằng lấy mẫu.
- `analytic-builder.js`: dựng lại solid bằng mặt phẳng, mặt trụ và fillet OpenCASCADE.
- `oc.js`, `oc.wasm`: cặp thư viện OpenCASCADE.js đi kèm; giữ nguyên hai file này, không trộn phiên bản.
- `serve.py`, `CHAY-WEB.cmd`: mở web cục bộ, không cần cài gói Python bên ngoài.

Có thể đưa các file ứng dụng lên máy chủ tĩnh HTTP(S). Đường dẫn tương đối hỗ trợ đặt trong thư mục con. Máy chủ cần phục vụ đúng nội dung `oc.wasm` (MIME khuyến nghị `application/wasm`), không thay bằng trang HTML fallback. Khi cập nhật mã JavaScript, cập nhật chuỗi phiên bản trong URL JavaScript trong HTML/Worker, bao gồm các mô-đun nhận dạng để tránh cache cũ. Không đưa thư mục sao lưu `_backup-*` lên bản công khai.

## Kiểm tra bản sửa ngày 27/10/2026

Có kiểm tra bằng runtime WASM thật và Chrome: ASCII/nhị phân, mô hình kín/hở, đảo hướng mặt, tam giác lỗi, nhiều khối, dung sai lỗi, giới hạn tài nguyên, hủy/thử lại và thư viện bị thiếu. STEP xuất ra được đọc ngược lại để so số mặt, số khối và thể tích mẫu. Đây là kiểm tra với mẫu tổng hợp; chưa thay thế việc xác nhận từng STL thực tế trong phần mềm CAD đích.
