import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  GenomeStorage,
  agentGenomeAbi,
  createZgStorageBackend,
  hashGenome,
  zgGalileo,
  zgMainnet,
  type RootHash,
} from "@progena/sdk";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { GENESIS_AGENTS, buildGenesisGenome } from "./genesis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = join(__dirname, "..", "..", "..", "skills", "skills");

async function loadSkill(name: string): Promise<string> {
  return readFile(join(SKILLS_ROOT, name, "SKILL.md"), "utf8");
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, bindings: { service: "seed-genesis" } });

  const chain = config.network === "mainnet" ? zgMainnet : zgGalileo;
  const account = privateKeyToAccount(config.genomeWriterPrivateKey);

  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });

  const storage = new GenomeStorage(
    createZgStorageBackend({
      rpcUrl: config.rpcUrl,
      indexerUrl: config.indexerUrl,
      privateKey: config.genomeWriterPrivateKey,
    })
  );

  const agentGenome = getContract({
    address: config.addresses.agentGenome,
    abi: agentGenomeAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  const alreadyMinted = Number(await agentGenome.read.totalMinted());
  const remaining = GENESIS_AGENTS.slice(alreadyMinted);

  logger.info("seeding genesis agents", {
    network: config.network,
    chainId: chain.id,
    deployer: account.address,
    totalSpecs: GENESIS_AGENTS.length,
    alreadyMinted,
    toMint: remaining.length,
  });

  if (remaining.length === 0) {
    logger.info("nothing to mint, all founders already on-chain");
    return;
  }

  const minted: Array<{
    name: string;
    rootHash: RootHash;
    storageTxHash: Hex;
    mintTxHash: Hex;
    contentHash: Hex;
    owner: Address;
  }> = [];

  for (const spec of remaining) {
    const child = logger.child({ agent: spec.name });
    child.info("building genome");

    const genome = await buildGenesisGenome({
      spec,
      loadSkill,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const contentHash = hashGenome(genome);
    child.info("uploading to 0G Storage", { contentHash });
    const upload = await storage.uploadGenome(genome);

    child.info("minting on-chain", {
      rootHash: upload.rootHash,
      storageTxHash: upload.txHash,
    });

    const mintTxHash = (await agentGenome.write.mintGenesis(
      [account.address, upload.rootHash],
      { account, chain }
    )) as Hex;

    await publicClient.waitForTransactionReceipt({
      hash: mintTxHash,
      timeout: 120_000,
      retryCount: 30,
    });
    child.info("minted", { mintTxHash });

    minted.push({
      name: spec.name,
      rootHash: upload.rootHash,
      storageTxHash: upload.txHash,
      mintTxHash,
      contentHash,
      owner: account.address,
    });
  }

  logger.info("seeding complete", { minted: minted.length });
  console.log("\n=== Genesis agents minted ===");
  for (const m of minted) {
    console.log(`\n${m.name}`);
    console.log(`  rootHash:     ${m.rootHash}`);
    console.log(`  contentHash:  ${m.contentHash}`);
    console.log(`  storage tx:   ${m.storageTxHash}`);
    console.log(`  mint tx:      ${m.mintTxHash}`);
    console.log(`  owner:        ${m.owner}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
