import * as fs from "node:fs";
import * as path from "node:path";
import env from "../environment.js";

export class PromptManager {
  /**
   * Load cấu hình hệ thống & kỹ năng cho Agent.
   * Tối ưu hóa cho Native VM Ubuntu & Template Injection.
   */
  static loadConfigs(activeTools: string[] = []) {
    const skillsMap: Record<string, string> = {
      terminal: "Thực thi shell, cài đặt package (apt, npm).",
      browser: "Tìm kiếm web (Wikipedia/Search).",
      human: "Hỏi ý kiến người dùng khi bế tắc hoặc cần xác nhận.",
      file_op: "CRUD file/thư mục trực tiếp trên VM.",
      structure: "Xem sơ đồ cây thư mục dự án.",
      debug: "Kiểm tra logs, process, network port.",
      task_mgmt: "Tóm tắt kết quả & nhận task tiếp theo.",
      search_grep: "Tìm kiếm code (regex, exclude node_modules).",
    };

    const getSkillContent = (key: string, fileName: string) => {
      if (activeTools.length === 0 || activeTools.includes(key)) {
        try {
          const rawContent = fs.readFileSync(`./src/agent-configs/skills/${fileName}`, "utf-8");
          return this.injectVariables(rawContent);
        } catch (e) {
          return skillsMap[key];
        }
      }
      return `Mô tả: ${skillsMap[key]} (Dùng tool để xem chi tiết)`;
    };

    try {
      const codingStandard = this.injectVariables(fs.readFileSync(`./src/agent-configs/rules/coding_standard.md`, "utf-8"));
      const selfCorrection = this.injectVariables(fs.readFileSync(`./src/agent-configs/rules/rule.md`, "utf-8"));

      return this.buildFinalPrompt(skillsMap, getSkillContent.bind(this), codingStandard, selfCorrection);
    } catch (e) {
      console.error("❌ Lỗi load cấu hình Prompt:", e);
      return "Lỗi: Không thể load quy tắc hệ thống tại src/agent-configs/rules/.";
    }
  }

  private static injectVariables(content: string): string {
    return content
      .replace(/\{\{AGENT_WORK_DIR\}\}/g, env.get("agent_work_dir"))
      .replace(/\{\{WORK_SPACE_DIR\}\}/g, env.get("main_work_space_dir"))
      .replace(/\{\{USER_NAME\}\}/g, env.get("user_name"))
      .replace(/\{\{HOST_IP\}\}/g, env.get("host_ip"))
      .replace(/\{\{HOST_PORT\}\}/g, env.get("host_port").toString());
  }

  private static buildFinalPrompt(skillsMap: any, getSkillContent: Function, rules: string, mainRules: string) {
    const agentDir = env.get("agent_work_dir");
    const user = env.get("user_name");

    return `
      # ROLE: Senior Full-stack Engineer Agent (Native VM Ubuntu)

      ## MÔI TRƯỜNG
      - **User**: ${user} | **Root**: /${agentDir}
      - **Persistence**: Dữ liệu bền vững, không reset. Kiểm tra kỹ file cũ trước khi thao tác.

      ## QUY TRÌNH BẮT BUỘC
      1. **Verify**: Luôn \`read_structure\`/\`ls\` xác nhận file trước khi sửa.
      2. **Big Files**: Cấm 'cat' file > 50KB. Dùng head/tail/grep.
      3. **Install**: Ưu tiên local. Chỉ dùng \`sudo\` cho apt/systemctl.
      4. **Loop**: Bị cảnh báo Loop -> Phải đổi phương pháp hoặc \`ask_human\`.
      5. **Finish**: Đạt mục tiêu -> \`ask_human\` tóm tắt & xác nhận task mới. KHÔNG 'done' ngay.

      ## CÔNG CỤ (SKILLS)
      ${Object.keys(skillsMap).map(k => `- ${k.toUpperCase()}: ${getSkillContent(k, this.getFileName(k))}`).join("\n")}

      ## QUY TẮC & TIÊU CHUẨN
      ${rules}
      ${mainRules}

      ## QUYỀN HẠN
      - Thực thi shell user \`${user}\`. Lệnh nhạy cảm (\`rm -rf\`, \`sudo\`) yêu cầu xác nhận.
      - Trả về JSON đúng schema.
      `.trim();
  }

  private static getFileName(key: string): string {
    const files: Record<string, string> = {
      terminal: "terminal.md",
      browser: "browser_search.md",
      human: "ask_human.md",
      file_op: "file_operation.md",
      structure: "read_structure.md",
      debug: "debug_service.md",
      task_mgmt: "task_management.md",
      search_grep: "search_grep.md",
    };
    return files[key] || "";
  }
}