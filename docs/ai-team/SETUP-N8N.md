# Checklist dựng workflow ai-dev-loop trong n8n

Làm từng node, kiểm tra từng node bằng Execute step, không dựng cả chuỗi một lúc.

Credential:
- Giám sát: Gemini key 1
- Thợ code: Gemini key 2
- Thợ kiểm thử: Gemini key 3
- Phản biện: Ollama (gpt-oss:20b)

Các node theo thứ tự:
1. **Schedule Trigger**: mỗi 30 phút.
2. **HTTP Request**: đọc `docs/ai-team/state.json` và `budget.json` từ main qua GitHub API.
3. **Code**: nếu có file `docs/ai-team/STOP` thì dừng. Nếu `calls_today >= max_calls_per_day` thì dừng. Reset `calls_today` nếu `last_date` khác hôm nay.
4. **HTTP Request**: đọc `ROADMAP.md`, lấy mục đầu tiên có `## [ ]` (Code node tách theo `## `).
5. **Code**: nếu không còn mục nào thì dừng.
6. **HTTP Request**: tạo nhánh `ai/issue-N` từ `main`.
7. **HTTP Request**: tạo Issue với nhãn `ai-task` cho mục đó.
8. **Gemini key 2** (phase test): nhận prompt từ `docs/ai-team/prompts/coder.md`, điền biến.
9. **Code**: kiểm tra file trả về chỉ nằm trong `tests/`. Sai thì dừng và báo lỗi.
10. **HTTP Request**: commit file test lên nhánh `ai/issue-N`.
11. **Gemini key 1** (Giám sát): kiểm tra diff theo `supervisor.md`. `ok=false` thì dừng.
12. **Wait 3 phút**, rồi đọc trạng thái CI của commit. Test phải **ĐỎ**. Nếu **xanh**: ghi vào Issue "test không bắt lỗi", dừng.
13. **Vòng sửa** (tối đa 3):
    a. **Gemini key 2** (phase fix) nhận log CI nguyên văn.
    b. **Code**: kiểm tra file chỉ trong phạm vi và không xóa dòng trong `tests/` đã có.
    c. **Gemini key 1** kiểm tra lại diff.
    d. Commit, chờ CI, đọc kết quả.
    e. **Xanh** thì sang bước 14. **Đỏ** thì lặp, `round` tăng dần.
    f. Quá 3 vòng: gọi **Gemini key 3** viết `root_cause` vào Issue, đánh dấu mục "bỏ qua tạm" trong `ROADMAP.md`, dừng.
14. **Ollama**: tóm tắt diff, đưa vào nội dung PR.
15. **HTTP Request**: mở PR có "Closes #N", chỉ đưa `## [ ]` thành `## [x]` cho mục này.
16. **HTTP Request (GraphQL)**: bật auto-merge **SQUASH** cho PR.
17. **HTTP Request**: gắn nhãn `ai-done` cho Issue.
18. **Code**: cập nhật `state.json` (`calls_today` tăng, `current_item`, `round`, `last_status`) rồi commit lên `main`.

Lưu ý: mỗi lần gọi Gemini tăng `calls_today`. Đặt node **Code** đếm trước khi gọi.
