# Skill: Search & Grep (Tìm kiếm nội dung)

Sử dụng công cụ này khi bạn cần tìm kiếm một từ khóa, định nghĩa hàm, hoặc tìm xem file nào đang chứa đoạn code cụ thể trong toàn bộ dự án.

## Mục đích

- Tìm vị trí định nghĩa của các Component, Class, hoặc Function.
- Tìm các file cấu hình hoặc biến môi trường.
- Hiểu cách các module liên kết với nhau thông qua lệnh import.

## Lệnh đề xuất (Sử dụng qua terminal)

 1. Tìm file theo tên: find . -name "*UserComponent*"

 2. Tìm nội dung trong file: grep -rnE "keyword" . --exclude-dir={node_modules,dist,.git}

    -r: Tìm đệ quy.

    -n: Hiển thị số dòng.

    -E: Sử dụng Regular Expression.

 3. Tìm và xem ngữ cảnh (Context): grep -C 3 "functionName" path/to/file (Xem thêm 3 dòng trước và sau từ khóa).

## Quy trình thực hiện

- Luôn loại trừ các thư mục rác như node_modules hoặc dist để tăng tốc độ.
- Nếu tìm thấy quá nhiều kết quả, hãy thu hẹp phạm vi tìm kiếm bằng cách chỉ định thư mục (ví dụ: ./src).