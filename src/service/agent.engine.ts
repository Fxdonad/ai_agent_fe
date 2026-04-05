import axios from "axios";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DockerService } from "../core/docker.service.js";
import { BrowserService } from "../core/browser.service.js";
import { PromptManager } from "./prompt.manager.js";
import * as fs from "node:fs";
import { Nemotron3Nano4bConfig } from "../model/nemotron-3-nano-4b.response.js";

export class AgentEngine {
  private messages: any[] = [];
  private docker = new DockerService("my-agent-sandbox");
  private browser = new BrowserService();
  private rl = readline.createInterface({ input, output });

  private readonly LMS_URL = "http://localhost:1234/v1/chat/completions";
  private isFullyAutomated = false;

  constructor() {
    this.messages.push({
      role: "system",
      content: PromptManager.loadConfigs(),
    });
  }

  /**
   * Orchestrator chính của Agent
   */
  async run() {
    console.log("🤖 Hệ thống Code Agent đã sẵn sàng.");

    const goal = await this.rl.question(
      "👉 Nhập yêu cầu của bạn (ví dụ: Tạo Landing Page...): ",
    );
    if (!this.validateGoal(goal)) return;

    this.messages.push({ role: "user", content: goal });
    console.log("\n🚀 Agent đang phân tích và khởi động...");

    for (let i = 0; i < 30; i++) {
      try {
        const response = await this.askLLM();

        console.log(`\n📨 Phản hồi từ LLM:\n${response}`);
        const decision = this.parseResponse(response);
        if (!decision) continue;

        console.log(`\n🤔 SUY NGHĨ: ${decision.thought}`);

        const shouldContinue = await this.executeDecision(decision);
        if (!shouldContinue) break;
      } catch (err: any) {
        await this.handleCriticalError(err);
      }
    }
    this.rl.close();
  }

  /**
   * Điều hướng thực thi dựa trên Tool Call
   */
  private async executeDecision(decision: any): Promise<boolean> {
    switch (decision.tool) {
      case "execute_command":
        await this.handleDocker(decision);
        return true;
      case "web_search":
        await this.handleSearch(decision);
        return true;
      case "ask_human":
        await this.handleHumanIntervention(decision);
        return true;
      case "respond_to_user":
        await this.handleRespondToUser(decision);
        return true;
      case "read_structure":
        await this.handleReadStructure(decision);
        return true;
      case "file_operation":
        await this.handleFileOperation(decision);
        return true;
      case "debug_service":
        await this.handleDebugService(decision);
        return true;
      case "done":
        console.log("✅ NHIỆM VỤ HOÀN THÀNH!");
        return false;
      default:
        return true;
    }
  }

  /**
   * Skill: Đọc cấu trúc thư mục (Tree view)
   */
  private async handleReadStructure(decision: any) {
    const path = decision.parameters.path || ".";
    console.log(`📂 LIST STRUCTURE: ${path}`);
    try {
      // Sử dụng lệnh find để lấy cấu trúc phân cấp (loại trừ node_modules)
      const cmd = `find ${path} -maxdepth 3 -not -path '*/.*' -not -path '*node_modules*'`;
      const stdout = this.docker.execute(cmd);
      this.addStep(decision, `Cấu trúc thư mục hiện tại:\n${stdout}`);
    } catch (e: any) {
      this.addStep(decision, `Lỗi đọc cấu trúc: ${e.message}`);
    }
  }

  /**
   * Skill: CRUD File/Folder
   */
  private async handleFileOperation(decision: any) {
    // 1. Chống lỗi 'undefined' - Fallback về chuỗi trống hoặc báo lỗi ngay
    const action = decision.parameters?.action;
    const filePath = decision.parameters?.path || decision.parameters?.filepath; // Support cả 2 cách đặt tên của AI
    const content = decision.parameters?.content || "";

    if (!action || !filePath) {
      const errorMsg = `Lỗi: Thiếu tham số 'action' hoặc 'path'. Bạn đã gửi: ${JSON.stringify(decision.parameters)}`;
      console.error(`❌ ${errorMsg}`);
      this.addStep(decision, errorMsg);
      return;
    }

    console.log(`🛠 FILE OP: ${action} on ${filePath}`);

    try {
      let result = "";
      switch (action) {
        case "read":
          // Kiểm tra file tồn tại trước khi cat để tránh lỗi stderr làm treo AI
          result = this.docker.execute(
            `[ -f "${filePath}" ] && cat "${filePath}" || echo "Lỗi: File không tồn tại."`,
          );
          break;

        case "write":
          // Tự động tạo thư mục cha
          const dir = filePath.includes("/")
            ? filePath.substring(0, filePath.lastIndexOf("/"))
            : "";
          const mkdirCmd = dir ? `mkdir -p "${dir}" && ` : "";

          // Dùng Here-doc (EOF) kết hợp Base64 để truyền tải nội dung cực lớn/phức tạp
          const base64Content = Buffer.from(content).toString("base64");
          const writeCmd = `${mkdirCmd} base64 --decode << 'EOF' > "${filePath}"\n${base64Content}\nEOF`;

          this.docker.execute(writeCmd);
          result = `Đã ghi thành công ${Buffer.byteLength(content)} bytes vào ${filePath}`;
          break;

        case "delete":
          this.docker.execute(`rm -rf "${filePath}"`);
          result = `Đã xóa ${filePath}`;
          break;

        case "mkdir":
          this.docker.execute(`mkdir -p "${filePath}"`);
          result = `Đã tạo thư mục ${filePath}`;
          break;

        case "list":
          result = this.docker.execute(
            `ls -F "${filePath}" 2>&1 || echo "Thư mục trống hoặc không tồn tại."`,
          );
          break;

        default:
          result = `Hành động '${action}' không được hỗ trợ.`;
      }
      this.addStep(decision, `Kết quả: ${result}`);
    } catch (e: any) {
      // Log lỗi chi tiết ra console của bạn để debug nhưng gửi gợi ý ngắn gọn cho AI
      console.error(`❌ File Op Error: ${e.message}`);
      const cleanError = e.stderr || e.message;
      this.addStep(decision, `Lỗi thao tác file (${action}): ${cleanError}`);
    }
  }

  /**
   * Logic cụ thể cho từng Tool (Giữ nguyên logic gốc)
   */
  private async handleRespondToUser(decision: any) {
    console.log(`\n🤖 AGENT PHẢN HỒI: ${decision.parameters.content}`);
    const nextGoal = await this.rl.question(
      "\n👉 Nhập phản hồi hoặc yêu cầu tiếp theo của bạn: ",
    );

    const feedback =
      !nextGoal || nextGoal.trim() === ""
        ? "Người dùng đã xem phản hồi."
        : `Người dùng phản hồi: ${nextGoal}`;

    this.addStep(decision, feedback);
    // Lưu ý: addStep thứ 2 giữ nguyên theo code cũ của bạn
    this.messages.push({
      role: "user",
      content: "Đã gửi phản hồi cho người dùng.",
    });
  }

  private async handleDocker(decision: any) {
    const cmd = decision.parameters.command;
    let finalCmd = cmd;
    const timestamp = new Date().toISOString();

    try {
      console.log(`💻 EXEC: ${cmd}`);
      // Ghi cả lệnh vào log file trên máy host
      fs.appendFileSync("agent_execution.log", `[${timestamp}] EXEC: ${cmd}\n`);

      const isServerCommand =
        (cmd.includes("npm run dev") || cmd.includes("vite")) &&
        !cmd.includes("create-vite") && // Loại trừ lệnh khởi tạo
        !cmd.includes("npm install"); // Loại trừ cài đặt

      if (isServerCommand) {
        console.log(
          "⚠️ Phát hiện lệnh chạy Server, đang chuyển sang Background...",
        );
        finalCmd = `${cmd} > server.log 2>&1 & echo "SUCCESS: Server is running in background. Check logs at server.log"`;
      } else {
        // Các lệnh bình thường (install, create, ls, mkdir) PHẢI chạy đồng bộ để lấy kết quả
        finalCmd = `(${cmd}) && echo "EXECUTION_COMPLETED"`;
      }

      const stdout = this.docker.execute(finalCmd);
      const cleanStdout = stdout.trim();

      // Nếu không có output, trả về thông báo xác nhận dựa trên exit code
      const finalResponse =
        cleanStdout || "Lệnh đã thực thi thành công (không có output).";

      console.log(`✅ Kết quả:`, finalResponse);
      this.addStep(decision, `Kết quả hệ thống:\n${finalResponse}`);

      // Ghi cả kết quả thành công vào log để sau này dễ audit
      fs.appendFileSync(
        "agent_execution.log",
        `[${timestamp}] STDOUT: ${stdout || "Success"}\n---\n`,
      );

      console.log(`✅ Kết quả:`, stdout || "Đã thực thi (Background)");
      this.addStep(
        decision,
        `Thành công:\n${stdout || "Lệnh đang chạy ngầm."}`,
      );
    } catch (e: any) {
      const errorMsg = e.stderr?.toString() || e.message;
      // Ghi lỗi vào log
      fs.appendFileSync(
        "agent_execution.log",
        `[${timestamp}] ERROR: ${errorMsg}\n---\n`,
      );
      await this.handleDockerError(e, decision);
    }
  }

  /**
   * Tách riêng logic xử lý lỗi Docker (Self-healing & Automation)
   */
  private async handleDockerError(e: any, decision: any) {
    const errorMsg = e.stderr || e.message;
    console.log("❌ Lỗi thực thi.");

    // 1. Auto-Hint cho lỗi thiếu thư mục
    if (errorMsg.includes("No such file or directory")) {
      const hint =
        "\nMẹo: Có vẻ thư mục cha chưa tồn tại. Hãy dùng 'mkdir -p' để tạo thư mục trước khi tạo file.";
      this.addStep(decision, `Lỗi: ${errorMsg}.${hint}`);
      console.log("💡 Đã gửi gợi ý tự sửa lỗi cho Agent.");
      return;
    }

    // 2. Tái tạo workspace nếu bị xóa nhầm
    if (e.message.includes("ENOENT") || e.message.includes("no such file")) {
      console.log("🛠 Phát hiện mất thư mục làm việc, đang tái tạo...");
      this.docker.execute("mkdir -p /home/agent/app");
    }

    // 3. Xử lý Automation
    if (this.isFullyAutomated) {
      console.log("🤖 Chế độ tự động: Đang chuyển lỗi cho AI tự xử lý...");
      const recoveryHint =
        "Lưu ý: Nếu thư mục làm việc bị xóa, hãy chạy 'mkdir -p /home/agent/app' trước khi làm việc khác.";
      this.addStep(decision, `Lỗi:\n${errorMsg}. ${recoveryHint}`);
      return;
    }

    // 4. Hỏi ý kiến con người
    const manualFix = await this.rl.question(
      "Nhập kết quả sửa lỗi, nhấn (a) để tự động hoàn toàn, hoặc Enter để AI tự sửa: ",
    );
    if (manualFix.toLowerCase() === "a") {
      this.isFullyAutomated = true;
      this.addStep(
        decision,
        `Lỗi:\n${errorMsg}. Từ giờ hãy tự sửa lỗi, không cần hỏi tôi.`,
      );
    } else if (manualFix) {
      this.addStep(decision, `Người dùng can thiệp sửa: ${manualFix}`);
    } else {
      this.addStep(decision, `Lỗi:\n${errorMsg}. Hãy tự sửa lỗi này.`);
    }
  }

  private async askLLM() {
    const res = await axios.post(
      this.LMS_URL,
      {
        model: Nemotron3Nano4bConfig.modelName,
        messages: this.messages,
        temperature: 0.1,
        response_format: Nemotron3Nano4bConfig.structureResponse,
      },
      { timeout: 120000 },
    );

    const message = res.data.choices[0].message;
    console.log(`\n📊 Thông tin phản hồi từ LLM:`, message);

    // CHUẨN HÓA TẠI ĐÂY: Ưu tiên lấy content, nếu trống thì lấy reasoning_content
    // Một số model đẩy JSON vào content, số khác (như Nemotron/DeepSeek) đẩy vào reasoning_content
    const rawContent = message.content || message.reasoning_content || "";

    return rawContent;
  }

  private async handleDebugService(decision: any) {
    const type = decision.parameters?.type || "logs";
    const lines = decision.parameters?.lines || 50;
    console.log(`🔍 DEBUGGING: ${type}`);

    try {
      let result = "";
      switch (type) {
        case "logs":
          result = this.docker.execute(
            `tail -n ${lines} server.log 2>/dev/null || echo "Chưa có file log nào được tạo."`,
          );
          break;
        case "process":
          // Thêm "|| echo" để tránh throw error khi grep không thấy tiến trình
          result = this.docker.execute(
            `ps aux | grep -E "node|vite|npm" | grep -v grep || echo "Không có tiến trình liên quan đang chạy."`,
          );
          break;
        case "network":
          // Tuyệt chiêu: Nếu không có netstat/ss, ta đọc trực tiếp file hệ thống nhưng format lại cho AI dễ hiểu
          // Port 5173 (Hex: 1435), Port 5000 (Hex: 1388)
          const checkPorts = `grep -E "1435|1388" /proc/net/tcp`;
          result = this.docker.execute(
            `${checkPorts} && echo "Phát hiện port đang Listen (mã Hex)." || netstat -tuln || ss -tuln || echo "Không tìm thấy port 5173/5000 đang mở."`,
          );
          break;
      }
      this.addStep(decision, `Kết quả Debug (${type}):\n${result}`);
    } catch (e: any) {
      // Đảm bảo addStep vẫn ghi nhận dù có lỗi crash thực sự
      this.addStep(decision, `Lỗi hệ thống khi debug: ${e.message}`);
    }
  }

  private async handleCriticalError(err: any) {
    console.log(`\n⚠️ HỆ THỐNG GẶP LỖI: ${err.message}`);
    if (this.isFullyAutomated) {
      this.messages.push({
        role: "user",
        content: `Lỗi hệ thống: ${err.message}. Hãy thử lại.`,
      });
      return;
    }

    const choice = await this.rl.question(
      "Bạn muốn (s)ửa thủ công, (a)utomatic luôn từ giờ, hay (d)ừng? (s/a/d): ",
    );
    if (choice.toLowerCase() === "a") {
      this.isFullyAutomated = true;
      this.messages.push({
        role: "user",
        content: "Lỗi hệ thống đã xảy ra. Từ giờ hãy tự quyết định cách sửa.",
      });
    } else if (choice.toLowerCase() === "s") {
      const input = await this.rl.question("Nhập chỉ dẫn cho Agent: ");
      this.messages.push({ role: "user", content: `Chỉ dẫn: ${input}` });
    } else if (choice.toLowerCase() === "d") {
      process.exit(0);
    }
  }

  private parseResponse(content: string) {
    if (!content) return null;

    try {
      // Tìm khối JSON đầu tiên xuất hiện trong chuỗi
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Nếu không có ngoặc nhọn, có thể AI trả về text thuần, ta bọc nó lại thành tool respond_to_user
        return {
          thought: "AI returned plain text, wrapping it.",
          tool: "respond_to_user",
          parameters: { content: content.trim() },
        };
      }

      let jsonStr = jsonMatch[0];
      // Làm sạch rác Markdown nếu có
      jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "");

      return JSON.parse(jsonStr);
    } catch (err: any) {
      console.log(
        `⚠️ Lỗi Parser (${err.message}). AI trả về: ${content.substring(0, 100)}...`,
      );

      // Đẩy thông báo lỗi chi tiết cho AI để nó tự sửa format
      this.messages.push({
        role: "user",
        content: `Lỗi định dạng JSON: ${err.message}. Hãy chắc chắn bạn KHÔNG viết văn bản thừa bên ngoài khối JSON và các chuỗi string phải được escape đúng cách.`,
      });
      return null;
    }
  }

  private async handleHumanIntervention(decision: any) {
    console.log(
      `\n❓ AGENT ĐANG HỎI: ${decision.parameters.query || "Cần ý kiến của bạn"}`,
    );
    const answer = await this.rl.question("👉 Trả lời của bạn: ");
    this.addStep(decision, `Người dùng phản hồi: ${answer}`);
  }

  private async handleSearch(decision: any) {
    console.log(`🌐 SEARCH: ${decision.parameters.query}`);
    const res = await this.browser.search(decision.parameters.query);
    this.addStep(decision, `Kết quả tìm kiếm:\n${res}`);
  }

  private addStep(decision: any, result: string) {
    this.messages.push({
      role: "assistant",
      content: JSON.stringify(decision),
    });
    this.messages.push({ role: "user", content: result });
  }

  private validateGoal(goal: string): boolean {
    if (!goal || goal.trim() === "") {
      console.log("❌ Yêu cầu không được để trống. Vui lòng chạy lại.");
      this.rl.close();
      return false;
    }
    return true;
  }
}
