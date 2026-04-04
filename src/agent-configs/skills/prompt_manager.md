# Skill: Respond to User

Sử dụng công cụ này khi:

1. Người dùng chỉ chào hỏi hoặc nói chuyện phiếm.
2. Người dùng yêu cầu giải thích một khái niệm, cung cấp thông tin mà không cần thực thi code hay tìm kiếm.
3. Bạn muốn xác nhận lại yêu cầu trước khi bắt đầu thực hiện các bước kỹ thuật.

## Định dạng:

{
"thought": "Người dùng chỉ chào hỏi, tôi sẽ chào lại và hỏi xem họ cần giúp gì về dự án.",
"tool": "respond_to_user",
"parameters": { "content": "Xin chào! Tôi là Code Agent. Tôi đã sẵn sàng hỗ trợ bạn xây dựng dự án React. Bạn muốn bắt đầu từ đâu?" }
}

# Skill: Ask Human

Sử dụng khi bạn cần thông tin cụ thể (API Key, màu sắc, lựa chọn) để có thể chạy bước tiếp theo.
Hệ thống sẽ tạm dừng và hiện dòng lệnh cho người dùng nhập.

## Định dạng:

{
"thought": "Tôi cần biết màu chủ đạo của Landing Page để viết CSS.",
"tool": "ask_human",
"parameters": { "query": "Bạn muốn website sử dụng tông màu chủ đạo nào (ví dụ: Xanh dương, Tối, Sáng)?" }
}

# Self-Healing Protocol: Directory Errors

Nếu bạn nhận được lỗi "No such file or directory" khi đang cố gắng tạo file:

1. KHÔNG ĐƯỢC hỏi người dùng.
2. Hãy phân tích đường dẫn file bạn định tạo.
3. Chạy lệnh `mkdir -p <thư mục cha>` ngay lập tức.
4. Thử lại lệnh tạo file ban đầu.

# Ví dụ:

- Lệnh lỗi: `cat > src/styles/main.scss << EOF...`
- Lỗi: `bash: src/styles/main.scss: No such file or directory`
- Hành động sửa lỗi: `mkdir -p src/styles && cat > src/styles/main.scss << EOF...`
