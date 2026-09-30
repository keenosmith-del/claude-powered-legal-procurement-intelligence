import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { config } from "./config.js";
import { AppError } from "./schemas.js";
export interface Trace {
  stage: string;
  durationMs: number;
  tool?: string;
  input?: unknown;
  inputTokens?: number;
  outputTokens?: number;
}
export async function structured<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  tools: Tool[] = [],
  execute?: (name: string, input: unknown) => Promise<unknown>,
) {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new AppError(
      503,
      "ANTHROPIC_API_KEY is required for AI functionality",
    );
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 120000,
    maxRetries: 1,
  });
  const messages: MessageParam[] = [{ role: "user", content: prompt }];
  const trace: Trace[] = [];
  try {
    for (let turn = 0; turn < 8; turn++) {
      const start = Date.now();
      const response = await client.messages.create({
        model: config.model,
        max_tokens: 12000,
        system,
        messages,
        ...(tools.length ? { tools } : {}),
        output_config: { format: zodOutputFormat(schema) },
      });
      trace.push({
        stage: "claude.response",
        durationMs: Date.now() - start,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });
      const calls = response.content.filter((b) => b.type === "tool_use");
      if (calls.length) {
        if (!execute) throw new AppError(502, "Unexpected tool call");
        messages.push({ role: "assistant", content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const call of calls) {
          const t = Date.now();
          try {
            const output = await execute(call.name, call.input);
            trace.push({
              stage: "tool.completed",
              tool: call.name,
              input: call.input,
              durationMs: Date.now() - t,
            });
            results.push({
              type: "tool_result",
              tool_use_id: call.id,
              content: JSON.stringify(output),
            });
          } catch (e) {
            results.push({
              type: "tool_result",
              tool_use_id: call.id,
              is_error: true,
              content:
                e instanceof AppError
                  ? e.message
                  : "Tool input or execution failed",
            });
          }
        }
        messages.push({ role: "user", content: results });
        continue;
      }
      if (response.stop_reason !== "end_turn")
        throw new AppError(
          502,
          `Claude output incomplete (${response.stop_reason}); retry analysis`,
        );
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      const data = schema.parse(JSON.parse(text));
      console.info(
        JSON.stringify({
          stage: "ai.completed",
          turns: turn + 1,
          durationMs: trace.reduce((n, x) => n + x.durationMs, 0),
        }),
      );
      return { data, trace };
    }
    throw new AppError(502, "Claude tool round limit reached");
  } catch (e) {
    if (e instanceof AppError) throw e;
    console.error(
      JSON.stringify({
        stage: "ai.failed",
        type: e instanceof Error ? e.name : "unknown",
      }),
    );
    throw new AppError(
      502,
      "Claude request or structured response validation failed. Check credentials, model access and retry.",
    );
  }
}
