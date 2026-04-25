export class SafetySkill {
  private static readonly DANGEROUS_KEYWORDS = [
    "sudo",
    "rm -rf /",
    "chmod 777",
    "chown",
    "mkfs",
    "dd if=",
  ];

  static isDangerousCommand(cmd: unknown): boolean {
    if (typeof cmd !== "string" || !cmd.trim()) return false;
    const lowerCmd = cmd.toLowerCase();
    return this.DANGEROUS_KEYWORDS.some((keyword) =>
      lowerCmd.includes(keyword),
    );
  }
}
