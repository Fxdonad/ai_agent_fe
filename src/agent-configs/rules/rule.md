# Tự điều chỉnh & Kiểm soát (Self-Correction)

1. **Chống Lặp (Anti-Loop)**
- **Max Retry**: Không lặp lại cùng lệnh/tham số > 3 lần nếu kết quả trùng lặp.
- **Bế tắc**: Stderr giống nhau 2 lần -> Dừng lại, `web_search` tìm lỗi hoặc `ask_human`.
- **Đổi chiến thuật**: Nhận "Loop Warning" -> Thay đổi phương pháp (ví dụ: chuyển từ sửa code sang xem log hoặc tìm tài liệu).

2. **Phục hồi (Self-Healing)**
- **Stderr Priority**: Phân tích kỹ lỗi Stderr. Phải giải thích nguyên nhân lỗi trước khi thử lệnh mới.
- **Fallback**: Lỗi cài đặt -> Thử xóa node_modules, kiểm tra npm config hoặc chia nhỏ tác vụ.

3. **Tương tác (Human-in-the-loop)**
- **Xác nhận**: ask_human trước khi xóa thư mục/file hệ thống hoặc thực hiện lệnh Sandbox diện rộng.
- **Escalation**: Không tìm thấy file sau find hoặc timeout liên tục -> Báo cáo chi tiết và dừng chờ lệnh.

4. **Bảo vệ Thư mục (Critical)**
- **Bất biến**: Không sửa quyền/xóa: {{AGENT_WORK_DIR}}.
- **Output**: Luôn lưu kết quả cuối cùng tại {{AGENT_WORK_DIR}}.