import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes } from "viem";

const BASE_URI = "https://api.progena.xyz/agent/";
const hashOf = (label: string) => keccak256(toBytes(label));

const TRAITS_JSON =
  '{"version":1,"skills":["0g","onchain-analyst","progena-predictor"],"tools":["chain-reader"],"description":"Alpha"}';

async function deployStack() {
  const { viem } = hre;
  const [owner, alice, bob, intruder] = await viem.getWalletClients();

  const agentGenome = await viem.deployContract("AgentGenome", [owner.account.address, BASE_URI]);
  const catalog = await viem.deployContract("AgentTraitCatalog", [agentGenome.address]);

  return { agentGenome, catalog, owner, alice, bob, intruder };
}

describe("AgentTraitCatalog", () => {
  it("lets token owner publish traits", async () => {
    const stack = await deployStack();
    await stack.agentGenome.write.mintGenesis([stack.alice.account.address, hashOf("g")]);

    await stack.catalog.write.publish([1n, TRAITS_JSON], { account: stack.alice.account });
    expect(await stack.catalog.read.traitsOf([1n])).to.equal(TRAITS_JSON);
    expect(await stack.catalog.read.isPublished([1n])).to.equal(true);
  });

  it("rejects non-owner publishes", async () => {
    const stack = await deployStack();
    await stack.agentGenome.write.mintGenesis([stack.alice.account.address, hashOf("g")]);
    await expect(
      stack.catalog.write.publish([1n, TRAITS_JSON], { account: stack.bob.account })
    ).to.be.rejectedWith(/NotTokenOwner/);
  });

  it("allows owner to update", async () => {
    const stack = await deployStack();
    await stack.agentGenome.write.mintGenesis([stack.alice.account.address, hashOf("g")]);
    await stack.catalog.write.publish([1n, TRAITS_JSON], { account: stack.alice.account });

    const v2 = '{"version":1,"skills":["new-skill"]}';
    await stack.catalog.write.publish([1n, v2], { account: stack.alice.account });
    expect(await stack.catalog.read.traitsOf([1n])).to.equal(v2);
  });

  it("transfers update rights with the token", async () => {
    const stack = await deployStack();
    await stack.agentGenome.write.mintGenesis([stack.alice.account.address, hashOf("g")]);
    await stack.catalog.write.publish([1n, TRAITS_JSON], { account: stack.alice.account });

    await stack.agentGenome.write.transferFrom(
      [stack.alice.account.address, stack.bob.account.address, 1n],
      { account: stack.alice.account }
    );

    const v2 = '{"version":1,"skills":["bob-was-here"]}';
    await stack.catalog.write.publish([1n, v2], { account: stack.bob.account });
    expect(await stack.catalog.read.traitsOf([1n])).to.equal(v2);

    await expect(
      stack.catalog.write.publish([1n, TRAITS_JSON], { account: stack.alice.account })
    ).to.be.rejectedWith(/NotTokenOwner/);
  });

  it("rejects empty traits", async () => {
    const stack = await deployStack();
    await stack.agentGenome.write.mintGenesis([stack.alice.account.address, hashOf("g")]);
    await expect(
      stack.catalog.write.publish([1n, ""], { account: stack.alice.account })
    ).to.be.rejectedWith(/EmptyTraits/);
  });

  it("rejects traits exceeding MAX_TRAITS_LENGTH", async () => {
    const stack = await deployStack();
    await stack.agentGenome.write.mintGenesis([stack.alice.account.address, hashOf("g")]);
    const huge = "x".repeat(8193);
    await expect(
      stack.catalog.write.publish([1n, huge], { account: stack.alice.account })
    ).to.be.rejectedWith(/TraitsTooLong/);
  });

  it("returns empty string for unpublished tokens", async () => {
    const { catalog } = await deployStack();
    expect(await catalog.read.traitsOf([99n])).to.equal("");
    expect(await catalog.read.isPublished([99n])).to.equal(false);
  });
});
