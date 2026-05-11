import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes, encodeFunctionData, getAddress } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const hashOf = (text: string) => keccak256(toBytes(text));

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, intruder] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);
  const reputationOracle = await viem.deployContract("ReputationOracle", [
    owner.account.address,
    agentGenome.address,
  ]);
  const royaltySplitter = await viem.deployContract("RoyaltySplitter", [
    owner.account.address,
    agentGenome.address,
    5000,
    4,
  ]);
  const predictionRound = await viem.deployContract("PredictionRound", [
    owner.account.address,
    agentGenome.address,
    reputationOracle.address,
  ]);
  await reputationOracle.write.setReporter([predictionRound.address]);

  const impl = await viem.deployContract("RoundMetadata", []);
  const init = encodeFunctionData({
    abi: impl.abi,
    functionName: "initialize",
    args: [owner.account.address, predictionRound.address],
  });
  const proxy = await viem.deployContract("ERC1967Proxy", [impl.address, init]);
  const meta = await viem.getContractAt("RoundMetadata", proxy.address);

  return {
    agentGenome,
    predictionRound,
    meta,
    owner,
    alice,
    intruder,
  };
}

async function openRound(stack: Awaited<ReturnType<typeof deployStack>>, text: string) {
  const publicClient = await hre.viem.getPublicClient();
  const now = Number((await publicClient.getBlock()).timestamp);
  const commitDeadline = BigInt(now + 3600);
  const revealDeadline = BigInt(now + 7200);
  await stack.predictionRound.write.createRound([
    hashOf(text),
    commitDeadline,
    revealDeadline,
    0n,
  ]);
}

describe("RoundMetadata (UUPS)", () => {
  it("wires predictionRound + owner on initialize", async () => {
    const stack = await deployStack();
    expect(getAddress(await stack.meta.read.predictionRound())).to.equal(
      getAddress(stack.predictionRound.address)
    );
    expect(getAddress(await stack.meta.read.owner())).to.equal(
      getAddress(stack.owner.account.address)
    );
  });

  it("anyone can publish question text that matches the hash", async () => {
    const stack = await deployStack();
    const q = "Will OG token close >= $2 on 2026-05-15?";
    await openRound(stack, q);
    await stack.meta.write.publishQuestion([1n, q], {
      account: stack.alice.account,
    });
    expect(await stack.meta.read.questionOf([1n])).to.equal(q);
    expect(await stack.meta.read.isQuestionPublished([1n])).to.equal(true);
  });

  it("rejects mismatched text", async () => {
    const stack = await deployStack();
    await openRound(stack, "real question");
    await expect(
      stack.meta.write.publishQuestion([1n, "different question"], {
        account: stack.alice.account,
      })
    ).to.be.rejectedWith(/HashMismatch/);
  });

  it("rejects empty text", async () => {
    const stack = await deployStack();
    await openRound(stack, "q");
    await expect(
      stack.meta.write.publishQuestion([1n, ""], {
        account: stack.alice.account,
      })
    ).to.be.rejectedWith(/EmptyText/);
  });

  it("rejects double-publish", async () => {
    const stack = await deployStack();
    const q = "q";
    await openRound(stack, q);
    await stack.meta.write.publishQuestion([1n, q], {
      account: stack.alice.account,
    });
    await expect(
      stack.meta.write.publishQuestion([1n, q], { account: stack.alice.account })
    ).to.be.rejectedWith(/AlreadyPublished/);
  });

  it("non-owner cannot upgrade; owner can and state survives", async () => {
    const stack = await deployStack();
    const q = "preserved";
    await openRound(stack, q);
    await stack.meta.write.publishQuestion([1n, q], {
      account: stack.alice.account,
    });

    const { viem } = hre;
    const newImpl = await viem.deployContract("RoundMetadata", []);
    await expect(
      stack.meta.write.upgradeToAndCall([newImpl.address, "0x"], {
        account: stack.intruder.account,
      })
    ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);

    await stack.meta.write.upgradeToAndCall([newImpl.address, "0x"], {
      account: stack.owner.account,
    });
    expect(await stack.meta.read.questionOf([1n])).to.equal(q);
  });
});
