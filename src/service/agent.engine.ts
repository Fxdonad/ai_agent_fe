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
        const errorMsg = `Lỗi hệ thống cuối cùng: ${err.message}`;
        this.logActivity("FATAL_ERROR", errorMsg);
        // Thêm thông báo cho AI biết lỗi để nó tự healing nếu có thể ở lượt sau
        this.addStep({ tool: "error", parameters: {} }, errorMsg);
      }
    }
  }

  private detectLoop(currentHash: string): boolean {
    this.actionHistory.push(currentHash);
    if (this.actionHistory.length > this.MAX_HISTORY) this.actionHistory.shift();
    return this.actionHistory.filter(h => h === currentHash).length >= this.MAX_RETRY_SAME_ACTION;
  }

  /**
   * Gọi LLM với cơ chế Exponential Backoff
   * Giúp xử lý các lỗi tạm thời như Socket Hang Up hoặc Timeout khi VM đang tải nặng
   */
  private async askLLM(retryCount = 0): Promise<string> {
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 4000, 8000, 16000]; // ms

    try {
      const res = await axios.post(
        this.LMS_URL,
        {
          model: Gemma34bConfig.modelName,
          messages: this.messages,
          temperature: 0.1,
          response_format: Gemma34bConfig.structureResponse,
        },
        { 
          timeout: 240000, // 4 phút cho các task suy luận phức tạp
          headers: { 'Connection': 'keep-alive' }
        }
      );

      const content = res.data.choices[0].message.content || res.data.choices[0].message.reasoning_content || "";
      if (!content) throw new Error("LLM trả về nội dung trống");
      
      return content;
    } catch (err: any) {
      const isNetworkError = err.code === 'ECONNRESET' || 
                             err.message.includes('socket hang up') || 
                             err.code === 'ETIMEDOUT' ||
                             err.response?.status === 502 ||
                             err.response?.status === 503;

      if (isNetworkError && retryCount < maxRetries) {
        const delay = retryDelays[retryCount];
        console.log(`⚠️ Lỗi kết nối (${err.message}). Thử lại lần ${retryCount + 1}/${maxRetries} sau ${delay}ms...`);
        this.logActivity("RETRY", { attempt: retryCount + 1, error: err.message });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.askLLM(retryCount + 1);
      }

      throw err;
    }
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

    // Ghi lại kết quả thực thi vào log hệ thống để kiểm soát
    this.logActivity("RESULT", result.substring(0, 1000) + (result.length > 1000 ? "..." : ""));
    return result;
  }

  private async handleFileOp(p: any): Promise<string> {
    const { action, path: filePath, content } = p;
    
    switch (action) {
      case "write":
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

  private parseResponse(content: string) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Lưu bước chạy vào bối cảnh (messages)
   * Tối ưu hóa log hệ thống để tránh làm tràn Context gây lỗi Socket
   */
  private addStep(decision: any, result: string) {
    // Tối ưu hóa: Nếu result từ các task thực thi (như npm install) quá dài
    // Chúng ta chỉ giữ lại phần đầu và phần cuối quan trọng nhất.
    const MAX_LOG_LENGTH = 4000;
    let optimizedResult = result;

    if (result.length > MAX_LOG_LENGTH) {
      optimizedResult = 
        result.substring(0, 1500) + 
        "\n\n... [HỆ THỐNG: Cắt bớt " + (result.length - 3000) + " ký tự log trung gian để tối ưu payload] ...\n\n" + 
        result.substring(result.length - 1500);
    }

    this.messages.push({ role: "assistant", content: JSON.stringify(decision) });
    this.messages.push({ role: "user", content: `Kết quả hệ thống: ${optimizedResult}` });
    
    // Giữ Context trong giới hạn an toàn (khoảng 15-20 lượt trao đổi gần nhất)
    if (this.messages.length > 40) {
      this.messages.splice(1, 2); 
    }
  }
}