import * as readline from "node:readline/promises";
import { BrowserService } from "../../../core/browser.service.js";
import { ShellService } from "../../../core/shell.service.js";
import type { AgentDecision } from "../types.js";

interface ActionExecutorDeps {
  shell: ShellService;
  browser: BrowserService;
  rl: readline.Interface;
  execLogPath: string;
  logActivity: (type: string, data: any) => void;
  isDangerousCommand: (cmd: unknown) => boolean;
  resetActionHistory: () => void;
}

export class ActionExecutor {
  constructor(private readonly deps: ActionExecutorDeps) {}

  async executeDecision(decision: AgentDecision): Promise<string> {
    const { tool } = decision;
    const parameters = decision?.parameters ?? {};
    let result = "";

    this.deps.logActivity("TOOL_USE", tool);

    try {
      switch (tool) {
        case "respond_to_user":
          result =
            parameters.content ||
            parameters.message ||
            "Lỗi: respond_to_user thiếu parameters.content hoặc parameters.message";
          console.log(`\n💬 AGENT: ${result}`);
          break;

        case "done":
          result = parameters.summary || "Hoàn tất theo xác nhận của agent.";
          break;

        case "execute_command":
          result = await this.handleExecuteCommand(parameters);
          break;

        case "file_operation":
          result = await this.handleFileOp(parameters);
          break;

        case "read_structure": {
          const targetPath = parameters.path || ".";
          const findCmd = `find ${targetPath} -maxdepth 3 -not -path '*/.*' -not -path '*node_modules*' -not -path '*dist*'`;
          result = await this.deps.shell.execute(findCmd);
          break;
        }

        case "search_grep":
        case "search_code": {
          const query = (parameters.query || "").replace(/"/g, '\\"');
          const searchPath = parameters.path || ".";
          const grepCmd = `grep -rnI "${query}" ${searchPath} --exclude-dir={.git,node_modules,dist,build} | head -n 50`;
          result = await this.deps.shell.execute(grepCmd);
          if (!result.trim()) result = `Không tìm thấy kết quả cho từ khóa: "${query}"`;
          break;
        }

        case "ask_human":
          console.log("\n--- CHỜ PHẢN HỒI ---");
          result = await this.deps.rl.question(
            `❓ AGENT HỎI: ${parameters.query}\n👉 Trả lời: `,
          );
          this.deps.resetActionHistory();
          break;

        case "web_search":
          result = await this.deps.browser.search(parameters.query);
          break;

        case "debug_service": {
          const { type, lines = 20 } = parameters;
          if (type === "logs") {
            result = await this.deps.shell.execute(
              `tail -n ${lines} ${this.deps.execLogPath}`,
            );
          } else if (type === "process") {
            result = await this.deps.shell.execute(`ps aux | head -n ${lines}`);
          } else if (type === "network") {
            result = await this.deps.shell.execute(`netstat -tunlp`);
          }
          break;
        }

        default:
          result = `Lỗi: Tool "${tool}" không tồn tại.`;
      }
    } catch (e: any) {
      result = `Lỗi thực thi tool: ${e.message}`;
    }

    this.deps.logActivity(
      "RESULT",
      result.substring(0, 500) + (result.length > 500 ? "..." : ""),
    );
    const pwd = await this.deps.shell.execute("pwd");
    return `[Vị trí: ${pwd.trim()}]\n${result}`;
  }

  private async handleExecuteCommand(parameters: Record<string, any>) {
    if (typeof parameters.command !== "string" || !parameters.command.trim()) {
      return 'Lỗi: Thiếu "parameters.command" hợp lệ cho tool execute_command.';
    }

    if (this.deps.isDangerousCommand(parameters.command)) {
      const confirm = await this.deps.rl.question(
        `\n⚠️ LỆNH NGUY HIỂM: "${parameters.command}". Chạy không? (y/n): `,
      );
      if (confirm.toLowerCase() !== "y") {
        return "Bị từ chối bởi người dùng.";
      }
    }

    if (parameters.mode === "background") {
      const backgroundResult = await this.deps.shell.executeBackground(
        parameters.command,
        parameters.log_file || "agent_background.log",
      );
      const pidMatch = backgroundResult.match(/pid=(\d+)/);
      const shouldRunHealthCheck =
        parameters.health_check === true ||
        typeof parameters.ready_pattern === "string" ||
        typeof parameters.health_url === "string" ||
        typeof parameters.health_port === "number";

      if (!shouldRunHealthCheck || !pidMatch) {
        return backgroundResult;
      }

      const healthResult = await this.deps.shell.waitForBackgroundHealthy(
        pidMatch[1],
        {
          logFile: parameters.log_file || "agent_background.log",
          timeoutMs:
            typeof parameters.health_timeout_ms === "number"
              ? parameters.health_timeout_ms
              : 120000,
          intervalMs:
            typeof parameters.health_interval_ms === "number"
              ? parameters.health_interval_ms
              : 2500,
          readyPattern:
            typeof parameters.ready_pattern === "string"
              ? parameters.ready_pattern
              : undefined,
          healthUrl:
            typeof parameters.health_url === "string"
              ? parameters.health_url
              : undefined,
          healthPort:
            typeof parameters.health_port === "number"
              ? parameters.health_port
              : undefined,
        },
      );

      const shouldAutoCleanup = parameters.auto_cleanup_on_unhealthy !== false;
      let cleanupLine = "AUTO_CLEANUP=skipped";
      if (
        shouldAutoCleanup &&
        (healthResult.status === "timeout" || healthResult.status === "unhealthy")
      ) {
        const cleanupResult = await this.deps.shell.stopBackgroundProcess(pidMatch[1]);
        cleanupLine = [
          "AUTO_CLEANUP=executed",
          `CLEANUP_STATUS=${cleanupResult.status}`,
          `CLEANUP_MESSAGE=${cleanupResult.message}`,
        ].join(" ");
      }

      return [
        backgroundResult,
        `HEALTH_STATUS=${healthResult.status}`,
        `HEALTH_REASON=${healthResult.reason}`,
        `HEALTH_ELAPSED_MS=${healthResult.elapsedMs}`,
        `HEALTH_CHECKS=${healthResult.checks.join(",") || "none"}`,
        `HEALTH_LOG_TAIL=${healthResult.recentLog || "Không có log."}`,
        cleanupLine,
      ].join("\n");
    }

    const timeoutMs =
      typeof parameters.timeout_ms === "number" ? parameters.timeout_ms : 300000;
    const commandResult = await this.deps.shell.executeWithMeta(
      parameters.command,
      timeoutMs,
    );

    const hasOutput = Boolean(commandResult.output?.trim());
    const shouldVerify =
      commandResult.status === "success" &&
      (!hasOutput || parameters.always_verify === true) &&
      typeof parameters.verify_command === "string" &&
      parameters.verify_command.trim().length > 0;

    if (!shouldVerify) {
      return [
        `COMMAND_STATUS=${commandResult.status}`,
        `EXIT_CODE=${commandResult.exitCode}`,
        `DURATION_MS=${commandResult.durationMs}`,
        `OUTPUT=${commandResult.output || "Không có output."}`,
      ].join("\n");
    }

    const verifyResult = await this.deps.shell.executeWithMeta(
      parameters.verify_command,
      Math.min(timeoutMs, 120000),
    );

    return [
      `COMMAND_STATUS=${commandResult.status}`,
      `EXIT_CODE=${commandResult.exitCode}`,
      `DURATION_MS=${commandResult.durationMs}`,
      `OUTPUT=${commandResult.output || "Không có output."}`,
      `VERIFY_STATUS=${verifyResult.status}`,
      `VERIFY_EXIT_CODE=${verifyResult.exitCode}`,
      `VERIFY_OUTPUT=${verifyResult.output || "Không có output."}`,
    ].join("\n");
  }

  private async handleFileOp(parameters: Record<string, any>): Promise<string> {
    const { action, path: filePath, content } = parameters;

    switch (action) {
      case "write": {
        const base64 = Buffer.from(content || "").toString("base64");
        return this.deps.shell.execute(
          `mkdir -p "$(dirname "${filePath}")" && echo "${base64}" | base64 --decode > "${filePath}" && echo "Ghi file thành công."`,
        );
      }

      case "read":
        return this.deps.shell.execute(
          `if [ -f "${filePath}" ]; then FILE_SIZE=$(stat -c%s "${filePath}"); if [ "$FILE_SIZE" -gt 51200 ]; then echo "FILE QUÁ LỚN. 100 dòng đầu:"; head -n 100 "${filePath}"; else cat "${filePath}"; fi; else echo "Lỗi: File không tồn tại."; fi`,
        );

      case "list":
        return this.deps.shell.execute(`ls -F "${filePath || "."}"`);

      case "mkdir":
        return this.deps.shell.execute(
          `mkdir -p "${filePath}" && echo "Đã tạo thư mục: ${filePath}"`,
        );

      case "delete": {
        const confirm = await this.deps.rl.question(`\n❓ Xóa "${filePath}"? (y/n): `);
        return confirm.toLowerCase() === "y"
          ? this.deps.shell.execute(`rm -rf "${filePath}"`)
          : "Hủy xóa.";
      }

      default:
        return "Hành động file không hợp lệ.";
    }
  }
}
