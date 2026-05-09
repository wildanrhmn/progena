import { describe, it, expect } from "vitest";
import { createLogger, type LogLevel } from "./logger.js";

function captured() {
  const lines: Array<Record<string, unknown>> = [];
  const sink = (line: string) => {
    lines.push(JSON.parse(line));
  };
  return { lines, sink };
}

const FIXED_NOW = new Date("2026-05-10T00:00:00.000Z");

function buildLogger(level: LogLevel = "info") {
  const cap = captured();
  const log = createLogger({ level, sink: cap.sink, now: () => FIXED_NOW });
  return { log, ...cap };
}

describe("createLogger", () => {
  it("emits a JSON line with ts, level, and msg", () => {
    const { log, lines } = buildLogger("trace");
    log.info("hello world");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      ts: FIXED_NOW.toISOString(),
      level: "info",
      msg: "hello world",
    });
  });

  it("merges field bindings into the payload", () => {
    const { log, lines } = buildLogger("trace");
    log.warn("something", { agentId: 42, score: -5 });

    expect(lines[0]).toMatchObject({ level: "warn", agentId: 42, score: -5 });
  });

  it("filters messages below the configured level", () => {
    const { log, lines } = buildLogger("warn");
    log.trace("a");
    log.debug("b");
    log.info("c");
    log.warn("d");
    log.error("e");

    expect(lines.map((l) => l.msg)).toEqual(["d", "e"]);
  });

  it("child loggers inherit and extend bindings", () => {
    const cap = captured();
    const root = createLogger({
      level: "trace",
      bindings: { service: "indexer" },
      sink: cap.sink,
      now: () => FIXED_NOW,
    });
    const child = root.child({ roundId: 7 });
    child.info("processing");

    expect(cap.lines[0]).toMatchObject({
      service: "indexer",
      roundId: 7,
      msg: "processing",
    });
  });

  it("child does not retroactively pollute the parent's bindings", () => {
    const cap = captured();
    const root = createLogger({
      level: "trace",
      bindings: { a: 1 },
      sink: cap.sink,
      now: () => FIXED_NOW,
    });
    const child = root.child({ b: 2 });
    child.info("from child");
    root.info("from parent");

    expect(cap.lines[0]).toMatchObject({ a: 1, b: 2 });
    expect(cap.lines[1]).toMatchObject({ a: 1 });
    expect(cap.lines[1]?.b).toBeUndefined();
  });

  it("explicit fields override bindings of the same name", () => {
    const cap = captured();
    const root = createLogger({
      level: "trace",
      bindings: { stage: "boot" },
      sink: cap.sink,
      now: () => FIXED_NOW,
    });
    root.info("override", { stage: "ready" });

    expect(cap.lines[0]).toMatchObject({ stage: "ready" });
  });
});
