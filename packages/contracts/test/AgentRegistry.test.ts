import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const hashOf = (label: string) => keccak256(toBytes(label));
const MAX_UINT = (1n << 256n) - 1n;

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, bob, intruder] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);
  const registry = await viem.deployContract("AgentRegistry", [agentGenome.address]);

  return { agentGenome, registry, owner, alice, bob, intruder };
}

async function mintTo(
  s: Awaited<ReturnType<typeof deployStack>>,
  to: `0x${string}`,
  label: string
) {
  await s.agentGenome.write.mintGenesis([to, hashOf(label)]);
  return s.agentGenome.read.totalMinted();
}

describe("AgentRegistry", () => {
  describe("construction", () => {
    it("stores the genome reference and has no owner", async () => {
      const { registry, agentGenome } = await deployStack();
      expect((await registry.read.agentGenome()).toLowerCase()).to.equal(
        agentGenome.address.toLowerCase()
      );
      expect(await registry.read.MIN_NAME_LENGTH()).to.equal(2n);
      expect(await registry.read.MAX_NAME_LENGTH()).to.equal(32n);
    });
  });

  describe("setName", () => {
    it("lets the token owner claim a name and emits NameSet", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g");

      await stack.registry.write.setName([1n, "Alpha"], { account: stack.alice.account });

      expect(await stack.registry.read.nameOf([1n])).to.equal("Alpha");
      expect(await stack.registry.read.isClaimed(["Alpha"])).to.equal(true);
      expect(await stack.registry.read.tokenIdOf(["Alpha"])).to.equal(1n);
    });

    it("rejects callers who do not own the token", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g");

      await expect(
        stack.registry.write.setName([1n, "Alpha"], { account: stack.bob.account })
      ).to.be.rejectedWith(/NotTokenOwner/);
    });

    it("rejects a second name claim on the same token", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g");

      await stack.registry.write.setName([1n, "Alpha"], { account: stack.alice.account });
      await expect(
        stack.registry.write.setName([1n, "Beta"], { account: stack.alice.account })
      ).to.be.rejectedWith(/NameAlreadySet/);
    });

    it("rejects a name already claimed by another token", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g1");
      await mintTo(stack, stack.bob.account.address, "g2");

      await stack.registry.write.setName([1n, "Alpha"], { account: stack.alice.account });
      await expect(
        stack.registry.write.setName([2n, "Alpha"], { account: stack.bob.account })
      ).to.be.rejectedWith(/NameAlreadyClaimed/);
    });

    it("treats different cases as distinct names", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g1");
      await mintTo(stack, stack.bob.account.address, "g2");

      await stack.registry.write.setName([1n, "Alpha"], { account: stack.alice.account });
      await stack.registry.write.setName([2n, "ALPHA"], { account: stack.bob.account });

      expect(await stack.registry.read.nameOf([1n])).to.equal("Alpha");
      expect(await stack.registry.read.nameOf([2n])).to.equal("ALPHA");
    });

    it("rejects names that are too short or too long", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g");

      await expect(
        stack.registry.write.setName([1n, "a"], { account: stack.alice.account })
      ).to.be.rejectedWith(/InvalidNameLength/);
      await expect(
        stack.registry.write.setName([1n, "x".repeat(33)], { account: stack.alice.account })
      ).to.be.rejectedWith(/InvalidNameLength/);
    });

    it("rejects names with disallowed characters", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g");

      await expect(
        stack.registry.write.setName([1n, "bad/name"], { account: stack.alice.account })
      ).to.be.rejectedWith(/InvalidNameCharacter/);
      await expect(
        stack.registry.write.setName([1n, "emoji\u{1F600}"], { account: stack.alice.account })
      ).to.be.rejectedWith(/InvalidNameCharacter/);
    });

    it("accepts alphanumeric, dash, underscore, and space", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g");

      await stack.registry.write.setName([1n, "Cyber-Sage_01 v2"], {
        account: stack.alice.account,
      });
      expect(await stack.registry.read.nameOf([1n])).to.equal("Cyber-Sage_01 v2");
    });

    it("survives an ownership transfer of the token (name stays with tokenId)", async () => {
      const stack = await deployStack();
      await mintTo(stack, stack.alice.account.address, "g");

      await stack.registry.write.setName([1n, "Alpha"], { account: stack.alice.account });
      await stack.agentGenome.write.transferFrom(
        [stack.alice.account.address, stack.bob.account.address, 1n],
        { account: stack.alice.account }
      );

      expect(await stack.registry.read.nameOf([1n])).to.equal("Alpha");
      expect(await stack.registry.read.tokenIdOf(["Alpha"])).to.equal(1n);
    });
  });

  describe("views", () => {
    it("returns sentinel max-uint for unclaimed names", async () => {
      const { registry } = await deployStack();
      expect(await registry.read.tokenIdOf(["Nobody"])).to.equal(MAX_UINT);
      expect(await registry.read.isClaimed(["Nobody"])).to.equal(false);
      expect(await registry.read.nameOf([42n])).to.equal("");
    });
  });
});
