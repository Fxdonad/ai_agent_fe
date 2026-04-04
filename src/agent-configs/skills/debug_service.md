# Skill: Debug Service

Sử dụng công cụ này khi bạn đã chạy một lệnh background (như npm run dev) nhưng không biết nó có chạy thành công hay không.

- `type: logs`: Đọc 50 dòng cuối của file `server.log`. Đây là nơi chứa lỗi runtime của Vite/React.
- `type: process`: Kiểm tra xem tiến trình có bị "die" giữa chừng không.
- `type: network`: Kiểm tra xem Port 5173 đã sẵn sàng chưa.

# Quy tắc Debug:

1. Nếu bạn chạy `npm run dev` và thấy "Thành công", đừng vội tin. Hãy dùng `debug_service` để đọc log.
2. Nếu gặp lỗi trắng trang hoặc lỗi kết nối, hãy kiểm tra `network` và `logs`.
