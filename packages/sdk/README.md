# @progena/sdk

TypeScript SDK for [Progena](https://github.com/wildanrhmn/progena). Shared between the daemon and the frontend.

## What it exposes

- **Genome schema + serialization.** A genome is a SOUL file + skill bundle + tool list + manifest, encoded as a deterministic content-addressed blob.
- **Deterministic crossover.** Given two parent genomes + a seed, produces a child genome that is reproducible bit-for-bit on any machine. This is what runs at breed time.
- **0G Storage wrapper.** Upload and download genomes by `rootHash`. ECIES-style payload framing built in. Browser and Node entry points (the latter at `@progena/sdk/node` because it pulls native deps).
- **Typed contract clients.** viem-style typed ABIs for every contract in the deploy. Auto-imports the right address per network from [`@progena/contracts/deployments`](../contracts/deployments).
- **Chain constants.** `zgMainnet` (chain `16661`) and `zgGalileo` (testnet), wired to the right RPCs.

## Layout

```
src/
  genome/        # schema, serialization, crossover algorithm
  storage/       # 0G Storage upload/download + node-only entry
  contracts/     # ABIs + typed clients + per-network addresses
  chain.ts       # mainnet + testnet chain configs
  index.ts       # browser-safe entry
  node.ts        # node-only entry (storage)
```

## Use

The SDK is a workspace dep, not published to npm. Import from inside the monorepo:

```ts
import {
  GenomeStorage,
  agentGenomeAbi,
  zgMainnet,
} from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";

const storage = new GenomeStorage(
  createZgStorageBackend({
    rpcUrl: "https://evmrpc.0g.ai",
    indexerUrl: "...",
    privateKey: process.env.PRIVATE_KEY!,
  })
);

const genome = await storage.downloadGenome(rootHash);
```

## Develop

```bash
npm run build     # tsc emit to dist/
npm run test      # vitest
```

The daemon and frontend depend on the built artifacts in `dist/`. A `prebuild` hook in `@progena/app` compiles the SDK first so `next build` resolves the workspace import correctly on any host.
