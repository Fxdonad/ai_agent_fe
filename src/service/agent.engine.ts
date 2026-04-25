import * as fs from "node:fs";
import { execSync } from "node:child_process";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import env from "../environment.js";
import { BrowserService } from "../core/browser.service.js";
import { ShellService } from "../core/shell.service.js";
import { ActionExecutor } from "./agent-engine/actions/action.executor.js";
import { LlmBackend } from "./agent-engine/backend/llm.backend.js";
import { SafetySkill } from "./agent-engine/skill/safety.skill.js";
import { AgentStore } from "./agent-engine/store/agent.store.js";
import { PromptManager } from "./prompt.manager.js";

export class AgentEngine {
  private readonly shell = new ShellService();
  private readonly browser = new BrowserService();
  private readonly rl = readline.createInterface({ input, output });
  private readonly store = new AgentStore((type, data) => this.logActivity(type, data));

  private readonly hostIp = env.get("host_ip");
  private readonly port = env.get("host_port");
  private readonly lmsUrl = `http://${this.hostIp}:${this.port}/v1/chat/completions`;
  private readonly execLogPath = "./agent_execute.log";

  private readonly llm = new LlmBackend(
    this.lmsUrl,
    () => this.store.getMessages(),
    (type, data) => this.logActivity(type, data),
    (aggressive) => this.store.pruneContext(aggressive),
  );

  private readonly actionExecutor = new ActionExecutor({
    shell: this.shell,
    browser: this.browser,
    rl: this.rl,
    execLogPath: this.execLogPath,
    logActivity: (type, data) => this.logActivity(type, data),
    isDangerousCommand: (cmd) => SafetySkill.isDangerousCommand(cmd),
    resetActionHistory: () => this.store.resetActionHistory(),
  });

  constructor() {
    let realUser = "unknown";
    try {
      realUser = execSync("whoami").toString().trim();
    } catch {
      realUser = "error";
    }

    console.log("\n" + "=".repeat(50));
    console.log(`👤 ĐANG CHẠY DƯỚI USER: [ ${realUser} ]`);
    console.log(`📂 WORKING DIR: ${process.cwd()}`);
    console.log("=".repeat(50) + "\n");

    this.store.pushMessage("system", PromptManager.loadConfigs(), {
      mergeWithPrevious: false,
    });

    if (!fs.existsSync(this.execLogPath)) {
      fs.writeFileSync(
        this.execLogPath,
        `--- Session Start: ${new Date().toISOString()} ---\n`,
      );
    }
  }

  async run() {
    console.log("🤖 Hệ thống Code Agent (Native VM Mode) đã sẵn sàng.");
    let goal = (await this.rl.question("👉 Yêu cầu của bạn: ")).trim();
    if (!goal) return;

    while (goal) {
      this.store.pushMessage("user", goal, { mergeWithPrevious: false });
      this.logActivity("GOAL", goal);
      this.store.resetActionHistory();

      let taskCompleted = false;
      for (let i = 0; i < 100; i++) {
        try {
          process.stdout.write(`\r🤖 [Lượt ${i}] Đang gửi yêu cầu tới LLM... `);
          const rawResponse = await this.llm.askLLM();

          const decision = this.llm.parseResponse(rawResponse);
          if (!decision) {
            console.log(
              "\n⚠️ Cảnh báo: LLM trả về format không hợp lệ. Đang yêu cầu AI định dạng lại...",
            );
            this.store.pushMessage(
              "agent",
              "Lỗi định dạng: Bạn phải trả về JSON đúng schema. Hãy thử lại.",
              { mergeWithPrevious: false },
            );
            continue;
          }

          const actionHash = JSON.stringify({
            t: decision.tool,
            p: decision.parameters,
          });

          if (this.store.detectLoop(actionHash)) {
            const warning =
              "\n⚠️ HỆ THỐNG: Bạn đang lặp lại hành động. Hãy đổi cách tiếp cận hoặc dùng 'ask_human'.";
            this.store.pushMessage("agent", warning, { mergeWithPrevious: false });
            console.log(warning);
            continue;
          }

          console.log(`\n🤔 SUY NGHĨ [${i}]: ${decision.thought}`);
          this.logActivity("THOUGHT", decision.thought);

          process.stdout.write(`⚙️ Đang thực thi tool [${decision.tool}]... `);
          const result = await this.actionExecutor.executeDecision(decision);
          process.stdout.write("✅ Xong.\n");

          if (decision.tool === "done") {
            this.store.addStep(decision, result, { includeSystemResult: false });
            console.log("✅ NHIỆM VỤ HOÀN THÀNH!");
            taskCompleted = true;
            break;
          }

          this.store.addStep(decision, result);
        } catch (err: any) {
          console.log(`\n💥 Lỗi: ${err.message}`);
          const errorMsg = `Lỗi hệ thống: ${err.message}`;
          this.logActivity("FATAL_ERROR", errorMsg);

          if (err.response?.status === 400) {
            this.store.pruneContext(true);
          }

          this.store.addStep({ tool: "error", parameters: {} }, errorMsg);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!taskCompleted) {
        console.log(
          "⚠️ Đã đạt giới hạn 100 lượt cho nhiệm vụ hiện tại. Vui lòng nhập yêu cầu mới.",
        );
        this.store.pushMessage(
          "agent",
          "Nhiệm vụ tạm dừng vì đã đạt giới hạn 100 lượt.",
          { mergeWithPrevious: false },
        );
      }

      goal = (await this.rl.question("👉 Nhập yêu cầu tiếp theo (Enter để thoát): ")).trim();
    }
  }

  private logActivity(type: string, data: any) {
    const logEntry = `[${new Date().toLocaleTimeString()}] [${type}] ${
      typeof data === "string" ? data : JSON.stringify(data)
    }\n`;
    fs.appendFileSync(this.execLogPath, logEntry);
  }
}