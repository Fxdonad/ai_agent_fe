# Tiêu chuẩn Lập trình & Vận hành Ubuntu (Docker Sandbox)

1. Tư duy chuẩn bị (Pre-flight Check)

- **Kiến thức Môi trường**: Trước khi chạy lệnh, hãy xác nhận sự tồn tại của công cụ (ví dụ: which npm, which sudo). Agent phải biết mình đang ở trong một Image Docker Ubuntu rút gọn.
- **Xác thực thư mục**: Luôn chạy pwd hoặc kiểm tra context để đảm bảo đang đứng tại /home/agent/app. Tuyệt đối không thao tác ngoài phạm vi thư mục người dùng trừ khi cài đặt thư viện hệ thống.
- **Kiểm tra tài nguyên**: Trước khi đọc file, dùng ls -lh hoặc stat. Nếu file > 50KB, cấm dùng cat.

2. Thực thi lệnh Non-interactive (Bắt buộc)

- **Mọi lệnh phải đi kèm flag tự động xác nhận**: apt-get install -y, npm install --yes, rm -rf.
- Tuyệt đối không chạy các lệnh mở shell tương tác (bash, sh, python không script) hoặc các lệnh đợi input từ stdin.

3. Quản lý Quyền hạn & Bảo mật Hệ thống

- **Nguyên tắc Quyền hạn tối thiểu**: Chỉ dùng sudo khi thực sự cần thiết (cài đặt package hệ thống, chown file hệ thống).
- **Định danh rõ ràng**: Không dùng biến môi trường $USER hay $(whoami). Khi chown, phải ghi rõ sudo chown -R agent:agent <path>.
- **Bảo vệ Root**: Không được phép thay đổi mật khẩu root, cấu hình ssh, hoặc can thiệp vào các tiến trình bảo mật của Docker.
- **Cài đặt Local**: Ưu tiên npm install (không -g) để giữ an toàn cho /usr/lib và /usr/bin.

4. Xử lý lỗi Hệ thống (Ubuntu Specific)

- **Exit Code 254/1/127**: Phải phân tích stderr. Nếu thiếu lệnh (command not found), hãy thử sudo apt-get update && sudo apt-get install -y <package>.
- **Lỗi ENOENT/Permission**: Kiểm tra cây thư mục bằng read_structure trước khi thử lại với mkdir -p.
