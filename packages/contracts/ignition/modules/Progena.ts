import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DEFAULT_BASE_URI = "https://api.progena.xyz/agent/";
const DEFAULT_LEVEL_SHARE_BPS = 5000;
const DEFAULT_MAX_DEPTH = 4;

export default buildModule("Progena", (m) => {
  const initialOwner = m.getParameter("initialOwner", m.getAccount(0));
  const baseURI = m.getParameter("baseURI", DEFAULT_BASE_URI);
  const levelShareBps = m.getParameter("levelShareBps", DEFAULT_LEVEL_SHARE_BPS);
  const maxDepth = m.getParameter("maxDepth", DEFAULT_MAX_DEPTH);
  const genomeWriter = m.getParameter("genomeWriter", m.getAccount(0));
  const memoryWriter = m.getParameter("memoryWriter", m.getAccount(0));

  const agentGenome = m.contract("AgentGenome", [initialOwner, baseURI]);

  const royaltySplitter = m.contract("RoyaltySplitter", [
    initialOwner,
    agentGenome,
    levelShareBps,
    maxDepth,
  ]);

  const breedingContract = m.contract("BreedingContract", [
    initialOwner,
    agentGenome,
    royaltySplitter,
  ]);

  const reputationOracle = m.contract("ReputationOracle", [initialOwner, agentGenome]);

  const predictionRound = m.contract("PredictionRound", [
    initialOwner,
    agentGenome,
    reputationOracle,
  ]);

  const agentMemory = m.contract("AgentMemory", [initialOwner, agentGenome]);

  const agentRegistry = m.contract("AgentRegistry", [agentGenome]);

  m.call(agentGenome, "setBreedingContract", [breedingContract]);
  m.call(agentGenome, "setGenomeWriter", [genomeWriter]);
  m.call(reputationOracle, "setReporter", [predictionRound]);
  m.call(agentMemory, "setMemoryWriter", [memoryWriter]);

  return {
    agentGenome,
    royaltySplitter,
    breedingContract,
    reputationOracle,
    predictionRound,
    agentMemory,
    agentRegistry,
  };
});
