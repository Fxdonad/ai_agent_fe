import * as dotenv from "dotenv";
import { AgentEngine } from "./service/agent.engine.js";

dotenv.config();

const engine = new AgentEngine();

// Không cần truyền tham số, engine sẽ tự hỏi khi khởi động
engine.run().catch((err) => {
  console.error("💥 Lỗi khởi động:", err);
});
