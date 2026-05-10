import hre from "hardhat";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEPLOYMENTS = {
  galileo: {
    file: "deployments/galileo.json",
    agentGenome: "0xCe2AA403276D01919295823237123C0ac47A24e2",
  },
  mainnet: {
    file: "deployments/mainnet.json",
    agentGenome: "0xCe2AA403276D01919295823237123C0ac47A24e2",
  },
} as const;

async function main() {
  const network = hre.network.name as keyof typeof DEPLOYMENTS;
  const config = DEPLOYMENTS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }

  console.log(`Deploying AgentRegistry on ${network}…`);
  console.log(`  AgentGenome: ${config.agentGenome}`);

  const { viem } = hre;
  const [deployer] = await viem.getWalletClients();
  console.log(`  Deployer:    ${deployer.account.address}`);

  const registry = await viem.deployContract("AgentRegistry", [
    config.agentGenome,
  ]);
  console.log(`  AgentRegistry deployed at: ${registry.address}`);

  const filePath = resolve(config.file);
  const existing = JSON.parse(readFileSync(filePath, "utf-8"));
  existing.contracts.AgentRegistry = registry.address;
  writeFileSync(filePath, JSON.stringify(existing, null, 2) + "\n");
  console.log(`  Updated ${config.file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
