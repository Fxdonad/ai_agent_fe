# Skill: Terminal Execution

Chuyên môn: chạy lệnh shell để cài đặt, build, test, chạy app, kiểm tra process/network.

## Khi dùng

- Cài package hoặc chạy script (`npm`, `pnpm`, `pip`, `apt`).
- Build/test/lint hoặc chạy runtime (`npm run build`, `npm test`, `node ...`).
- Kiểm tra trạng thái môi trường (`pwd`, `ls`, `ps`, `netstat`, `tail`).

## Không dùng

- Không dùng để ghi nội dung file lớn bằng `echo/cat <<EOF`; hãy dùng `file_operation`.
- Không chạy lệnh tương tác cần nhập tay.

## JSON tool-call chuẩn

```json
{
  "thought": "Cần chạy lệnh kiểm tra hoặc thực thi trong terminal",
  "tool": "execute_command",
  "parameters": {
    "command": "npm run build",
    "timeout_ms": 900000
  }
}
```

## Mẫu nâng cao

- Chay lenh lau (install/build): dat `timeout_ms` lon hon mac dinh.
- Lenh it output: them `verify_command` de xac nhan side-effect.
- Lenh dai han (dev/watch): dat `mode: "background"` va `log_file`.
- Khi chay nen, uu tien bat health-check loop de doi service "ready" roi moi di tiep.
- Neu health-check fail/timeout, he thong se tu dong cleanup process (mac dinh). Co the tat bang `auto_cleanup_on_unhealthy: false`.

```json
{
  "thought": "Can cai package va xac nhan da cai xong",
  "tool": "execute_command",
  "parameters": {
    "command": "npm i axios",
    "timeout_ms": 1200000,
    "verify_command": "npm ls axios --depth=0",
    "always_verify": true
  }
}
```

```json
{
  "thought": "Can chay dev server va doi khi he thong san sang",
  "tool": "execute_command",
  "parameters": {
    "mode": "background",
    "command": "npm run dev",
    "log_file": "dev-server.log",
    "health_check": true,
    "ready_pattern": "ready|listening|compiled successfully",
    "health_timeout_ms": 180000,
    "health_interval_ms": 3000,
    "auto_cleanup_on_unhealthy": true
  }
}
```

## Quy tắc an toàn

1. Luôn quote path có khoảng trắng.
2. Với lệnh có rủi ro xóa/sửa rộng, phải xin xác nhận người dùng trước.
3. Nếu lệnh thất bại, nêu nguyên nhân chính rồi mới retry bằng chiến thuật khác.
