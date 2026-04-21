import axios from "axios";
import * as fs from "node:fs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ShellService } from "../core/shell.service.js";
import { BrowserService } from "../core/browser.service.js";
import { PromptManager } from "./prompt.manager.js";
import { Gemma34bConfig } from "../model/gemma-3-4b.response.js";

export class AgentEngine {
  private messages: any[] = [];
  private shell = new ShellService();
  private browser = new BrowserService();
  private rl = readline.createInterface({ input, output });
  
  private hostIp = "10.119.97.128";
  private port = "1235";
  private readonly LMS_URL = `http://${this.hostIp}:${this.port}/v1/chat/completions`;
  
  private readonly EXEC_LOG_PATH = "./agent_execute.log";

  private actionHistory: string[] = [];
  private readonly MAX_HISTORY = 5;
  private readonly MAX_RETRY_SAME_ACTION = 3;
  private readonly DANGEROUS_KEYWORDS = ["sudo", "rm -rf /", "chmod 777", "chown", "mkfs", "dd if="];

  constructor() {
    this.messages.push({
      role: "system",
      content: PromptManager.loadConfigs(),
    });
    if (!fs.existsSync(this.EXEC_LOG_PATH)) {
      fs.writeFileSync(this.EXEC_LOG_PATH, `--- Session Start: ${new Date().toISOString()} ---\n`);
    }
  }

  private logActivity(type: string, data: any) {
    const logEntry = `[${new Date().toLocaleTimeString()}] [${type}] ${typeof data === 'string' ? data : JSON.stringify(data)}\n`;
    fs.appendFileSync(this.EXEC_LOG_PATH, logEntry);
  }

  private isDangerousCommand(cmd: string): boolean {
    const lowerCmd = cmd.toLowerCase();
    return this.DANGEROUS_KEYWORDS.some((keyword) => lowerCmd.includes(keyword));
  }

  async run() {
    console.log("🤖 Hệ thống Code Agent (Native VM Mode) đã sẵn sàng.");
    const goal = await this.rl.question("👉 Yêu cầu của bạn: ");
    if (!goal) return;

    this.messages.push({ role: "user", content: goal });
    this.logActivity("GOAL", goal);

    for (let i = 0; i < 50; i++) {
      try {
        const rawResponse = await this.askLLM();
        const decision = this.parseResponse(rawResponse);
        if (!decision) continue;

        const actionHash = JSON.stringify({ t: decision.tool, p: decision.parameters });
        if (this.detectLoop(actionHash)) {
          const warning = "⚠️ HỆ THỐNG: Bạn đang lặp lại hành động. Hãy đổi cách tiếp cận hoặc dùng 'ask_human'.";
          this.messages.push({ role: "user", content: warning });
          console.log(warning);
          continue;
        }

        console.log(`\n🤔 SUY NGHĨ [${i}]: ${decision.thought}`);
        this.logActivity("THOUGHT", decision.thought);

        const result = await this.executeDecision(decision);
        
        if (decision.tool === "done") {
          console.log("✅ NHIỆM VỤ HOÀN THÀNH!");
          break;
        }

        this.addStep(decision, result);
      } catch (err: any) {
        const errorMsg = `Lỗi hệ thống: ${err.message}`;
        this.logActivity("ERROR", errorMsg);
        this.addStep({ tool: "error", parameters: {} }, errorMsg);
      }
    }
  }

  private detectLoop(currentHash: string): boolean {
    this.actionHistory.push(currentHash);
    if (this.actionHistory.length > this.MAX_HISTORY) this.actionHistory.shift();
    return this.actionHistory.filter(h => h === currentHash).length >= this.MAX_RETRY_SAME_ACTION;
  }

  private async executeDecision(decision: any): Promise<string> {
    const { tool, parameters } = decision;
    let result = "";

    switch (tool) {
      case "execute_command":
        this.logActivity("EXEC", parameters.command);
        if (this.isDangerousCommand(parameters.command)) {
          const confirm = await this.rl.question(`⚠️ LỆNH NGUY HIỂM: "${parameters.command}". Chạy không? (y/n): `);
          if (confirm.toLowerCase() !== 'y') return "Bị từ chối bởi người dùng.";
        }
        result = this.shell.execute(parameters.command);
        break;

      case "file_operation":
        this.logActivity("FILE", parameters);
        result = await this.handleFileOp(parameters);
        break;

      case "read_structure":
        const findCmd = `find ${parameters.path || "."} -maxdepth 3 -not -path '*/.*' -not -path '*node_modules*' -not -path '*dist*'`;
        result = this.shell.execute(findCmd);
        break;

      case "search_grep":
        this.logActivity("SEARCH", parameters);
        // Tối ưu lệnh grep để không quét qua node_modules và các file binary
        const query = parameters.query;
        const path = parameters.path || ".";
        const grepCmd = `grep -rnI "${query}" ${path} --exclude-dir={.git,node_modules,dist,build} | head -n 50`;
        result = this.shell.execute(grepCmd);
        if (!result.trim()) result = `Không tìm thấy kết quả cho từ khóa: "${query}"`;
        break;

      case "ask_human":
        result = await this.rl.question(`❓ AGENT HỎI: ${parameters.query}\n👉 Trả lời: `);
        this.actionHistory = [];
        break;

      case "web_search":
        result = await this.browser.search(parameters.query);
        break;

      default:
        result = "Lỗi: Tool không được hỗ trợ.";
    }

    this.logActivity("RESULT", result.substring(0, 500) + (result.length > 500 ? "..." : ""));
    return result;
  }

  private async handleFileOp(p: any): Promise<string> {
    const { action, path: filePath, content } = p;
    
    switch (action) {
      case "write":
        // Dùng Base64 để truyền dữ liệu code an toàn qua Shell
        const base64 = Buffer.from(content || "").toString("base64");
        return this.shell.execute(`
          mkdir -p "$(dirname "${filePath}")" && 
          echo "${base64}" | base64 --decode > "${filePath}" && 
          echo "Ghi file ${filePath} thành công."
        `);
      
      case "read":
        return this.shell.execute(`
          if [ -f "${filePath}" ]; then
            FILE_SIZE=$(stat -c%s "${filePath}")
            if [ "$FILE_SIZE" -gt 51200 ]; then
              echo "FILE QUÁ LỚN ($FILE_SIZE bytes). Chỉ hiển thị 100 dòng đầu:"
              head -n 100 "${filePath}"
            else
              cat "${filePath}"
            fi
          else
            echo "Lỗi: File không tồn tại."
          fi
        `);
      
      case "list":
        return this.shell.execute(`ls -F "${filePath || "."}"`);
        
      case "mkdir":
        return this.shell.execute(`mkdir -p "${filePath}" && echo "Đã tạo thư mục: ${filePath}"`);
        
      case "delete":
        const confirm = await this.rl.question(`❓ Xóa "${filePath}"? (y/n): `);
        return confirm.toLowerCase() === 'y' ? this.shell.execute(`rm -rf "${filePath}" && echo "Đã xóa."`) : "Hủy xóa.";

      default:
        return "Hành động file không hợp lệ.";
    }
  }

  private async askLLM() {
    const res = await axios.post(
      this.LMS_URL,
      {
        model: Gemma34bConfig.modelName,
        messages: this.messages,
        temperature: 0.1,
        response_format: Gemma34bConfig.structureResponse,
      },
      { timeout: 240000 }
    );
    return res.data.choices[0].message.content || res.data.choices[0].message.reasoning_content || "";
  }

  private parseResponse(content: string) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      return null;
    }
  }

  private addStep(decision: any, result: string) {
    this.messages.push({ role: "assistant", content: JSON.stringify(decision) });
    this.messages.push({ role: "user", content: `Kết quả hệ thống: ${result}` });
    if (this.messages.length > 30) this.messages.splice(1, 2); 
  }
}