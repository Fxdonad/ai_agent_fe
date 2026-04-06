import * as fs from "node:fs";
import * as path from "node:path";

export class PromptManager {
  /**
   * Header này chỉ chứa mô tả ngắn gọn về tool để Agent biết nó có gì.
   * Giúp giảm tới 60-70% token so với việc load toàn bộ content.
   */
  static loadConfigs(activeTools: string[] = []) {
    // Danh sách các skill khả dụng
    const skillsMap: Record<string, string> = {
      terminal: "Thực thi lệnh shell, cài đặt package (apt, npm).",
      browser: "Tìm kiếm thông tin trên internet qua Google/DuckDuckGo.",
      human: "Hỏi ý kiến người dùng khi gặp bế tắc hoặc lệnh nguy hiểm.",
      file_op: "Đọc/Ghi/Xóa/Tạo file và thư mục.",
      structure: "Xem sơ đồ cây của thư mục dự án.",
      debug: "Kiểm tra logs, tiến trình (process) và network port.",
    };

    // Chỉ load FULL nội dung nếu tool đó đang được "active" hoặc cho lượt đầu tiên
    const getSkillContent = (key: string, fileName: string) => {
      if (activeTools.length === 0 || activeTools.includes(key)) {
        try {
          return fs.readFileSync(
            `./src/agent-configs/skills/${fileName}`,
            "utf-8",
          );
        } catch (e) {
          return skillsMap[key]; // Fallback về mô tả ngắn
        }
      }
      return `Mô tả: ${skillsMap[key]} (Dùng tool này để xem hướng dẫn chi tiết)`;
    };

    const rules = fs.readFileSync(
      `./src/agent-configs/rules/coding_standard.md`,
      "utf-8",
    );
    const mainRules = fs.readFileSync(
      `./src/agent-configs/rules/rule.md`,
      "utf-8",
    );

    return `
      ## VAI TRÒ
      Bạn là một Senior Full-stack Engineer Agent (Self-healing) trong Docker Sandbox.

      ## CHIẾN THUẬT & QUY TRÌNH (BẮT BUỘC)
      1. Xử lý file lớn: TUYỆT ĐỐI KHÔNG 'cat' file > 50KB. Dùng 'head', 'tail' hoặc 'grep'.
      2. Timeout: Nếu timeout, hãy chia nhỏ tác vụ.
      3. Loop: Nếu bị Loop Warning, PHẢI đổi cách tiếp cận hoặc 'ask_human'.
      4. Debug: Luôn 'read_structure' trước khi thao tác file.

      ## DANH SÁCH CÔNG CỤ (SKILLS):
      ${Object.keys(skillsMap)
        .map(
          (key) =>
            `- ${key.toUpperCase()}: ${getSkillContent(key, this.getFileName(key))}`,
        )
        .join("\n\n")}

      ## QUY TẮC CỐ ĐỊNH:
      ${rules}
      ${mainRules}

      ## QUYỀN HẠN:
      - Tự do 'apt-get', 'npm install'.
      - 'sudo' và 'rm' sẽ được hệ thống hỏi người dùng tự động.
      - Phải trả về JSON đúng schema.
    `;
  }

  private static getFileName(key: string): string {
    const files: Record<string, string> = {
      terminal: "terminal.md",
      browser: "browser_search.md",
      human: "ask_human.md",
      file_op: "file_operation.md",
      structure: "read_structure.md",
      debug: "debug_service.md",
    };
    return files[key] || "";
  }
}
