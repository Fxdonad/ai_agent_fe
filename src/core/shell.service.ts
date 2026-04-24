import { execSync } from "node:child_process";
import env from "../environment.js";

type CommandStatus = "success" | "error" | "timeout";

export interface CommandResult {
  status: CommandStatus;
  exitCode: number | null;
  output: string;
  timedOut: boolean;
  durationMs: number;
}

export interface BackgroundHealthOptions {
  logFile?: string;
  timeoutMs?: number;
  intervalMs?: number;
  readyPattern?: string;
  healthUrl?: string;
  healthPort?: number;
}

export interface BackgroundHealthResult {
  status: "healthy" | "timeout" | "unhealthy";
  checks: string[];
  reason: string;
  elapsedMs: number;
  recentLog: string;
}

export interface BackgroundStopResult {
  status: "stopped" | "not_running" | "failed";
  pid: string;
  message: string;
}

export class ShellService {
  // Đồng bộ với cấu hình VM của bạn
  public readonly workingDir = env.get("agent_work_dir");

  async executeWithMeta(
    command: string,
    timeoutMs = 300000,
  ): Promise<CommandResult> {
    // Đảm bảo thư mục hoạt động tồn tại
    const wrappedCommand = `
      mkdir -p ${this.workingDir} && cd ${this.workingDir} && 
      { 
        (${command}) ; 
      } 2>&1
      echo "---EXIT_CODE:$?---"
    `;

    const base64Cmd = Buffer.from(wrappedCommand).toString("base64");
    const startedAt = Date.now();

    try {
      const output = await execSync(
        `echo "${base64Cmd}" | base64 --decode | bash`,
        {
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 1024 * 1024 * 10,
          timeout: timeoutMs,
          shell: "/bin/bash",
        },
      ).toString();

      // Phân tích exit code
      const exitCodeMatch = output.match(/---EXIT_CODE:(\d+)---/);
      const exitCode = exitCodeMatch ? Number(exitCodeMatch[1]) : null;
      const cleanOutput = output.replace(/---EXIT_CODE:\d+---/, "").trim();

      return {
        status: exitCode === 0 ? "success" : "error",
        exitCode,
        output: cleanOutput,
        timedOut: false,
        durationMs: Date.now() - startedAt,
      };
    } catch (e: any) {
      const durationMs = Date.now() - startedAt;
      const stderr = e?.stderr?.toString?.() || "";
      const stdout = e?.stdout?.toString?.() || "";
      const message = e?.message || "";
      const combinedOutput = [stderr, stdout, message].filter(Boolean).join("\n").trim();
      const timedOut =
        e?.killed === true ||
        e?.signal === "SIGTERM" ||
        message.includes("ETIMEDOUT") ||
        message.toLowerCase().includes("timed out");

      return {
        status: timedOut ? "timeout" : "error",
        exitCode: typeof e?.status === "number" ? e.status : null,
        output: combinedOutput || "Không có output lỗi.",
        timedOut,
        durationMs,
      };
    }
  }

  async execute(command: string, timeoutMs = 300000): Promise<string> {
    const result = await this.executeWithMeta(command, timeoutMs);
    if (result.status === "success") {
      return result.output || "Thành công (Không có output).";
    }
    if (result.status === "timeout") {
      return `[TIMEOUT] Lệnh chạy quá thời gian ${timeoutMs}ms. Output: ${result.output}`;
    }
    return `[ERROR] Exit Code ${result.exitCode ?? "unknown"}. Output: ${result.output}`;
  }

  async executeBackground(command: string, logFile = "agent_background.log"): Promise<string> {
    const escapedLogFile = logFile.replace(/"/g, '\\"');
    const wrapped = `mkdir -p ${this.workingDir} && cd ${this.workingDir} && nohup bash -lc "${command.replace(/"/g, '\\"')}" > "${escapedLogFile}" 2>&1 & echo $!`;
    try {
      const pid = execSync(wrapped, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: "/bin/bash",
      })
        .toString()
        .trim();
      return `BACKGROUND_STARTED pid=${pid} log=${this.workingDir}/${escapedLogFile}`;
    } catch (e: any) {
      return `[ERROR] Không thể chạy background: ${e?.stderr?.toString?.() || e?.message || "Unknown error"}`;
    }
  }

  async waitForBackgroundHealthy(
    pid: string,
    options: BackgroundHealthOptions = {},
  ): Promise<BackgroundHealthResult> {
    const timeoutMs = options.timeoutMs ?? 120000;
    const intervalMs = options.intervalMs ?? 2500;
    const logFile = options.logFile || "agent_background.log";
    const checks: string[] = [];
    const startedAt = Date.now();
    let recentLog = "";

    while (Date.now() - startedAt < timeoutMs) {
      const pidCheck = await this.executeWithMeta(
        `ps -p ${pid} -o pid= | tr -d ' '`,
        Math.min(intervalMs, 3000),
      );
      const isAlive = pidCheck.status === "success" && pidCheck.output.trim() === pid;
      if (!isAlive) {
        const logSnapshot = await this.executeWithMeta(
          `if [ -f "${logFile}" ]; then tail -n 40 "${logFile}"; else echo "Log file chưa tồn tại."; fi`,
          3000,
        );
        return {
          status: "unhealthy",
          checks,
          reason: `Process ${pid} không còn chạy.`,
          elapsedMs: Date.now() - startedAt,
          recentLog: logSnapshot.output || "",
        };
      }
      checks.push("pid_alive");

      if (options.readyPattern) {
        const escapedPattern = options.readyPattern.replace(/"/g, '\\"');
        const patternCheck = await this.executeWithMeta(
          `if [ -f "${logFile}" ]; then grep -E "${escapedPattern}" "${logFile}" >/dev/null && echo READY || echo NOT_READY; else echo NOT_READY; fi`,
          3000,
        );
        if (patternCheck.output.includes("READY")) {
          checks.push("log_pattern_ready");
          recentLog = (
            await this.executeWithMeta(
              `if [ -f "${logFile}" ]; then tail -n 40 "${logFile}"; else echo "Log file chưa tồn tại."; fi`,
              3000,
            )
          ).output;
          return {
            status: "healthy",
            checks,
            reason: `Log đã match pattern "${options.readyPattern}".`,
            elapsedMs: Date.now() - startedAt,
            recentLog,
          };
        }
      }

      if (typeof options.healthPort === "number" && Number.isFinite(options.healthPort)) {
        const portCheck = await this.executeWithMeta(
          `ss -ltn "( sport = :${options.healthPort} )" | sed -n '2p'`,
          3000,
        );
        if (portCheck.status === "success" && portCheck.output.trim()) {
          checks.push("port_open");
          recentLog = (
            await this.executeWithMeta(
              `if [ -f "${logFile}" ]; then tail -n 40 "${logFile}"; else echo "Log file chưa tồn tại."; fi`,
              3000,
            )
          ).output;
          return {
            status: "healthy",
            checks,
            reason: `Port ${options.healthPort} đã mở.`,
            elapsedMs: Date.now() - startedAt,
            recentLog,
          };
        }
      }

      if (options.healthUrl) {
        const escapedUrl = options.healthUrl.replace(/"/g, '\\"');
        const urlCheck = await this.executeWithMeta(
          `curl -fsS --max-time 5 "${escapedUrl}" >/dev/null && echo URL_OK || echo URL_NOT_READY`,
          7000,
        );
        if (urlCheck.status === "success" && urlCheck.output.includes("URL_OK")) {
          checks.push("health_url_ok");
          recentLog = (
            await this.executeWithMeta(
              `if [ -f "${logFile}" ]; then tail -n 40 "${logFile}"; else echo "Log file chưa tồn tại."; fi`,
              3000,
            )
          ).output;
          return {
            status: "healthy",
            checks,
            reason: `Health URL "${options.healthUrl}" trả về thành công.`,
            elapsedMs: Date.now() - startedAt,
            recentLog,
          };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const finalLog = await this.executeWithMeta(
      `if [ -f "${logFile}" ]; then tail -n 60 "${logFile}"; else echo "Log file chưa tồn tại."; fi`,
      3000,
    );
    return {
      status: "timeout",
      checks,
      reason: `Health-check quá thời gian ${timeoutMs}ms.`,
      elapsedMs: Date.now() - startedAt,
      recentLog: finalLog.output || "",
    };
  }

  async stopBackgroundProcess(pid: string): Promise<BackgroundStopResult> {
    const check = await this.executeWithMeta(
      `ps -p ${pid} -o pid= | tr -d ' '`,
      3000,
    );
    const isAlive = check.status === "success" && check.output.trim() === pid;
    if (!isAlive) {
      return {
        status: "not_running",
        pid,
        message: `Process ${pid} không còn chạy.`,
      };
    }

    const stop = await this.executeWithMeta(`kill ${pid}`, 3000);
    if (stop.status !== "success") {
      return {
        status: "failed",
        pid,
        message: `Kill ${pid} thất bại: ${stop.output}`,
      };
    }

    const afterCheck = await this.executeWithMeta(
      `sleep 1; ps -p ${pid} -o pid= | tr -d ' '`,
      5000,
    );
    if (afterCheck.status === "success" && afterCheck.output.trim() === pid) {
      const forceStop = await this.executeWithMeta(`kill -9 ${pid}`, 3000);
      if (forceStop.status !== "success") {
        return {
          status: "failed",
          pid,
          message: `Kill -9 ${pid} thất bại: ${forceStop.output}`,
        };
      }
    }

    return {
      status: "stopped",
      pid,
      message: `Đã dừng process ${pid}.`,
    };
  }
}
