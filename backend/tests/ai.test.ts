import { it, expect, vi, beforeEach } from "vitest";
const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));
import { structured } from "../src/ai.js";
import { z } from "zod";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "unit-test-key";
});
it("executes an actual application tool then validates final output", async () => {
  create
    .mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "call1", name: "get_cost", input: {} }],
      stop_reason: "tool_use",
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    .mockResolvedValueOnce({
      content: [{ type: "text", text: '{"total":100}' }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  const execute = vi.fn(async () => ({ total: 100 }));
  const result = await structured(
    z.object({ total: z.number() }),
    "System",
    "Prompt",
    [
      {
        name: "get_cost",
        description: "Cost",
        input_schema: { type: "object", properties: {} },
      },
    ],
    execute,
  );
  expect(result.data.total).toBe(100);
  expect(execute).toHaveBeenCalledWith("get_cost", {});
  expect(result.trace.some((t) => t.stage === "tool.completed")).toBe(true);
  expect(create.mock.calls[1][0].messages.at(-1).content[0].type).toBe(
    "tool_result",
  );
});
it("rejects invalid structured output", async () => {
  create.mockResolvedValue({
    content: [{ type: "text", text: '{"total":"invented"}' }],
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  await expect(
    structured(z.object({ total: z.number() }), "", ""),
  ).rejects.toThrow("structured response");
});
it("fails clearly without credentials", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await expect(
    structured(z.object({ total: z.number() }), "", ""),
  ).rejects.toThrow("ANTHROPIC_API_KEY");
});
it("rejects truncated responses", async () => {
  create.mockResolvedValue({
    content: [{ type: "text", text: "{}" }],
    stop_reason: "max_tokens",
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  await expect(structured(z.object({}), "", "")).rejects.toThrow("incomplete");
});
