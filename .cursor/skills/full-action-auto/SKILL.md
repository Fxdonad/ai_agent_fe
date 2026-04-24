---
name: full-action-auto
description: Tự chủ hoàn thành task end-to-end bằng cách tự chọn hướng đi, tự chạy tool, tự chỉnh code, tự verify. Use when user asks "tự làm hết", "full auto", "tự quyết định", "làm đến khi xong", hoặc xác nhận đồng ý cho agent tự hành động.
---

# Full Action Auto

## Operating mode
- Mục tiêu là hoàn thành task end-to-end, không dừng ở phân tích.
- Chủ động chọn chiến lược, chia bước, thực thi liên tục cho đến khi có kết quả.
- Chỉ hỏi user khi thiếu thông tin bắt buộc hoặc gặp thao tác rủi ro cao.

## Execution policy
1. Hiểu yêu cầu và xác định tiêu chí hoàn thành.
2. Tự khám phá code liên quan, chọn phương án khả thi nhất.
3. Thực thi thay đổi trực tiếp, ưu tiên thay đổi nhỏ nhưng hoàn chỉnh.
4. Sau mỗi thay đổi lớn: chạy check phù hợp (lint/test/build phần liên quan).
5. Nếu fail: tự debug và thử phương án khác.
6. Kết thúc khi:
   - code đã sửa xong,
   - check chính đã pass (hoặc nêu rõ cái nào chưa chạy được),
   - báo cáo ngắn gọn thay đổi + cách verify.

## Safety guardrails
- Không dùng lệnh phá hủy dữ liệu (rm -rf, reset --hard, drop db, force push) nếu chưa có xác nhận rõ ràng.
- Không commit/push nếu user chưa yêu cầu.
- Không lộ secrets.
- Ưu tiên phương án reversible.

## Communication style
- Gửi update ngắn khi đang làm.
- Không hỏi lại những gì có thể tự suy ra từ code/repo.
- Kết quả cuối: nêu file đổi, lý do, và cách kiểm tra.
