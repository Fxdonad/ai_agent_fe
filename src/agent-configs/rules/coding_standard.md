# Tiêu chuẩn Lập trình & Vận hành Ubuntu VM (Native Environment)

### 1. Tư duy chuẩn bị (Pre-flight Check)

- **Kiến thức Môi trường**: Xác nhận sự tồn tại của công cụ (ví dụ: `which npm`, `which node`) trước khi chạy lệnh. Agent đang hoạt động trên một **Ubuntu VM thực**, không phải container tạm thời.
- **Xác thực thư mục (Strict Scope)**:
  - Luôn đảm bảo đang đứng tại: {{AGENT_WORK_DIR}}.
  - **Cấm** thao tác ngoài phạm vi {{WORK_SPACE_DIR}} trừ khi được yêu cầu cài đặt package hệ thống (`apt`).
  - Trước khi thao tác file, phải chạy `read_structure` hoặc `ls -la` để xác định trạng thái thực tế của đĩa cứng (Persistence).
- **Kiểm tra tài nguyên**: Nếu file size > 50KB, cấm đọc toàn bộ file. Hãy dùng các lệnh xử lý stream hoặc đọc từng phần.

### 2. Thực thi lệnh Non-interactive (Bắt buộc)

- **Cờ xác nhận tự động**: Mọi lệnh cài đặt/xóa phải đi kèm flag: `apt-get install -y`, `npm install --yes`, `rm -rf`.
- **Phòng tránh treo tiến trình**:
  - Tuyệt đối không chạy lệnh mở shell tương tác hoặc các lệnh đợi input từ `stdin`.
  - Khi dùng `npm create` hoặc `git clone`, phải đảm bảo thư mục đích chưa tồn tại hoặc đã được xử lý để tránh prompt "Overwrite?".

### 3. Quản lý Quyền hạn & Bảo mật (User-Centric)

- **Nguyên tắc Sudo**:
  - Chỉ dùng `sudo` cho các lệnh hệ thống (`apt`, `systemctl`).
  - **Cấm** dùng `sudo` cho `npm install` hoặc các thao tác file trong thư mục dự án để tránh lỗi lệch quyền sở hữu (Ownership mismatch).
- **Định danh người dùng**: Không dùng biến môi trường `$USER`. Khi cần sửa quyền, hãy ghi rõ: `sudo chown -R {{USER_NAME}}:{{USER_NAME}} <path>`.
- **Bảo vệ hệ thống Host**: Cấm can thiệp vào cấu hình mạng của VM, SSH, hoặc các file trong `/etc/` mà không liên quan đến môi trường chạy ứng dụng.

### 4. Vận hành & Xử lý lỗi (VM Specific)

- **Tính bền vững (Persistence)**: Luôn nhớ rằng dữ liệu trên VM **không bị mất đi** sau khi restart. Phải kiểm tra file cũ trước khi tạo mới để tránh xung đột cấu hình.
- **Phân tích lỗi (stderr)**:
  - Nếu gặp `Exit Code 1`, phải đọc kỹ `stderr`.
  - Lỗi `Command not found`: Cần cài đặt bằng `sudo apt-get update && sudo apt-get install -y`.
  - Lỗi `Port already in use`: Phải dùng `fuser -k <port>/tcp` để giải phóng trước khi khởi động server mới.
- **Kết nối mạng**: Khi cần kết nối về máy Host (ví dụ: gọi GPU LLM), sử dụng IP Gateway tìm được qua `ip route show` thay vì `localhost`.
