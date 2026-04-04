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

    // Wrap lệnh trong ngoặc đơn () để đảm bảo preCommand chạy trước lệnh chính chính xác
    const finalCommand = preCommand ? `(${preCommand} ${command})` : command;
    const base64Cmd = Buffer.from(finalCommand).toString("base64");

    return execSync(
      // Dùng -- để báo hiệu kết thúc flag của docker exec, tránh lỗi tham số
      `docker exec ${this.containerName} bash -c 'echo "${base64Cmd}" | base64 --decode | bash'`,
      {
        stdio: "pipe",
        maxBuffer: 1024 * 1024 * 10,
        timeout: 300000,
      },
    ).toString();
  }
}
