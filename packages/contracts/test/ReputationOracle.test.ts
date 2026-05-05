import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const hashOf = (label: string) => keccak256(toBytes(label));

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, bob, reporter, intruder] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);

  const oracle = await viem.deployContract("ReputationOracle", [
    owner.account.address,
    agentGenome.address,
  ]);

  await oracle.write.setReporter([reporter.account.address]);

  return { agentGenome, oracle, owner, alice, bob, reporter, intruder };
}

async function mintGenesis(
  s: Awaited<ReturnType<typeof deployStack>>,
  to: `0x${string}`,
  label: string
) {
  await s.agentGenome.write.mintGenesis([to, hashOf(label)]);
  return s.agentGenome.read.totalMinted();
}

describe("ReputationOracle", () => {
  describe("construction", () => {
    it("stores the genome reference and starts with no reporter", async () => {
      const { viem } = hre;
      const [owner] = await viem.getWalletClients();
      const ag = await viem.deployContract("AgentGenome", [owner.account.address, BASE_URI]);
      const oracle = await viem.deployContract("ReputationOracle", [
        owner.account.address,
        ag.address,
      ]);

      expect((await oracle.read.agentGenome()).toLowerCase()).to.equal(ag.address.toLowerCase());
      expect(await oracle.read.reporter()).to.equal("0x0000000000000000000000000000000000000000");
    });
  });

  describe("setReporter", () => {
    it("lets the owner rotate the reporter", async () => {
      const { oracle, alice } = await deployStack();
      await oracle.write.setReporter([alice.account.address]);
      expect((await oracle.read.reporter()).toLowerCase()).to.equal(
        alice.account.address.toLowerCase()
      );
    });

    it("rejects rotation by a non-owner", async () => {
      const { oracle, alice, bob } = await deployStack();

      await expect(
        oracle.write.setReporter([bob.account.address], { account: alice.account })
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });

  describe("recordPerformance", () => {
    it("records a single score and updates running stats", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await stack.oracle.write.recordPerformance([1n, 100n, 50n], {
        account: stack.reporter.account,
      });

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(50n);
      expect(await stack.oracle.read.roundCountOf([1n])).to.equal(1n);
      const [score, recorded] = await stack.oracle.read.roundScoreOf([1n, 100n]);
      expect(score).to.equal(50n);
      expect(recorded).to.equal(true);
    });

    it("aggregates positive and negative scores across rounds", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await stack.oracle.write.recordPerformance([1n, 1n, 80n], { account: stack.reporter.account });
      await stack.oracle.write.recordPerformance([1n, 2n, -30n], { account: stack.reporter.account });
      await stack.oracle.write.recordPerformance([1n, 3n, 50n], { account: stack.reporter.account });

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(100n);
      expect(await stack.oracle.read.roundCountOf([1n])).to.equal(3n);
      expect(await stack.oracle.read.averageScoreOf([1n])).to.equal(33n);
    });

    it("rejects callers other than the reporter", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await expect(
        stack.oracle.write.recordPerformance([1n, 1n, 10n], { account: stack.intruder.account })
      ).to.be.rejectedWith(/NotReporter/);
    });

    it("rejects a second record for the same (agent, round) pair", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      await stack.oracle.write.recordPerformance([1n, 1n, 50n], { account: stack.reporter.account });

      await expect(
        stack.oracle.write.recordPerformance([1n, 1n, 99n], { account: stack.reporter.account })
      ).to.be.rejectedWith(/AlreadyRecorded/);
    });

    it("rejects a non-existent agent", async () => {
      const stack = await deployStack();

      await expect(
        stack.oracle.write.recordPerformance([99n, 1n, 50n], { account: stack.reporter.account })
      ).to.be.rejectedWith(/ERC721NonexistentToken/);
    });
  });

  describe("recordBatch", () => {
    it("records multiple agents in a single round", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "a");
      await mintGenesis(stack, stack.bob.account.address, "b");

      await stack.oracle.write.recordBatch([[1n, 2n], 1n, [40n, -20n]], {
        account: stack.reporter.account,
      });

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(40n);
      expect(await stack.oracle.read.scoreOf([2n])).to.equal(-20n);
      expect(await stack.oracle.read.roundCountOf([1n])).to.equal(1n);
      expect(await stack.oracle.read.roundCountOf([2n])).to.equal(1n);
    });

    it("rejects mismatched array lengths", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "a");

      await expect(
        stack.oracle.write.recordBatch([[1n], 1n, [10n, 20n]], {
          account: stack.reporter.account,
        })
      ).to.be.rejectedWith(/LengthMismatch/);
    });

    it("reverts the whole batch if any pair was already recorded", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "a");
      await mintGenesis(stack, stack.bob.account.address, "b");
      await stack.oracle.write.recordPerformance([1n, 1n, 5n], { account: stack.reporter.account });

      await expect(
        stack.oracle.write.recordBatch([[1n, 2n], 1n, [10n, 20n]], {
          account: stack.reporter.account,
        })
      ).to.be.rejectedWith(/AlreadyRecorded/);

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(5n);
      expect(await stack.oracle.read.scoreOf([2n])).to.equal(0n);
      expect(await stack.oracle.read.roundCountOf([2n])).to.equal(0n);
    });

    it("rejects callers other than the reporter", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "a");

      await expect(
        stack.oracle.write.recordBatch([[1n], 1n, [10n]], { account: stack.intruder.account })
      ).to.be.rejectedWith(/NotReporter/);
    });
  });

  describe("views", () => {
    it("returns zero average for an unrecorded agent", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      expect(await stack.oracle.read.averageScoreOf([1n])).to.equal(0n);
    });

    it("rounds the average toward zero for negative aggregates", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await stack.oracle.write.recordPerformance([1n, 1n, -10n], { account: stack.reporter.account });
      await stack.oracle.write.recordPerformance([1n, 2n, -3n], { account: stack.reporter.account });

      expect(await stack.oracle.read.averageScoreOf([1n])).to.equal(-6n);
    });

    it("returns (0, false) for an unrecorded round", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      const [score, recorded] = await stack.oracle.read.roundScoreOf([1n, 999n]);
      expect(score).to.equal(0n);
      expect(recorded).to.equal(false);
    });
  });
});
