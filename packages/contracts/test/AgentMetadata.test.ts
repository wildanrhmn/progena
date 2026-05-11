import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes, encodeFunctionData, getAddress } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const hashOf = (label: string) => keccak256(toBytes(label));

const TRAITS_JSON =
  '{"version":1,"skills":["onchain-analyst"],"tools":["chain-reader"]}';

const ROOT_A = "0x" + "aa".repeat(32) as `0x${string}`;
const ROOT_B = "0x" + "bb".repeat(32) as `0x${string}`;
const ZERO = "0x" + "00".repeat(32) as `0x${string}`;

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, bob, operator, intruder, governor2] =
    await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [
    owner.account.address,
    BASE_URI,
  ]);

  const impl = await viem.deployContract("AgentMetadata", []);
  const initCalldata = encodeFunctionData({
    abi: impl.abi,
    functionName: "initialize",
    args: [owner.account.address, agentGenome.address, operator.account.address],
  });
  const proxy = await viem.deployContract("ERC1967Proxy", [
    impl.address,
    initCalldata,
  ]);

  const meta = await viem.getContractAt("AgentMetadata", proxy.address);
  return {
    agentGenome,
    impl,
    proxy,
    meta,
    owner,
    alice,
    bob,
    operator,
    intruder,
    governor2,
  };
}

describe("AgentMetadata (UUPS)", () => {
  describe("initialization", () => {
    it("wires agentGenome, operator, and owner", async () => {
      const stack = await deployStack();
      expect(getAddress(await stack.meta.read.agentGenome())).to.equal(
        getAddress(stack.agentGenome.address)
      );
      expect(getAddress(await stack.meta.read.operator())).to.equal(
        getAddress(stack.operator.account.address)
      );
      expect(getAddress(await stack.meta.read.owner())).to.equal(
        getAddress(stack.owner.account.address)
      );
    });

    it("rejects re-initialization", async () => {
      const stack = await deployStack();
      await expect(
        stack.meta.write.initialize([
          stack.owner.account.address,
          stack.agentGenome.address,
          stack.operator.account.address,
        ])
      ).to.be.rejectedWith(/InvalidInitialization/);
    });

    it("rejects zero addresses on initialize", async () => {
      const { viem } = hre;
      const [owner] = await viem.getWalletClients();
      const agentGenome = await viem.deployContract("AgentGenome", [
        owner.account.address,
        BASE_URI,
      ]);
      const impl = await viem.deployContract("AgentMetadata", []);
      const bad = encodeFunctionData({
        abi: impl.abi,
        functionName: "initialize",
        args: [
          owner.account.address,
          agentGenome.address,
          "0x0000000000000000000000000000000000000000",
        ],
      });
      await expect(viem.deployContract("ERC1967Proxy", [impl.address, bad]))
        .to.be.rejectedWith(/ZeroAddress/);
    });
  });

  describe("names", () => {
    it("token owner can set a name once", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await stack.meta.write.setName([1n, "Alpha"], {
        account: stack.alice.account,
      });
      expect(await stack.meta.read.nameOf([1n])).to.equal("Alpha");
      expect(await stack.meta.read.hasName([1n])).to.equal(true);
    });

    it("rejects second name set (set-once)", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await stack.meta.write.setName([1n, "Alpha"], {
        account: stack.alice.account,
      });
      await expect(
        stack.meta.write.setName([1n, "Beta"], { account: stack.alice.account })
      ).to.be.rejectedWith(/NameAlreadyClaimed/);
    });

    it("rejects non-owner setName", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await expect(
        stack.meta.write.setName([1n, "x"], { account: stack.bob.account })
      ).to.be.rejectedWith(/NotTokenOwner/);
    });

    it("rejects empty + over-long names", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await expect(
        stack.meta.write.setName([1n, ""], { account: stack.alice.account })
      ).to.be.rejectedWith(/EmptyName/);
      await expect(
        stack.meta.write.setName([1n, "x".repeat(33)], {
          account: stack.alice.account,
        })
      ).to.be.rejectedWith(/NameTooLong/);
    });
  });

  describe("traits", () => {
    it("owner can publish + update traits", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await stack.meta.write.publishTraits([1n, TRAITS_JSON], {
        account: stack.alice.account,
      });
      expect(await stack.meta.read.traitsOf([1n])).to.equal(TRAITS_JSON);
      expect(await stack.meta.read.isTraitsPublished([1n])).to.equal(true);

      const v2 = '{"version":1,"skills":["new"]}';
      await stack.meta.write.publishTraits([1n, v2], {
        account: stack.alice.account,
      });
      expect(await stack.meta.read.traitsOf([1n])).to.equal(v2);
    });

    it("transfers trait publish rights with the token", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await stack.meta.write.publishTraits([1n, TRAITS_JSON], {
        account: stack.alice.account,
      });
      await stack.agentGenome.write.transferFrom(
        [stack.alice.account.address, stack.bob.account.address, 1n],
        { account: stack.alice.account }
      );
      await stack.meta.write.publishTraits([1n, '{"v":2}'], {
        account: stack.bob.account,
      });
      await expect(
        stack.meta.write.publishTraits([1n, '{"v":3}'], {
          account: stack.alice.account,
        })
      ).to.be.rejectedWith(/NotTokenOwner/);
    });

    it("rejects empty + over-long traits", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await expect(
        stack.meta.write.publishTraits([1n, ""], { account: stack.alice.account })
      ).to.be.rejectedWith(/EmptyTraits/);
      await expect(
        stack.meta.write.publishTraits([1n, "x".repeat(8193)], {
          account: stack.alice.account,
        })
      ).to.be.rejectedWith(/TraitsTooLong/);
    });
  });

  describe("earned skills", () => {
    it("operator records earned skills and they accumulate", async () => {
      const stack = await deployStack();
      await stack.meta.write.recordEarnedSkill(
        [1n, "domain-mastery-macro", ROOT_A, 2n, "3 strong macro rounds"],
        { account: stack.operator.account }
      );
      await stack.meta.write.recordEarnedSkill(
        [1n, "sentiment-fade", ROOT_B, 3n, "fade on extremes"],
        { account: stack.operator.account }
      );
      expect(await stack.meta.read.earnedCountOf([1n])).to.equal(2n);
      const list = await stack.meta.read.earnedSkillsOf([1n]);
      expect(list.map((s) => s.skillName)).to.deep.equal([
        "domain-mastery-macro",
        "sentiment-fade",
      ]);
      expect(list[0].skillRootHash).to.equal(ROOT_A);
      expect(list[0].earnedInRound).to.equal(2n);
    });

    it("rejects non-operator", async () => {
      const stack = await deployStack();
      await expect(
        stack.meta.write.recordEarnedSkill(
          [1n, "x", ROOT_A, 1n, "r"],
          { account: stack.intruder.account }
        )
      ).to.be.rejectedWith(/NotOperator/);
    });

    it("rejects duplicate skill per token but allows same name on different tokens", async () => {
      const stack = await deployStack();
      await stack.meta.write.recordEarnedSkill(
        [1n, "macro", ROOT_A, 1n, "r"],
        { account: stack.operator.account }
      );
      await expect(
        stack.meta.write.recordEarnedSkill(
          [1n, "macro", ROOT_B, 2n, "r2"],
          { account: stack.operator.account }
        )
      ).to.be.rejectedWith(/SkillAlreadyEarned/);
      await stack.meta.write.recordEarnedSkill(
        [2n, "macro", ROOT_B, 2n, "r"],
        { account: stack.operator.account }
      );
      expect(await stack.meta.read.hasEarnedSkill([1n, "macro"])).to.equal(true);
      expect(await stack.meta.read.hasEarnedSkill([2n, "macro"])).to.equal(true);
    });

    it("validates inputs", async () => {
      const stack = await deployStack();
      await expect(
        stack.meta.write.recordEarnedSkill([1n, "", ROOT_A, 1n, "r"], {
          account: stack.operator.account,
        })
      ).to.be.rejectedWith(/EmptySkillName/);
      await expect(
        stack.meta.write.recordEarnedSkill([1n, "x".repeat(65), ROOT_A, 1n, "r"], {
          account: stack.operator.account,
        })
      ).to.be.rejectedWith(/SkillNameTooLong/);
      await expect(
        stack.meta.write.recordEarnedSkill([1n, "x", ZERO, 1n, "r"], {
          account: stack.operator.account,
        })
      ).to.be.rejectedWith(/EmptyRootHash/);
      await expect(
        stack.meta.write.recordEarnedSkill([1n, "x", ROOT_A, 1n, "y".repeat(513)], {
          account: stack.operator.account,
        })
      ).to.be.rejectedWith(/ReasoningTooLong/);
    });
  });

  describe("operator rotation", () => {
    it("owner rotates operator", async () => {
      const stack = await deployStack();
      await stack.meta.write.setOperator([stack.governor2.account.address], {
        account: stack.owner.account,
      });
      expect(getAddress(await stack.meta.read.operator())).to.equal(
        getAddress(stack.governor2.account.address)
      );
      await stack.meta.write.recordEarnedSkill(
        [1n, "x", ROOT_A, 1n, "r"],
        { account: stack.governor2.account }
      );
      await expect(
        stack.meta.write.recordEarnedSkill([1n, "y", ROOT_A, 1n, "r"], {
          account: stack.operator.account,
        })
      ).to.be.rejectedWith(/NotOperator/);
    });

    it("non-owner cannot rotate operator", async () => {
      const stack = await deployStack();
      await expect(
        stack.meta.write.setOperator([stack.intruder.account.address], {
          account: stack.intruder.account,
        })
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });

  describe("UUPS upgrades", () => {
    it("only owner can upgrade", async () => {
      const stack = await deployStack();
      const { viem } = hre;
      const newImpl = await viem.deployContract("AgentMetadata", []);
      await expect(
        stack.meta.write.upgradeToAndCall([newImpl.address, "0x"], {
          account: stack.intruder.account,
        })
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });

    it("owner-authorized upgrade preserves state", async () => {
      const stack = await deployStack();
      await stack.agentGenome.write.mintGenesis([
        stack.alice.account.address,
        hashOf("g"),
      ]);
      await stack.meta.write.setName([1n, "Alpha"], {
        account: stack.alice.account,
      });
      await stack.meta.write.publishTraits([1n, TRAITS_JSON], {
        account: stack.alice.account,
      });
      await stack.meta.write.recordEarnedSkill(
        [1n, "macro", ROOT_A, 1n, "r"],
        { account: stack.operator.account }
      );

      const { viem } = hre;
      const newImpl = await viem.deployContract("AgentMetadata", []);
      await stack.meta.write.upgradeToAndCall([newImpl.address, "0x"], {
        account: stack.owner.account,
      });

      expect(await stack.meta.read.nameOf([1n])).to.equal("Alpha");
      expect(await stack.meta.read.traitsOf([1n])).to.equal(TRAITS_JSON);
      expect(await stack.meta.read.earnedCountOf([1n])).to.equal(1n);
    });
  });
});
