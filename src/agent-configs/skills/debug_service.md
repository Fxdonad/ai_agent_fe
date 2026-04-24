# Skill: Debug Service

Chuyên môn: chẩn đoán trạng thái runtime sau khi chạy app/service.

## Khi dùng

- Nghi ngờ process chết ngầm sau khi chạy lệnh.
- Cần đọc log nhanh để tìm nguyên nhân lỗi.
- Nghi ngờ port conflict hoặc lỗi kết nối.

## Tham số `type`

- `logs`: đọc log thực thi gần nhất.
- `process`: kiểm tra tiến trình đang chạy.
- `network`: kiểm tra trạng thái cổng mạng.

## JSON tool-call mẫu

```json
{
  "thought": "Cần xác nhận server có đang chạy và lắng nghe đúng port không",
  "tool": "debug_service",
  "parameters": {
    "type": "network"
  }
}
```

## Quy trình khuyến nghị

1. Xem `process`.
2. Xem `logs`.
3. Kiểm tra `network`.
4. Tóm tắt nguyên nhân gốc + đề xuất fix cụ thể.
