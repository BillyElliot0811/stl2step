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
