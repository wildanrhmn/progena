import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes, encodeAbiParameters, pad } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const BASE_URI = "https://api.progena.xyz/agent/";
const QUESTION = keccak256(toBytes("Will BTC close above $100k on resolution day?"));
const NONCE_A = pad("0x01", { size: 32 });
const NONCE_B = pad("0x02", { size: 32 });

const hashOf = (label: string) => keccak256(toBytes(label));

function commitOf(roundId: bigint, agentId: bigint, prediction: number, nonce: `0x${string}`) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "uint16" }, { type: "bytes32" }],
      [roundId, agentId, prediction, nonce]
    )
  );
}

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, bob, carol, intruder] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);

  const oracle = await viem.deployContract("ReputationOracle", [
    owner.account.address,
    agentGenome.address,
  ]);

  const round = await viem.deployContract("PredictionRound", [
    owner.account.address,
    agentGenome.address,
    oracle.address,
  ]);

  await oracle.write.setReporter([round.address]);

  return { agentGenome, oracle, round, owner, alice, bob, carol, intruder };
}

async function mintGenesis(
  s: Awaited<ReturnType<typeof deployStack>>,
  to: `0x${string}`,
  label: string
) {
  await s.agentGenome.write.mintGenesis([to, hashOf(label)]);
  return s.agentGenome.read.totalMinted();
}

async function openRound(s: Awaited<ReturnType<typeof deployStack>>) {
  const now = await time.latest();
  const commitDeadline = BigInt(now + 3600);
  const revealDeadline = BigInt(now + 7200);
  await s.round.write.createRound([QUESTION, commitDeadline, revealDeadline]);
  return { roundId: 1n, commitDeadline, revealDeadline };
}

describe("PredictionRound", () => {
  describe("createRound", () => {
    it("assigns sequential round ids and stores deadlines", async () => {
      const stack = await deployStack();
      const { roundId, commitDeadline, revealDeadline } = await openRound(stack);

      const data = await stack.round.read.roundOf([roundId]);
      expect(data.commitDeadline).to.equal(commitDeadline);
      expect(data.revealDeadline).to.equal(revealDeadline);
      expect(data.questionHash).to.equal(QUESTION);
      expect(data.resolved).to.equal(false);
      expect(await stack.round.read.nextRoundId()).to.equal(2n);
    });

    it("rejects callers other than the owner", async () => {
      const stack = await deployStack();
      const now = await time.latest();

      await expect(
        stack.round.write.createRound(
          [QUESTION, BigInt(now + 100), BigInt(now + 200)],
          { account: stack.alice.account }
        )
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });

    it("rejects deadlines in the past or out of order", async () => {
      const stack = await deployStack();
      const now = await time.latest();

      await expect(
        stack.round.write.createRound([QUESTION, BigInt(now - 1), BigInt(now + 100)])
      ).to.be.rejectedWith(/InvalidDeadlines/);

      await expect(
        stack.round.write.createRound([QUESTION, BigInt(now + 200), BigInt(now + 100)])
      ).to.be.rejectedWith(/InvalidDeadlines/);
    });
  });

  describe("statusOf", () => {
    it("walks the full lifecycle", async () => {
      const stack = await deployStack();
      const { roundId, commitDeadline, revealDeadline } = await openRound(stack);

      expect(await stack.round.read.statusOf([roundId])).to.equal(1);

      await time.increaseTo(commitDeadline + 1n);
      expect(await stack.round.read.statusOf([roundId])).to.equal(2);

      await time.increaseTo(revealDeadline + 1n);
      expect(await stack.round.read.statusOf([roundId])).to.equal(3);

      await stack.round.write.resolveRound([roundId, 5000]);
      expect(await stack.round.read.statusOf([roundId])).to.equal(4);
    });

    it("returns NonExistent for unknown round ids", async () => {
      const stack = await deployStack();
      expect(await stack.round.read.statusOf([42n])).to.equal(0);
    });
  });

  describe("commitPrediction", () => {
    it("stores the commit and lists the agent", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId } = await openRound(stack);
      const ch = commitOf(roundId, 1n, 7000, NONCE_A);

      await stack.round.write.commitPrediction([roundId, 1n, ch], {
        account: stack.alice.account,
      });

      const c = await stack.round.read.commitmentOf([roundId, 1n]);
      expect(c.commitHash).to.equal(ch);
      expect(c.exists).to.equal(true);
      expect(c.revealed).to.equal(false);

      const agents = await stack.round.read.agentsOf([roundId]);
      expect(agents.length).to.equal(1);
      expect(agents[0]).to.equal(1n);
    });

    it("rejects callers that don't own the agent", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId } = await openRound(stack);
      const ch = commitOf(roundId, 1n, 5000, NONCE_A);

      await expect(
        stack.round.write.commitPrediction([roundId, 1n, ch], { account: stack.bob.account })
      ).to.be.rejectedWith(/NotAgentOwner/);
    });

    it("rejects double-commits for the same agent in the same round", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId } = await openRound(stack);
      const ch = commitOf(roundId, 1n, 5000, NONCE_A);
      await stack.round.write.commitPrediction([roundId, 1n, ch], {
        account: stack.alice.account,
      });

      await expect(
        stack.round.write.commitPrediction([roundId, 1n, ch], { account: stack.alice.account })
      ).to.be.rejectedWith(/AlreadyCommitted/);
    });

    it("rejects commits after the deadline", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId, commitDeadline } = await openRound(stack);
      await time.increaseTo(commitDeadline + 1n);

      await expect(
        stack.round.write.commitPrediction([roundId, 1n, commitOf(roundId, 1n, 5000, NONCE_A)], {
          account: stack.alice.account,
        })
      ).to.be.rejectedWith(/NotInCommitPhase/);
    });
  });

  describe("revealPrediction", () => {
    it("accepts a matching reveal during the reveal phase", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId, commitDeadline } = await openRound(stack);
      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, 8000, NONCE_A)],
        { account: stack.alice.account }
      );
      await time.increaseTo(commitDeadline + 1n);

      await stack.round.write.revealPrediction([roundId, 1n, 8000, NONCE_A]);

      const c = await stack.round.read.commitmentOf([roundId, 1n]);
      expect(c.revealed).to.equal(true);
      expect(c.prediction).to.equal(8000);
    });

    it("rejects reveals during the commit phase", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId } = await openRound(stack);
      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, 5000, NONCE_A)],
        { account: stack.alice.account }
      );

      await expect(
        stack.round.write.revealPrediction([roundId, 1n, 5000, NONCE_A])
      ).to.be.rejectedWith(/NotInRevealPhase/);
    });

    it("rejects reveals after the reveal deadline", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId, commitDeadline, revealDeadline } = await openRound(stack);
      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, 5000, NONCE_A)],
        { account: stack.alice.account }
      );
      await time.increaseTo(revealDeadline + 1n);

      await expect(
        stack.round.write.revealPrediction([roundId, 1n, 5000, NONCE_A])
      ).to.be.rejectedWith(/NotInRevealPhase/);
    });

    it("rejects reveals whose hash does not match the commit", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId, commitDeadline } = await openRound(stack);
      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, 7000, NONCE_A)],
        { account: stack.alice.account }
      );
      await time.increaseTo(commitDeadline + 1n);

      await expect(
        stack.round.write.revealPrediction([roundId, 1n, 7001, NONCE_A])
      ).to.be.rejectedWith(/InvalidReveal/);

      await expect(
        stack.round.write.revealPrediction([roundId, 1n, 7000, NONCE_B])
      ).to.be.rejectedWith(/InvalidReveal/);
    });

    it("rejects predictions out of range", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId, commitDeadline } = await openRound(stack);
      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, 12000, NONCE_A)],
        { account: stack.alice.account }
      );
      await time.increaseTo(commitDeadline + 1n);

      await expect(
        stack.round.write.revealPrediction([roundId, 1n, 12000, NONCE_A])
      ).to.be.rejectedWith(/PredictionOutOfRange/);
    });

    it("rejects double reveals", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId, commitDeadline } = await openRound(stack);
      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, 5000, NONCE_A)],
        { account: stack.alice.account }
      );
      await time.increaseTo(commitDeadline + 1n);
      await stack.round.write.revealPrediction([roundId, 1n, 5000, NONCE_A]);

      await expect(
        stack.round.write.revealPrediction([roundId, 1n, 5000, NONCE_A])
      ).to.be.rejectedWith(/AlreadyRevealed/);
    });
  });

  describe("resolveRound", () => {
    async function setupResolvable(prediction: number) {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");
      const { roundId, commitDeadline, revealDeadline } = await openRound(stack);

      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, prediction, NONCE_A)],
        { account: stack.alice.account }
      );
      await time.increaseTo(commitDeadline + 1n);
      await stack.round.write.revealPrediction([roundId, 1n, prediction, NONCE_A]);
      await time.increaseTo(revealDeadline + 1n);

      return { stack, roundId };
    }

    it("scores a perfect prediction at +10000", async () => {
      const { stack, roundId } = await setupResolvable(10000);
      await stack.round.write.resolveRound([roundId, 10000]);

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(10000n);
    });

    it("scores a neutral prediction at 0 against a YES outcome", async () => {
      const { stack, roundId } = await setupResolvable(5000);
      await stack.round.write.resolveRound([roundId, 10000]);

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(0n);
    });

    it("scores a perfectly wrong prediction at -10000", async () => {
      const { stack, roundId } = await setupResolvable(10000);
      await stack.round.write.resolveRound([roundId, 0]);

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(-10000n);
    });

    it("scores intermediate distances symmetrically", async () => {
      const { stack, roundId } = await setupResolvable(7500);
      await stack.round.write.resolveRound([roundId, 10000]);

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(5000n);
    });

    it("skips agents that committed but never revealed", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "ga");
      await mintGenesis(stack, stack.bob.account.address, "gb");
      const { roundId, commitDeadline, revealDeadline } = await openRound(stack);

      await stack.round.write.commitPrediction(
        [roundId, 1n, commitOf(roundId, 1n, 9000, NONCE_A)],
        { account: stack.alice.account }
      );
      await stack.round.write.commitPrediction(
        [roundId, 2n, commitOf(roundId, 2n, 4000, NONCE_B)],
        { account: stack.bob.account }
      );

      await time.increaseTo(commitDeadline + 1n);
      await stack.round.write.revealPrediction([roundId, 1n, 9000, NONCE_A]);
      await time.increaseTo(revealDeadline + 1n);
      await stack.round.write.resolveRound([roundId, 10000]);

      expect(await stack.oracle.read.scoreOf([1n])).to.equal(8000n);
      expect(await stack.oracle.read.roundCountOf([1n])).to.equal(1n);
      expect(await stack.oracle.read.roundCountOf([2n])).to.equal(0n);
    });

    it("rejects callers other than the owner", async () => {
      const stack = await deployStack();
      const { roundId, revealDeadline } = await openRound(stack);
      await time.increaseTo(revealDeadline + 1n);

      await expect(
        stack.round.write.resolveRound([roundId, 5000], { account: stack.alice.account })
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });

    it("rejects resolution before the reveal deadline", async () => {
      const stack = await deployStack();
      const { roundId } = await openRound(stack);

      await expect(stack.round.write.resolveRound([roundId, 5000])).to.be.rejectedWith(
        /RevealPhaseNotEnded/
      );
    });

    it("rejects double resolution", async () => {
      const stack = await deployStack();
      const { roundId, revealDeadline } = await openRound(stack);
      await time.increaseTo(revealDeadline + 1n);
      await stack.round.write.resolveRound([roundId, 5000]);

      await expect(stack.round.write.resolveRound([roundId, 5000])).to.be.rejectedWith(
        /RoundAlreadyResolved/
      );
    });

    it("rejects an outcome out of range", async () => {
      const stack = await deployStack();
      const { roundId, revealDeadline } = await openRound(stack);
      await time.increaseTo(revealDeadline + 1n);

      await expect(stack.round.write.resolveRound([roundId, 12000])).to.be.rejectedWith(
        /InvalidOutcome/
      );
    });
  });
});
