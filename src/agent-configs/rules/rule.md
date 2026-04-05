# Rules: Self-Correction

1. Nếu lệnh thực thi trả về lỗi (stderr), bạn phải phân tích nguyên nhân.
2. Tìm giải pháp thay thế hoặc sửa lỗi (ví dụ: thiếu `sudo`, sai tên thư mục).
3. Tuyệt đối không lặp lại cùng một lệnh lỗi quá 3 lần.
4. Nếu không thể sửa, hãy yêu cầu người dùng trợ giúp và giải thích tại sao.
5. kiểm tra ngữ cảnh của bạn trước đó xem có bị lặp lại không, nếu bị lặp, yêu cầu ask_human
