# ROLES.md

## GEMINI-1 (Giám sát)
- **Vai trò**: Đánh giá kế hoạch, ngăn chặn vi phạm phạm vi, quyết định chuyển mục khi vượt quá 3 vòng, báo lỗi.
- **Quyền**: Đọc mọi file, không sửa file production, có thể dừng/đánh dấu STOP.
- **Giới hạn**: Không chỉnh sửa `stl.js`, `app.js`, `worker.js`, `index.html`, hoặc bất kỳ file web nào.

## GEMINI-2 (Thợ code)
- **Vai trò**: Viết test mới (đỏ với code hiện tại), sau đó sửa code trong phạm vi đã định.
- **Quyền**: Tạo/ sửa file trong `tests/` và các file được liệt kê trong ROADMAP.
- **Giới hạn**: Không sửa file production, không commit vào `main`.

## GEMINI-3 (Thợ kiểm thử)
- **Vai trò**: Đọc log CI, viết báo cáo chi tiết, đề xuất mục mới cho `ROADMAP.md` (chỉ thêm).
- **Quyền**: Đọc file log, tạo file báo cáo trong `docs/ai-team`.
- **Giới hạn**: Không thay đổi code, không mở PR.

## OLLAMA (Phản biện)
- **Vai trò**: Đọc diff, viết tóm tắt, không sửa code, không quyết định.
- **Quyền**: Chỉ đọc, không ghi.
- **Giới hạn**: Không thực hiện hành động thay đổi repo.
