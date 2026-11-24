# RULES.md

- Chỉ sửa file trong phạm vi mục `ROADMAP.md` đã liệt kê.
- Không chỉnh sửa `stl.js`, `app.js`, `worker.js`, `index.html`, hoặc bất kỳ file web nào.
- Không commit, merge, hoặc push vào nhánh `main`.
- Không sử dụng `git reset --hard`, `git clean`, `git checkout -f`, `git checkout --`, `git push --force`, `rm -rf`.
- Không ghi API key hoặc bí mật vào repo.
- Không tạo file ngoài thư mục `docs/ai-team` hoặc file `ROADMAP.md` ở root.
- Nếu tồn tại file `docs/ai-team/STOP`, dừng mọi hành động ngay lập tức.
- Giới hạn tối đa 3 vòng sửa cho mỗi mục (được ghi trong `budget.json`).
- Ngân sách gọi AI tối đa 30 lần mỗi ngày (được ghi trong `budget.json`).
- Các test phải được viết trước, phải đỏ với code hiện tại, sau đó mới sửa code.
- Các thay đổi phải được commit với thông điệp tiếng Anh, không merge.

## Cổng tự động merge (AUTO-MERGE GATE)

Một PR chỉ được bật auto-merge khi TẤT CẢ điều kiện sau đúng. Mọi điều kiện được kiểm tra bằng code (n8n gọi GitHub API), KHÔNG dựa vào lời tự báo cáo của AI.

### Điều kiện đầu vào (PR)
1. Head branch bắt đầu bằng `ai/`, base là `main`.
2. Mọi file thay đổi nằm trong "Phạm vi" của mục ROADMAP đang làm (so sánh danh sách file với code, không tin báo cáo).
3. Không có dòng `-` nào trong diff của `tests/` (chỉ được thêm test).
4. Không sửa `tests/e2e.spec.js`, `tests/ui-stepper.spec.js`, `tests/cylinder-general.spec.js` đã có (diff rỗng với main, trừ khi mục ROADMAP ghi rõ được sửa).
5. Không có file `docs/ai-team/STOP`.
6. Commit test đi TRƯỚC commit code. Check-run của commit test phải ĐỎ (bằng chứng test bắt được lỗi).

### Điều kiện kiểm thử
7. Tất cả check-runs của head SHA là `success` (không có `failure`, `cancelled`, `timed_out`).
8. Số ca passed ≥ số ca passed của `main` trước đó (không được giảm). Không có ca `skipped`.
9. Dòng "KHỚP HOÀN TOÀN" của `compare-stl-parser.js` xuất hiện trong log CI.
10. Không vượt `max_calls_per_day` trong `budget.json`.

### Điều kiện sau merge (giám sát)
11. Sau khi merge, n8n kích hoạt `health-check-pages` trên `main` (workflow_dispatch) và chờ kết quả.
12. Health xanh: giữ PR đã merge, ghi vào sổ.
13. Health đỏ lần 1: chạy lại sau 3 phút.
14. Health đỏ lần 2: tạo PR revert commit vừa merge, auto-merge revert (revert được phép dù cổng trên chưa đầy đủ, vì quay về trạng thái đã biết là tốt). Ghi lý do vào ROADMAP.
   - Bước này CHỈ bật sau khi lịch `schedule` đã chạy đều ít nhất 3 lần liên tiếp xanh.

### Khi không đạt
- Thất bại 3 vòng sửa cho một mục: ghi lý do vào Issue, đánh dấu mục "bỏ qua tạm" trong ROADMAP, chuyển mục khác. Không tự merge.
- Không bao giờ bỏ qua test đỏ bằng cách sửa ngưỡng hoặc xóa ca.

### Tóm tắt sáng (gửi mỗi ngày 08:00, n8n tạo từ dữ liệu API, không từ AI)
- Đã merge: danh sách PR, commit hash, link.
- Bị bỏ qua: mục, số vòng, lý do (lấy từ log CI).
- Health check 24 giờ: số lần xanh / đỏ.
- Lượt AI đã dùng / trần ngày.
- Cảnh báo: bất kỳ điều kiện 1–14 nào không đạt.
- Kênh gửi: do bạn chọn (email hoặc Telegram).
