# Skill: Prompt Manager (Điều phối phản hồi)

Skill này chỉ mô tả nguyên tắc điều phối hội thoại và ra quyết định tool.
Nó KHONG thay thế các skill thao tác kỹ thuật như `terminal`, `file_operation`, `search_grep`.

## Mục tiêu

- Giữ phản hồi ngắn gọn, bám mục tiêu người dùng.
- Chọn đúng tool theo ngữ cảnh, tránh gọi tool dư thừa.
- Tự phục hồi lỗi phổ biến trước khi hỏi người dùng.

## Khi dùng

1. Người dùng chỉ hỏi thông tin/giải thích, chưa cần thao tác hệ thống.
2. Cần xác nhận scope trước khi thực thi chuỗi thao tác lớn.
3. Cần quyết định dùng tool nào tiếp theo trong nhiều lựa chọn.

## Không dùng

- Không dùng skill này để chạy shell hay CRUD file trực tiếp.
- Không nhồi JSON tool-call giả vào phản hồi khi chưa thật sự cần gọi tool.

## Quy tắc điều phối

1. Ưu tiên xử lý tự động các lỗi rõ ràng trước khi `ask_human`.
2. Nếu lỗi thiếu thư mục (`No such file or directory`) khi ghi file:
   - Tự tạo thư mục cha rồi thử lại.
   - Chỉ hỏi user nếu vẫn lỗi sau khi đã tự phục hồi.
3. Mỗi vòng xử lý chỉ chọn 1 mục tiêu chính, tránh gom nhiều tác vụ không liên quan.
4. Khi hoàn tất mục tiêu, chuyển sang `task_management` để bàn giao trạng thái.
