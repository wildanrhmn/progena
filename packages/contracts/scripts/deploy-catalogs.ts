import hre from "hardhat";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEPLOYMENTS = {
  galileo: "deployments/galileo.json",
  mainnet: "deployments/mainnet.json",
} as const;

async function main() {
  const network = hre.network.name as keyof typeof DEPLOYMENTS;
  const file = DEPLOYMENTS[network];
  if (!file) throw new Error(`Unknown network: ${network}`);

  const filePath = resolve(file);
  const deployment = JSON.parse(readFileSync(filePath, "utf-8"));
  const agentGenomeAddress = deployment.contracts.AgentGenome as `0x${string}`;
  const predictionRoundAddress = deployment.contracts.PredictionRound as `0x${string}`;

  const { viem } = hre;
  const [deployer] = await viem.getWalletClients();

  console.log(`Network:          ${network}`);
  console.log(`Deployer:         ${deployer.account.address}`);
  console.log(`AgentGenome:      ${agentGenomeAddress}`);
  console.log(`PredictionRound:  ${predictionRoundAddress}`);
  console.log("");

  console.log("Deploying RoundQuestionCatalog…");
  const questionCatalog = await viem.deployContract("RoundQuestionCatalog", [
    predictionRoundAddress,
  ]);
  console.log(`  → ${questionCatalog.address}`);

  console.log("Deploying AgentTraitCatalog…");
  const traitCatalog = await viem.deployContract("AgentTraitCatalog", [agentGenomeAddress]);
  console.log(`  → ${traitCatalog.address}`);

  deployment.contracts.RoundQuestionCatalog = questionCatalog.address;
  deployment.contracts.AgentTraitCatalog = traitCatalog.address;
  writeFileSync(filePath, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`\nUpdated ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
