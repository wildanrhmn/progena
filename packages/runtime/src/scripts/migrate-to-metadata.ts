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
  agentMetadataAbi,
  GenomeStorage,
  predictionRoundAbi,
  roundMetadataAbi,
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

function loadAddresses(network: keyof typeof DEPLOYMENTS) {
  const file = join(
    new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    "contracts",
    DEPLOYMENTS[network]
  );
  const parsed = JSON.parse(readFileSync(file, "utf-8"));
  return {
    agentMetadata: parsed.contracts.AgentMetadata as Address,
    roundMetadata: parsed.contracts.RoundMetadata as Address,
  };
}

function buildTraitJson(genome: Awaited<ReturnType<GenomeStorage["downloadGenome"]>>): string {
  const ctx = toAgentContext(genome);
  const soul = genome.workspace[SOUL_FILE] ?? "";
  const synthesisRaw = genome.workspace["SYNTHESIS.md"] ?? "";
  const syn = parseSynthesisHeaders(synthesisRaw);
  return JSON.stringify({
    version: 1,
    skills: ctx.skillNames,
    tools: ctx.toolList,
    soulPreview: soul.trim().slice(0, 320),
    generation: genome.manifest.generation,
    synthesizedSoul: syn.soulSynthesized || undefined,
    hybridSkillName: syn.hybridSkillName,
    hybridSourceSkills: syn.hybridSourceSkills,
  });
}

function parseSynthesisHeaders(markdown: string) {
  const re = /<!--\s*([a-zA-Z]+):\s*(.+?)\s*-->/g;
  const fields: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    fields[m[1]!] = m[2]!;
  }
  const soulSynthesized = fields.soulSynthesized === "true";
  const hybridSkillName =
    fields.hybridSkillSynthesized === "true" ? fields.hybridSkillName : undefined;
  const sources = fields.hybridSourceSkills?.split(",");
  const hybridSourceSkills =
    sources && sources.length === 2 ? ([sources[0]!, sources[1]!] as [string, string]) : undefined;
  return { soulSynthesized, hybridSkillName, hybridSourceSkills };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "migrate-to-metadata", network: config.network },
  });

  const network = config.network as keyof typeof DEPLOYMENTS;
  const addrs = loadAddresses(network);
  logger.info("addresses", addrs);

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
  const agentMeta = getContract({
    address: addrs.agentMetadata,
    abi: agentMetadataAbi,
    client: { public: publicClient, wallet: walletClient },
  });
  const roundMeta = getContract({
    address: addrs.roundMetadata,
    abi: roundMetadataAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  const storage = new GenomeStorage(
    createZgStorageBackend({
      rpcUrl: config.rpcUrl,
      indexerUrl: config.indexerUrl,
      privateKey: config.genomeWriterPrivateKey,
    })
  );

  console.log("\n=== Re-publishing trait JSON to AgentMetadata ===\n");
  const totalMinted = (await genomeContract.read.totalMinted()) as bigint;
  for (let id = 1n; id <= totalMinted; id++) {
    try {
      const already = (await agentMeta.read.isTraitsPublished([id])) as boolean;
      if (already) {
        console.log(`#${id}  traits already published, skipping`);
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
      const txHash = (await agentMeta.write.publishTraits([id, traitsJson], {
        account,
        chain,
      })) as Hex;
      await publicClient
        .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
        .catch(() => undefined);
      console.log(`#${id}  traits published  tx ${txHash}`);
    } catch (err) {
      console.log(`#${id}  FAILED — ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  }

  console.log("\n=== Re-publishing question text to RoundMetadata ===\n");
  const storePath = join(process.cwd(), "state", "rounds.json");
  let rounds: Array<{ roundId: string; question: string; questionHash: `0x${string}` }> = [];
  try {
    const storeRaw = JSON.parse(readFileSync(storePath, "utf-8")) as {
      rounds: typeof rounds;
    };
    rounds = storeRaw.rounds;
  } catch {
    console.log("(no state/rounds.json — reading from deprecated RoundQuestionCatalog at 0xeca2…4e28)");
    const legacyAbi = [
      {
        type: "function",
        name: "textOf",
        stateMutability: "view",
        inputs: [{ name: "roundId", type: "uint256" }],
        outputs: [{ name: "", type: "string" }],
      },
    ] as const;
    const legacyAddr = "0xeca2a337a639a6214197a78090a83422351a4e28" as Address;
    const nextRoundId = (await roundContract.read.nextRoundId()) as bigint;
    for (let id = 1n; id < nextRoundId; id++) {
      try {
        const text = (await publicClient.readContract({
          address: legacyAddr,
          abi: legacyAbi,
          functionName: "textOf",
          args: [id],
        })) as string;
        if (text && text.length > 0) {
          const data = await roundContract.read.roundOf([id]);
          rounds.push({
            roundId: id.toString(),
            question: text,
            questionHash: data.questionHash as `0x${string}`,
          });
        }
      } catch {
        // skip
      }
    }
    console.log(`  found ${rounds.length} legacy round entries`);
  }

  for (const r of rounds) {
    const id = BigInt(r.roundId);
    try {
      const already = (await roundMeta.read.isQuestionPublished([id])) as boolean;
      if (already) {
        console.log(`round ${id}  already published, skipping`);
        continue;
      }
      const data = await roundContract.read.roundOf([id]);
      if (data.questionHash !== r.questionHash) {
        console.log(`round ${id}  hash mismatch (state vs chain) — skipping`);
        continue;
      }
      const txHash = (await roundMeta.write.publishQuestion([id, r.question], {
        account,
        chain,
      })) as Hex;
      await publicClient
        .waitForTransactionReceipt({ hash: txHash, timeout: 600_000, retryCount: 120 })
        .catch(() => undefined);
      console.log(`round ${id}  published  tx ${txHash}`);
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
