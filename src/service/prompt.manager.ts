import * as fs from "node:fs";
import * as path from "node:path";

export class PromptManager {
  /**
   * Load cấu hình hệ thống và kỹ năng cho Agent.
   * Đã tối ưu hóa cho môi trường Native VM Ubuntu.
   */
  static loadConfigs(activeTools: string[] = []) {
    // Danh sách các skill khả dụng
    const skillsMap: Record<string, string> = {
      terminal: "Thực thi lệnh shell, cài đặt package (apt, npm).",
      browser: "Tìm kiếm thông tin trên internet qua Wikipedia/Search.",
      human: "Hỏi ý kiến người dùng khi gặp bế tắc hoặc cần xác nhận quan trọng.",
      file_op: "Đọc/Ghi/Xóa/Tạo file và thư mục trực tiếp trên VM.",
      structure: "Xem sơ đồ cây của thư mục dự án để định hướng.",
      debug: "Kiểm tra logs, tiến trình (process) và trạng thái network port.",
    };

    // Chỉ load FULL nội dung nếu tool đó đang được "active" hoặc cho lượt đầu tiên
    const getSkillContent = (key: string, fileName: string) => {
      if (activeTools.length === 0 || activeTools.includes(key)) {
        try {
          // Lưu ý: Đảm bảo thư mục src/agent-configs tồn tại trên VM
          return fs.readFileSync(
            `./src/agent-configs/skills/${fileName}`,
            "utf-8",
          );
        } catch (e) {
          return skillsMap[key]; // Fallback về mô tả ngắn nếu không tìm thấy file
        }
      }
      return `Mô tả: ${skillsMap[key]} (Dùng tool này để xem hướng dẫn chi tiết)`;
    };

    const rules = "";
    const mainRules = "";
    
    try {
      // Load quy chuẩn lập trình và quy tắc tự điều chỉnh
      const codingStandard = fs.readFileSync(`./src/agent-configs/rules/coding_standard.md`, "utf-8");
      const selfCorrection = fs.readFileSync(`./src/agent-configs/rules/rule.md`, "utf-8");
      return this.buildFinalPrompt(skillsMap, getSkillContent.bind(this), codingStandard, selfCorrection);
    } catch (e) {
      return "Lỗi: Không thể load quy tắc hệ thống. Hãy kiểm tra thư mục src/agent-configs/rules/.";
    }
  }

  private static buildFinalPrompt(skillsMap: any, getSkillContent: Function, rules: string, mainRules: string) {
    return `
      ## VAI TRÒ
      Bạn là một Senior Full-stack Engineer Agent (Self-healing) vận hành trực tiếp trên môi trường **Native VM Ubuntu**.

      ## MÔI TRƯỜNG HOẠT ĐỘNG
      - **Hệ điều hành**: Ubuntu (Native)
      - **User**: fxdonad
      - **Thư mục làm việc chính**: \`/home/fxdonad/Fxdonad/Agent/App\`
      - **Đặc điểm**: Dữ liệu có tính bền vững (Persistence), không bị reset như Docker.

      ## CHIẾN THUẬT & QUY TRÌNH (BẮT BUỘC)
      1. **Kiểm tra trạng thái**: Luôn dùng \`read_structure\` hoặc \`ls\` để xác nhận file/thư mục cũ trước khi thao tác, tránh xung đột dữ liệu tồn dư trên VM.
      2. **Xử lý file lớn**: TUYỆT ĐỐI KHÔNG 'cat' file > 50KB. Dùng 'head', 'tail' hoặc 'grep'.
      3. **Cài đặt**: Ưu tiên cài đặt local. Chỉ dùng \`sudo\` cho các tác vụ hệ thống (apt, systemctl).
      4. **Loop**: Nếu bị Loop Warning, PHẢI thay đổi cách tiếp cận hoặc dùng \`ask_human\`.

      ## DANH SÁCH CÔNG CỤ (SKILLS):
      ${Object.keys(skillsMap)
        .map((key) => `- ${key.toUpperCase()}: ${getSkillContent(key, this.getFileName(key))}`)
        .join("\n\n")}

      ## QUY TẮC LẬP TRÌNH & VẬN HÀNH:
      ${rules}
      ${mainRules}

      ## QUYỀN HẠN & BẢO MẬT:
      - Bạn có quyền thực thi lệnh shell với user \`fxdonad\`.
      - Các lệnh nhạy cảm (\`rm -rf\`, \`sudo\`) sẽ được hệ thống chặn lại để hỏi xác nhận từ người dùng tự động.
      - Phải trả về JSON đúng schema quy định.
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