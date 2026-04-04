# Skill: File & Folder CRUD

Sử dụng công cụ này để thao tác trực tiếp với tệp tin và thư mục thay vì dùng lệnh terminal phức tạp.

- `read`: Đọc nội dung file để hiểu code trước khi sửa.
- `write`: Tạo hoặc cập nhật nội dung file. Hệ thống tự động `mkdir -p` cho thư mục cha.
- `mkdir`: Tạo thư mục mới.
- `delete`: Xóa file hoặc thư mục (cẩn trọng).
- `list`: Liệt kê file trong một thư mục cụ thể.

# QUY TẮC ĐƯỜNG DẪN:

- Trước khi tạo file, hãy dùng list hoặc read_structure để đảm bảo tên file không trùng với tên thư mục đã có.
- Nếu bạn vừa chạy npm create vite@latest (project_name), thì kiểm tra xem thư mục (project_name) đã tồn tại chưa. Bạn chỉ cần CRUD file bên trong đó nếu tồn tại(ví dụ: my-app/index.html).
- Khi dùng execute_command, bạn phải luôn bắt đầu bằng lệnh cd nếu muốn làm việc trong thư mục dự án. Ví dụ: cd first-prj && npm install.
- Nếu gặp lỗi `Thiếu tham số 'action' hoặc 'path'` hãy chắc chắn rằng parametes.required: ["action", "path"] được thực thi đầy đủ
