export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export type LogFields = Record<string, unknown>;

export interface Logger {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  bindings?: LogFields;
  sink?: (line: string) => void;
  now?: () => Date;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level: LogLevel = options.level ?? "info";
  const minimum = LEVEL_ORDER[level];
  const bindings = { ...(options.bindings ?? {}) };
  const sink = options.sink ?? defaultSink;
  const now = options.now ?? defaultNow;

  function emit(messageLevel: LogLevel, message: string, fields?: LogFields) {
    if (LEVEL_ORDER[messageLevel] < minimum) return;
    const payload: Record<string, unknown> = {
      ts: now().toISOString(),
      level: messageLevel,
      msg: message,
      ...bindings,
      ...(fields ?? {}),
    };
    sink(JSON.stringify(payload));
  }

  return {
    trace: (m, f) => emit("trace", m, f),
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (extra) =>
      createLogger({
        level,
        bindings: { ...bindings, ...extra },
        sink,
        now,
      }),
  };
}

function defaultSink(line: string): void {
  process.stdout.write(line + "\n");
}

function defaultNow(): Date {
  return new Date();
}
