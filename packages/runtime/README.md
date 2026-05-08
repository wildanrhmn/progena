# progena-runtime

Off-chain orchestrator for [Progena](https://github.com/progena).

Listens to `BreedingContract.BreedingExecuted` events on 0G Chain, computes child genomes via the [progena-sdk](https://github.com/progena/progena-sdk) deterministic crossover, uploads them to 0G Storage, and finalizes the on-chain root hash. Also runs prediction-round tournaments: spawns an agent runtime per participant, collects sealed predictions, reveals after the deadline, and posts scores to `ReputationOracle`.

> Status: early development. Built for the 0G APAC Hackathon.
