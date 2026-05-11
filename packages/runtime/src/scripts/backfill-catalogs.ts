import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  agentGenomeAbi,
  agentTraitCatalogAbi,
  GenomeStorage,
  roundQuestionCatalogAbi,
  predictionRoundAbi,
  SOUL_FILE,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { createZgStorageBackend } from "@progena/sdk/node";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { toAgentContext } from "../round/agent-context.js";

const DEPLOYMENTS = {
  galileo: "deployments/galileo.json",
  mainnet: "deployments/mainnet.json",
} as const;

function loadDeploymentAddresses(network: keyof typeof DEPLOYMENTS) {
  const file = join(
    new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    "contracts",
    DEPLOYMENTS[network]
  );
  const parsed = JSON.parse(readFileSync(file, "utf-8"));
  return {
    questionCatalog: parsed.contracts.RoundQuestionCatalog as Address,
    traitCatalog: parsed.contracts.AgentTraitCatalog as Address,
  };
}

function buildTraitJson(genome: ReturnType<typeof GenomeStorage>["downloadGenome"] extends (
  ...args: never[]
) => Promise<infer T>
  ? T
  : never): string {
  const ctx = toAgentContext(genome);
  const soul = genome.workspace[SOUL_FILE] ?? "";
  const soulPreview = soul.trim().slice(0, 320);
  return JSON.stringify({
    version: 1,
    skills: ctx.skillNames,
    tools: ctx.toolList,
    soulPreview,
    generation: genome.manifest.generation,
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "backfill-catalogs", network: config.network },
  });

  const network = config.network as keyof typeof DEPLOYMENTS;
  const catalogs = loadDeploymentAddresses(network);
  logger.info("catalog addresses", catalogs);

  const chain = network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const genomeContract = getContract({
    address: config.addresses.agentGenome,
    abi: agentGenomeAbi,
    client: { public: publicClient },
  });
  const roundContract = getContract({
    address: config.addresses.predictionRound,
    abi: predictionRoundAbi,
    client: { public: publicClient },
  });
  const questionCatalog = getContract({
    address: catalogs.questionCatalog,
    abi: roundQuestionCatalogAbi,
    client: { public: publicClient, wallet: walletClient },
  });
  const traitCatalog = getContract({
    address: catalogs.traitCatalog,
    abi: agentTraitCatalogAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  const storage = new GenomeStorage(
    createZgStorageBackend({
      rpcUrl: config.rpcUrl,
      indexerUrl: config.indexerUrl,
      privateKey: config.genomeWriterPrivateKey,
    })
  );

  console.log("\n=== Backfilling AgentTraitCatalog ===\n");
  const totalMinted = (await genomeContract.read.totalMinted()) as bigint;
  for (let id = 1n; id <= totalMinted; id++) {
    try {
      const already = (await traitCatalog.read.isPublished([id])) as boolean;
      if (already) {
        console.log(`#${id}  already published, skipping`);
        continue;
      }
      const finalized = (await genomeContract.read.isFinalized([id])) as boolean;
      if (!finalized) {
        console.log(`#${id}  not finalized, skipping`);
        continue;
      }
      const owner = (await genomeContract.read.ownerOf([id])) as Address;
      if (owner.toLowerCase() !== account.address.toLowerCase()) {
        console.log(`#${id}  not owned by operator (${owner}), skipping`);
        continue;
      }
      const rootHash = (await genomeContract.read.rootHashOf([id])) as `0x${string}`;
      const genome = await storage.downloadGenome(rootHash);
      const traitsJson = buildTraitJson(genome);

      const txHash = (await traitCatalog.write.publish([id, traitsJson], {
        account,
        chain,
      })) as Hex;
      await publicClient
        .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
        .catch(() => undefined);

      console.log(`#${id}  published  tx ${txHash}`);
      console.log(`        ${traitsJson.slice(0, 160)}${traitsJson.length > 160 ? "…" : ""}`);
    } catch (err) {
      console.log(`#${id}  FAILED — ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  }

  console.log("\n=== Backfilling RoundQuestionCatalog ===\n");
  const storePath = join(process.cwd(), "state", "rounds.json");
  const storeRaw = JSON.parse(readFileSync(storePath, "utf-8")) as {
    rounds: Array<{ roundId: string; question: string; questionHash: `0x${string}` }>;
  };

  for (const r of storeRaw.rounds) {
    const id = BigInt(r.roundId);
    try {
      const already = (await questionCatalog.read.isPublished([id])) as boolean;
      if (already) {
        console.log(`round ${id}  already published, skipping`);
        continue;
      }
      const data = await roundContract.read.roundOf([id]);
      if (data.questionHash !== r.questionHash) {
        console.log(`round ${id}  hash mismatch (state vs chain) — skipping`);
        continue;
      }
      const txHash = (await questionCatalog.write.publish([id, r.question], {
        account,
        chain,
      })) as Hex;
      await publicClient
        .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
        .catch(() => undefined);
      console.log(`round ${id}  published  tx ${txHash}`);
      console.log(`            ${r.question.slice(0, 120)}${r.question.length > 120 ? "…" : ""}`);
    } catch (err) {
      console.log(`round ${id}  FAILED — ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  }

  console.log("\ndone");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
