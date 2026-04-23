import axios from "axios";
import * as fs from "node:fs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ShellService } from "../core/shell.service.js";
import { BrowserService } from "../core/browser.service.js";
import { PromptManager } from "./prompt.manager.js";
import { Gemma34bConfig } from "../model/gemma-3-4b.response.js";
import { execSync } from "node:child_process";
import env from "../environment.js";

export class AgentEngine {
  private messages: any[] = [];
  private shell = new ShellService();
  private browser = new BrowserService();
  private rl = readline.createInterface({ input, output });

  private hostIp = env.get("host_ip");
  private port = env.get("host_port");
  private readonly LMS_URL = `http://${this.hostIp}:${this.port}/v1/chat/completions`;

  private readonly EXEC_LOG_PATH = "./agent_execute.log";

  private actionHistory: string[] = [];
  private readonly MAX_HISTORY = 5;
  private readonly MAX_RETRY_SAME_ACTION = 3;
  private readonly DANGEROUS_KEYWORDS = [
    "sudo",
    "rm -rf /",
    "chmod 777",
    "chown",
    "mkfs",
    "dd if=",
  ];

  constructor() {
    // 1. KIỂM TRA ĐỊNH DANH NGHIÊM NGẶT
    let realUser = "unknown";
    try {
      realUser = execSync('whoami').toString().trim();
    } catch (e) {
      realUser = "error";
    }

    console.log("\n" + "=".repeat(50));
    console.log(`👤 ĐANG CHẠY DƯỚI USER: [ ${realUser} ]`);
    console.log(`📂 WORKING DIR: ${process.cwd()}`);
    console.log("=".repeat(50) + "\n");

    this.messages.push({
      role: "system",
      content: PromptManager.loadConfigs(),
    });

    if (!fs.existsSync(this.EXEC_LOG_PATH)) {
      fs.writeFileSync(
        this.EXEC_LOG_PATH,
        `--- Session Start: ${new Date().toISOString()} ---\n`,
      );
    }
  }

  private logActivity(type: string, data: any) {
    const logEntry = `[${new Date().toLocaleTimeString()}] [${type}] ${typeof data === "string" ? data : JSON.stringify(data)}\n`;
    fs.appendFileSync(this.EXEC_LOG_PATH, logEntry);
  }

  private isDangerousCommand(cmd: string): boolean {
    const lowerCmd = cmd.toLowerCase();
    return this.DANGEROUS_KEYWORDS.some((keyword) =>
      lowerCmd.includes(keyword),
    );
  }

  async run() {
    console.log("🤖 Hệ thống Code Agent (Native VM Mode) đã sẵn sàng.");
    const goal = await this.rl.question("👉 Yêu cầu của bạn: ");
    if (!goal) return;

    this.messages.push({ role: "user", content: goal });
    this.logActivity("GOAL", goal);

    for (let i = 0; i < 100; i++) { // Tăng lên tối đa 100 lượt
      try {
        process.stdout.write(`\r🤖 [Lượt ${i}] Đang gửi yêu cầu tới LLM... `);
        const rawResponse = await this.askLLM();

        const decision = this.parseResponse(rawResponse);
        if (!decision) {
          console.log(
            "\n⚠️ Cảnh báo: LLM trả về format không hợp lệ. Đang yêu cầu AI định dạng lại...",
          );
          this.messages.push({
            role: "user",
            content: "Lỗi: Bạn phải trả về JSON đúng schema. Hãy thử lại.",
          });
          continue;
        }

        const actionHash = JSON.stringify({
          t: decision.tool,
          p: decision.parameters,
        });
        if (this.detectLoop(actionHash)) {
          const warning =
            "\n⚠️ HỆ THỐNG: Bạn đang lặp lại hành động. Hãy đổi cách tiếp cận hoặc dùng 'ask_human'.";
          this.messages.push({ role: "user", content: warning });
          console.log(warning);
          continue;
        }

        console.log(`\n🤔 SUY NGHĨ [${i}]: ${decision.thought}`);
        this.logActivity("THOUGHT", decision.thought);

        process.stdout.write(`⚙️ Đang thực thi tool [${decision.tool}]... `);
        const result = await this.executeDecision(decision);
        process.stdout.write(`✅ Xong.\n`);

        if (decision.tool === "done") {
          console.log("✅ NHIỆM VỤ HOÀN THÀNH!");
          break;
        }

        this.addStep(decision, result);
      } catch (err: any) {
        console.log(`\n💥 Lỗi: ${err.message}`);
        const errorMsg = `Lỗi hệ thống: ${err.message}`;
        this.logActivity("FATAL_ERROR", errorMsg);
        
        // Nếu là lỗi 400, thử cắt bớt context rồi mới addStep
        if (err.response?.status === 400) {
           this.pruneContext(true);
        }

        this.addStep({ tool: "error", parameters: {} }, errorMsg);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  private detectLoop(currentHash: string): boolean {
    this.actionHistory.push(currentHash);
    if (this.actionHistory.length > this.MAX_HISTORY)
      this.actionHistory.shift();
    return (
      this.actionHistory.filter((h) => h === currentHash).length >=
      this.MAX_RETRY_SAME_ACTION
    );
  }

  private async askLLM(retryCount = 0): Promise<string> {
    const maxRetries = 5;
    const retryDelays = [2000, 4000, 8000, 16000, 32000];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); 

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
          timeout: 300000,
          signal: controller.signal,
          headers: { Connection: "keep-alive" },
        },
      );

      clearTimeout(timeoutId);
      const content =
        res.data.choices[0].message.content ||
        res.data.choices[0].message.reasoning_content ||
        "";
      if (!content) throw new Error("LLM trả về nội dung trống");

      return content;
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      // Xử lý tràn ngữ cảnh (HTTP 400)
      if (err.response?.status === 400 && retryCount < maxRetries) {
        this.logActivity("CONTEXT_LIMIT", "Phát hiện đầy bộ nhớ, đang cắt tỉa...");
        this.pruneContext(true);
        return this.askLLM(retryCount + 1);
      }

      const isNetworkError =
        err.code === "ECONNRESET" ||
        err.message.includes("socket hang up") ||
        err.name === "AbortError" ||
        err.code === "ETIMEDOUT";

      if (isNetworkError && retryCount < maxRetries) {
        const delay = retryDelays[retryCount];
        console.log(
          `\n📡 Lỗi kết nối (${err.message}). Thử lại ${retryCount + 1}/${maxRetries} sau ${delay}ms...`,
        );
        this.logActivity("RETRY", { attempt: retryCount + 1, error: err.message });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.askLLM(retryCount + 1);
      }

      throw err;
    }
  }

  private async executeDecision(decision: any): Promise<string> {
    const { tool, parameters } = decision;
    let result = "";

    this.logActivity("TOOL_USE", tool);

    try {
      switch (tool) {
        case "execute_command":
          if (this.isDangerousCommand(parameters.command)) {
            const confirm = await this.rl.question(
              `\n⚠️ LỆNH NGUY HIỂM: "${parameters.command}". Chạy không? (y/n): `,
            );
            if (confirm.toLowerCase() !== "y")
              return "Bị từ chối bởi người dùng.";
          }
          result = await this.shell.execute(parameters.command);
          break;

        case "file_operation":
          result = await this.handleFileOp(parameters);
          break;

        case "read_structure":
          const targetPath = parameters.path || ".";
          const findCmd = `find ${targetPath} -maxdepth 3 -not -path '*/.*' -not -path '*node_modules*' -not -path '*dist*'`;
          result = await this.shell.execute(findCmd);
          break;

        case "search_grep":
        case "search_code":
          const query = parameters.query;
          const searchPath = parameters.path || ".";
          const grepCmd = `grep -rnI "${query}" ${searchPath} --exclude-dir={.git,node_modules,dist,build} | head -n 50`;
          result = await this.shell.execute(grepCmd);
          if (!result.trim()) result = `Không tìm thấy kết quả cho từ khóa: "${query}"`;
          break;

        case "ask_human":
          console.log("\n--- CHỜ PHẢN HỒI ---");
          result = await this.rl.question(`❓ AGENT HỎI: ${parameters.query}\n👉 Trả lời: `);
          this.actionHistory = []; 
          break;

        case "web_search":
          result = await this.browser.search(parameters.query);
          break;

        case "debug_service":
          const { type, lines = 20 } = parameters;
          if (type === "logs")
            result = await this.shell.execute(`tail -n ${lines} ${this.EXEC_LOG_PATH}`);
          else if (type === "process")
            result = await this.shell.execute(`ps aux | head -n ${lines}`);
          else if (type === "network")
            result = await this.shell.execute(`netstat -tunlp`);
          break;

        default:
          result = `Lỗi: Tool "${tool}" không tồn tại.`;
      }
    } catch (e: any) {
      result = `Lỗi thực thi tool: ${e.message}`;
    }

    this.logActivity("RESULT", result.substring(0, 500) + (result.length > 500 ? "..." : ""));
    const pwd = await this.shell.execute("pwd");
    return `[Vị trí: ${pwd.trim()}]\n${result}`;
  }

  private async handleFileOp(p: any): Promise<string> {
    const { action, path: filePath, content } = p;

    switch (action) {
      case "write":
        const base64 = Buffer.from(content || "").toString("base64");
        return this.shell.execute(
          `mkdir -p "$(dirname "${filePath}")" && echo "${base64}" | base64 --decode > "${filePath}" && echo "Ghi file thành công."`,
        );

      case "read":
        return this.shell.execute(
          `if [ -f "${filePath}" ]; then FILE_SIZE=$(stat -c%s "${filePath}"); if [ "$FILE_SIZE" -gt 51200 ]; then echo "FILE QUÁ LỚN. 100 dòng đầu:"; head -n 100 "${filePath}"; else cat "${filePath}"; fi; else echo "Lỗi: File không tồn tại."; fi`,
        );

      case "list":
        return this.shell.execute(`ls -F "${filePath || "."}"`);

      case "mkdir":
        return this.shell.execute(`mkdir -p "${filePath}" && echo "Đã tạo thư mục: ${filePath}"`);

      case "delete":
        const confirm = await this.rl.question(`\n❓ Xóa "${filePath}"? (y/n): `);
        return confirm.toLowerCase() === "y"
          ? this.shell.execute(`rm -rf "${filePath}"`)
          : "Hủy xóa.";

      default:
        return "Hành động file không hợp lệ.";
    }
  }

  private parseResponse(content: string) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return null;
    }
  }

  private pruneContext(aggressive = false) {
    if (this.messages.length > (aggressive ? 10 : 35)) {
      const count = aggressive ? 10 : 2;
      this.messages.splice(1, count); // Giữ tin nhắn System ở index 0
      this.logActivity("PRUNE", `Đã xóa ${count} tin nhắn cũ.`);
    }
  }

  private addStep(decision: any, result: string) {
    const MAX_LOG_LENGTH = 4000;
    let optimizedResult = result;

    if (result.length > MAX_LOG_LENGTH) {
      optimizedResult =
        result.substring(0, 1500) +
        "\n\n... [HỆ THỐNG: Cắt bớt log để tránh đầy bộ nhớ] ...\n\n" +
        result.substring(result.length - 1500);
    }

    this.messages.push({
      role: "assistant",
      content: JSON.stringify(decision),
    });
    this.messages.push({
      role: "user",
      content: `Kết quả hệ thống: ${optimizedResult}`,
    });

    this.pruneContext(false);
  }
}