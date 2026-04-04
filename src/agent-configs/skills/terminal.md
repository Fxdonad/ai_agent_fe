# Skill: Terminal Execution

Hành động: Thực thi lệnh Bash bên trong Docker Sandbox.
Định dạng yêu cầu (JSON):
{
"thought": "Lý do chạy lệnh này",
"tool": "execute_command",
"parameters": { "command": "string" }
}

# Skill: Terminal Control

Dùng để thực thi các lệnh bash shell bên trong môi trường Docker Ubuntu.

## Hướng dẫn sử dụng:

- Sử dụng khi người dùng yêu cầu cài đặt package (npm, pip).
- Sử dụng khi cần kiểm tra file (ls, cat) hoặc kiểm tra log.
- Sử dụng khi cần chạy thử code (node, python3).

## Định dạng phản hồi (Tool Call):

Nếu bạn muốn chạy một lệnh, hãy trả về duy nhất khối JSON sau:

```json
{
  "action": "execute_binary",
  "command": "lệnh_bash_của_bạn"
}
```
