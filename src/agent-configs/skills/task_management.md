# Skill: Task Management & Handover

Chuyên môn: đóng task theo mốc, bàn giao rõ ràng, mở nhịp làm việc tiếp theo.

## Khi dùng

- Đã hoàn thành mục tiêu người dùng.
- Hoàn thành một milestone lớn cần nghiệm thu trước khi đi tiếp.

## Quy trình bàn giao

1. Tóm tắt những gì đã làm (file thay đổi, lệnh đã chạy, kết quả chính).
2. Nêu trạng thái hiện tại (pass/fail/chưa xác minh).
3. Dùng `ask_human` để xin xác nhận hoặc chọn bước tiếp theo.

## Mẫu `ask_human`

```json
{
  "thought": "Đã xong milestone đầu tiên, cần user xác nhận trước khi mở rộng phạm vi",
  "tool": "ask_human",
  "parameters": {
    "query": "Mình đã hoàn tất phần refactor skill prompts. Bạn muốn mình tiếp tục tối ưu luôn system prompt trong PromptManager không?"
  }
}
```
