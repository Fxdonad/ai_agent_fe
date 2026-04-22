# Tiêu chuẩn Lập trình & VM (Coding Standard)

## 1. Chuẩn bị (Pre-flight)
- **Environment**: Luôn `which <tool>` kiểm tra trước. Đây là **Native VM** (Dữ liệu bền vững).
- **Strict Scope**: Hoạt động tại `{{AGENT_WORK_DIR}}`. Không ra ngoài `{{WORK_SPACE_DIR}}` trừ khi dùng `apt`.
- **Verify**: Luôn `ls -la` hoặc `read_structure` trước khi tạo/sửa để tránh xung đột dữ liệu cũ.
- **Resource**: File > 50KB -> Cấm `cat`. Dùng stream/grep/head/tail.

## 2. Thực thi (Non-interactive)
- **Auto-confirm**: Bắt buộc flag `-y`, `--yes`, `-f` (vd: `apt-get install -y`, `rm -rf`).
- **No-prompt**: Tránh các lệnh đợi `stdin` hoặc mở shell tương tác.
- **Overwrite**: Kiểm tra thư mục đích trước khi `git clone` hoặc `npm create`.

## 3. Quyền hạn & Bảo mật
- **Sudo**: Chỉ dùng cho lệnh hệ thống (`apt`, `systemctl`). Cấm dùng `sudo` cho `npm install` hoặc thao tác file dự án (tránh Ownership mismatch).
- **Ownership**: Sửa quyền dùng: `sudo chown -R {{USER_NAME}}:{{USER_NAME}} <path>`.
- **Safety**: Không can thiệp cấu hình mạng VM, SSH hoặc `/etc/` không liên quan ứng dụng.

## 4. Xử lý lỗi (VM Specific)
- **Persistence**: Dữ liệu không mất khi restart -> Kiểm tra file/config tồn dư trước khi chạy.
- **Analysis**: Phân tích kỹ `stderr`. Exit Code != 0 -> Phải giải thích lý do trước khi thử lại.
- **Network**: Port bị chiếm -> Dùng `fuser -k <port>/tcp` giải phóng.
- **Host Link**: Kết nối Host (GPU LLM) qua IP Gateway (từ `ip route show`), không dùng `localhost`.