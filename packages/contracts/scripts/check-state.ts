import hre from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodePacked, keccak256 } from "viem";

const DEPLOYMENTS = {
  galileo: "deployments/galileo.json",
  mainnet: "deployments/mainnet.json",
} as const;

async function main() {
  const network = hre.network.name as keyof typeof DEPLOYMENTS;
  const file = DEPLOYMENTS[network];
  if (!file) throw new Error(`Unknown network: ${network}`);

  const deployment = JSON.parse(readFileSync(resolve(file), "utf-8"));
  const genomeAddress = deployment.contracts.AgentGenome as `0x${string}`;

  const { viem } = hre;
  const genome = await viem.getContractAt("AgentGenome", genomeAddress);

  const total = (await genome.read.totalMinted()) as bigint;
  console.log(`totalMinted: ${total}`);

  for (let i = 1n; i <= total; i++) {
    const data = await genome.read.agentOf([i]);
    const finalized = await genome.read.isFinalized([i]);
    console.log(
      `  #${i}  gen=${data.generation}  parents=(${data.parentA}, ${data.parentB})  rootHash=${data.rootHash}  finalized=${finalized}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
