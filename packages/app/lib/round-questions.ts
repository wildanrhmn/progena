import { keccak256, toBytes } from "viem";

export function questionHashOf(text: string): `0x${string}` {
  return keccak256(toBytes(text));
}
