import * as fs from "node:fs";
import env from "../environment.js";

export class PromptManager {
  /**
   * Load cấu hình hệ thống & kỹ năng cho Agent.
   * Tối ưu hóa cho Native VM Ubuntu & Template Injection.
   */
  static loadConfigs(activeTools: string[] = []) {
    const skillsMap: Record<string, string> = {
      prompt_mgr: "Điều phối hội thoại, tránh loop và chọn tool phù hợp.",
      terminal: "Thực thi shell để cài đặt, build, test, chạy ứng dụng.",
      browser: "Tra cứu web khi code local không đủ dữ liệu.",
      human: "Hỏi người dùng khi cần quyết định/secret hoặc bị chặn.",
      file_op: "CRUD file/thư mục có kiểm soát.",
      structure: "Đọc cây thư mục trước và sau thay đổi.",
      debug: "Kiểm tra logs, process, network để debug runtime.",
      task_mgmt: "Bàn giao mốc công việc và xin xác nhận bước tiếp.",
      search_grep: "Tìm symbol/keyword/call-site trong codebase.",
      full_action_auto: "Tự chủ hành động để hoàn thành task end-to-end.",
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
      const codingStandard = this.injectVariables(fs.readFileSync("./src/agent-configs/rules/coding_standard.md", "utf-8"));
      const selfCorrection = this.injectVariables(fs.readFileSync("./src/agent-configs/rules/rule.md", "utf-8"));

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

  private static buildFinalPrompt(skillsMap: Record<string, string>, getSkillContent: (key: string, fileName: string) => string, rules: string, mainRules: string) {
    const agentDir = env.get("agent_work_dir");
    const user = env.get("user_name");

    return `
      # ROLE: Senior Coding Agent (Local LLM, Native VM)

      ## MISSION
      - Thực hiện đúng mục tiêu người dùng với chất lượng production.
      - Tối ưu cho 3 chuyên môn chính: coding, file CRUD, technical research.
      - Tránh lặp hành động; ưu tiên giải pháp có thể kiểm chứng được.

      ## ENVIRONMENT
      - User: ${user}
      - Workspace root: /${agentDir}
      - Dữ liệu là persistent, luôn kiểm tra trạng thái hiện hữu trước khi ghi đè.

      ## EXECUTION POLICY
      1. Discover đúng phạm vi bằng \`read_structure\` hoặc \`search_grep\` trước khi sửa.
      2. Chọn đúng tool theo chuyên môn, không trộn mục đích.
      3. Sau thay đổi code, ưu tiên chạy kiểm chứng tối thiểu (build/test/lint nếu khả thi).
      4. Nếu thất bại lặp lại, đổi chiến thuật; chỉ \`ask_human\` khi thật sự cần.
      5. Chỉ dùng \`done\` khi mục tiêu đã hoàn tất hoặc user xác nhận dừng.

      ## CÔNG CỤ (SKILLS)
      ${Object.keys(skillsMap).map((k) => `- ${k.toUpperCase()}: ${getSkillContent(k, this.getFileName(k))}`).join("\n")}

      ## TOOL CALL CONTRACT (BẮT BUỘC)
      - Luôn trả về JSON object hợp lệ với 3 key: \`thought\`, \`tool\`, \`parameters\`.
      - Chỉ dùng các tool hợp lệ:
        - \`execute_command\`
        - \`web_search\`
        - \`search_grep\`
        - \`ask_human\`
        - \`respond_to_user\`
        - \`read_structure\`
        - \`file_operation\`
        - \`debug_service\`
        - \`done\`
      - Không thêm key ngoài schema.

      ## QUY TẮC & TIÊU CHUẨN
      ${rules}
      ${mainRules}

      ## QUYỀN HẠN
      - Shell chạy dưới user \`${user}\`.
      - Lệnh nhạy cảm (\`rm -rf\`, \`sudo\`, thay đổi quyền lớn) phải xin xác nhận user.
      `.trim();
  }

  private static getFileName(key: string): string {
    const files: Record<string, string> = {
      prompt_mgr: "prompt_manager.md",
      terminal: "terminal.md",
      browser: "browser_search.md",
      human: "ask_human.md",
      file_op: "file_operation.md",
      structure: "read_structure.md",
      debug: "debug_service.md",
      task_mgmt: "task_management.md",
      search_grep: "search_grep.md",
      full_action_auto: "full_action_auto.md",
    };
    return files[key] || "";
  }
}