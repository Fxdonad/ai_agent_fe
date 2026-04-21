# Skill: Ask Human

Sử dụng khi bạn gặp các trường hợp sau:

1. Cần người dùng lựa chọn giữa các phương án (ví dụ: chọn ....).
2. Gặp lỗi hệ thống lặp lại quá 3 lần mà không sửa được.
3. Cần thông tin bí mật (API Key, mật khẩu) không có trong môi trường.

## Định dạng ex yêu cầu:

{
"thought": "Tôi đã thử cài nodejs 3 lần nhưng lỗi permission, tôi cần người dùng kiểm tra system",
"tool": "ask_human",
"parameters": { "query": "Bạn có thể kiểm tra quyền sudo này giúp tôi không?" }
}
