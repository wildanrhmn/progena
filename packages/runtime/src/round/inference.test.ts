import { describe, it, expect, vi } from "vitest";
import {
  createOpenAIInferenceClient,
  createStubInferenceClient,
  inferAndExtract,
  type OpenAIChatLike,
} from "./inference.js";

describe("createStubInferenceClient", () => {
  it("returns a parseable PREDICTION line", async () => {
    const client = createStubInferenceClient();
    const out = await client.complete({
      systemPrompt: "I am Alpha.",
      userPrompt: "Will BTC be above $100k tomorrow?",
    });
    expect(out.text).toMatch(/PREDICTION:\s*\d+/);
    expect(out.model).toEqual("stub");
  });

  it("is deterministic for identical inputs", async () => {
    const client = createStubInferenceClient();
    const a = await client.complete({ systemPrompt: "a", userPrompt: "b" });
    const b = await client.complete({ systemPrompt: "a", userPrompt: "b" });
    expect(a.text).toEqual(b.text);
  });

  it("produces different outputs for different system prompts", async () => {
    const client = createStubInferenceClient();
    const alpha = await client.complete({ systemPrompt: "alpha", userPrompt: "q" });
    const beta = await client.complete({ systemPrompt: "beta", userPrompt: "q" });
    expect(alpha.text).not.toEqual(beta.text);
  });

  it("respects a bias function", async () => {
    const positive = createStubInferenceClient({ bias: () => 4_000 });
    const negative = createStubInferenceClient({ bias: () => -4_000 });
    const reqs = { systemPrompt: "agent", userPrompt: "question" };
    const high = await positive.complete(reqs);
    const low = await negative.complete(reqs);
    const highVal = parseInt(/PREDICTION:\s*(\d+)/.exec(high.text)![1]!, 10);
    const lowVal = parseInt(/PREDICTION:\s*(\d+)/.exec(low.text)![1]!, 10);
    expect(highVal).toBeGreaterThan(lowVal);
  });

  it("clamps biased predictions into [0, 10000]", async () => {
    const overshoot = createStubInferenceClient({ bias: () => 99_999 });
    const undershoot = createStubInferenceClient({ bias: () => -99_999 });
    const high = await overshoot.complete({ systemPrompt: "x", userPrompt: "y" });
    const low = await undershoot.complete({ systemPrompt: "x", userPrompt: "y" });
    expect(high.text).toContain("PREDICTION: 10000");
    expect(low.text).toContain("PREDICTION: 0");
  });
});

describe("createOpenAIInferenceClient", () => {
  function fakeOpenAI(text: string, model = "deepseek-chat-v3"): OpenAIChatLike {
    return {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            model,
            choices: [{ message: { content: text } }],
          })),
        },
      },
    };
  }

  it("forwards system + user prompts and returns the assistant text", async () => {
    const ai = fakeOpenAI("PREDICTION: 5500");
    const client = createOpenAIInferenceClient({ client: ai });

    const out = await client.complete({
      systemPrompt: "sys",
      userPrompt: "user",
    });

    expect(out.text).toEqual("PREDICTION: 5500");
    expect(out.model).toEqual("deepseek-chat-v3");
    const create = ai.chat.completions.create as ReturnType<typeof vi.fn>;
    const params = create.mock.calls[0]![0]!;
    expect(params.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "user" },
    ]);
  });

  it("uses request-level model + temperature + max_tokens overrides", async () => {
    const ai = fakeOpenAI("PREDICTION: 1");
    const client = createOpenAIInferenceClient({ client: ai, defaultModel: "x" });

    await client.complete({
      systemPrompt: "s",
      userPrompt: "u",
      model: "qwen3-vl-30b",
      temperature: 0.7,
      maxTokens: 1024,
    });

    const create = ai.chat.completions.create as ReturnType<typeof vi.fn>;
    const params = create.mock.calls[0]![0]!;
    expect(params.model).toEqual("qwen3-vl-30b");
    expect(params.temperature).toEqual(0.7);
    expect(params.max_tokens).toEqual(1024);
  });

  it("falls back to defaultModel when request omits model", async () => {
    const ai = fakeOpenAI("PREDICTION: 1");
    const client = createOpenAIInferenceClient({ client: ai, defaultModel: "glm-5-fp8" });

    await client.complete({ systemPrompt: "s", userPrompt: "u" });

    const create = ai.chat.completions.create as ReturnType<typeof vi.fn>;
    const params = create.mock.calls[0]![0]!;
    expect(params.model).toEqual("glm-5-fp8");
  });

  it("returns empty text when the assistant message has no content", async () => {
    const ai: OpenAIChatLike = {
      chat: {
        completions: {
          create: async () => ({
            model: "x",
            choices: [{ message: { content: null } }],
          }),
        },
      },
    };
    const client = createOpenAIInferenceClient({ client: ai });
    const out = await client.complete({ systemPrompt: "s", userPrompt: "u" });
    expect(out.text).toEqual("");
  });
});

describe("inferAndExtract", () => {
  it("returns a parsed prediction alongside the raw response", async () => {
    const client = createStubInferenceClient();
    const result = await inferAndExtract(client, {
      systemPrompt: "I am Alpha.",
      userPrompt: "Will the price moon?",
    });
    expect(result.prediction).toBeGreaterThanOrEqual(0);
    expect(result.prediction).toBeLessThanOrEqual(10_000);
    expect(result.raw.text).toMatch(/PREDICTION:/);
  });
});
