import { keccak256, hexToBytes, type Hex } from "viem";

const SEED_BYTES = 32;

function bigintToBytes32(value: bigint): Uint8Array {
  const out = new Uint8Array(SEED_BYTES);
  let v = value;
  for (let i = SEED_BYTES - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export class DeterministicRNG {
  private counter = 0n;
  private buffer: number[] = [];

  constructor(private readonly seed: Uint8Array) {
    if (seed.length !== SEED_BYTES) {
      throw new Error(`seed must be ${SEED_BYTES} bytes, got ${seed.length}`);
    }
  }

  static fromHex(seed: Hex): DeterministicRNG {
    return new DeterministicRNG(hexToBytes(seed));
  }

  private refill(): void {
    const block = new Uint8Array(SEED_BYTES + SEED_BYTES);
    block.set(this.seed, 0);
    block.set(bigintToBytes32(this.counter), SEED_BYTES);
    this.counter += 1n;
    const hash = hexToBytes(keccak256(block));
    for (const byte of hash) this.buffer.push(byte);
  }

  private nextByte(): number {
    if (this.buffer.length === 0) this.refill();
    return this.buffer.shift()!;
  }

  nextU32(): number {
    const b0 = this.nextByte();
    const b1 = this.nextByte();
    const b2 = this.nextByte();
    const b3 = this.nextByte();
    return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
  }

  nextFloat(): number {
    return this.nextU32() / 0x1_0000_0000;
  }

  nextBoolean(probability = 0.5): boolean {
    return this.nextFloat() < probability;
  }

  nextBoundedInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error("maxExclusive must be positive");
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextBoundedInt(i + 1);
      const tmp = result[i]!;
      result[i] = result[j]!;
      result[j] = tmp;
    }
    return result;
  }

  pickSubset<T>(items: readonly T[], probability: number): T[] {
    if (probability < 0 || probability > 1) {
      throw new Error("probability must be in [0, 1]");
    }
    const out: T[] = [];
    for (const item of items) {
      if (this.nextBoolean(probability)) out.push(item);
    }
    return out;
  }
}
