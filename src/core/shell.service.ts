import { execSync } from "node:child_process";

export class ShellService {
  // Đồng bộ với cấu hình VM của bạn
  public readonly workingDir = "/home/fxdonad/Fxdonad/Agent/App";

  execute(command: string): string {
    // Đảm bảo thư mục hoạt động tồn tại
    const wrappedCommand = `
      mkdir -p ${this.workingDir} && cd ${this.workingDir} && 
      { 
        (${command}) ; 
      } 2>&1
      echo "---EXIT_CODE:$?---"
    `;
    
    const base64Cmd = Buffer.from(wrappedCommand).toString("base64");
    
    try {
      const output = execSync(
        `echo "${base64Cmd}" | base64 --decode | bash`,
        {
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 1024 * 1024 * 10,
          timeout: 300000,
          shell: "/bin/bash"
        }
      ).toString();

      // Phân tích exit code
      const exitCodeMatch = output.match(/---EXIT_CODE:(\d+)---/);
      const exitCode = exitCodeMatch ? exitCodeMatch[1] : "unknown";
      const cleanOutput = output.replace(/---EXIT_CODE:\d+---/, "").trim();

      if (exitCode === "0") {
        return cleanOutput || "Thành công (Không có output).";
      } else {
        return `[ERROR] Exit Code ${exitCode}. Output: ${cleanOutput}`;
      }
    } catch (e: any) {
      return `[CRITICAL] ${e.stderr?.toString() || e.message}`;
    }
  }
}