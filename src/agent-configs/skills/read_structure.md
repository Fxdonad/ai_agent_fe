# Skill: Read Structure (Updated for VM Environment)

Sử dụng công cụ này để quét và hiểu sơ đồ cây thư mục của dự án trên máy ảo. Đây là bước **BẮT BUỘC** trước khi bạn thực hiện bất kỳ thao tác ghi file (`write`) hoặc sửa đổi cấu trúc nào.

### Mục đích

- Xác định vị trí chính xác của các file nguồn trong môi trường lưu trữ bền vững (Persistent Storage) của VM.
- Tránh tạo trùng lặp thư mục hoặc ghi đè file hiện có trong không gian người dùng.
- Kiểm tra kết quả sau khi thực hiện lệnh `mkdir`, `npm create` hoặc các lệnh shell trực tiếp.

### Phạm vi hoạt động (Scope)

- **Root Directory (VM Base):** `/home/fxdonad/Fxdonad/Agent/App`
- **Quy tắc đường dẫn:** - Luôn hiểu rằng mọi câu lệnh `execute_command` sẽ bắt đầu (Working Directory) tại đường dẫn gốc phía trên.
    - Sử dụng đường dẫn tương đối (ví dụ: `.` hoặc `src/`) để giữ cho các lệnh ngắn gọn và chính xác.

### Tham số `path`

- **Giá trị mặc định:** `"."` (Ánh xạ trực tiếp tới `/home/fxdonad/Fxdonad/Agent/App`).
- **Khám phá:** Truyền `path: "folder_name"` để xem nội dung bên trong các thư mục con.

### Quy tắc quan trọng dành cho VM

1. **Lọc dữ liệu (Vô cùng quan trọng):** Trên VM, các thư mục như `node_modules` hoặc `.git` có thể chứa hàng nghìn file. Hệ thống tự động dùng lệnh `find` với flag loại trừ để tránh làm tràn Context Window. 
2. **Kiểm tra quyền hạn:** Nếu không thấy file hoặc folder mặc dù đã chạy lệnh tạo, hãy kiểm tra xem bạn có đang thực thi lệnh ở ngoài phạm vi `/home/fxdonad/` hay không.
3. **Thứ tự thực hiện:**
   - **Bước 1:** `read_structure` (Xác định trạng thái hiện tại của VM).
   - **Bước 2:** `file_operation` hoặc `execute_command` (Thực hiện thay đổi).
   - **Bước 3:** `read_structure` một lần nữa để xác nhận thay đổi đã được ghi xuống đĩa cứng của VM (vì file trên VM không mất đi khi khởi động lại như Docker).

---

### Mẹo dành cho Agent trên VM:

* **Persistence:** Khác với Docker, các file bạn tạo ra sẽ tồn tại vĩnh viễn trên VM. Nếu bạn muốn làm lại từ đầu, hãy sử dụng `execute_command` với `rm -rf` một cách cẩn thận bên trong thư mục `App`.
* **Build Check:** Sau khi `npm run build`, hãy kiểm tra thư mục `dist` hoặc `build`. Nếu chạy trên VM Ubuntu, hãy lưu ý sự phân biệt chữ hoa chữ thường (Case-sensitivity) trong tên file.