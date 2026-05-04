import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes, getAddress } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const DEFAULT_SHARE_BPS = 5000;
const DEFAULT_MAX_DEPTH = 4;

const hashOf = (label: string) => keccak256(toBytes(label));

async function deployStack(shareBps = DEFAULT_SHARE_BPS, maxDepth = DEFAULT_MAX_DEPTH) {
  const { viem } = hre;
  const [owner, alice, bob, carol, dave, eve, frank, grace, breeder, writer] =
    await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);
  await agentGenome.write.setBreedingContract([breeder.account.address]);
  await agentGenome.write.setGenomeWriter([writer.account.address]);

  const splitter = await viem.deployContract("RoyaltySplitter", [
    owner.account.address,
    agentGenome.address,
    shareBps,
    maxDepth,
  ]);

  return {
    agentGenome,
    splitter,
    owner,
    alice,
    bob,
    carol,
    dave,
    eve,
    frank,
    grace,
    breeder,
    writer,
  };
}

async function mintGenesis(s: Awaited<ReturnType<typeof deployStack>>, to: `0x${string}`, label: string) {
  await s.agentGenome.write.mintGenesis([to, hashOf(label)]);
}

async function breed(
  s: Awaited<ReturnType<typeof deployStack>>,
  to: `0x${string}`,
  parentA: bigint,
  parentB: bigint,
  finalizeLabel: string
) {
  await s.agentGenome.write.mintFromBreeding([to, parentA, parentB], {
    account: s.breeder.account,
  });
  const total = await s.agentGenome.read.totalMinted();
  await s.agentGenome.write.setRootHash([total, hashOf(finalizeLabel)], {
    account: s.writer.account,
  });
  return total;
}

describe("RoyaltySplitter", () => {
  describe("construction", () => {
    it("stores parameters and the genome reference", async () => {
      const { splitter, agentGenome } = await deployStack();

      expect(await splitter.read.levelShareBps()).to.equal(DEFAULT_SHARE_BPS);
      expect(await splitter.read.maxDepth()).to.equal(DEFAULT_MAX_DEPTH);
      expect((await splitter.read.agentGenome()).toLowerCase()).to.equal(
        agentGenome.address.toLowerCase()
      );
    });

    it("rejects share bps of zero", async () => {
      const { viem } = hre;
      const [owner] = await viem.getWalletClients();
      const ag = await viem.deployContract("AgentGenome", [owner.account.address, BASE_URI]);

      await expect(
        viem.deployContract("RoyaltySplitter", [owner.account.address, ag.address, 0, 1])
      ).to.be.rejectedWith(/InvalidShareBps/);
    });

    it("rejects share bps over the cap", async () => {
      const { viem } = hre;
      const [owner] = await viem.getWalletClients();
      const ag = await viem.deployContract("AgentGenome", [owner.account.address, BASE_URI]);

      await expect(
        viem.deployContract("RoyaltySplitter", [owner.account.address, ag.address, 9501, 1])
      ).to.be.rejectedWith(/InvalidShareBps/);
    });

    it("rejects depth of zero or above the absolute maximum", async () => {
      const { viem } = hre;
      const [owner] = await viem.getWalletClients();
      const ag = await viem.deployContract("AgentGenome", [owner.account.address, BASE_URI]);

      await expect(
        viem.deployContract("RoyaltySplitter", [owner.account.address, ag.address, 5000, 0])
      ).to.be.rejectedWith(/InvalidMaxDepth/);

      await expect(
        viem.deployContract("RoyaltySplitter", [owner.account.address, ag.address, 5000, 7])
      ).to.be.rejectedWith(/InvalidMaxDepth/);
    });
  });

  describe("setParameters", () => {
    it("lets the owner update both parameters", async () => {
      const { splitter } = await deployStack();
      await splitter.write.setParameters([6000, 5]);

      expect(await splitter.read.levelShareBps()).to.equal(6000);
      expect(await splitter.read.maxDepth()).to.equal(5);
    });

    it("rejects updates from a non-owner", async () => {
      const { splitter, alice } = await deployStack();

      await expect(
        splitter.write.setParameters([6000, 5], { account: alice.account })
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });

  describe("distribute", () => {
    it("rejects a zero-value call", async () => {
      const { splitter, alice } = await deployStack();
      await mintGenesis(await deployStack(), alice.account.address, "x");

      await expect(splitter.write.distribute([1n], { value: 0n })).to.be.rejectedWith(
        /NoFundsToDistribute/
      );
    });

    it("rejects a non-existent token", async () => {
      const { splitter } = await deployStack();
      await expect(splitter.write.distribute([99n], { value: 1n })).to.be.rejectedWith(
        /AgentDoesNotExist/
      );
    });

    it("credits the full amount to a genesis earner", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g1");

      await stack.splitter.write.distribute([1n], { value: 1000n });

      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(1000n);
    });

    it("splits across child and two parents one generation deep", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.bob.account.address, "p2");
      const child = await breed(stack, stack.carol.account.address, 1n, 2n, "c");

      await stack.splitter.write.distribute([child], { value: 1000n });

      expect(await stack.splitter.read.pendingOf([stack.carol.account.address])).to.equal(750n);
      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(125n);
      expect(await stack.splitter.read.pendingOf([stack.bob.account.address])).to.equal(125n);
    });

    it("walks two generations across distinct grandparents", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "gp1");
      await mintGenesis(stack, stack.bob.account.address, "gp2");
      await mintGenesis(stack, stack.carol.account.address, "gp3");
      await mintGenesis(stack, stack.dave.account.address, "gp4");
      const parentA = await breed(stack, stack.eve.account.address, 1n, 2n, "pa");
      const parentB = await breed(stack, stack.frank.account.address, 3n, 4n, "pb");
      const grandchild = await breed(stack, stack.grace.account.address, parentA, parentB, "gc");

      await stack.splitter.write.distribute([grandchild], { value: 1000n });

      expect(await stack.splitter.read.pendingOf([stack.grace.account.address])).to.equal(626n);
      expect(await stack.splitter.read.pendingOf([stack.eve.account.address])).to.equal(125n);
      expect(await stack.splitter.read.pendingOf([stack.frank.account.address])).to.equal(125n);
      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(31n);
      expect(await stack.splitter.read.pendingOf([stack.bob.account.address])).to.equal(31n);
      expect(await stack.splitter.read.pendingOf([stack.carol.account.address])).to.equal(31n);
      expect(await stack.splitter.read.pendingOf([stack.dave.account.address])).to.equal(31n);
    });

    it("stops walking once maxDepth is reached", async () => {
      const stack = await deployStack(DEFAULT_SHARE_BPS, 2);
      await mintGenesis(stack, stack.alice.account.address, "gp1");
      await mintGenesis(stack, stack.bob.account.address, "gp2");
      await mintGenesis(stack, stack.carol.account.address, "gp3");
      await mintGenesis(stack, stack.dave.account.address, "gp4");
      const parentA = await breed(stack, stack.eve.account.address, 1n, 2n, "pa");
      const parentB = await breed(stack, stack.frank.account.address, 3n, 4n, "pb");
      const grandchild = await breed(stack, stack.grace.account.address, parentA, parentB, "gc");

      await stack.splitter.write.distribute([grandchild], { value: 1000n });

      expect(await stack.splitter.read.pendingOf([stack.grace.account.address])).to.equal(750n);
      expect(await stack.splitter.read.pendingOf([stack.eve.account.address])).to.equal(125n);
      expect(await stack.splitter.read.pendingOf([stack.frank.account.address])).to.equal(125n);
      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(0n);
      expect(await stack.splitter.read.pendingOf([stack.bob.account.address])).to.equal(0n);
      expect(await stack.splitter.read.pendingOf([stack.carol.account.address])).to.equal(0n);
      expect(await stack.splitter.read.pendingOf([stack.dave.account.address])).to.equal(0n);
    });

    it("credits an inbred ancestor once per appearance", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "gp1");
      await mintGenesis(stack, stack.bob.account.address, "gp2");
      const parentA = await breed(stack, stack.carol.account.address, 1n, 2n, "pa");
      const parentB = await breed(stack, stack.dave.account.address, 1n, 2n, "pb");
      const grandchild = await breed(stack, stack.eve.account.address, parentA, parentB, "gc");

      await stack.splitter.write.distribute([grandchild], { value: 1000n });

      expect(await stack.splitter.read.pendingOf([stack.eve.account.address])).to.equal(626n);
      expect(await stack.splitter.read.pendingOf([stack.carol.account.address])).to.equal(125n);
      expect(await stack.splitter.read.pendingOf([stack.dave.account.address])).to.equal(125n);
      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(62n);
      expect(await stack.splitter.read.pendingOf([stack.bob.account.address])).to.equal(62n);
    });

    it("accumulates credit when one owner controls multiple ancestors", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.alice.account.address, "p2");
      const child = await breed(stack, stack.bob.account.address, 1n, 2n, "c");

      await stack.splitter.write.distribute([child], { value: 1000n });

      expect(await stack.splitter.read.pendingOf([stack.bob.account.address])).to.equal(750n);
      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(250n);
    });
  });

  describe("withdraw", () => {
    it("withdraws the full balance and zeroes pending", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      await stack.splitter.write.distribute([1n], { value: 1000n });

      await stack.splitter.write.withdraw({ account: stack.alice.account });

      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(0n);
    });

    it("decreases the contract balance by the withdrawn amount", async () => {
      const stack = await deployStack();
      const publicClient = await hre.viem.getPublicClient();
      await mintGenesis(stack, stack.alice.account.address, "g");
      await stack.splitter.write.distribute([1n], { value: 1000n });

      const before = await publicClient.getBalance({ address: stack.splitter.address });
      await stack.splitter.write.withdraw({ account: stack.alice.account });
      const after = await publicClient.getBalance({ address: stack.splitter.address });

      expect(before - after).to.equal(1000n);
    });

    it("rejects when the caller has no balance", async () => {
      const stack = await deployStack();

      await expect(
        stack.splitter.write.withdraw({ account: stack.alice.account })
      ).to.be.rejectedWith(/NoBalance/);
    });

    it("accumulates across multiple distributes", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await stack.splitter.write.distribute([1n], { value: 1000n });
      await stack.splitter.write.distribute([1n], { value: 500n });

      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(1500n);

      await stack.splitter.write.withdraw({ account: stack.alice.account });
      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(0n);
    });
  });
});
