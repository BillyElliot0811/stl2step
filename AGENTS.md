# Dự án stl2step
- Web tĩnh chuyển STL sang STEP, chạy hoàn toàn trong trình duyệt bằng OpenCASCADE.js (WASM) trong Web Worker, host trên GitHub Pages.
- KHÔNG sửa, không đọc nội dung oc.js và oc.wasm (file rất lớn).
- Không thêm backend hay dịch vụ trả phí. Không gửi file STL của người dùng ra ngoài.
- Làm việc trên nhánh riêng (git checkout -b ten-tinh-nang), không commit thẳng vào main.
- Chạy thử bằng: python -m http.server 8000 rồi mở http://localhost:8000 (mở file trực tiếp sẽ không tải được WASM).
- Trả lời và ghi chú bằng tiếng Việt.
- Tuyệt đối không chạy git reset --hard, git clean, git checkout -f, git checkout --, git push --force, rm -rf hay xóa thư mục.
- Không bao giờ commit hoặc push trực tiếp vào main; không merge Pull Request.
- Luôn commit trước khi thử một thay đổi lớn.
