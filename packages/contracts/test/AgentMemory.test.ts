import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const hashOf = (label: string) => keccak256(toBytes(label));

const SHARD_A = `0x${"a1".repeat(32)}` as const;
const SHARD_B = `0x${"b2".repeat(32)}` as const;
const SHARD_C = `0x${"c3".repeat(32)}` as const;
const ZERO = `0x${"0".repeat(64)}` as const;

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, writer, intruder] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);
  const memory = await viem.deployContract("AgentMemory", [
    owner.account.address,
    agentGenome.address,
  ]);
  await memory.write.setMemoryWriter([writer.account.address]);

  return { agentGenome, memory, owner, alice, writer, intruder };
}

async function mintGenesis(
  s: Awaited<ReturnType<typeof deployStack>>,
  to: `0x${string}`,
  label: string
) {
  await s.agentGenome.write.mintGenesis([to, hashOf(label)]);
  return s.agentGenome.read.totalMinted();
}

describe("AgentMemory", () => {
  describe("construction and admin", () => {
    it("stores the genome reference and starts with no writer", async () => {
      const { viem } = hre;
      const [owner] = await viem.getWalletClients();
      const ag = await viem.deployContract("AgentGenome", [owner.account.address, BASE_URI]);
      const mem = await viem.deployContract("AgentMemory", [owner.account.address, ag.address]);

      expect((await mem.read.agentGenome()).toLowerCase()).to.equal(ag.address.toLowerCase());
      expect(await mem.read.memoryWriter()).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("lets the owner rotate the writer", async () => {
      const { memory, alice } = await deployStack();
      await memory.write.setMemoryWriter([alice.account.address]);
      expect((await memory.read.memoryWriter()).toLowerCase()).to.equal(
        alice.account.address.toLowerCase()
      );
    });

    it("rejects writer rotation by a non-owner", async () => {
      const { memory, alice, intruder } = await deployStack();
      await expect(
        memory.write.setMemoryWriter([alice.account.address], { account: intruder.account })
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });

  describe("addShard", () => {
    it("appends a shard and emits with the correct index", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      await stack.memory.write.addShard([1n, SHARD_A], { account: stack.writer.account });

      expect(await stack.memory.read.shardCountOf([1n])).to.equal(1n);
      expect(await stack.memory.read.shardAt([1n, 0n])).to.equal(SHARD_A);
    });

    it("preserves order across multiple appends", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await stack.memory.write.addShard([1n, SHARD_A], { account: stack.writer.account });
      await stack.memory.write.addShard([1n, SHARD_B], { account: stack.writer.account });
      await stack.memory.write.addShard([1n, SHARD_C], { account: stack.writer.account });

      const all = await stack.memory.read.shardsOf([1n]);
      expect(all).to.deep.equal([SHARD_A, SHARD_B, SHARD_C]);
    });

    it("isolates shards per agent", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g1");
      await mintGenesis(stack, stack.alice.account.address, "g2");

      await stack.memory.write.addShard([1n, SHARD_A], { account: stack.writer.account });
      await stack.memory.write.addShard([2n, SHARD_B], { account: stack.writer.account });

      expect(await stack.memory.read.shardCountOf([1n])).to.equal(1n);
      expect(await stack.memory.read.shardCountOf([2n])).to.equal(1n);
      expect(await stack.memory.read.shardAt([1n, 0n])).to.equal(SHARD_A);
      expect(await stack.memory.read.shardAt([2n, 0n])).to.equal(SHARD_B);
    });

    it("rejects callers other than the writer", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await expect(
        stack.memory.write.addShard([1n, SHARD_A], { account: stack.intruder.account })
      ).to.be.rejectedWith(/NotMemoryWriter/);
    });

    it("rejects a zero shard", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await expect(
        stack.memory.write.addShard([1n, ZERO], { account: stack.writer.account })
      ).to.be.rejectedWith(/InvalidShard/);
    });

    it("rejects appending to a non-existent agent", async () => {
      const stack = await deployStack();
      await expect(
        stack.memory.write.addShard([99n, SHARD_A], { account: stack.writer.account })
      ).to.be.rejectedWith(/ERC721NonexistentToken/);
    });
  });

  describe("views", () => {
    async function setupWithFiveShards() {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const shards = [SHARD_A, SHARD_B, SHARD_C, `0x${"d4".repeat(32)}`, `0x${"e5".repeat(32)}`];
      for (const s of shards) {
        await stack.memory.write.addShard([1n, s as `0x${string}`], { account: stack.writer.account });
      }
      return { stack, shards };
    }

    it("shardsOf returns all shards in append order", async () => {
      const { stack, shards } = await setupWithFiveShards();
      const all = await stack.memory.read.shardsOf([1n]);
      expect(all).to.deep.equal(shards);
    });

    it("shardAt out-of-range reverts cleanly", async () => {
      const { stack } = await setupWithFiveShards();
      await expect(stack.memory.read.shardAt([1n, 99n])).to.be.rejectedWith(/IndexOutOfRange/);
    });

    it("recentShardsOf returns the latest n in append order", async () => {
      const { stack, shards } = await setupWithFiveShards();
      const last3 = await stack.memory.read.recentShardsOf([1n, 3n]);
      expect(last3).to.deep.equal(shards.slice(-3));
    });

    it("recentShardsOf clamps when n exceeds total", async () => {
      const { stack, shards } = await setupWithFiveShards();
      const all = await stack.memory.read.recentShardsOf([1n, 100n]);
      expect(all).to.deep.equal(shards);
    });

    it("recentShardsOf returns empty array when n=0 or no shards", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      expect(await stack.memory.read.recentShardsOf([1n, 5n])).to.deep.equal([]);

      await stack.memory.write.addShard([1n, SHARD_A], { account: stack.writer.account });
      expect(await stack.memory.read.recentShardsOf([1n, 0n])).to.deep.equal([]);
    });
  });
});
