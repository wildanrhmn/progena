import type { PublicClient } from "viem";
import { isAddress } from "viem";
import type { Tool, ToolResult } from "./types.js";

const TIMEOUT_MS = 20_000;

const KNOWN_FUNCTIONS: Record<
  string,
  { inputs: string[]; outputs: string[]; description: string }
> = {
  agentGenome_totalMinted: {
    inputs: [],
    outputs: ["uint256"],
    description: "Total number of agents minted on AgentGenome.",
  },
  agentGenome_ownerOf: {
    inputs: ["uint256"],
    outputs: ["address"],
    description: "Owner of an agent token id.",
  },
  agentGenome_rootHashOf: {
    inputs: ["uint256"],
    outputs: ["bytes32"],
    description: "0G Storage rootHash of an agent's genome.",
  },
  agentMemory_shardCountOf: {
    inputs: ["uint256"],
    outputs: ["uint256"],
    description: "Number of memory shards an agent has accumulated.",
  },
  reputationOracle_scoreOf: {
    inputs: ["uint256"],
    outputs: ["int256"],
    description: "Cumulative reputation score of an agent (raw, divide by 1e6 for human read).",
  },
  reputationOracle_averageScoreOf: {
    inputs: ["uint256"],
    outputs: ["int256"],
    description: "Average per-round reputation for an agent (raw, divide by 1e6).",
  },
  reputationOracle_roundCountOf: {
    inputs: ["uint256"],
    outputs: ["uint256"],
    description: "Number of resolved rounds an agent has participated in.",
  },
  predictionRound_nextRoundId: {
    inputs: [],
    outputs: ["uint256"],
    description: "Next round id that will be assigned (so total rounds = nextRoundId - 1).",
  },
  predictionRound_roundOf: {
    inputs: ["uint256"],
    outputs: ["tuple"],
    description:
      "Full round metadata (questionHash, deadlines, outcome, resolved status, totalPool, totalCommits, totalRevealed).",
  },
};

const FUNCTION_ABIS: Record<string, readonly unknown[]> = {
  agentGenome_totalMinted: [
    {
      type: "function",
      name: "totalMinted",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256" }],
    },
  ],
  agentGenome_ownerOf: [
    {
      type: "function",
      name: "ownerOf",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [{ type: "address" }],
    },
  ],
  agentGenome_rootHashOf: [
    {
      type: "function",
      name: "rootHashOf",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [{ type: "bytes32" }],
    },
  ],
  agentMemory_shardCountOf: [
    {
      type: "function",
      name: "shardCountOf",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [{ type: "uint256" }],
    },
  ],
  reputationOracle_scoreOf: [
    {
      type: "function",
      name: "scoreOf",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [{ type: "int256" }],
    },
  ],
  reputationOracle_averageScoreOf: [
    {
      type: "function",
      name: "averageScoreOf",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [{ type: "int256" }],
    },
  ],
  reputationOracle_roundCountOf: [
    {
      type: "function",
      name: "roundCountOf",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [{ type: "uint256" }],
    },
  ],
  predictionRound_nextRoundId: [
    {
      type: "function",
      name: "nextRoundId",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256" }],
    },
  ],
  predictionRound_roundOf: [
    {
      type: "function",
      name: "roundOf",
      stateMutability: "view",
      inputs: [{ type: "uint256" }],
      outputs: [
        {
          type: "tuple",
          components: [
            { name: "questionHash", type: "bytes32" },
            { name: "commitDeadline", type: "uint64" },
            { name: "revealDeadline", type: "uint64" },
            { name: "entryFee", type: "uint256" },
            { name: "totalPool", type: "uint256" },
            { name: "totalCommits", type: "uint256" },
            { name: "totalRevealed", type: "uint256" },
            { name: "outcome", type: "uint16" },
            { name: "resolved", type: "bool" },
          ],
        },
      ],
    },
  ],
};

export interface ReadOnChainOptions {
  publicClient: PublicClient;
  addresses: {
    agentGenome: `0x${string}`;
    agentMemory: `0x${string}`;
    reputationOracle: `0x${string}`;
    predictionRound: `0x${string}`;
  };
}

function describeFunctions(): string {
  return Object.entries(KNOWN_FUNCTIONS)
    .map(
      ([k, v]) =>
        `${k}(${v.inputs.join(", ") || ""}) -> ${v.outputs.join(", ")} — ${v.description}`
    )
    .join("\n");
}

export function createReadOnChainTool(opts: ReadOnChainOptions): Tool {
  const description = [
    "Read state directly from the 0G Chain smart contracts. Use this for verifiable, current chain facts:",
    "agent ownership, root hashes, memory shard counts, reputation scores, round metadata.",
    "",
    "Available functions:",
    describeFunctions(),
    "",
    "Pass the function name in `function` and the args as a JSON array string in `args` (e.g. '[1]' or '[]').",
  ].join("\n");

  return {
    name: "read_on_chain",
    description,
    parameters: {
      type: "object",
      properties: {
        function: {
          type: "string",
          description: "Function name from the list above (e.g. 'agentGenome_ownerOf').",
        },
        args: {
          type: "string",
          description: "JSON array of arguments matching the function inputs (e.g. '[1]' for tokenId).",
        },
      },
      required: ["function", "args"],
    },
    async execute(args, ctx): Promise<ToolResult> {
      const fnName = String(args.function ?? "");
      const argsRaw = String(args.args ?? "[]");
      ctx.logger?.info?.("tool read_on_chain", { fn: fnName });

      const spec = KNOWN_FUNCTIONS[fnName];
      const abi = FUNCTION_ABIS[fnName];
      if (!spec || !abi) {
        return {
          ok: false,
          summary: `unknown function "${fnName}"`,
          error: `valid functions: ${Object.keys(KNOWN_FUNCTIONS).join(", ")}`,
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(argsRaw);
      } catch {
        return { ok: false, summary: "invalid args JSON", error: argsRaw };
      }
      if (!Array.isArray(parsed)) {
        return { ok: false, summary: "args must be a JSON array", error: argsRaw };
      }
      if (parsed.length !== spec.inputs.length) {
        return {
          ok: false,
          summary: `expected ${spec.inputs.length} args, got ${parsed.length}`,
          error: argsRaw,
        };
      }

      const [contractAlias] = fnName.split("_") as [keyof typeof opts.addresses];
      const address =
        contractAlias === "agentGenome"
          ? opts.addresses.agentGenome
          : contractAlias === "agentMemory"
            ? opts.addresses.agentMemory
            : contractAlias === "reputationOracle"
              ? opts.addresses.reputationOracle
              : contractAlias === "predictionRound"
                ? opts.addresses.predictionRound
                : undefined;
      if (!address || !isAddress(address)) {
        return { ok: false, summary: `bad contract alias "${contractAlias}"`, error: "no address" };
      }

      const coerced = parsed.map((v, i) => {
        const t = spec.inputs[i];
        if (t === "uint256" || t === "int256" || t === "uint64") {
          if (typeof v === "string" || typeof v === "number") return BigInt(v);
          return v;
        }
        return v;
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const result = await opts.publicClient.readContract({
          address,
          abi: abi as never,
          functionName: fnName.split("_")[1]!,
          args: coerced as never,
        });
        const summary = formatResult(fnName, result);
        return {
          ok: true,
          summary,
          data: { function: fnName, args: parsed, result: stringifyBig(result) },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, summary: `${fnName} reverted`, error: message.split("\n")[0] };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function stringifyBig(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(stringifyBig);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stringifyBig(v);
    }
    return out;
  }
  return value;
}

function formatResult(fnName: string, value: unknown): string {
  const s = stringifyBig(value);
  return `${fnName} => ${JSON.stringify(s)}`;
}
