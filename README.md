# STL → STEP

**Mở công cụ:** [billyelliot0811.github.io/stl2step](https://billyelliot0811.github.io/stl2step/)

Chuyển STL ASCII/nhị phân sang STEP ngay trong trình duyệt bằng OpenCASCADE.js. Nội dung STL không được gửi lên máy chủ.

## Dùng trên web

1. Mở link GitHub Pages ở trên.
2. Chọn hoặc kéo một file `.stl` vào trang, rồi bấm **Chuyển sang STEP**.
3. Đọc kết quả/cảnh báo và bấm **Tải … .step**.

Giới hạn: **32 MiB**, **20.000 tam giác/file**, **3 phút/tác vụ**. Có nút hủy để dừng và thử lại.

STL không chứa đơn vị; công cụ hiểu 1 đơn vị = 1 mm. Có tùy chọn nhận dạng mặt trụ/cung tròn và bo cơ bản; nếu không đủ tin cậy, công cụ giữ các mặt phẳng từ lưới. Không khôi phục cây feature/lịch sử thiết kế của Inventor. Lưới kín và hợp lệ có thể tạo solid; lưới hở hoặc các vỏ chưa xác định quan hệ được báo rõ là mặt/vỏ.

## Tiền xử lý lưới

Bật mặc định trước bước nhận dạng và xuất STEP: loại tam giác trùng/suy biến, ghép các đỉnh biên trong dung sai khâu nhưng tối đa **0.0001 mm**, sửa hướng tam giác khi xác định được, rồi kiểm tra lại cạnh biên, cạnh non-manifold và đỉnh nối bất thường. Lưới kín tốt giữ nguyên tọa độ. Không tự xóa các mặt giao nhau, không đổi hướng riêng vỏ lồng nhau để đoán lỗ rỗng.

**Vá lỗ nhỏ có biên phẳng** là tùy chọn riêng, mặc định tắt: bật khi biết STL bị thiếu mặt; kích thước mặc định **1 mm**, cho phép 0.001–10 mm, đo bằng khoảng cách xa nhất giữa hai đỉnh biên. Chỉ vá vòng biên đơn phẳng không lồng nhau, không chồng/cắt hình học hiện có; có giới hạn số đỉnh, số vòng, ngân sách kiểm tra và tổng số tam giác. Miệng hốc thiết kế cũng có thể có biên như vậy, nên người dùng cần xác nhận mục đích và xem vùng vá trong CAD. Không tái tạo phần cong bị mất bằng nắp phẳng.

Kết quả báo số đỉnh ghép, tam giác sửa hướng/loại bỏ, số lỗ và tam giác thêm, cùng các cạnh lỗi còn lại. Topology kín chưa chứng minh lưới không tự giao. Cạnh/đỉnh non-manifold còn lại sẽ chặn nhận dạng và tạo solid. File Chesam.stl không có cạnh biên hở; 4 cạnh non-manifold của mẫu được xử lý bằng tùy chọn sửa cạnh chạm bên dưới.

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

Cần giữ đủ `index.html`, `app.js`, `stl.js`, `worker.js`, `oc.js`, `oc.wasm`, `mesh-qa.js`, `recognize.js`, `analytic-builder.js`, `preprocess.js`, `contact-detect.js`, `contact-kernel.js` cùng thư mục. Không đưa `oc.wasm` vào Git LFS vì trang cần tải trực tiếp nội dung WASM.

## Chạy trên máy

Bấm **CHAY-WEB.cmd** trên Windows, hoặc chạy `python serve.py` với Python 3.8 trở lên. Không mở trực tiếp `index.html` bằng `file://`.

Xem [HUONG-DAN.md](HUONG-DAN.md) để biết tùy chọn, giới hạn và cách xử lý lỗi.

## Kiểm tra bản sửa

- 34 ca Worker/WASM: ASCII/nhị phân, kín/hở, hướng mặt, nhiều khối, dữ liệu lỗi và giới hạn tài nguyên.
- 17 kết quả STEP được đọc lại để so số mặt/số khối và thể tích mẫu solid.
- 21 kiểm tra giao diện trên Chrome, gồm hủy/thử lại, timeout và thiếu/hỏng thư viện.

Bản nhận dạng có thêm 18 ca hình học (mẫu thực, xoay/tịnh tiến/đổi tỉ lệ, hai mô hình tổng hợp khác kích thước, lưới thô và các trường hợp từ chối) và 4 kiểm tra Worker cho lựa chọn/tự quay về mặt lưới. STEP mẫu thực được đọc lại để kiểm tra một solid hợp lệ với các mặt trụ, mặt cầu và cạnh tròn thật. Vẫn cần xác nhận từng STL thực tế trong phần mềm CAD đích.

Bước tiền xử lý được kiểm tra bằng 23 ca hình học và 8 ca Worker/WASM, cùng 34 ca Worker cũ. Mẫu thiếu một tam giác được vá thành solid, mẫu tốt giữ nguyên, mẫu Chesam giữ cảnh báo non-manifold khi tắt sửa cạnh chạm.

## Sửa cạnh chạm gây lỗi khối (thử nghiệm)

Tùy chọn bật mặc định cùng tiền xử lý. Nhận dạng nhóm cạnh có đúng 4 mặt kề ở chỗ hai đầu họa tiết đùn chạm nhau, kiểm tra hướng mặt, liên thông, khoảng cách đến chi tiết khác và giao nhau của tam giác. Không áp dụng cho mọi lưới non-manifold, chuỗi cạnh lỗi hoặc mặt tự giao. Giới hạn tối đa 16 cạnh và ngân sách kiểm tra.

Cách sửa tạo rãnh trụ nhỏ dọc cạnh chạm, **có thay đổi hình học**. Sai lệch đặt mặc định 0.01 mm (0.001–0.05 mm); bán kính rãnh bằng nửa giá trị này. Toàn bộ dụng cụ cắt nằm trong khoảng căn(2) lần bán kính quanh đoạn cạnh gốc; đây là giới hạn vùng chỉnh sửa, không phải chứng minh khoảng cách Hausdorff toàn mô hình. Có thể tắt tùy chọn để giữ tuyệt đối hình học lưới.

Chỉ chấp nhận nếu phép cắt tạo đúng một solid hợp lệ, một shell kín, thể tích dương, kích thước bao giữ nguyên trong sai số kernel, mức đổi thể tích không quá 0.01%. Nếu thất bại, giữ luồng mặt/vỏ và báo lỗi; không bỏ bớt khối để ép thành solid. Công cụ không có bộ kiểm tra tự giao chính xác toàn bộ B-rep trong runtime này.

Mẫu Chesam: 4 rãnh R0.005 mm, xuất một solid kín hợp lệ 614 mặt sau gộp đồng phẳng. Khi tắt khôi phục mặt cong, các mặt cong gốc giữ dạng mặt lưới; 4 mặt trụ mới thuộc rãnh sửa. Xem bản khôi phục dải mặt cong bên dưới. Mẫu nap nam cham vẫn nhận dạng 25 mặt giải tích như trước.


## Khôi phục dải mặt cong (07/11/2026)

Bật **Khôi phục mặt cong và bo tròn**, giữ sai lệch 0,01 mm. Công cụ nhận dạng các dải mặt đùn có hai biên phẳng, dựng cung tròn thành mặt trụ và dùng spline bậc ba cho các đoạn cong không tròn phù hợp. Các mặt phẳng kề được dựng lại cùng đường biên cong để giữ kín. Không phụ thuộc tên file hoặc trục đặt mẫu.

Chỉ nhận một solid hợp lệ, không bỏ mặt/khối; kiểm tra kích thước bao và thay đổi thể tích tổng tối đa 0,1%. Spline được kiểm tra khoảng cách hai chiều bằng lấy mẫu, không phải chứng minh sai lệch toàn cục. Nhận dạng dải giới hạn 10.000 tam giác, ngân sách thử cung và tối đa 32 dải spline, mỗi dải tối đa 128 đoạn; ngoài giới hạn giữ luồng mặt lưới. Các vùng không đủ điều kiện có thể còn chia mặt.

Mẫu Chesam với cả khôi phục mặt cong và sửa cạnh chạm: 24 dải trụ + 5 dải spline, 1 khối kín, 145 mặt. Mẫu trước chỉ sửa cạnh chạm có 614 mặt. Bốn mặt trụ của rãnh sửa cạnh chạm tách biệt với 24 mặt trụ khôi phục. Dung sai 0,01 mm: sai lệch cung/dây tối đa khoảng 0,00799 mm, sai lệch spline lấy mẫu khoảng 0,00351 mm; thể tích tổng thay đổi khoảng 0,00652%. Không khôi phục lịch sử feature của Inventor.

Khi cập nhật web, cần thêm `strip-curves.js` cùng `worker.js`, `app.js` và `index.html`.


## Nối vùng bo bị ngắt bởi chữ/chi tiết (08/11/2026)

Thêm `junction-curves.js`: mở rộng mặt trụ lồi khi các đỉnh STL hỗ trợ phần cung còn thiếu, hợp phần bù và dựng lại giao tuyến của các mặt nhỏ. Chỉ áp dụng khi sai lệch cung, một solid/một vỏ kín, thể tích, số mặt và kích thước bao đạt kiểm tra; nếu không đạt thì giữ bản trước bước nối. Giới hạn 10.000 tam giác và tối đa 8 vùng thử. Không phục hồi lịch sử Fillet của Inventor.

Chesam: từ 145 xuống 125 mặt, loại 20 mặt nhỏ quanh chỗ chữ chạm vùng bo; 24 dải trụ và 5 dải spline giữ nguyên. Đọc lại STEP bằng OpenCascade độc lập: một khối kín hợp lệ, kiểm tra tự giao đạt, không còn mặt phẳng theo hướng bán kính trong vùng mối nối đang xét. Khoảng cách từ 46 điểm lấy mẫu STL ở vùng đó tới vỏ STEP tối đa 0,00684 mm (dung sai 0,01 mm); đây là kiểm tra lấy mẫu, không phải chứng minh Hausdorff toàn cục. Thể tích tổng khác STL khoảng 0,00654%.

Triển khai cần đồng thời cập nhật `junction-curves.js`, `strip-curves.js`, `worker.js`, `app.js`, `index.html`.
