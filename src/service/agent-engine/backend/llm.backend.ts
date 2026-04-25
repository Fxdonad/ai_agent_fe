import axios from "axios";
import { Gemma4e4bConfig } from "../../../model/gemma-4-e4b.response.js";
import type { AgentDecision, AgentMessage } from "../types.js";

export class LlmBackend {
  constructor(
    private readonly lmsUrl: string,
    private readonly getMessages: () => AgentMessage[],
    private readonly logActivity: (type: string, data: any) => void,
    private readonly pruneContext: (aggressive?: boolean) => void,
  ) {}

  async askLLM(retryCount = 0): Promise<string> {
    const maxRetries = 5;
    const retryDelays = [2000, 4000, 8000, 16000, 32000];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);

    try {
      const res = await axios.post(
        this.lmsUrl,
        {
          model: Gemma4e4bConfig.modelName,
          messages: this.getMessages(),
          temperature: 0.1,
          response_format: Gemma4e4bConfig.structureResponse,
        },
        {
          timeout: 600000,
          signal: controller.signal,
          headers: { Connection: "keep-alive" },
        },
      );

      clearTimeout(timeoutId);
      const content =
        res.data.choices[0].message.content ||
        res.data.choices[0].message.reasoning_content ||
        "";

      if (!content) throw new Error("LLM trả về nội dung trống");
      return content;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.response?.status === 400 && retryCount < maxRetries) {
        this.logActivity("CONTEXT_LIMIT", "Phát hiện đầy bộ nhớ, đang cắt tỉa...");
        this.pruneContext(true);
        return this.askLLM(retryCount + 1);
      }

      const isNetworkError =
        err.code === "ECONNRESET" ||
        err.message.includes("socket hang up") ||
        err.name === "AbortError" ||
        err.code === "ETIMEDOUT";

      if (isNetworkError && retryCount < maxRetries) {
        const delay = retryDelays[retryCount];
        console.log(
          `\n📡 Lỗi kết nối (${err.message}). Thử lại ${retryCount + 1}/${maxRetries} sau ${delay}ms...`,
        );
        this.logActivity("RETRY", { attempt: retryCount + 1, error: err.message });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.askLLM(retryCount + 1);
      }

      throw err;
    }
  }

  parseResponse(content: string): AgentDecision | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}
