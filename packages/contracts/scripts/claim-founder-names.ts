import hre from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FOUNDER_NAMES = ["Alpha", "Beta", "Gamma", "Delta"] as const;

const DEPLOYMENTS = {
  galileo: "deployments/galileo.json",
  mainnet: "deployments/mainnet.json",
} as const;

async function main() {
  const network = hre.network.name as keyof typeof DEPLOYMENTS;
  const file = DEPLOYMENTS[network];
  if (!file) throw new Error(`Unknown network: ${network}`);

  const deployment = JSON.parse(readFileSync(resolve(file), "utf-8"));
  const registryAddress = deployment.contracts.AgentRegistry as `0x${string}`;
  const genomeAddress = deployment.contracts.AgentGenome as `0x${string}`;
  if (!registryAddress) throw new Error("AgentRegistry not deployed yet");

  const { viem } = hre;
  const [caller] = await viem.getWalletClients();
  console.log(`Network:  ${network}`);
  console.log(`Caller:   ${caller.account.address}`);
  console.log(`Registry: ${registryAddress}`);

  const registry = await viem.getContractAt("AgentRegistry", registryAddress);
  const genome = await viem.getContractAt("AgentGenome", genomeAddress);

  for (let i = 0; i < FOUNDER_NAMES.length; i++) {
    const tokenId = BigInt(i + 1);
    const desired = FOUNDER_NAMES[i]!;

    const owner = await genome.read.ownerOf([tokenId]);
    if (owner.toLowerCase() !== caller.account.address.toLowerCase()) {
      console.log(
        `  #${tokenId} owned by ${owner} (not caller) — skipping ${desired}`
      );
      continue;
    }

    const existing = await registry.read.nameOf([tokenId]);
    if (existing && existing.length > 0) {
      console.log(`  #${tokenId} already named "${existing}" — skipping`);
      continue;
    }

    const claimed = await registry.read.isClaimed([desired]);
    if (claimed) {
      console.log(`  "${desired}" already claimed by another token — skipping`);
      continue;
    }

    console.log(`  #${tokenId} ← "${desired}"`);
    const tx = await registry.write.setName([tokenId, desired]);
    console.log(`    tx: ${tx}`);
  }

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
