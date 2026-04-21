import axios from "axios";
import env from '../environment.js';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export class BrowserService {
  private readonly apiKey: string;
  private readonly BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

  constructor() {
    this.apiKey = env.get('brave_search_api_key');
  }

  /**
   * Tìm kiếm thông tin sử dụng Brave Search API.
   * Ưu điểm: Nhanh, chính xác, trả về JSON trực tiếp, không bị block.
   */
  async search(query: string): Promise<string> {
    if (!this.apiKey) {
      return "Lỗi: Chưa cấu hình BRAVE_SEARCH_API_KEY trong file .env";
    }

    try {
      console.log(`🔍 Đang tìm kiếm trên Brave: ${query}`);
      
      const response = await axios.get(this.BRAVE_API_URL, {
        params: {
          q: query,
          count: 5,         // Lấy 5 kết quả đầu tiên
          safesearch: "off" // Tùy chỉnh mức độ an toàn
        },
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey
        },
        timeout: 10000 // Timeout 10s
      });

      // Brave API trả về kết quả trong object 'web.results'
      const results = response.data.web?.results || [];

      if (results.length === 0) {
        return `Không tìm thấy kết quả nào cho từ khóa: "${query}"`;
      }

      const formattedResults: SearchResult[] = results.map((item: any) => ({
        title: item.title,
        link: item.url,
        snippet: item.description
      }));

      console.log(`✅ Đã tìm thấy ${formattedResults.length} kết quả từ Brave.`);
      return JSON.stringify(formattedResults);

    } catch (error: any) {
      let errorMsg = error.message;
      
      if (error.response) {
        if (error.response.status === 401) errorMsg = "API Key không hợp lệ.";
        if (error.response.status === 429) errorMsg = "Đã hết hạn mức tìm kiếm (Rate limit).";
      }

      console.error(`❌ Lỗi Brave Search API: ${errorMsg}`);
      return `Lỗi khi tìm kiếm: ${errorMsg}`;
    }
  }
}