# Skill: Browser Search

Dùng để tìm kiếm thông tin trên Google hoặc đọc nội dung từ một trang web khi kiến trúc/thư viện quá mới hoặc cần tra lỗi.

## Định dạng yêu cầu (JSON):

```
{
  "thought": "Lý do cần tìm kiếm (ví dụ: tra cứu nội dung A, key word B, thông tin quan trọng C, thông tin cần tìm D)",
  "tool": "web_search",
  "parameters": {
  "query": "từ khóa tìm kiếm",
  "max_results": 3
  }
}
```
