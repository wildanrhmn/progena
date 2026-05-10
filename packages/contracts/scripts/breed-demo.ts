import hre from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodePacked, keccak256 } from "viem";

const PARENT_A = 1n;
const PARENT_B = 2n;

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
  const breedingAddress = deployment.contracts.BreedingContract as `0x${string}`;

  const { viem } = hre;
  const [caller] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log(`Network:  ${network}`);
  console.log(`Caller:   ${caller.account.address}`);
  console.log(`Genome:   ${genomeAddress}`);
  console.log(`Breeding: ${breedingAddress}`);
  console.log("");

  const genome = await viem.getContractAt("AgentGenome", genomeAddress);
  const breeding = await viem.getContractAt("BreedingContract", breedingAddress);

  const parentAOwner = await genome.read.ownerOf([PARENT_A]);
  const parentBOwner = await genome.read.ownerOf([PARENT_B]);
  console.log(`Parent #${PARENT_A} owner: ${parentAOwner}`);
  console.log(`Parent #${PARENT_B} owner: ${parentBOwner}`);

  const fee = await breeding.read.quoteBreedingFee([
    caller.account.address,
    PARENT_A,
    PARENT_B,
  ]);
  console.log(`Breeding fee: ${fee} wei`);

  const rootA = (await genome.read.rootHashOf([PARENT_A])) as `0x${string}`;
  const rootB = (await genome.read.rootHashOf([PARENT_B])) as `0x${string}`;
  console.log(`Parent A root: ${rootA}`);
  console.log(`Parent B root: ${rootB}`);

  const totalBefore = (await genome.read.totalMinted()) as bigint;
  console.log(`\nBreeding... (next tokenId: ${totalBefore + 1n})`);

  const breedTx = await breeding.write.breed([PARENT_A, PARENT_B], { value: fee });
  console.log(`  breed tx: ${breedTx}`);
  await publicClient.waitForTransactionReceipt({
    hash: breedTx,
    timeout: 180_000,
    retryCount: 60,
  });

  const totalAfter = (await genome.read.totalMinted()) as bigint;
  const childId = totalAfter;
  console.log(`  Child minted at tokenId #${childId}`);

  const childRootHash = keccak256(
    encodePacked(["bytes32", "bytes32", "uint256"], [rootA, rootB, childId])
  );
  console.log(`\nFinalizing child with derived rootHash:`);
  console.log(`  ${childRootHash}`);
  const finalizeTx = await genome.write.setRootHash([childId, childRootHash]);
  console.log(`  setRootHash tx: ${finalizeTx}`);
  await publicClient.waitForTransactionReceipt({
    hash: finalizeTx,
    timeout: 180_000,
    retryCount: 60,
  });

  const isFinal = await genome.read.isFinalized([childId]);
  const data = await genome.read.agentOf([childId]);
  console.log(`\nChild #${childId} ready:`);
  console.log(`  finalized:  ${isFinal}`);
  console.log(`  generation: ${data.generation}`);
  console.log(`  parentA:    ${data.parentA}`);
  console.log(`  parentB:    ${data.parentB}`);
  console.log(`  rootHash:   ${data.rootHash}`);
  console.log(`\nView at: /agents/${childId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
