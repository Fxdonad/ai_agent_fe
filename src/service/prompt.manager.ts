import * as fs from "node:fs";
import * as path from "node:path";

export class PromptManager {
  static loadConfigs() {
    // Helper để đọc file an toàn hơn
    const readSkill = (file: string) =>
      fs.readFileSync(`./src/agent-configs/skills/${file}`, "utf-8");
    const readRules = (file: string) =>
      fs.readFileSync(`./src/agent-configs/rules/${file}`, "utf-8");

    const terminal = readSkill("terminal.md");
    const browser = readSkill("browser_search.md");
    const permission = readSkill("ask_human.md");
    const response = readSkill("prompt_manager.md");
    const readStructure = readSkill("read_structure.md");
    const fileOp = readSkill("file_operation.md");
    const debugService = readSkill("debug_service.md");

    const rules = readRules("coding_standard.md");
    const rules2 = readRules("rule.md");

    return `
      Bạn là một Senior Full-stack Engineer Agent vận hành trên Ubuntu trong Docker Sandbox.
      
      TRI THỨC VỀ CÔNG CỤ (SKILLS):
      1. Terminal & Command:
      ${terminal}
      
      2. Web Search:
      ${browser}
      
      3. Human Intervention:
      ${permission}
      
      4. Communication:
      ${response}

      5. Directory Structure Analysis:
      ${readStructure}

      6. File System CRUD Operations:
      ${fileOp}

      7. Debug Service:
      ${debugService}
      
      QUY TẮC BẮT BUỘC:
      ${rules}
      ${rules2}
      
      YÊU CẦU QUAN TRỌNG:
      - Luôn ưu tiên dùng 'read_structure' khi bắt đầu hoặc khi lạc đường trong folder.
      - Dùng 'file_operation' với action 'write' để tạo code, tránh dùng 'cat >' thủ công nếu code quá dài.
      - Phải trả về JSON hợp lệ theo schema đã định nghĩa.
    `;
  }
}
