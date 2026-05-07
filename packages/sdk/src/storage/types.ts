import type { Hex } from "viem";
import type { RootHash } from "../genome/types.js";

export interface UploadResult {
  rootHash: RootHash;
  txHash: Hex;
}

export interface StorageBackend {
  upload(bytes: Uint8Array): Promise<UploadResult>;
  download(rootHash: RootHash): Promise<Uint8Array>;
}

export interface ZgStorageOptions {
  rpcUrl: string;
  indexerUrl: string;
  privateKey?: Hex;
  expectedReplicas?: number;
}

export class StorageNotFoundError extends Error {
  constructor(public readonly rootHash: RootHash) {
    super(`storage object not found: ${rootHash}`);
    this.name = "StorageNotFoundError";
  }
}
