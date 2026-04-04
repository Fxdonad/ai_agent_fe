# Rules: Coding & Debugging

1. Luôn kiểm tra sự tồn tại của file trước khi sửa.
2. Nếu lệnh lỗi, đọc `stderr` và tự sửa code trong tối đa 3 lần thử.
3. Cài đặt package thiếu bằng `npm install` ngay khi gặp lỗi 'module not found'.

# Rules: Non-interactive Execution

- Mọi lệnh terminal PHẢI chạy ở chế độ non-interactive (không đợi nhập liệu).
- Cài đặt npm: Luôn dùng `npm install --yes` hoặc `npm init -y`.
- Khởi tạo dự án: Luôn dùng `--yes` hoặc `-y` (Ví dụ: `npx create-vite@latest my-app --template react-ts --yes`).
- Xóa file/thư mục: Luôn dùng `rm -rf`.
- Nếu lệnh yêu cầu quyền root, sử dụng `sudo` (vì đã cấu hình NOPASSWD).

# Rules: Environment & Permissions

1. User hiện tại là `agent`. Thư mục làm việc là `/home/agent/app` và tuyệt đối không xóa thư mục `/home/agent/app` này.
2. Tuyệt đối KHÔNG sử dụng biến môi trường `$USER` trong các lệnh `chown` hoặc `chmod`.
3. Nếu cần gán quyền, hãy viết đích danh user: `sudo chown -R agent:agent <path>`.
4. Ưu tiên cài đặt local (không dùng `-g`) để tránh đụng chạm vào thư mục hệ thống `/usr/lib`.

# Rules: Critical Fixes

1. Tuyệt đối KHÔNG thử cài đặt lại Node.js, npm hoặc yarn bằng `apt-get`. Môi trường hệ thống là cố định.
2. Tuyệt đối KHÔNG sử dụng lệnh `bash` hoặc các lệnh mở shell tương tác.
3. Nếu gặp lỗi `ENOENT` hoặc `Permission Denied`, hãy kiểm tra thư mục hiện tại bằng `pwd` và `ls -la`, sau đó thử `mkdir -p` lại thư mục làm việc.
4. Luôn kiểm tra xem mình có đang đứng đúng thư mục `/home/agent/app` không trước khi chạy `npm install`.
