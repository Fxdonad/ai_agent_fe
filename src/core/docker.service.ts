import { execSync } from "node:child_process";

export class DockerService {
  constructor(private containerName: string) {}

  execute(command: string): string {
    const fileWriteRegex = /(?:>|tee)\s+([\w\.\/-]+)/g;
    let preCommand = "";
    let match;

    while ((match = fileWriteRegex.exec(command)) !== null) {
      const filePath = match[1];
      if (filePath.includes("/")) {
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        preCommand += `mkdir -p "${dir}" && `; // Thêm ngoặc kép cho an toàn đường dẫn
      }
    }

    const finalCommand = preCommand ? `(${preCommand} ${command})` : command;

    const wrappedCommand = `${finalCommand} ; echo "EXIT_CODE:$?"`;
    const base64Cmd = Buffer.from(wrappedCommand).toString("base64");
    try {
      const output = execSync(
        // Dùng -- để báo hiệu kết thúc flag của docker exec, tránh lỗi tham số
        `docker exec ${this.containerName} bash -c 'echo "${base64Cmd}" | base64 --decode | bash'`,
        {
          input: finalCommand,
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10,
          timeout: 300000,
        },
      ).toString();

      // Tách Exit Code ra khỏi Output
      if (output.includes("EXIT_CODE:0")) {
        return output.replace("EXIT_CODE:0", "").trim() || "Thành công.";
      } else {
        return `Lệnh thực thi xong nhưng có lỗi. Output: ${output}`;
      }
    } catch (e: any) {
      // Trả về stderr thay vì throw lỗi để Agent có thể tự đọc lỗi và sửa
      return e.stderr?.toString() || e.message;
    }
  }
}
