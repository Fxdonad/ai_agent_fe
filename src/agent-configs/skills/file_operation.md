# Skill: File & Folder CRUD (VM Optimized)

Sử dụng công cụ này để thao tác trực tiếp với tệp tin và thư mục trên hệ thống Ubuntu VM. Công cụ này giúp tránh các lỗi cú pháp khi dùng `echo` hoặc `cat` trong terminal.

### Các hành động hỗ trợ:

- `read`: Đọc nội dung file. Hãy đọc trước khi sửa để đảm bảo không làm mất logic cũ.
- `write`: Tạo hoặc cập nhật file. Hệ thống tự động thực hiện `mkdir -p` cho các thư mục cha nếu chưa tồn tại.
- `mkdir`: Tạo thư mục mới.
- `delete`: Xóa file hoặc thư mục. **Lưu ý:** Trên VM, hành động này là vĩnh viễn (không có thùng rác).
- `list`: Liệt kê danh sách file/thư mục.

### QUY TẮC ĐƯỜNG DẪN & VẬN HÀNH TRÊN VM:

1. **Thư mục gốc (Working Directory):** - Mọi thao tác mặc định diễn ra tại: {{AGENT_WORK_DIR}}/App.
   - Luôn sử dụng **đường dẫn tương đối** (ví dụ: `src/main.tsx` thay vì `/home/fxdonad/.../src/main.tsx`) để đảm bảo tính gọn gàng.

2. **Đồng bộ với Terminal:**
   - Khi bạn dùng `execute_command` để tạo dự án (ví dụ: `npm create vite`), dự án sẽ tạo ra một thư mục con (ví dụ: `my-app`).
   - Lúc này, các lệnh `file_operation` tiếp theo PHẢI bao gồm tên thư mục đó trong `path` (ví dụ: `path: "my-app/package.json"`).

3. **Cảnh báo ghi đè:**
   - Trên VM, file cũ không bị xóa khi khởi động lại. Trước khi `write`, hãy dùng `list` hoặc `read_structure` để kiểm tra file đã tồn tại chưa.
   - Nếu ghi đè một file cấu hình quan trọng (như `vite.config.ts`), hãy `read` nó trước để giữ lại các thiết lập cần thiết.

4. **Xử lý lỗi quyền hạn (Permissions):**
   - Nếu gặp lỗi `Permission denied`, điều này có nghĩa là file/thư mục đó thuộc quyền sở hữu của `root` hoặc user khác.
   - Tuyệt đối không tự ý dùng `sudo` trong `file_operation`. Nếu cần thay đổi quyền, hãy dùng `ask_human`.

5. **Lệnh kết hợp:**
   - Khi dùng `execute_command`, hãy luôn nhớ: `cd path/to/dir && <command>`. Trạng thái `cd` không được lưu giữ giữa các lần gọi tool khác nhau.

### Ví dụ luồng làm việc chuẩn trên VM:

- **Bước 1:** `execute_command` -> `npm create vite@latest my-app -- --template react`
- **Bước 2:** `file_operation` (list) -> `path: "my-app"` (Xác nhận thư mục đã tạo thành công).
- **Bước 3:** `file_operation` (write) -> `path: "my-app/src/App.css"`, `content: "..."`
