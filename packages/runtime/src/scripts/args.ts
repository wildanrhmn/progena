export function arg(name: string, argv: string[] = process.argv): string | undefined {
  const flag = `--${name}`;
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return undefined;
  return argv[idx + 1];
}

export function requiredArg(name: string, argv: string[] = process.argv): string {
  const v = arg(name, argv);
  if (v === undefined || v.length === 0) {
    throw new Error(`missing required argument: --${name}`);
  }
  return v;
}

export function intArg(name: string, fallback?: number, argv: string[] = process.argv): number {
  const v = arg(name, argv);
  if (v === undefined) {
    if (fallback === undefined) throw new Error(`missing required argument: --${name}`);
    return fallback;
  }
  const n = parseInt(v, 10);
  if (!Number.isInteger(n)) throw new Error(`--${name} must be an integer`);
  return n;
}

export function bigintArg(name: string, argv: string[] = process.argv): bigint {
  const v = requiredArg(name, argv);
  try {
    return BigInt(v);
  } catch {
    throw new Error(`--${name} must be a bigint`);
  }
}

export function listArg(name: string, argv: string[] = process.argv): bigint[] {
  const v = requiredArg(name, argv);
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => BigInt(s));
}
