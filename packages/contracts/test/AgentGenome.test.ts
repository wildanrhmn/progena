import { expect } from "chai";
import hre from "hardhat";
import { getAddress, keccak256, toBytes } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const ZERO_HASH = `0x${"0".repeat(64)}` as const;

const hashOf = (label: string) => keccak256(toBytes(label));

describe("AgentGenome", () => {
  async function deploy() {
    const { viem } = hre;
    const [owner, alice, bob, carol, breeder, writer] = await viem.getWalletClients();

    const agentGenome = await viem.deployContract("AgentGenome", [
      owner.account.address,
      BASE_URI,
    ]);

    await agentGenome.write.setBreedingContract([breeder.account.address]);
    await agentGenome.write.setGenomeWriter([writer.account.address]);

    return { agentGenome, owner, alice, bob, carol, breeder, writer };
  }

  describe("genesis minting", () => {
    it("mints with no parents and generation 0", async () => {
      const { agentGenome, alice } = await deploy();
      const root = hashOf("genesis-1");

      await agentGenome.write.mintGenesis([alice.account.address, root]);

      const data = await agentGenome.read.agentOf([1n]);
      expect(data.rootHash).to.equal(root);
      expect(data.parentA).to.equal(0n);
      expect(data.parentB).to.equal(0n);
      expect(data.generation).to.equal(0);
      expect(Number(data.bornAt)).to.be.greaterThan(0);
    });

    it("assigns sequential token ids starting at 1", async () => {
      const { agentGenome, alice, bob } = await deploy();

      await agentGenome.write.mintGenesis([alice.account.address, hashOf("a")]);
      await agentGenome.write.mintGenesis([bob.account.address, hashOf("b")]);

      expect(await agentGenome.read.ownerOf([1n])).to.equal(getAddress(alice.account.address));
      expect(await agentGenome.read.ownerOf([2n])).to.equal(getAddress(bob.account.address));
      expect(await agentGenome.read.totalMinted()).to.equal(2n);
    });

    it("flags the agent as genesis and finalized immediately", async () => {
      const { agentGenome, alice } = await deploy();

      await agentGenome.write.mintGenesis([alice.account.address, hashOf("g")]);

      expect(await agentGenome.read.isGenesisAgent([1n])).to.equal(true);
      expect(await agentGenome.read.isFinalized([1n])).to.equal(true);
    });

    it("rejects a zero root hash", async () => {
      const { agentGenome, alice } = await deploy();

      await expect(
        agentGenome.write.mintGenesis([alice.account.address, ZERO_HASH])
      ).to.be.rejectedWith(/InvalidRootHash/);
    });

    it("rejects callers other than the owner", async () => {
      const { agentGenome, alice } = await deploy();

      await expect(
        agentGenome.write.mintGenesis(
          [alice.account.address, hashOf("bad")],
          { account: alice.account }
        )
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });

  describe("breeding mints", () => {
    async function deployWithTwoParents() {
      const fixture = await deploy();
      const { agentGenome, alice } = fixture;
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("p1")]);
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("p2")]);
      return fixture;
    }

    it("mints a child with both parents recorded", async () => {
      const { agentGenome, alice, breeder } = await deployWithTwoParents();

      await agentGenome.write.mintFromBreeding(
        [alice.account.address, 1n, 2n],
        { account: breeder.account }
      );

      const data = await agentGenome.read.agentOf([3n]);
      expect(data.parentA).to.equal(1n);
      expect(data.parentB).to.equal(2n);
      expect(data.generation).to.equal(1);
      expect(data.rootHash).to.equal(ZERO_HASH);
    });

    it("computes generation as max(parentA.gen, parentB.gen) + 1", async () => {
      const { agentGenome, alice, breeder } = await deployWithTwoParents();

      await agentGenome.write.mintFromBreeding(
        [alice.account.address, 1n, 2n],
        { account: breeder.account }
      );
      const writer = (await hre.viem.getWalletClients())[5];
      await agentGenome.write.setRootHash([3n, hashOf("c1")], { account: writer.account });

      await agentGenome.write.mintGenesis([alice.account.address, hashOf("p3")]);

      await agentGenome.write.mintFromBreeding(
        [alice.account.address, 3n, 4n],
        { account: breeder.account }
      );

      const grandchild = await agentGenome.read.agentOf([5n]);
      expect(grandchild.generation).to.equal(2);
    });

    it("flags bred agents as non-genesis and not yet finalized", async () => {
      const { agentGenome, alice, breeder } = await deployWithTwoParents();

      await agentGenome.write.mintFromBreeding(
        [alice.account.address, 1n, 2n],
        { account: breeder.account }
      );

      expect(await agentGenome.read.isGenesisAgent([3n])).to.equal(false);
      expect(await agentGenome.read.isFinalized([3n])).to.equal(false);
    });

    it("rejects identical parents", async () => {
      const { agentGenome, alice, breeder } = await deployWithTwoParents();

      await expect(
        agentGenome.write.mintFromBreeding(
          [alice.account.address, 1n, 1n],
          { account: breeder.account }
        )
      ).to.be.rejectedWith(/IdenticalParents/);
    });

    it("rejects a non-existent parent", async () => {
      const { agentGenome, alice, breeder } = await deployWithTwoParents();

      await expect(
        agentGenome.write.mintFromBreeding(
          [alice.account.address, 1n, 99n],
          { account: breeder.account }
        )
      ).to.be.rejectedWith(/ParentDoesNotExist/);
    });

    it("rejects a parent whose genome is not yet finalized", async () => {
      const { agentGenome, alice, breeder } = await deployWithTwoParents();

      await agentGenome.write.mintFromBreeding(
        [alice.account.address, 1n, 2n],
        { account: breeder.account }
      );

      await expect(
        agentGenome.write.mintFromBreeding(
          [alice.account.address, 1n, 3n],
          { account: breeder.account }
        )
      ).to.be.rejectedWith(/ParentNotFinalized/);
    });

    it("rejects callers other than the breeding contract", async () => {
      const { agentGenome, alice } = await deployWithTwoParents();

      await expect(
        agentGenome.write.mintFromBreeding(
          [alice.account.address, 1n, 2n],
          { account: alice.account }
        )
      ).to.be.rejectedWith(/NotBreedingContract/);
    });
  });

  describe("setRootHash", () => {
    async function deployWithUnfinalizedChild() {
      const fixture = await deploy();
      const { agentGenome, alice, breeder } = fixture;
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("p1")]);
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("p2")]);
      await agentGenome.write.mintFromBreeding(
        [alice.account.address, 1n, 2n],
        { account: breeder.account }
      );
      return fixture;
    }

    it("finalizes a child genome via the writer role", async () => {
      const { agentGenome, writer } = await deployWithUnfinalizedChild();
      const root = hashOf("child-final");

      await agentGenome.write.setRootHash([3n, root], { account: writer.account });

      expect(await agentGenome.read.rootHashOf([3n])).to.equal(root);
      expect(await agentGenome.read.isFinalized([3n])).to.equal(true);
    });

    it("rejects a second update once finalized", async () => {
      const { agentGenome, writer } = await deployWithUnfinalizedChild();
      await agentGenome.write.setRootHash([3n, hashOf("first")], { account: writer.account });

      await expect(
        agentGenome.write.setRootHash([3n, hashOf("second")], { account: writer.account })
      ).to.be.rejectedWith(/RootHashAlreadySet/);
    });

    it("rejects a zero root hash", async () => {
      const { agentGenome, writer } = await deployWithUnfinalizedChild();

      await expect(
        agentGenome.write.setRootHash([3n, ZERO_HASH], { account: writer.account })
      ).to.be.rejectedWith(/InvalidRootHash/);
    });

    it("rejects callers other than the genome writer", async () => {
      const { agentGenome, alice } = await deployWithUnfinalizedChild();

      await expect(
        agentGenome.write.setRootHash([3n, hashOf("x")], { account: alice.account })
      ).to.be.rejectedWith(/NotGenomeWriter/);
    });

    it("rejects a non-existent token", async () => {
      const { agentGenome, writer } = await deploy();

      await expect(
        agentGenome.write.setRootHash([99n, hashOf("x")], { account: writer.account })
      ).to.be.rejectedWith(/AgentDoesNotExist/);
    });
  });

  describe("ancestry views", () => {
    it("parentsOf returns both parent ids", async () => {
      const { agentGenome, alice, breeder } = await deploy();
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("a")]);
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("b")]);
      await agentGenome.write.mintFromBreeding(
        [alice.account.address, 1n, 2n],
        { account: breeder.account }
      );

      const [pA, pB] = await agentGenome.read.parentsOf([3n]);
      expect(pA).to.equal(1n);
      expect(pB).to.equal(2n);
    });

    it("returns 0,0 for a genesis agent", async () => {
      const { agentGenome, alice } = await deploy();
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("a")]);

      const [pA, pB] = await agentGenome.read.parentsOf([1n]);
      expect(pA).to.equal(0n);
      expect(pB).to.equal(0n);
    });
  });

  describe("metadata", () => {
    it("returns the correct tokenURI", async () => {
      const { agentGenome, alice } = await deploy();
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("a")]);

      expect(await agentGenome.read.tokenURI([1n])).to.equal(`${BASE_URI}1`);
    });

    it("reflects the updated base URI", async () => {
      const { agentGenome, alice } = await deploy();
      await agentGenome.write.mintGenesis([alice.account.address, hashOf("a")]);
      const newBase = "https://progena.xyz/api/agent/";
      await agentGenome.write.setBaseURI([newBase]);

      expect(await agentGenome.read.tokenURI([1n])).to.equal(`${newBase}1`);
    });
  });

  describe("admin transitions", () => {
    it("emits when the breeding contract is updated", async () => {
      const { agentGenome, bob } = await deploy();

      await agentGenome.write.setBreedingContract([bob.account.address]);

      expect((await agentGenome.read.breedingContract()).toLowerCase()).to.equal(
        bob.account.address.toLowerCase()
      );
    });

    it("rejects non-owners trying to rotate the breeding contract", async () => {
      const { agentGenome, alice, bob } = await deploy();

      await expect(
        agentGenome.write.setBreedingContract([bob.account.address], { account: alice.account })
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });
});
