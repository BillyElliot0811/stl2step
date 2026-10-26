# STL → STEP (miễn phí, chạy trên trình duyệt)

## Cấu trúc
- `index.html`  giao diện
- `worker.js`   logic chuyển đổi (OpenCASCADE trong Web Worker)
- `oc.js`, `oc.wasm`  OpenCASCADE.js 1.1.1 (wasm ~63 MB, GitHub cho phép file < 100 MB)

## Host miễn phí bằng GitHub Pages
1. Tạo repo công khai mới, đẩy cả 4 file lên (file wasm lớn nên dùng `git push` thay vì upload web).
2. Settings → Pages → Source: branch `main`, thư mục `/ (root)`.
3. Mở `https://<tên-bạn>.github.io/<tên-repo>/`.

Có thể thay bằng Cloudflare Pages hoặc Netlify (bậc miễn phí). Lưu ý: trang phải chạy qua http(s), không mở trực tiếp file:// (Worker và wasm sẽ bị chặn).
Thử cục bộ: `python3 -m http.server 8000` rồi mở http://localhost:8000
