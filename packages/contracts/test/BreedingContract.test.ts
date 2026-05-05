import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes, getAddress, parseEther } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const DEFAULT_SHARE_BPS = 5000;
const DEFAULT_MAX_DEPTH = 4;

const hashOf = (label: string) => keccak256(toBytes(label));

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, bob, carol, dave, eve, writer] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);

  const splitter = await viem.deployContract("RoyaltySplitter", [
    owner.account.address,
    agentGenome.address,
    DEFAULT_SHARE_BPS,
    DEFAULT_MAX_DEPTH,
  ]);

  const breedingContract = await viem.deployContract("BreedingContract", [
    owner.account.address,
    agentGenome.address,
    splitter.address,
  ]);

  await agentGenome.write.setBreedingContract([breedingContract.address]);
  await agentGenome.write.setGenomeWriter([writer.account.address]);

  return {
    agentGenome,
    splitter,
    breedingContract,
    owner,
    alice,
    bob,
    carol,
    dave,
    eve,
    writer,
  };
}

async function mintGenesis(
  s: Awaited<ReturnType<typeof deployStack>>,
  to: `0x${string}`,
  label: string
) {
  await s.agentGenome.write.mintGenesis([to, hashOf(label)]);
  return s.agentGenome.read.totalMinted();
}

describe("BreedingContract", () => {
  describe("construction", () => {
    it("stores immutable references to genome and splitter", async () => {
      const { breedingContract, agentGenome, splitter } = await deployStack();

      expect((await breedingContract.read.agentGenome()).toLowerCase()).to.equal(
        agentGenome.address.toLowerCase()
      );
      expect((await breedingContract.read.royaltySplitter()).toLowerCase()).to.equal(
        splitter.address.toLowerCase()
      );
    });
  });

  describe("setStudFee", () => {
    it("lets the agent owner set their stud fee", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await stack.breedingContract.write.setStudFee([1n, 1234n], { account: stack.alice.account });

      expect(await stack.breedingContract.read.studFeeOf([1n])).to.equal(1234n);
    });

    it("rejects callers that don't own the agent", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "g");

      await expect(
        stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.bob.account })
      ).to.be.rejectedWith(/NotAgentOwner/);
    });

    it("reverts on a non-existent token", async () => {
      const stack = await deployStack();

      await expect(
        stack.breedingContract.write.setStudFee([42n, 100n], { account: stack.alice.account })
      ).to.be.rejectedWith(/ERC721NonexistentToken/);
    });
  });

  describe("quoteBreedingFee", () => {
    it("returns zero when the breeder owns both parents", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.alice.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 200n], { account: stack.alice.account });

      const quote = await stack.breedingContract.read.quoteBreedingFee([
        stack.alice.account.address,
        1n,
        2n,
      ]);
      expect(quote).to.equal(0n);
    });

    it("excludes the fee for parents the breeder owns", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.bob.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 200n], { account: stack.bob.account });

      const aliceQuote = await stack.breedingContract.read.quoteBreedingFee([
        stack.alice.account.address,
        1n,
        2n,
      ]);
      expect(aliceQuote).to.equal(200n);

      const bobQuote = await stack.breedingContract.read.quoteBreedingFee([
        stack.bob.account.address,
        1n,
        2n,
      ]);
      expect(bobQuote).to.equal(100n);
    });

    it("sums both stud fees when the breeder owns neither", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.bob.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 200n], { account: stack.bob.account });

      const carolQuote = await stack.breedingContract.read.quoteBreedingFee([
        stack.carol.account.address,
        1n,
        2n,
      ]);
      expect(carolQuote).to.equal(300n);
    });
  });

  describe("breed", () => {
    it("mints a child for free when the breeder owns both parents", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.alice.account.address, "p2");

      await stack.breedingContract.write.breed([1n, 2n], { account: stack.alice.account });

      expect(await stack.agentGenome.read.totalMinted()).to.equal(3n);
      expect((await stack.agentGenome.read.ownerOf([3n])).toLowerCase()).to.equal(
        stack.alice.account.address.toLowerCase()
      );
    });

    it("refunds the surplus when more value is sent than required", async () => {
      const stack = await deployStack();
      const publicClient = await hre.viem.getPublicClient();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.bob.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 200n], { account: stack.bob.account });

      const before = await publicClient.getBalance({ address: stack.breedingContract.address });
      await stack.breedingContract.write.breed([1n, 2n], {
        account: stack.carol.account,
        value: 1000n,
      });
      const after = await publicClient.getBalance({ address: stack.breedingContract.address });

      expect(after - before).to.equal(0n);
    });

    it("reverts when the value sent is below the required fee", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.bob.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 200n], { account: stack.bob.account });

      await expect(
        stack.breedingContract.write.breed([1n, 2n], {
          account: stack.carol.account,
          value: 250n,
        })
      ).to.be.rejectedWith(/InsufficientFee/);
    });

    it("routes stud fees through the royalty splitter", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.bob.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 200n], { account: stack.bob.account });

      await stack.breedingContract.write.breed([1n, 2n], {
        account: stack.carol.account,
        value: 300n,
      });

      expect(await stack.splitter.read.pendingOf([stack.alice.account.address])).to.equal(100n);
      expect(await stack.splitter.read.pendingOf([stack.bob.account.address])).to.equal(200n);
    });

    it("does not call the splitter when both parents are owned by the breeder", async () => {
      const stack = await deployStack();
      const publicClient = await hre.viem.getPublicClient();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.alice.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 1000n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 1000n], { account: stack.alice.account });

      await stack.breedingContract.write.breed([1n, 2n], { account: stack.alice.account });

      expect(await publicClient.getBalance({ address: stack.splitter.address })).to.equal(0n);
    });

    it("reverts on identical parents", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");

      await expect(
        stack.breedingContract.write.breed([1n, 1n], { account: stack.alice.account })
      ).to.be.rejectedWith(/IdenticalParents/);
    });

    it("reverts when a parent does not exist", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");

      await expect(
        stack.breedingContract.write.breed([1n, 99n], { account: stack.alice.account })
      ).to.be.rejectedWith(/ERC721NonexistentToken/);
    });

    it("reverts when a parent is not yet finalized", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.alice.account.address, "p2");

      await stack.breedingContract.write.breed([1n, 2n], { account: stack.alice.account });

      await expect(
        stack.breedingContract.write.breed([1n, 3n], { account: stack.alice.account })
      ).to.be.rejectedWith(/ParentNotFinalized/);
    });

    it("mints the child INFT to the breeder, not the parent owners", async () => {
      const stack = await deployStack();
      await mintGenesis(stack, stack.alice.account.address, "p1");
      await mintGenesis(stack, stack.bob.account.address, "p2");
      await stack.breedingContract.write.setStudFee([1n, 100n], { account: stack.alice.account });
      await stack.breedingContract.write.setStudFee([2n, 200n], { account: stack.bob.account });

      await stack.breedingContract.write.breed([1n, 2n], {
        account: stack.carol.account,
        value: 300n,
      });

      expect((await stack.agentGenome.read.ownerOf([3n])).toLowerCase()).to.equal(
        stack.carol.account.address.toLowerCase()
      );
    });
  });
});
