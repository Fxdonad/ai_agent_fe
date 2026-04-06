import axios from "axios";
import * as fs from "node:fs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DockerService } from "../core/docker.service.js";
import { BrowserService } from "../core/browser.service.js";
import { PromptManager } from "./prompt.manager.js";
import { Nemotron3Nano4bConfig } from "../model/nemotron-3-nano-4b.response.js";

export class AgentEngine {
  private messages: any[] = [];
  private docker = new DockerService("my-agent-sandbox");
  private browser = new BrowserService();
  private rl = readline.createInterface({ input, output });
  private readonly LMS_URL = "http://localhost:1234/v1/chat/completions";

  // --- CƠ CHẾ CHỐNG LẶP ---
  private actionHistory: string[] = []; // Lưu hash của thought + tool + params
  private readonly MAX_HISTORY = 5; // Theo dõi 5 hành động gần nhất
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
    this.messages.push({
      role: "system",
      content: PromptManager.loadConfigs(),
    });
  }

  private isDangerousCommand(cmd: string): boolean {
    const lowerCmd = cmd.toLowerCase();
    return this.DANGEROUS_KEYWORDS.some((keyword) =>
      lowerCmd.includes(keyword),
    );
  }

  async run() {
    console.log("🤖 Hệ thống Code Agent (Autonomous Mode) đã sẵn sàng.");
    const goal = await this.rl.question("👉 Yêu cầu của bạn: ");
    if (!goal) return;

    this.messages.push({ role: "user", content: goal });

    for (let i = 0; i < 50; i++) {
      try {
        const rawResponse = await this.askLLM();
        const decision = this.parseResponse(rawResponse);
        if (!decision) continue;

        // 1. KIỂM TRA LẶP
        const actionHash = JSON.stringify({
          t: decision.tool,
          p: decision.parameters,
        });
        if (this.detectLoop(actionHash)) {
          const warning =
            "⚠️ CẢNH BÁO HỆ THỐNG: Bạn đang lặp lại cùng một hành động mà không có kết quả mới. Vui lòng dừng lại, phân tích tại sao lệnh trước đó không đạt mục đích, và thử một cách tiếp cận khác hoặc: giải thích khó khăn gặp phải và đưa ra hướng cần trợ giúp từ human: sử dụng ask_human.";
          console.log(warning);
          this.messages.push({ role: "user", content: warning });
          continue;
        }

        console.log(`\n🤔 SUY NGHĨ: ${decision.thought}`);
        console.log(
          `\nQuyết định: ${decision.tool} - ${decision.parameters.command}`,
        );

        const result = await this.executeDecision(decision);

        if (decision.tool === "done") {
          console.log("✅ NHIỆM VỤ HOÀN THÀNH!");
          break;
        }

        this.addStep(decision, result);
      } catch (err: any) {
        console.error(`⚠️ Lỗi: ${err.message}`);
        this.addStep(
          { tool: "error", parameters: {} },
          `Lỗi hệ thống: ${err.message}`,
        );
      }
    }
  }

  /**
   * Thuật toán phát hiện lặp đơn giản
   */
  private detectLoop(currentHash: string): boolean {
    this.actionHistory.push(currentHash);
    if (this.actionHistory.length > this.MAX_HISTORY) {
      this.actionHistory.shift();
    }

    // Đếm số lần hành động hiện tại xuất hiện trong lịch sử gần đây
    const occurrences = this.actionHistory.filter(
      (h) => h === currentHash,
    ).length;
    return occurrences >= this.MAX_RETRY_SAME_ACTION;
  }

  private async executeDecision(decision: any): Promise<string> {
    const { tool, parameters } = decision;

    try {
      switch (tool) {
        case "execute_command":
          const cmd = parameters.command;
          console.log(`💻 EXEC: ${cmd}`);

          // CHẶN LỆNH NGUY HIỂM: Tự động chuyển sang ask_human nếu lệnh nhạy cảm
          if (this.isDangerousCommand(cmd)) {
            const warningMsg = `Lệnh này có thể gây nguy hiểm (${cmd}). Bạn có chắc chắn muốn thực thi không?`;
            console.log(
              `⚠️ PHÁT HIỆN LỆNH NHẠY CẢM: Chờ xác nhận từ người dùng...`,
            );

            // Tái cấu trúc lại decision để hỏi human
            const humanAnswer = await this.rl.question(
              `❓ AGENT CẦN XÁC NHẬN: Lệnh "${cmd}" được coi là nhạy cảm. Bạn cho phép chạy không? (y/n): `,
            );

            if (humanAnswer.toLowerCase() !== "y") {
              return "Thực thi bị hủy bởi người dùng vì lý do an toàn.";
            }
          }

          return this.docker.execute(cmd);

        case "file_operation":
          // Bổ sung kiểm tra cho action delete trong file_operation
          if (parameters.action === "delete") {
            const confirm = await this.rl.question(
              `❓ XÁC NHẬN: Bạn có chắc muốn xóa "${parameters.path}"? (y/n): `,
            );
            if (confirm.toLowerCase() !== "y") return "Hủy lệnh xóa.";
          }
          return this.handleFileOp(parameters);

        case "ask_human":
          const answer = await this.rl.question(
            `❓ AGENT HỎI: ${parameters.query}\n👉 Trả lời: `,
          );
          this.actionHistory = [];
          return answer;

        case "read_structure":
          return this.docker.execute(
            `find ${parameters.path || "."} -maxdepth 3 -not -path '*/.*' -not -path '*node_modules*'`,
          );

        case "debug_service":
          return this.handleDebug(parameters);

        case "web_search":
          return await this.browser.search(parameters.query);

        case "respond_to_user":
          console.log(`\n🤖 PHẢN HỒI: ${parameters.content}`);
          return "Người dùng đã nhận được thông tin.";

        default:
          return "Tool không hợp lệ.";
      }
    } catch (e: any) {
      return `Thực thi thất bại: ${e.message}`;
    }
  }

  private handleFileOp(p: any): string {
    const { action, path, content } = p;
    // Bọc các lệnh trong nháy kép để tránh lỗi path có dấu cách
    if (action === "write") {
      const base64 = Buffer.from(content || "").toString("base64");
      return this.docker.execute(
        `mkdir -p "$(dirname "${path}")" && echo "${base64}" | base64 --decode > "${path}" && echo "Ghi file thành công."`,
      );
    }
    if (action === "read")
      return this.docker.execute(
        `[ -f "${path}" ] && cat "${path}" || echo "Lỗi: File không tồn tại."`,
      );
    if (action === "delete")
      return this.docker.execute(`rm -rf "${path}" && echo "Đã xóa."`);
    if (action === "mkdir")
      return this.docker.execute(
        `mkdir -p "${path}" && echo "Đã tạo thư mục."`,
      );
    return this.docker.execute(`ls -F "${path}"`);
  }

  private handleDebug(p: any): string {
    if (p.type === "logs")
      return this.docker.execute(
        `tail -n ${p.lines || 50} server.log 2>/dev/null || echo "Chưa có log."`,
      );
    if (p.type === "network")
      return this.docker.execute(
        `ss -tuln || netstat -tuln || echo "Lỗi: Không tìm thấy công cụ mạng, hãy tự cài đặt tool còn thiếu hoặc yêu cầu human hỗ trợ."`,
      );
    return this.docker.execute(
      `ps aux | grep -E "node|npm|vite" | grep -v grep || echo "Không tìm thấy tiến trình."`,
    );
  }

  private async askLLM() {
    const res = await axios.post(
      this.LMS_URL,
      {
        model: Nemotron3Nano4bConfig.modelName,
        messages: this.messages,
        temperature: 0.1, // Thấp để đảm bảo tính nhất quán
        response_format: Nemotron3Nano4bConfig.structureResponse,
      },
      { timeout: 60000 },
    );

    const msg = res.data.choices[0].message;
    return msg.content || msg.reasoning_content || "";
  }

  private parseResponse(content: string) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log("⚠️ Lỗi phân giải JSON, đang yêu cầu AI format lại...");
      return null;
    }
  }

  private addStep(decision: any, result: string) {
    this.messages.push({
      role: "assistant",
      content: JSON.stringify(decision),
    });
    this.messages.push({
      role: "user",
      content: `Kết quả từ hệ thống: ${result}`,
    });

    // Giới hạn context để tránh quá tải token (Tùy chọn)
    if (this.messages.length > 40) {
      this.messages.splice(1, 2); // Xóa các cặp hội thoại cũ nhất (trừ System Prompt)
    }
  }
}
