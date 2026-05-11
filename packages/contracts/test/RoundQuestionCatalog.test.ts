import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const Q = "Will the OG token close ≥ $2.00 USD on 2026-05-15 12:00 UTC?";

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, bob] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [owner.account.address, BASE_URI]);
  const reputation = await viem.deployContract("ReputationOracle", [
    owner.account.address,
    agentGenome.address,
  ]);
  const round = await viem.deployContract("PredictionRound", [
    owner.account.address,
    agentGenome.address,
    reputation.address,
  ]);
  const catalog = await viem.deployContract("RoundQuestionCatalog", [round.address]);

  const publicClient = await viem.getPublicClient();
  const now = (await publicClient.getBlock()).timestamp;
  const commitDeadline = now + 600n;
  const revealDeadline = now + 1200n;
  const qHash = keccak256(toBytes(Q));
  await round.write.createRound([qHash, commitDeadline, revealDeadline, 0n]);

  return { agentGenome, round, catalog, qHash, owner, alice, bob };
}

describe("RoundQuestionCatalog", () => {
  it("publishes when keccak(text) matches the on-chain hash", async () => {
    const { catalog } = await deployStack();
    await catalog.write.publish([1n, Q]);
    expect(await catalog.read.textOf([1n])).to.equal(Q);
    expect(await catalog.read.isPublished([1n])).to.equal(true);
  });

  it("rejects text whose hash doesn't match", async () => {
    const { catalog } = await deployStack();
    await expect(catalog.write.publish([1n, "Different question entirely"])).to.be.rejectedWith(
      /HashMismatch/
    );
  });

  it("rejects empty text", async () => {
    const { catalog } = await deployStack();
    await expect(catalog.write.publish([1n, ""])).to.be.rejectedWith(/EmptyText/);
  });

  it("only allows publish once per round", async () => {
    const { catalog } = await deployStack();
    await catalog.write.publish([1n, Q]);
    await expect(catalog.write.publish([1n, Q])).to.be.rejectedWith(/AlreadyPublished/);
  });

  it("is permissionless — non-owner can publish if they know the text", async () => {
    const { catalog, alice } = await deployStack();
    await catalog.write.publish([1n, Q], { account: alice.account });
    expect(await catalog.read.textOf([1n])).to.equal(Q);
  });

  it("returns empty string for unpublished rounds", async () => {
    const { catalog } = await deployStack();
    expect(await catalog.read.textOf([42n])).to.equal("");
    expect(await catalog.read.isPublished([42n])).to.equal(false);
  });
});
