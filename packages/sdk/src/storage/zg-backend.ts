import { Indexer, MemData, defaultUploadOption } from "@0gfoundation/0g-ts-sdk";
import { JsonRpcProvider, Wallet } from "ethers";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hex } from "viem";
import type { RootHash } from "../genome/types.js";
import {
  StorageNotFoundError,
  type StorageBackend,
  type UploadResult,
  type ZgStorageOptions,
} from "./types.js";

export function createZgStorageBackend(opts: ZgStorageOptions): StorageBackend {
  const indexer = new Indexer(opts.indexerUrl);
  const provider = new JsonRpcProvider(opts.rpcUrl);
  const signer = opts.privateKey ? new Wallet(opts.privateKey, provider) : undefined;
  const expectedReplica = opts.expectedReplicas ?? 1;

  return {
    async upload(bytes: Uint8Array): Promise<UploadResult> {
      if (!signer) {
        throw new Error("ZgStorage: privateKey is required for uploads");
      }
      const data = new MemData(Buffer.from(bytes));
      const [result, err] = await indexer.upload(
        data as never,
        opts.rpcUrl,
        signer as never,
        { ...defaultUploadOption, expectedReplica }
      );
      if (err) throw err;
      if (!result) throw new Error("ZgStorage: upload returned no result");
      if ("rootHashes" in result) {
        const firstRoot = result.rootHashes[0];
        const firstTx = result.txHashes[0];
        if (!firstRoot || !firstTx) {
          throw new Error("ZgStorage: fragmented upload returned empty arrays");
        }
        return { rootHash: firstRoot as RootHash, txHash: firstTx as Hex };
      }
      return {
        rootHash: result.rootHash as RootHash,
        txHash: result.txHash as Hex,
      };
    },

    async download(rootHash: RootHash): Promise<Uint8Array> {
      const dir = await mkdtemp(join(tmpdir(), "progena-storage-"));
      const path = join(dir, "blob.bin");
      try {
        const err = await indexer.download(rootHash, path, false);
        if (err) {
          if (/not found|no file/i.test(err.message)) {
            throw new StorageNotFoundError(rootHash);
          }
          throw err;
        }
        return new Uint8Array(await readFile(path));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
