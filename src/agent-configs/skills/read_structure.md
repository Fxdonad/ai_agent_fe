# Skill: Read Structure

Sử dụng công cụ này để quét và hiểu sơ đồ cây thư mục của dự án. Đây là bước **BẮT BUỘC** trước khi bạn thực hiện bất kỳ thao tác ghi file (`write`) hoặc sửa đổi cấu trúc nào.

### Mục đích

- Xác định vị trí chính xác của các file nguồn (`src/`, `public/`, `components/`).
- Tránh tạo trùng lặp thư mục hoặc ghi đè file hiện có.
- Kiểm tra kết quả sau khi thực hiện lệnh `mkdir` hoặc `npm create`.

### Phạm vi hoạt động (Scope)

- **Root Directory:** Bạn chỉ được phép làm việc bên trong `/home/agent/app/`.
- **Relative Path:** Luôn sử dụng đường dẫn tương đối từ gốc dự án (ví dụ: `.` hoặc `src/App.tsx`).

### Tham số `path`

- Giá trị mặc định: `"."` (tương đương với `/home/agent/app`).
- Nếu muốn xem sâu hơn vào một folder cụ thể: Truyền `path: "src/components"`.

### Quy tắc quan trọng

1. **Lọc dữ liệu:** Hệ thống tự động ẩn `node_modules`, `.git`, và các file ẩn (`.*`) để tránh làm tràn Context Window của bạn.
2. **Định hướng không gian:** Nếu bạn nhận được lỗi "Is a directory" khi ghi file, hãy chạy ngay `read_structure` để kiểm tra xem bạn có đang nhầm lẫn giữa file và folder hay không.
3. **Thứ tự thực hiện:** - Bước 1: `read_structure` (Xem mình đang ở đâu).
   - Bước 2: `file_operation` hoặc `execute_command` (Thực hiện thay đổi).

---

### Mẹo dành cho Agent:

Nếu bạn vừa chạy `npm run build`, hãy dùng `read_structure` với `path: "dist"` để xác nhận các file tĩnh đã được tạo ra đúng vị trí trước khi báo cáo hoàn thành nhiệm vụ.
