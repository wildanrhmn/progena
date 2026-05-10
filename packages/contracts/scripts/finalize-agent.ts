import hre from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodePacked, keccak256 } from "viem";

const TOKEN_ID = process.env.TOKEN_ID ? BigInt(process.env.TOKEN_ID) : 5n;

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
  const publicClient = await viem.getPublicClient();
  const genome = await viem.getContractAt("AgentGenome", genomeAddress);

  const data = await genome.read.agentOf([TOKEN_ID]);
  if (data.rootHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log(`#${TOKEN_ID} already finalized: ${data.rootHash}`);
    return;
  }

  const rootA = (await genome.read.rootHashOf([data.parentA])) as `0x${string}`;
  const rootB = (await genome.read.rootHashOf([data.parentB])) as `0x${string}`;
  const childRootHash = keccak256(
    encodePacked(["bytes32", "bytes32", "uint256"], [rootA, rootB, TOKEN_ID])
  );
  console.log(`Child #${TOKEN_ID}`);
  console.log(`  parents:  #${data.parentA} × #${data.parentB}`);
  console.log(`  rootA:    ${rootA}`);
  console.log(`  rootB:    ${rootB}`);
  console.log(`  derived:  ${childRootHash}`);

  const tx = await genome.write.setRootHash([TOKEN_ID, childRootHash]);
  console.log(`  tx: ${tx}`);
  await publicClient.waitForTransactionReceipt({
    hash: tx,
    timeout: 180_000,
    retryCount: 60,
  });

  const finalized = await genome.read.isFinalized([TOKEN_ID]);
  console.log(`  finalized: ${finalized}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
