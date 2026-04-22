# Skill: Debug Service

Sử dụng công cụ này khi bạn đã chạy một lệnh background (như npm run dev, ...) nhưng không biết nó có chạy thành công hay không.

- `type: logs`: Đọc 50 dòng cuối của file `server.log`. nếu kiểm tra chưa tồn tại tại {{AGENT_WORK_DIR}}/App thì hãy tạo mới nó tại {{AGENT_WORK_DIR}}/App/server.log
- `type: process`: Kiểm tra xem tiến trình có bị "die" giữa chừng không.
- `type: network`: Kiểm tra xem port được yêu cầu có vấn đề gì không, báo cho human về thông tin nếu có

# Quy tắc Debug:

1. Nếu bạn chạy `npm run dev` và thấy "Thành công", đừng vội tin. Hãy dùng `debug_service` để đọc log.
2. Nếu gặp lỗi trắng trang hoặc lỗi kết nối, hãy kiểm tra `network` và `logs`.
