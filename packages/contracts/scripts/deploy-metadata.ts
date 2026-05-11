import hre from "hardhat";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeFunctionData } from "viem";

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
  const agentGenome = deployment.contracts.AgentGenome as `0x${string}`;
  const predictionRound = deployment.contracts.PredictionRound as `0x${string}`;

  const { viem } = hre;
  const [deployer] = await viem.getWalletClients();
  const owner = (deployment.params?.initialOwner ?? deployer.account.address) as `0x${string}`;
  const operator = (deployment.params?.memoryWriter ?? deployer.account.address) as `0x${string}`;

  console.log(`Network:          ${network}`);
  console.log(`Deployer:         ${deployer.account.address}`);
  console.log(`Owner (proxy):    ${owner}`);
  console.log(`Operator:         ${operator}`);
  console.log(`AgentGenome:      ${agentGenome}`);
  console.log(`PredictionRound:  ${predictionRound}`);
  console.log("");

  if (!deployment.contracts.AgentMetadata) {
    console.log("Deploying AgentMetadata implementation…");
    const agentMetaImpl = await viem.deployContract("AgentMetadata", []);
    console.log(`  impl → ${agentMetaImpl.address}`);

    const agentMetaInit = encodeFunctionData({
      abi: agentMetaImpl.abi,
      functionName: "initialize",
      args: [owner, agentGenome, operator],
    });
    const agentMetaProxy = await viem.deployContract("ERC1967Proxy", [
      agentMetaImpl.address,
      agentMetaInit,
    ]);
    console.log(`  proxy → ${agentMetaProxy.address}`);

    deployment.contracts.AgentMetadataImpl = agentMetaImpl.address;
    deployment.contracts.AgentMetadata = agentMetaProxy.address;
    writeFileSync(filePath, JSON.stringify(deployment, null, 2) + "\n");
  } else {
    console.log(`AgentMetadata already deployed at ${deployment.contracts.AgentMetadata} (skipping)`);
  }

  if (!deployment.contracts.RoundMetadata) {
    console.log("Deploying RoundMetadata implementation…");
    const roundMetaImpl = await viem.deployContract("RoundMetadata", []);
    console.log(`  impl → ${roundMetaImpl.address}`);

    const roundMetaInit = encodeFunctionData({
      abi: roundMetaImpl.abi,
      functionName: "initialize",
      args: [owner, predictionRound],
    });
    const roundMetaProxy = await viem.deployContract("ERC1967Proxy", [
      roundMetaImpl.address,
      roundMetaInit,
    ]);
    console.log(`  proxy → ${roundMetaProxy.address}`);

    deployment.contracts.RoundMetadataImpl = roundMetaImpl.address;
    deployment.contracts.RoundMetadata = roundMetaProxy.address;
  } else {
    console.log(`RoundMetadata already deployed at ${deployment.contracts.RoundMetadata} (skipping)`);
  }
  writeFileSync(filePath, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`\nUpdated ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
