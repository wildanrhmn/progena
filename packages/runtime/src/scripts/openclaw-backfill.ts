import { createPublicClient, getContract, http } from "viem";
import {
  GenomeStorage,
  agentGenomeAbi,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { registerOpenClawAgent } from "../openclaw/register-agent.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "openclaw-backfill", network: config.network },
  });

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });

  const storageBackend = createZgStorageBackend({
    rpcUrl: config.rpcUrl,
    indexerUrl: config.indexerUrl,
    privateKey: config.genomeWriterPrivateKey,
  });
  const storage = new GenomeStorage(storageBackend);

  const agentGenome = getContract({
    address: config.addresses.agentGenome,
    abi: agentGenomeAbi,
    client: { public: publicClient },
  });

  const totalMinted = (await agentGenome.read.totalMinted()) as bigint;
  logger.info("agents discovered", { totalMinted: String(totalMinted) });

  const fromArg = process.env.FROM ? BigInt(process.env.FROM) : 1n;
  const toArg = process.env.TO ? BigInt(process.env.TO) : totalMinted;

  let registered = 0;
  let existed = 0;
  let failed = 0;

  for (let tokenId = fromArg; tokenId <= toArg; tokenId++) {
    const tokenLog = logger.child({ tokenId: String(tokenId) });
    try {
      const rootHash = (await agentGenome.read.rootHashOf([tokenId])) as `0x${string}`;
      if (!rootHash || /^0x0+$/.test(rootHash)) {
        tokenLog.info("skipping unrooted token");
        continue;
      }
      const genome = await storage.downloadGenome(rootHash);
      const result = await registerOpenClawAgent({
        tokenId,
        genome,
        logger: tokenLog,
      });
      if (result.alreadyExisted) existed++;
      else registered++;
      tokenLog.info("ok", {
        agentName: result.agentName,
        workspaceDir: result.workspaceDir,
        alreadyExisted: result.alreadyExisted,
      });
    } catch (err) {
      failed++;
      tokenLog.warn("failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("backfill complete", { registered, existed, failed });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
